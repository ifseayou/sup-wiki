import Link from 'next/link';
import pool from '@/lib/db';
import { parseJsonArray, professionalRoleLabels, roleLabel, statusLabel, verificationLabels } from '@/lib/industry-utils';
import type { RowDataPacket } from 'mysql2';

export const dynamic = 'force-dynamic';

interface ProfessionalRow extends RowDataPacket {
  professional_id: number;
  name: string;
  avatar: string | null;
  province: string | null;
  city: string | null;
  roles: string | null;
  primary_role: string;
  club_id: number | null;
  club_name: string | null;
  bio: string | null;
  intro_short: string | null;
  specialties: string | null;
  service_items: string | null;
  verification_status: string;
  certificate_count: number;
  event_role_count: number;
  course_count: number;
}

async function getProfessionals(params: { search?: string; role?: string; city?: string }) {
  try {
    const conditions = ["p.status = 'published'"];
    const values: string[] = [];
    if (params.search) {
      conditions.push('(p.name LIKE ? OR p.bio LIKE ? OR p.intro_short LIKE ? OR c.name LIKE ?)');
      const like = `%${params.search}%`;
      values.push(like, like, like, like);
    }
    if (params.role) {
      conditions.push('(p.primary_role = ? OR JSON_SEARCH(p.roles, "one", ?) IS NOT NULL)');
      values.push(params.role, params.role);
    }
    if (params.city) {
      conditions.push('p.city = ?');
      values.push(params.city);
    }
    const [rows] = await pool.execute<ProfessionalRow[]>(
      `SELECT p.*, c.name AS club_name,
              COALESCE(cert.certificate_count, 0) AS certificate_count,
              COALESCE(er.event_role_count, 0) AS event_role_count,
              COALESCE(cl.course_count, 0) AS course_count
       FROM sup_professionals p
       LEFT JOIN sup_clubs c ON c.club_id = p.club_id
       LEFT JOIN (
         SELECT professional_id, COUNT(*) AS certificate_count
         FROM sup_professional_certificates
         WHERE status = 'published'
         GROUP BY professional_id
       ) cert ON cert.professional_id = p.professional_id
       LEFT JOIN (
         SELECT professional_id, COUNT(*) AS event_role_count
         FROM sup_professional_event_roles
         WHERE status = 'published'
         GROUP BY professional_id
       ) er ON er.professional_id = p.professional_id
       LEFT JOIN (
         SELECT professional_id, COUNT(*) AS course_count
         FROM sup_professional_course_links
         WHERE status = 'published'
         GROUP BY professional_id
       ) cl ON cl.professional_id = p.professional_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY p.sort_order ASC, p.verification_status = 'verified' DESC, p.professional_id DESC
       LIMIT 80`,
      values
    );
    return rows;
  } catch (error) {
    console.error('获取专业人员列表失败:', error);
    return [];
  }
}

