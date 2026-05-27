import Link from 'next/link';
import pool from '@/lib/db';
import { parseJsonArray, statusLabel, verificationLabels } from '@/lib/industry-utils';
import type { RowDataPacket } from 'mysql2';

export const dynamic = 'force-dynamic';

interface ClubRow extends RowDataPacket {
  club_id: number;
  slug: string;
  name: string;
  logo: string | null;
  cover_image: string | null;
  province: string | null;
  city: string | null;
  district: string | null;
  water_area_name: string | null;
  water_type: string | null;
  intro: string | null;
  services: string | null;
  safety_facilities: string | null;
  training_environment: string | null;
  claim_status: string;
  verification_status: string;
  member_count: number;
  athlete_count: number;
  professional_count: number;
  result_count: number;
  event_count: number;
}

function buildHref(current: Record<string, string | undefined>, next: Record<string, string | undefined | null>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...current, ...next })) {
    if (value) params.set(key, value);
  }
  const query = params.toString();
  return query ? `/clubs?${query}` : '/clubs';
}

async function getClubs(params: { search?: string; city?: string; province?: string; service?: string }) {
  try {
    const conditions = ["c.status = 'published'"];
    const values: string[] = [];
    if (params.search) {
      conditions.push('(c.name LIKE ? OR c.city LIKE ? OR c.water_area_name LIKE ? OR c.intro LIKE ?)');
      const like = `%${params.search}%`;
      values.push(like, like, like, like);
    }
    if (params.city) {
      conditions.push('c.city = ?');
      values.push(params.city);
    }
    if (params.province) {
      conditions.push('c.province = ?');
      values.push(params.province);
    }
    if (params.service) {
      conditions.push('JSON_SEARCH(c.services, "one", ?) IS NOT NULL');
      values.push(params.service);
    }
    const where = `WHERE ${conditions.join(' AND ')}`;
    const [rows] = await pool.execute<ClubRow[]>(
      `SELECT
         c.*,
         COALESCE(cm.member_count, 0) AS member_count,
         COALESCE(cm.athlete_count, 0) AS athlete_count,
         COALESCE(cm.professional_count, 0) AS professional_count,
         COALESCE(rr.result_count, 0) AS result_count,
         COALESCE(rr.event_count, 0) AS event_count
       FROM sup_clubs c
       LEFT JOIN (
         SELECT club_id,
                COUNT(*) AS member_count,
                COUNT(DISTINCT athlete_id) AS athlete_count,
                COUNT(DISTINCT professional_id) AS professional_count
         FROM sup_club_members
         WHERE status = 'published' AND join_status = 'approved' AND is_public = 1
         GROUP BY club_id
       ) cm ON cm.club_id = c.club_id
       LEFT JOIN (
         SELECT cm.club_id, COUNT(r.result_id) AS result_count, COUNT(DISTINCT r.event_id) AS event_count
         FROM sup_club_members cm
         JOIN sup_event_results r ON r.athlete_id = cm.athlete_id
         WHERE cm.status = 'published' AND cm.join_status = 'approved' AND cm.is_public = 1 AND r.is_verified = 1
         GROUP BY cm.club_id
       ) rr ON rr.club_id = c.club_id
       ${where}
       ORDER BY c.sort_order ASC, result_count DESC, c.club_id DESC
       LIMIT 60`,
      values
    );
    return rows;
  } catch (error) {
    console.error('获取俱乐部列表失败:', error);
    return [];
  }
}

