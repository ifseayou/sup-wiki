import Link from 'next/link';
import { notFound } from 'next/navigation';
import pool from '@/lib/db';
import { claimLabels, parseJsonArray, professionalRoleLabels, roleLabel, statusLabel, verificationLabels } from '@/lib/industry-utils';
import type { RowDataPacket } from 'mysql2';

export const dynamic = 'force-dynamic';

async function getProfessional(id: number) {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT p.*, c.name AS club_name, c.slug AS club_slug
     FROM sup_professionals p
     LEFT JOIN sup_clubs c ON c.club_id = p.club_id
     WHERE p.professional_id = ? AND p.status = 'published'
     LIMIT 1`,
    [id]
  );
  return rows[0] || null;
}

async function getCertificates(id: number) {
  try {
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT * FROM sup_professional_certificates WHERE professional_id = ? AND status = "published" ORDER BY expiry_date IS NULL, expiry_date DESC, certificate_id DESC LIMIT 12',
      [id]
    );
    return rows;
  } catch {
    return [];
  }
}

async function getEventRoles(id: number) {
  try {
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT * FROM sup_professional_event_roles WHERE professional_id = ? AND status = "published" ORDER BY year DESC, role_id DESC LIMIT 12',
      [id]
    );
    return rows;
  } catch {
    return [];
  }
}

async function getCourseLinks(id: number) {
  try {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT cl.*, co.slug AS course_slug
       FROM sup_professional_course_links cl
       LEFT JOIN sup_courses co ON co.course_id = cl.course_id
       WHERE cl.professional_id = ? AND cl.status = 'published'
       ORDER BY cl.record_date DESC, cl.link_id DESC
       LIMIT 12`,
      [id]
    );
    return rows;
  } catch {
    return [];
  }
}

function TagList({ items }: { items: string[] }) {
  if (items.length === 0) return <span className="text-sm text-[#8A8078]">待补充</span>;
  return <div className="flex flex-wrap gap-2">{items.map((item) => <span key={item} className="rounded-full bg-[#F2E8D9] px-3 py-1 text-xs text-[#7A6145]">{item}</span>)}</div>;
}

