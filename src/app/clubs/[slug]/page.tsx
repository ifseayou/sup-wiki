import Link from 'next/link';
import { notFound } from 'next/navigation';
import pool from '@/lib/db';
import { clubRoleLabels, parseJsonArray, professionalRoleLabels, statusLabel, verificationLabels } from '@/lib/industry-utils';
import type { RowDataPacket } from 'mysql2';

export const dynamic = 'force-dynamic';

interface ClubDetail extends RowDataPacket {
  club_id: number;
  slug: string;
  name: string;
  logo: string | null;
  cover_image: string | null;
  images: string | null;
  province: string | null;
  city: string | null;
  district: string | null;
  address: string | null;
  water_area_name: string | null;
  water_type: string | null;
  intro: string | null;
  services: string | null;
  safety_facilities: string | null;
  training_environment: string | null;
  opening_hours: string | null;
  contact_method: string | null;
  verification_status: string;
  claim_status: string;
}

async function getClub(slug: string) {
  const [rows] = await pool.execute<ClubDetail[]>(
    'SELECT * FROM sup_clubs WHERE slug = ? AND status = "published" LIMIT 1',
    [slug]
  );
  return rows[0] || null;
}

async function getMembers(clubId: number) {
  try {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT cm.*, p.name AS professional_name, p.avatar AS professional_avatar, p.primary_role,
              a.name AS athlete_name, a.photo AS athlete_photo
       FROM sup_club_members cm
       LEFT JOIN sup_professionals p ON p.professional_id = cm.professional_id
       LEFT JOIN sup_athletes a ON a.athlete_id = cm.athlete_id
       WHERE cm.club_id = ? AND cm.status = 'published' AND cm.join_status = 'approved' AND cm.is_public = 1
       ORDER BY FIELD(cm.role, 'owner', 'coach', 'referee', 'athlete', 'member'), cm.member_id DESC
       LIMIT 18`,
      [clubId]
    );
    return rows;
  } catch {
    return [];
  }
}

async function getCourses(clubId: number) {
  try {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT co.course_id, co.slug, co.title, co.subtitle, co.cover_image, co.price_display, co.duration_minutes
       FROM sup_club_courses cc
       JOIN sup_courses co ON co.course_id = cc.course_id
       WHERE cc.club_id = ? AND cc.status = 'published' AND co.status = 'published'
       ORDER BY cc.sort_order ASC, co.sort_order ASC
       LIMIT 6`,
      [clubId]
    );
    return rows;
  } catch {
    return [];
  }
}

async function getResults(clubId: number) {
  try {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT e.event_id, e.slug, e.name AS event_name, e.start_date,
              COUNT(DISTINCT r.result_id) AS result_count,
              SUM(CASE WHEN r.rank_position BETWEEN 1 AND 3 THEN 1 ELSE 0 END) AS podium_count,
              COUNT(DISTINCT COALESCE(r.athlete_id, r.athlete_name_snapshot)) AS athlete_count
       FROM (
         SELECT r.result_id
         FROM sup_event_results r
         INNER JOIN sup_club_members cm ON cm.athlete_id = r.athlete_id
         WHERE cm.club_id = ? AND cm.status = 'published' AND cm.join_status = 'approved' AND cm.is_public = 1 AND r.is_verified = 1
         UNION
         SELECT r.result_id
         FROM sup_event_results r
         INNER JOIN sup_club_team_aliases a ON a.normalized_name = r.team_name_normalized
         WHERE a.club_id = ? AND a.match_status = 'confirmed' AND r.is_verified = 1
       ) linked
       INNER JOIN sup_event_results r ON r.result_id = linked.result_id
       INNER JOIN sup_events e ON e.event_id = r.event_id
       GROUP BY e.event_id, e.slug, e.name, e.start_date
       ORDER BY e.start_date DESC, result_count DESC
       LIMIT 8`,
      [clubId, clubId]
    );
    return rows;
  } catch {
    return [];
  }
}

async function getTeamAliases(clubId: number) {
  try {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT alias_id, team_name_raw, result_count, event_count, athlete_count
       FROM sup_club_team_aliases
       WHERE club_id = ? AND match_status = 'confirmed'
       ORDER BY result_count DESC, team_name_raw ASC
       LIMIT 16`,
      [clubId]
    );
    return rows;
  } catch {
    return [];
  }
}

function InfoTags({ items, tone = 'brown' }: { items: string[]; tone?: 'brown' | 'green' }) {
  if (items.length === 0) return <span className="text-sm text-[#8A8078]">待补充</span>;
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => <span key={item} className={`rounded-full px-3 py-1 text-xs ${tone === 'green' ? 'bg-[#EEF3E8] text-[#516B47]' : 'bg-[#F2E8D9] text-[#7A6145]'}`}>{item}</span>)}
    </div>
  );
}