async function getStats() {
  try {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT
         COUNT(*) AS total,
         SUM(CASE WHEN primary_role = 'coach' THEN 1 ELSE 0 END) AS coaches,
         SUM(CASE WHEN primary_role = 'referee' THEN 1 ELSE 0 END) AS referees,
         SUM(CASE WHEN verification_status = 'verified' THEN 1 ELSE 0 END) AS verified
       FROM sup_professionals
       WHERE status = 'published'`
    );
    return rows[0] || { total: 0, coaches: 0, referees: 0, verified: 0 };
  } catch {
    return { total: 0, coaches: 0, referees: 0, verified: 0 };
  }
}

async function getCities() {
  try {
    const [rows] = await pool.execute<RowDataPacket[]>('SELECT DISTINCT city FROM sup_professionals WHERE status = "published" AND city IS NOT NULL AND city <> "" ORDER BY city ASC');
    return rows.map((row) => String(row.city));
  } catch {
    return [];
  }
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-[#E4D7C7] bg-white/70 p-5 shadow-[0_14px_32px_rgba(69,45,22,0.08)]">
      <div className="text-xs tracking-[0.22em] text-[#A78960]">{label}</div>
      <div className="mt-2 text-3xl font-semibold text-[#2E2118]">{value}</div>
    </div>
  );
}

function ProfessionalCard({ item }: { item: ProfessionalRow }) {
  const specialties = parseJsonArray(item.specialties).slice(0, 4);
  const services = parseJsonArray(item.service_items).slice(0, 3);
  return (
    <Link href={`/professionals/${item.professional_id}`} className="block rounded-2xl border border-[#E1D5C7] bg-[#FEFCF9] p-5 text-[#2E2118] no-underline shadow-[0_16px_36px_rgba(69,45,22,0.08)] transition hover:-translate-y-1 hover:shadow-[0_22px_46px_rgba(69,45,22,0.12)]">
      <div className="flex items-start gap-4">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-[#E9DDCF] text-xl font-semibold text-[#7A6145]">
          {item.avatar ? <img src={item.avatar} alt="" className="h-full w-full object-cover" /> : item.name.slice(0, 1)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-semibold leading-tight">{item.name}</h2>
            <span className="rounded-full bg-[#F2E8D9] px-3 py-1 text-xs text-[#7A6145]">{roleLabel(item.primary_role)}</span>
            <span className="rounded-full bg-[#EEF3E8] px-3 py-1 text-xs text-[#516B47]">{statusLabel(item.verification_status, verificationLabels)}</span>
          </div>
          <p className="mt-2 text-sm text-[#8A8078]">{[item.city, item.club_name].filter(Boolean).join(' · ') || '城市 / 俱乐部待补充'}</p>
        </div>
      </div>
      <p className="mt-4 line-clamp-2 min-h-11 text-sm leading-6 text-[#655D56]">{item.intro_short || item.bio || '专业档案正在整理中，可通过认领补充资质、服务和经历。'}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {[...specialties, ...services].slice(0, 6).map((tag) => <span key={tag} className="rounded-full bg-[#F7F1E8] px-3 py-1 text-xs text-[#7A6145]">{tag}</span>)}
      </div>
      <div className="mt-5 grid grid-cols-3 gap-2 border-t border-[#E8DDCE] pt-4 text-center">
        <div><div className="text-lg font-semibold">{Number(item.certificate_count || 0)}</div><div className="text-[11px] text-[#8A8078]">证书</div></div>
        <div><div className="text-lg font-semibold">{Number(item.course_count || 0)}</div><div className="text-[11px] text-[#8A8078]">课程</div></div>
        <div><div className="text-lg font-semibold">{Number(item.event_role_count || 0)}</div><div className="text-[11px] text-[#8A8078]">执裁/赛事</div></div>
      </div>
    </Link>
  );
}

export default async function ProfessionalsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; role?: string; city?: string }>;
}) {
  const params = await searchParams;
  const search = params.search?.trim();
  const [professionals, stats, cities] = await Promise.all([
    getProfessionals({ ...params, search }),
    getStats(),
    getCities(),
  ]);
  return (
    <main className="min-h-screen bg-[#F7F1E8] text-[#2E2118]">
      <section className="relative overflow-hidden border-b border-[#E8DDCE] bg-[#F7F1E8]">
        <div className="absolute inset-0 opacity-80" style={{ background: 'radial-gradient(circle at 78% 28%, rgba(108,132,95,0.22), transparent 30%), radial-gradient(circle at 20% 18%, rgba(188,145,84,0.24), transparent 34%)' }} />
        <div className="relative mx-auto max-w-[1440px] px-4 py-12 sm:px-6 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-[1fr_560px] lg:items-end">
            <div>
              <p className="tracking-[0.34em] text-[#A78960]">PROFESSIONAL NETWORK</p>
              <h1 className="mt-3 font-[var(--font-display)] text-5xl font-semibold leading-none text-[#2E2118] sm:text-6xl">专业人员库</h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-[#655D56]">收录桨板教练员、裁判员、讲师、赛事组织者和安全救援人员，沉淀资质、课程、执裁与俱乐部关系。</p>
              <div className="mt-6 hidden lg:flex">
                <Link href="/join?type=professional" className="rounded-full bg-[#7A5530] px-5 py-3 text-sm font-semibold text-white no-underline shadow-[0_14px_32px_rgba(122,85,48,0.22)]">教练 / 裁判入驻</Link>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatCard label="总人数" value={Number(stats.total || 0)} />
              <StatCard label="教练员" value={Number(stats.coaches || 0)} />
              <StatCard label="裁判员" value={Number(stats.referees || 0)} />
              <StatCard label="已核验" value={Number(stats.verified || 0)} />
            </div>
          </div>
        </div>
      </section>
      <div className="mx-auto max-w-[1440px] px-4 py-8 sm:px-6 lg:px-8">
        <section className="mb-7 rounded-2xl border border-[#E3D6C6] bg-white/76 p-4 shadow-[0_14px_36px_rgba(69,45,22,0.08)]">
          <form action="/professionals" className="grid gap-3 md:grid-cols-[1fr_180px_180px_auto]">
            <input name="search" defaultValue={search || ''} placeholder="搜索姓名 / 俱乐部 / 擅长方向" className="h-12 rounded-xl border border-[#E3D6C6] bg-white px-4 text-sm outline-none focus:border-[#B58A48]" />
            <select name="role" defaultValue={params.role || ''} className="h-12 rounded-xl border border-[#E3D6C6] bg-white px-4 text-sm">
              <option value="">全部身份</option>
              {Object.entries(professionalRoleLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <select name="city" defaultValue={params.city || ''} className="h-12 rounded-xl border border-[#E3D6C6] bg-white px-4 text-sm">
              <option value="">全部城市</option>
              {cities.map((city) => <option key={city} value={city}>{city}</option>)}
            </select>
            <button className="h-12 rounded-xl bg-[#7A5530] px-6 text-sm font-semibold text-white">查询</button>
          </form>
          <div className="mt-3 flex flex-wrap gap-2">
            {['coach', 'referee', 'lecturer', 'rescue'].map((role) => (
              <Link key={role} href={`/professionals?role=${params.role === role ? '' : role}`} className={`rounded-full px-3 py-1.5 text-xs no-underline ${params.role === role ? 'bg-[#7A5530] text-white' : 'bg-[#F2E8D9] text-[#7A6145]'}`}>{professionalRoleLabels[role]}</Link>
            ))}
            {(search || params.role || params.city) && <Link href="/professionals" className="rounded-full px-3 py-1.5 text-xs text-[#A08060] no-underline">清除筛选</Link>}
          </div>
        </section>
        {professionals.length > 0 ? (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {professionals.map((item) => <ProfessionalCard key={item.professional_id} item={item} />)}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-[#D8C8B6] bg-white/60 p-10 text-center text-[#8A8078]">暂无符合条件的专业人员资料。</div>
        )}
        <p className="mt-8 text-xs leading-6 text-[#8A8078]">本页面为 SUP Wiki 收录和用户共建资料。除明确标注外，平台仅核验资料完整性，不等同于官方资质认证。</p>
      </div>
    </main>
  );
}