async function getClubStats() {
  try {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT
         COUNT(*) AS total,
         SUM(CASE WHEN verification_status = 'verified' THEN 1 ELSE 0 END) AS verified,
         SUM(CASE WHEN claim_status = 'claimed' THEN 1 ELSE 0 END) AS claimed
       FROM sup_clubs
       WHERE status = 'published'`
    );
    return rows[0] || { total: 0, verified: 0, claimed: 0 };
  } catch {
    return { total: 0, verified: 0, claimed: 0 };
  }
}

async function getOptions() {
  try {
    const [cities] = await pool.execute<RowDataPacket[]>('SELECT DISTINCT city FROM sup_clubs WHERE status = "published" AND city IS NOT NULL AND city <> "" ORDER BY city ASC');
    const [provinces] = await pool.execute<RowDataPacket[]>('SELECT DISTINCT province FROM sup_clubs WHERE status = "published" AND province IS NOT NULL AND province <> "" ORDER BY province ASC');
    return {
      cities: cities.map((row) => String(row.city)),
      provinces: provinces.map((row) => String(row.province)),
    };
  } catch {
    return { cities: [], provinces: [] };
  }
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-white/25 bg-white/12 p-5 text-white shadow-[0_18px_40px_rgba(0,0,0,0.16)] backdrop-blur">
      <div className="text-xs tracking-[0.22em] text-[#D8C3A2]">{label}</div>
      <div className="mt-2 text-3xl font-semibold">{value}</div>
    </div>
  );
}

function ClubCard({ club }: { club: ClubRow }) {
  const services = parseJsonArray(club.services).slice(0, 4);
  const safety = parseJsonArray(club.safety_facilities).slice(0, 3);
  return (
    <Link href={`/clubs/${club.slug}`} className="group block overflow-hidden rounded-2xl border border-[#E1D5C7] bg-[#FEFCF9] text-[#2E2118] no-underline shadow-[0_16px_36px_rgba(69,45,22,0.08)] transition hover:-translate-y-1 hover:shadow-[0_22px_46px_rgba(69,45,22,0.13)]">
      <div className="relative h-40 bg-[#E9DDCF]">
        {club.cover_image ? (
          <img src={club.cover_image} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center bg-[radial-gradient(circle_at_30%_30%,#F7E7CF,transparent_35%),linear-gradient(135deg,#D8C5AA,#F6EFE6)] text-5xl">SUP</div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#2E2118]/62 to-transparent" />
        <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl border border-white/60 bg-white text-sm font-semibold text-[#7A6145]">
              {club.logo ? <img src={club.logo} alt="" className="h-full w-full object-contain p-1" /> : club.name.slice(0, 1)}
            </div>
            <div>
              <h2 className="text-lg font-semibold leading-tight text-white">{club.name}</h2>
              <p className="mt-1 text-xs text-white/78">{[club.province, club.city, club.water_area_name].filter(Boolean).join(' · ') || '资料待完善'}</p>
            </div>
          </div>
          <span className="rounded-full bg-white/88 px-3 py-1 text-xs font-medium text-[#7A6145]">{statusLabel(club.verification_status, verificationLabels)}</span>
        </div>
      </div>
      <div className="p-5">
        <p className="line-clamp-2 min-h-11 text-sm leading-6 text-[#655D56]">{club.intro || '俱乐部资料正在整理中，欢迎负责人认领后补充训练水域、课程和安全信息。'}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {services.map((item) => <span key={item} className="rounded-full bg-[#F2E8D9] px-3 py-1 text-xs text-[#7A6145]">{item}</span>)}
          {safety.map((item) => <span key={item} className="rounded-full bg-[#EEF3E8] px-3 py-1 text-xs text-[#516B47]">{item}</span>)}
        </div>
        <div className="mt-5 grid grid-cols-4 gap-2 border-t border-[#E8DDCE] pt-4 text-center">
          <div><div className="text-lg font-semibold text-[#2E2118]">{Number(club.member_count || 0)}</div><div className="text-[11px] text-[#8A8078]">成员</div></div>
          <div><div className="text-lg font-semibold text-[#2E2118]">{Number(club.professional_count || 0)}</div><div className="text-[11px] text-[#8A8078]">专业人员</div></div>
          <div><div className="text-lg font-semibold text-[#2E2118]">{Number(club.result_count || 0)}</div><div className="text-[11px] text-[#8A8078]">成绩</div></div>
          <div><div className="text-lg font-semibold text-[#2E2118]">{Number(club.event_count || 0)}</div><div className="text-[11px] text-[#8A8078]">赛事</div></div>
        </div>
      </div>
    </Link>
  );
}

export default async function ClubsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; city?: string; province?: string; service?: string }>;
}) {
  const params = await searchParams;
  const search = params.search?.trim();
  const [clubs, stats, options] = await Promise.all([
    getClubs({ ...params, search }),
    getClubStats(),
    getOptions(),
  ]);
  const current = { search, city: params.city, province: params.province, service: params.service };
  return (
    <main className="min-h-screen bg-[#F7F1E8] text-[#2E2118]">
      <section className="relative overflow-hidden bg-[#241E17]">
        <div className="absolute inset-0 opacity-60" style={{ background: 'radial-gradient(circle at 78% 35%, rgba(188,145,84,0.35), transparent 30%), linear-gradient(115deg, #241E17 0%, #3A2C20 52%, #6A543A 100%)' }} />
        <div className="relative mx-auto max-w-[1440px] px-4 py-14 sm:px-6 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-[1fr_520px] lg:items-end">
            <div>
              <p className="tracking-[0.34em] text-[#C6A77D]">SUP CLUB NETWORK</p>
              <h1 className="mt-3 font-[var(--font-display)] text-5xl font-semibold leading-none text-white sm:text-6xl">俱乐部库</h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-[#E5D7C4]">查找身边的桨板训练基地、课程服务和组织战绩，把运动员、教练员、赛事成绩连接到同一个俱乐部主页。</p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <StatCard label="收录俱乐部" value={Number(stats.total || 0)} />
              <StatCard label="已认领" value={Number(stats.claimed || 0)} />
              <StatCard label="已核验" value={Number(stats.verified || 0)} />
            </div>
          </div>
        </div>
      </section>
      <div className="mx-auto max-w-[1440px] px-4 py-8 sm:px-6 lg:px-8">
        <section className="mb-7 rounded-2xl border border-[#E3D6C6] bg-white/76 p-4 shadow-[0_14px_36px_rgba(69,45,22,0.08)]">
          <form action="/clubs" className="grid gap-3 lg:grid-cols-[1.3fr_repeat(3,180px)_auto]">
            <input name="search" defaultValue={search || ''} placeholder="搜索俱乐部 / 水域 / 城市" className="h-12 rounded-xl border border-[#E3D6C6] bg-white px-4 text-sm outline-none focus:border-[#B58A48]" />
            <select name="province" defaultValue={params.province || ''} className="h-12 rounded-xl border border-[#E3D6C6] bg-white px-4 text-sm">
              <option value="">全部省份</option>
              {options.provinces.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
            <select name="city" defaultValue={params.city || ''} className="h-12 rounded-xl border border-[#E3D6C6] bg-white px-4 text-sm">
              <option value="">全部城市</option>
              {options.cities.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
            <select name="service" defaultValue={params.service || ''} className="h-12 rounded-xl border border-[#E3D6C6] bg-white px-4 text-sm">
              <option value="">全部服务</option>
              {['桨板课程', '装备租赁', '竞速训练', '亲子活动', '青少年训练'].map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
            <button className="h-12 rounded-xl bg-[#7A5530] px-6 text-sm font-semibold text-white">查询</button>
          </form>
          <div className="mt-3 flex flex-wrap gap-2">
            {['桨板课程', '装备租赁', '竞速训练', '亲子活动'].map((item) => (
              <Link key={item} href={buildHref(current, { service: params.service === item ? null : item })} className={`rounded-full px-3 py-1.5 text-xs no-underline ${params.service === item ? 'bg-[#7A5530] text-white' : 'bg-[#F2E8D9] text-[#7A6145]'}`}>{item}</Link>
            ))}
            {(search || params.city || params.province || params.service) && <Link href="/clubs" className="rounded-full px-3 py-1.5 text-xs text-[#A08060] no-underline">清除筛选</Link>}
          </div>
        </section>
        {clubs.length > 0 ? (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
            {clubs.map((club) => <ClubCard key={club.club_id} club={club} />)}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-[#D8C8B6] bg-white/60 p-10 text-center text-[#8A8078]">暂无符合条件的俱乐部资料。</div>
        )}
        <p className="mt-8 text-xs leading-6 text-[#8A8078]">本页面为 SUP Wiki 收录和用户共建资料。证书、服务和安全信息来自公开资料、本人上传或俱乐部补充，具体活动安排以实际服务方为准。</p>
      </div>
    </main>
  );
}