function MemberName({ row }: { row: RowDataPacket }) {
  const name = row.professional_name || row.athlete_name || `成员 #${row.member_id}`;
  const avatar = row.professional_avatar || row.athlete_photo;
  return (
    <div className="flex items-center gap-3 rounded-xl border border-[#E8DDCE] bg-white/70 p-3">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#E9DDCF] text-sm font-semibold text-[#7A6145]">
        {avatar ? <img src={String(avatar)} alt="" className="h-full w-full object-cover" /> : String(name).slice(0, 1)}
      </div>
      <div>
        <div className="font-semibold text-[#2E2118]">{String(name)}</div>
        <div className="mt-0.5 text-xs text-[#8A8078]">{clubRoleLabels[String(row.role)] || '成员'}{row.primary_role ? ` · ${professionalRoleLabels[String(row.primary_role)] || row.primary_role}` : ''}</div>
      </div>
    </div>
  );
}

export default async function ClubDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const club = await getClub(slug);
  if (!club) notFound();
  const [members, courses, results, teamAliases] = await Promise.all([
    getMembers(club.club_id),
    getCourses(club.club_id),
    getResults(club.club_id),
    getTeamAliases(club.club_id),
  ]);
  const services = parseJsonArray(club.services);
  const safety = parseJsonArray(club.safety_facilities);
  const environment = parseJsonArray(club.training_environment);
  const images = parseJsonArray(club.images);
  return (
    <main className="min-h-screen bg-[#F7F1E8] text-[#2E2118]">
      <section className="relative overflow-hidden border-b border-[#E2D5C5]">
        <div className="absolute inset-0 bg-[#2E2118]">
          {club.cover_image ? <img src={club.cover_image} alt="" className="h-full w-full object-cover opacity-55" /> : <div className="h-full w-full bg-[radial-gradient(circle_at_70%_35%,#8A612F,transparent_34%),linear-gradient(120deg,#2E2118,#65492F)]" />}
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-[#2E2118]/80 via-[#2E2118]/45 to-[#2E2118]/20" />
        <div className="relative mx-auto max-w-[1280px] px-4 py-16 sm:px-6 lg:px-8">
          <Link href="/clubs" className="text-sm text-[#E8D7C0] no-underline">← 返回俱乐部库</Link>
          <div className="mt-10 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border border-white/45 bg-white text-xl font-semibold text-[#7A6145]">
                  {club.logo ? <img src={club.logo} alt="" className="h-full w-full object-contain p-2" /> : club.name.slice(0, 1)}
                </div>
                <span className="rounded-full bg-white/88 px-3 py-1 text-xs font-medium text-[#7A6145]">{statusLabel(club.verification_status, verificationLabels)}</span>
                <span className="rounded-full bg-[#F6E8D6] px-3 py-1 text-xs font-medium text-[#7A5530]">{club.claim_status === 'claimed' ? '已认领' : '待认领'}</span>
              </div>
              <h1 className="font-[var(--font-display)] text-5xl font-semibold leading-none text-white sm:text-6xl">{club.name}</h1>
              <p className="mt-4 text-base text-[#E8D7C0]">{[club.province, club.city, club.district, club.water_area_name].filter(Boolean).join(' · ') || '位置待补充'}</p>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center text-white">
              <div className="rounded-2xl border border-white/20 bg-white/12 p-4 backdrop-blur"><div className="text-2xl font-semibold">{members.length}</div><div className="text-xs text-[#E8D7C0]">公开成员</div></div>
              <div className="rounded-2xl border border-white/20 bg-white/12 p-4 backdrop-blur"><div className="text-2xl font-semibold">{results.reduce((sum, row) => sum + Number(row.result_count || 0), 0)}</div><div className="text-xs text-[#E8D7C0]">关联成绩</div></div>
              <div className="rounded-2xl border border-white/20 bg-white/12 p-4 backdrop-blur"><div className="text-2xl font-semibold">{results.length}</div><div className="text-xs text-[#E8D7C0]">关联赛事</div></div>
            </div>
          </div>
        </div>
      </section>
      <div className="mx-auto max-w-[1280px] px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <section className="rounded-2xl border border-[#E2D5C5] bg-white/78 p-6 shadow-[0_14px_36px_rgba(69,45,22,0.08)]">
            <h2 className="text-2xl font-semibold">俱乐部主页</h2>
            <p className="mt-4 text-sm leading-7 text-[#655D56]">{club.intro || '俱乐部资料正在整理中，欢迎负责人认领后补充更多信息。'}</p>
            <div className="mt-6 grid gap-5 md:grid-cols-3">
              <div><h3 className="mb-3 text-sm font-semibold">服务项目</h3><InfoTags items={services} /></div>
              <div><h3 className="mb-3 text-sm font-semibold">安全保障</h3><InfoTags items={safety} tone="green" /></div>
              <div><h3 className="mb-3 text-sm font-semibold">训练环境</h3><InfoTags items={environment} /></div>
            </div>
            {images.length > 0 && (
              <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
                {images.slice(0, 8).map((image) => <img key={image} src={image} alt="" className="aspect-[4/3] rounded-xl object-cover" />)}
              </div>
            )}
          </section>
          <aside className="rounded-2xl border border-[#E2D5C5] bg-[#FEFCF9] p-6 shadow-[0_14px_36px_rgba(69,45,22,0.08)]">
            <h2 className="text-lg font-semibold">联系与到达</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div><dt className="text-[#8A8078]">水域</dt><dd className="mt-1 font-medium">{club.water_area_name || '待补充'}{club.water_type ? ` · ${club.water_type}` : ''}</dd></div>
              <div><dt className="text-[#8A8078]">地址</dt><dd className="mt-1 font-medium">{club.address || '待补充'}</dd></div>
              <div><dt className="text-[#8A8078]">开放时间</dt><dd className="mt-1 font-medium">{club.opening_hours || '请联系俱乐部确认'}</dd></div>
              <div><dt className="text-[#8A8078]">联系方式</dt><dd className="mt-1 font-medium">{club.contact_method || '待认领后公开'}</dd></div>
            </dl>
            {club.claim_status !== 'claimed' && (
              <Link href={`/clubs/claim?club_id=${club.club_id}&club_name=${encodeURIComponent(club.name)}`} className="mt-5 inline-flex w-full justify-center rounded-xl bg-[#7A5530] px-4 py-3 text-sm font-semibold text-white no-underline">认领这个俱乐部</Link>
            )}
          </aside>
        </div>

        {teamAliases.length > 0 && (
          <section className="mt-8 rounded-2xl border border-[#E2D5C5] bg-white/78 p-6">
            <h2 className="text-2xl font-semibold">关联队伍名</h2>
            <p className="mt-2 text-sm text-[#8A8078]">以下队伍名来自赛事成绩册，已确认归属到本俱乐部。</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {teamAliases.map((alias) => (
                <span key={String(alias.alias_id)} className="rounded-full bg-[#F2E8D9] px-3 py-1.5 text-xs text-[#7A6145]">
                  {alias.team_name_raw} · {Number(alias.result_count || 0)} 条成绩
                </span>
              ))}
            </div>
          </section>
        )}

        {courses.length > 0 && (
          <section className="mt-8">
            <h2 className="mb-4 text-2xl font-semibold">课程服务</h2>
            <div className="grid gap-4 md:grid-cols-3">
              {courses.map((course) => (
                <Link href={`/courses/${course.slug}`} key={course.course_id} className="rounded-2xl border border-[#E2D5C5] bg-white/78 p-5 text-[#2E2118] no-underline shadow-[0_12px_28px_rgba(69,45,22,0.06)]">
                  <div className="text-lg font-semibold">{course.title}</div>
                  <p className="mt-2 text-sm text-[#655D56]">{course.subtitle || course.price_display || '课程详情'}</p>
                </Link>
              ))}
            </div>
          </section>
        )}

        {members.length > 0 && (
          <section className="mt-8">
            <h2 className="mb-4 text-2xl font-semibold">公开成员</h2>
            <div className="grid gap-3 md:grid-cols-3">
              {members.map((row) => <MemberName key={String(row.member_id)} row={row} />)}
            </div>
          </section>
        )}

        {results.length > 0 && (
          <section className="mt-8 rounded-2xl border border-[#E2D5C5] bg-white/78 p-6">
            <h2 className="text-2xl font-semibold">俱乐部战绩</h2>
            <div className="mt-4 divide-y divide-[#E8DDCE]">
              {results.map((row) => (
                <Link href={`/events/${row.slug}`} key={String(row.event_id)} className="grid gap-3 py-4 text-[#2E2118] no-underline md:grid-cols-[1fr_repeat(3,110px)] md:items-center">
                  <div>
                    <div className="font-semibold">{row.event_name}</div>
                    <div className="mt-1 text-xs text-[#8A8078]">{row.start_date ? String(row.start_date).slice(0, 10) : '日期待补充'}</div>
                  </div>
                  <div><span className="text-lg font-semibold">{Number(row.athlete_count || 0)}</span><span className="ml-1 text-xs text-[#8A8078]">人参赛</span></div>
                  <div><span className="text-lg font-semibold">{Number(row.result_count || 0)}</span><span className="ml-1 text-xs text-[#8A8078]">条成绩</span></div>
                  <div><span className="text-lg font-semibold">{Number(row.podium_count || 0)}</span><span className="ml-1 text-xs text-[#8A8078]">前三</span></div>
                </Link>
              ))}
            </div>
          </section>
        )}

        <p className="mt-8 text-xs leading-6 text-[#8A8078]">水上运动存在风险，请根据天气、水域、身体状况和专业人员建议参与活动。页面资料来自公开资料、管理员整理或用户补充，具体培训、收费和安全责任以实际服务方说明为准。</p>
      </div>
    </main>
  );
}