export default async function ProfessionalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: idText } = await params;
  const id = Number(idText);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const professional = await getProfessional(id);
  if (!professional) notFound();
  const [certificates, eventRoles, courseLinks] = await Promise.all([
    getCertificates(id),
    getEventRoles(id),
    getCourseLinks(id),
  ]);
  const roles = parseJsonArray(professional.roles);
  const specialties = parseJsonArray(professional.specialties);
  const services = parseJsonArray(professional.service_items);
  const levels = parseJsonArray(professional.teaching_level);
  const environments = parseJsonArray(professional.teaching_environment);
  return (
    <main className="min-h-screen bg-[#F7F1E8] text-[#2E2118]">
      <section className="relative overflow-hidden border-b border-[#E8DDCE] bg-[#2E2118]">
        <div className="absolute inset-0 opacity-70" style={{ background: 'radial-gradient(circle at 75% 28%, rgba(188,145,84,0.38), transparent 30%), linear-gradient(120deg,#2E2118,#4A3929)' }} />
        <div className="relative mx-auto max-w-[1180px] px-4 py-14 sm:px-6 lg:px-8">
          <Link href="/professionals" className="text-sm text-[#E8D7C0] no-underline">← 返回专业人员库</Link>
          <div className="mt-10 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div className="flex items-start gap-5">
              <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-3xl border border-white/30 bg-white text-3xl font-semibold text-[#7A6145]">
                {professional.avatar ? <img src={professional.avatar} alt="" className="h-full w-full object-cover" /> : String(professional.name).slice(0, 1)}
              </div>
              <div>
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full bg-white/90 px-3 py-1 text-xs text-[#7A6145]">{roleLabel(professional.primary_role)}</span>
                  <span className="rounded-full bg-[#EEF3E8] px-3 py-1 text-xs text-[#516B47]">{statusLabel(professional.verification_status, verificationLabels)}</span>
                  <span className="rounded-full bg-white/20 px-3 py-1 text-xs text-white">{statusLabel(professional.claim_status, claimLabels)}</span>
                </div>
                <h1 className="mt-4 font-[var(--font-display)] text-5xl font-semibold leading-none text-white">{professional.name}</h1>
                <p className="mt-4 text-sm text-[#E8D7C0]">{[professional.city, professional.club_name].filter(Boolean).join(' · ') || '城市 / 俱乐部待补充'}</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center text-white">
              <div className="rounded-2xl border border-white/20 bg-white/12 p-4 backdrop-blur"><div className="text-2xl font-semibold">{certificates.length}</div><div className="text-xs text-[#E8D7C0]">证书</div></div>
              <div className="rounded-2xl border border-white/20 bg-white/12 p-4 backdrop-blur"><div className="text-2xl font-semibold">{courseLinks.length}</div><div className="text-xs text-[#E8D7C0]">课程</div></div>
              <div className="rounded-2xl border border-white/20 bg-white/12 p-4 backdrop-blur"><div className="text-2xl font-semibold">{eventRoles.length}</div><div className="text-xs text-[#E8D7C0]">赛事经历</div></div>
            </div>
          </div>
        </div>
      </section>
      <div className="mx-auto max-w-[1180px] px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          <section className="rounded-2xl border border-[#E2D5C5] bg-white/78 p-6 shadow-[0_14px_36px_rgba(69,45,22,0.08)]">
            <h2 className="text-2xl font-semibold">专业档案</h2>
            <p className="mt-4 text-sm leading-7 text-[#655D56]">{professional.bio || professional.intro_short || '专业档案正在整理中，待本人认领或管理员补充资质、课程和经历。'}</p>
            <div className="mt-6 grid gap-5 md:grid-cols-2">
              <div><h3 className="mb-3 text-sm font-semibold">身份标签</h3><TagList items={roles.length ? roles.map((role) => professionalRoleLabels[role] || role) : [roleLabel(professional.primary_role)]} /></div>
              <div><h3 className="mb-3 text-sm font-semibold">擅长方向</h3><TagList items={specialties} /></div>
              <div><h3 className="mb-3 text-sm font-semibold">服务项目</h3><TagList items={services} /></div>
              <div><h3 className="mb-3 text-sm font-semibold">教学环境</h3><TagList items={[...levels, ...environments]} /></div>
            </div>
          </section>
          <aside className="rounded-2xl border border-[#E2D5C5] bg-[#FEFCF9] p-6 shadow-[0_14px_36px_rgba(69,45,22,0.08)]">
            <h2 className="text-lg font-semibold">关联信息</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div><dt className="text-[#8A8078]">所属俱乐部</dt><dd className="mt-1 font-medium">{professional.club_slug ? <Link href={`/clubs/${professional.club_slug}`} className="text-[#7A5530] no-underline">{professional.club_name}</Link> : professional.club_name || '待补充'}</dd></div>
              <div><dt className="text-[#8A8078]">所在城市</dt><dd className="mt-1 font-medium">{[professional.province, professional.city].filter(Boolean).join(' / ') || '待补充'}</dd></div>
              <div><dt className="text-[#8A8078]">联系方式</dt><dd className="mt-1 font-medium">{professional.contact_visible ? (professional.wechat_contact || professional.phone_masked || '待补充') : '未公开'}</dd></div>
            </dl>
            <div className="mt-6 rounded-xl bg-[#F7F1E8] p-4 text-xs leading-6 text-[#7A6145]">专业人员可通过认领补充证书、执教经历、服务项目和联系方式。</div>
          </aside>
        </div>

        {certificates.length > 0 && (
          <section className="mt-8 rounded-2xl border border-[#E2D5C5] bg-white/78 p-6">
            <h2 className="text-2xl font-semibold">资质证书</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {certificates.map((cert) => (
                <div key={String(cert.certificate_id)} className="rounded-xl border border-[#E8DDCE] bg-[#FEFCF9] p-4">
                  <div className="font-semibold">{cert.certificate_name}</div>
                  <div className="mt-2 text-sm text-[#655D56]">{[cert.certificate_type, cert.certificate_level, cert.issuer].filter(Boolean).join(' · ') || '证书信息待补充'}</div>
                  <div className="mt-3 text-xs text-[#8A8078]">有效期：{cert.issue_date ? String(cert.issue_date).slice(0, 10) : '—'} 至 {cert.expiry_date ? String(cert.expiry_date).slice(0, 10) : '—'} · {statusLabel(cert.verification_status, verificationLabels)}</div>
                </div>
              ))}
            </div>
          </section>
        )}

        {courseLinks.length > 0 && (
          <section className="mt-8 rounded-2xl border border-[#E2D5C5] bg-white/78 p-6">
            <h2 className="text-2xl font-semibold">执教 / 课程记录</h2>
            <div className="mt-4 divide-y divide-[#E8DDCE]">
              {courseLinks.map((row) => (
                <div key={String(row.link_id)} className="py-4">
                  <div className="font-semibold">{row.course_slug ? <Link href={`/courses/${row.course_slug}`} className="text-[#2E2118] no-underline">{row.course_name || '课程记录'}</Link> : row.course_name || '课程记录'}</div>
                  <div className="mt-1 text-sm text-[#655D56]">{[row.teaching_type, row.location, row.record_date ? String(row.record_date).slice(0, 10) : ''].filter(Boolean).join(' · ') || '经历信息待补充'}</div>
                </div>
              ))}
            </div>
          </section>
        )}

        {eventRoles.length > 0 && (
          <section className="mt-8 rounded-2xl border border-[#E2D5C5] bg-white/78 p-6">
            <h2 className="text-2xl font-semibold">赛事 / 执裁经历</h2>
            <div className="mt-4 divide-y divide-[#E8DDCE]">
              {eventRoles.map((row) => (
                <div key={String(row.role_id)} className="grid gap-2 py-4 md:grid-cols-[1fr_160px_120px] md:items-center">
                  <div className="font-semibold">{row.event_name || '赛事记录'}</div>
                  <div className="text-sm text-[#655D56]">{row.role_name}</div>
                  <div className="text-sm text-[#8A8078]">{row.year || '年份待补充'}</div>
                </div>
              ))}
            </div>
          </section>
        )}

        <p className="mt-8 text-xs leading-6 text-[#8A8078]">本页面为 SUP Wiki 收录和用户共建资料。证书、经历和服务信息来自公开资料、本人上传或俱乐部补充。平台会尽力核验资料完整性，但不替代官方资质认定。</p>
      </div>
    </main>
  );
}
