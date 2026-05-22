/* eslint-disable @next/next/no-img-element */
import Link from 'next/link';
import pool from '@/lib/db';
import { localResultSourceCondition } from '@/lib/result-source-scope';
import type { RowDataPacket } from 'mysql2';

interface AthleteCenterRow extends RowDataPacket {
  athlete_id: number;
  name: string;
  name_en: string | null;
  nationality: string | null;
  province: string | null;
  city: string | null;
  photo: string | null;
  discipline: string | null;
  icf_ranking: number | null;
  result_count: number | null;
  event_count: number | null;
  top10_count: number | null;
  best_rank: number | null;
  best_finish_time: string | null;
  best_discipline: string | null;
  recent_event_name: string | null;
  recent_event_date: string | Date | null;
  tier_key: AthleteTier;
}

interface AthleteView extends AthleteCenterRow {
  tier: AthleteTier;
  tierLabel: string;
  levelLabel: string;
  statusLabel: string;
}

type AthleteTier = 'elite' | 'training' | 'squad' | 'base';

const PAGE_SIZE = 24;

const disciplineLabels: Record<string, string> = {
  race: '竞速',
  surf: '冲浪',
  distance: '长距离',
  technical: '技巧',
};

const tierLabels: Record<AthleteTier, string> = {
  elite: '精英',
  training: '长训队',
  squad: '梯队队员',
  base: '基础档案',
};

const tierStyles: Record<AthleteTier, string> = {
  elite: 'border-[#E8B75C] bg-[#FFF1CF] text-[#8A570D]',
  training: 'border-[#9CC8F1] bg-[#EAF5FF] text-[#216391]',
  squad: 'border-[#A6D2BF] bg-[#ECFAF3] text-[#26714D]',
  base: 'border-[#E1D3BF] bg-[#F8F0E5] text-[#7B6143]',
};

function cleanParam(value?: string) {
  return typeof value === 'string' ? value.trim() : '';
}

function clampPage(value?: string) {
  const page = Number(value || 1);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

function formatDate(value?: string | Date | null) {
  if (!value) return '-';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function toAthleteView(row: AthleteCenterRow): AthleteView {
  const tier = row.tier_key || 'base';
  const resultCount = Number(row.result_count || 0);
  const levelLabel = tier === 'elite' ? 'L4' : tier === 'training' ? 'L3' : tier === 'squad' ? 'L2' : 'L1';

  return {
    ...row,
    tier,
    tierLabel: tierLabels[tier],
    levelLabel,
    statusLabel: resultCount > 0 ? '参赛中' : '待补充',
  };
}

function buildAthleteQuery(filters: {
  search: string;
  tier: string;
  discipline: string;
  gender: string;
  nationality: string;
}) {
  const baseConditions = ["a.status = 'published'"];
  const baseParams: (string | number)[] = [];
  const outerConditions: string[] = [];
  const outerParams: (string | number)[] = [];

  if (filters.search) {
    baseConditions.push('(a.name LIKE ? OR a.name_en LIKE ? OR CAST(a.athlete_id AS CHAR) LIKE ?)');
    const like = `%${filters.search}%`;
    baseParams.push(like, like, like);
  }
  if (filters.discipline) {
    baseConditions.push('a.discipline = ?');
    baseParams.push(filters.discipline);
  }
  if (filters.nationality && filters.nationality !== 'all') {
    baseConditions.push('a.nationality = ?');
    baseParams.push(filters.nationality);
  }
  if (filters.gender) {
    baseConditions.push(`EXISTS (
      SELECT 1
      FROM sup_event_results gender_er
      INNER JOIN sup_event_result_sources gender_src ON gender_src.source_id = gender_er.source_id
      WHERE gender_er.athlete_id = a.athlete_id
        AND gender_er.gender_group LIKE ?
        AND ${localResultSourceCondition.replaceAll('src.', 'gender_src.')}
        AND gender_er.review_status = 'confirmed'
        AND gender_er.is_verified = 1
    )`);
    baseParams.push(`%${filters.gender}%`);
  }
  if (filters.tier) {
    outerConditions.push('tier_key = ?');
    outerParams.push(filters.tier);
  }

  const where = outerConditions.length ? `WHERE ${outerConditions.join(' AND ')}` : '';
  const cte = `WITH stats AS (
      SELECT
        er.athlete_id,
        COUNT(*) AS result_count,
        COUNT(DISTINCT er.event_id) AS event_count,
        SUM(CASE WHEN er.rank_position <= 10 THEN 1 ELSE 0 END) AS top10_count,
        MIN(CASE WHEN er.rank_position < 9000 THEN er.rank_position ELSE NULL END) AS best_rank
      FROM sup_event_results er
      INNER JOIN sup_events e ON e.event_id = er.event_id
      INNER JOIN sup_event_result_sources src ON src.source_id = er.source_id
      WHERE er.athlete_id IS NOT NULL
        AND ${localResultSourceCondition}
        AND er.review_status = 'confirmed'
        AND er.is_verified = 1
        AND e.status = 'published'
      GROUP BY er.athlete_id
    ),
    athlete_metrics AS (
      SELECT
        a.athlete_id, a.name, a.name_en, a.nationality, a.province, a.city, a.photo,
        a.discipline, a.icf_ranking,
        COALESCE(stats.result_count, 0) AS result_count,
        COALESCE(stats.event_count, 0) AS event_count,
        COALESCE(stats.top10_count, 0) AS top10_count,
        stats.best_rank,
        CASE
          WHEN (COALESCE(a.icf_ranking, 999999) <= 100) OR (stats.best_rank IS NOT NULL AND stats.best_rank <= 3) THEN 'elite'
          WHEN COALESCE(stats.event_count, 0) >= 3 OR COALESCE(stats.top10_count, 0) >= 2 THEN 'training'
          WHEN COALESCE(stats.result_count, 0) > 0 THEN 'squad'
          ELSE 'base'
        END AS tier_key,
        (
          SELECT best_er.finish_time
          FROM sup_event_results best_er
          INNER JOIN sup_events best_e ON best_e.event_id = best_er.event_id
          INNER JOIN sup_event_result_sources best_src ON best_src.source_id = best_er.source_id
          WHERE best_er.athlete_id = a.athlete_id
            AND ${localResultSourceCondition.replaceAll('src.', 'best_src.')}
            AND best_er.review_status = 'confirmed'
            AND best_er.is_verified = 1
            AND best_er.rank_position < 9000
            AND best_e.status = 'published'
          ORDER BY best_er.rank_position ASC, best_er.time_seconds ASC, best_er.result_id ASC
          LIMIT 1
        ) AS best_finish_time,
        (
          SELECT best_er.discipline
          FROM sup_event_results best_er
          INNER JOIN sup_events best_e ON best_e.event_id = best_er.event_id
          INNER JOIN sup_event_result_sources best_src ON best_src.source_id = best_er.source_id
          WHERE best_er.athlete_id = a.athlete_id
            AND ${localResultSourceCondition.replaceAll('src.', 'best_src.')}
            AND best_er.review_status = 'confirmed'
            AND best_er.is_verified = 1
            AND best_er.rank_position < 9000
            AND best_e.status = 'published'
          ORDER BY best_er.rank_position ASC, best_er.time_seconds ASC, best_er.result_id ASC
          LIMIT 1
        ) AS best_discipline,
        (
          SELECT recent_e.name
          FROM sup_event_results recent_er
          INNER JOIN sup_events recent_e ON recent_e.event_id = recent_er.event_id
          INNER JOIN sup_event_result_sources recent_src ON recent_src.source_id = recent_er.source_id
          WHERE recent_er.athlete_id = a.athlete_id
            AND ${localResultSourceCondition.replaceAll('src.', 'recent_src.')}
            AND recent_er.review_status = 'confirmed'
            AND recent_er.is_verified = 1
            AND recent_e.status = 'published'
          ORDER BY recent_e.start_date DESC, recent_er.result_id DESC
          LIMIT 1
        ) AS recent_event_name,
        (
          SELECT recent_e.start_date
          FROM sup_event_results recent_er
          INNER JOIN sup_events recent_e ON recent_e.event_id = recent_er.event_id
          INNER JOIN sup_event_result_sources recent_src ON recent_src.source_id = recent_er.source_id
          WHERE recent_er.athlete_id = a.athlete_id
            AND ${localResultSourceCondition.replaceAll('src.', 'recent_src.')}
            AND recent_er.review_status = 'confirmed'
            AND recent_er.is_verified = 1
            AND recent_e.status = 'published'
          ORDER BY recent_e.start_date DESC, recent_er.result_id DESC
          LIMIT 1
        ) AS recent_event_date
      FROM sup_athletes a
      LEFT JOIN stats ON stats.athlete_id = a.athlete_id
      WHERE ${baseConditions.join(' AND ')}
    )`;

  return { cte, where, baseParams, outerParams };
}

async function getAthleteCenterData(filters: {
  search: string;
  tier: string;
  discipline: string;
  gender: string;
  nationality: string;
  page: number;
}) {
  const { cte, where, baseParams, outerParams } = buildAthleteQuery(filters);
  const page = filters.page;

  const [countRows] = await pool.execute<RowDataPacket[]>(
    `${cte}
     SELECT COUNT(*) AS total FROM athlete_metrics ${where}`,
    [...baseParams, ...outerParams]
  );
  const total = Number(countRows[0]?.total || 0);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const safeOffset = (safePage - 1) * PAGE_SIZE;

  const [rows] = await pool.execute<AthleteCenterRow[]>(
    `${cte}
     SELECT *
     FROM athlete_metrics
     ${where}
     ORDER BY FIELD(tier_key, 'elite', 'training', 'squad', 'base'), COALESCE(best_rank, 9999) ASC, result_count DESC, athlete_id ASC
     LIMIT ? OFFSET ?`,
    [...baseParams, ...outerParams, PAGE_SIZE, safeOffset]
  );

  return {
    items: rows.map(toAthleteView),
    total,
    page: safePage,
    pageSize: PAGE_SIZE,
    totalPages,
  };
}

async function getFeaturedAthletes(filters: {
  search: string;
  tier: string;
  discipline: string;
  gender: string;
  nationality: string;
}) {
  const { cte, where, baseParams, outerParams } = buildAthleteQuery(filters);
  const [rows] = await pool.execute<AthleteCenterRow[]>(
    `${cte}
     SELECT *
     FROM athlete_metrics
     ${where}
     ORDER BY FIELD(tier_key, 'elite', 'training', 'squad', 'base'), COALESCE(best_rank, 9999) ASC, result_count DESC, athlete_id ASC
     LIMIT 12`,
    [...baseParams, ...outerParams]
  );
  return rows.map(toAthleteView);
}

async function getNationalities() {
  const [rows] = await pool.execute<RowDataPacket[]>(
    "SELECT DISTINCT nationality FROM sup_athletes WHERE status = 'published' AND nationality IS NOT NULL AND nationality <> '' ORDER BY FIELD(nationality, '中国') DESC, nationality ASC"
  );
  return rows.map((row) => String(row.nationality));
}

function Icon({ name }: { name: 'board' | 'users' | 'medal' | 'team' | 'trophy' | 'search' | 'rotate' | 'chevron' }) {
  const paths = {
    board: <><path d="M7 20c5-5 8-11 10-18 2 7 0 13-5 18-2 2-3 2-5 0z" /><path d="M12 7v11" /></>,
    users: <><path d="M16 21a6 6 0 0 0-12 0" /><circle cx="10" cy="8" r="4" /><path d="M20 20a4 4 0 0 0-4-4" /><path d="M17 5a3 3 0 0 1 0 6" /></>,
    medal: <><path d="M8 3h8l-2 5h-4z" /><circle cx="12" cy="14" r="5" /><path d="m10.5 14 1 1 2-2" /></>,
    team: <><circle cx="8" cy="8" r="3" /><circle cx="16" cy="8" r="3" /><path d="M3 21a5 5 0 0 1 10 0" /><path d="M11 21a5 5 0 0 1 10 0" /></>,
    trophy: <><path d="M8 21h8" /><path d="M12 17v4" /><path d="M7 4h10v5a5 5 0 0 1-10 0z" /><path d="M5 5H3v2a4 4 0 0 0 4 4" /><path d="M19 5h2v2a4 4 0 0 1-4 4" /></>,
    search: <><circle cx="11" cy="11" r="6" /><path d="m16 16 4 4" /></>,
    rotate: <><path d="M21 12a9 9 0 1 1-2.64-6.36" /><path d="M21 4v6h-6" /></>,
    chevron: <path d="m9 18 6-6-6-6" />,
  };
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {paths[name]}
    </svg>
  );
}

function AthleteAvatar({ athlete, size = 'large' }: { athlete: AthleteView; size?: 'large' | 'small' }) {
  const sizeClass = size === 'large' ? 'h-full w-full' : 'h-12 w-12';
  if (athlete.photo) {
    return <img src={athlete.photo} alt={athlete.name} className={`${sizeClass} object-cover`} />;
  }
  return (
    <span className={`${size === 'large' ? 'text-5xl' : 'text-lg'} font-black text-[#9A6A2F]`}>
      {athlete.name.slice(0, 1)}
    </span>
  );
}

function TierBadge({ tier }: { tier: AthleteTier }) {
  return <span className={`inline-flex rounded-md border px-2.5 py-1 text-xs font-bold ${tierStyles[tier]}`}>{tierLabels[tier]}</span>;
}

function buildPageHref(params: Record<string, string>, page: number) {
  const next = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) next.set(key, value);
  }
  if (page > 1) next.set('page', String(page));
  const query = next.toString();
  return query ? `/athletes?${query}` : '/athletes';
}

function Pagination({ page, totalPages, params }: { page: number; totalPages: number; params: Record<string, string> }) {
  if (totalPages <= 1) return null;
  const pages = Array.from(new Set([1, page - 1, page, page + 1, totalPages].filter((item) => item >= 1 && item <= totalPages)));

  return (
    <nav className="mt-5 flex flex-wrap items-center justify-center gap-2" aria-label="运动员分页">
      <Link href={buildPageHref(params, Math.max(1, page - 1))} aria-disabled={page === 1} className={`rounded-md border px-3 py-2 text-sm font-bold no-underline ${page === 1 ? 'pointer-events-none border-[#E7D9C7] text-[#C6B8A5]' : 'border-[#D6C5AD] text-[#7A4B22] hover:bg-[#F8EFE4]'}`}>
        上一页
      </Link>
      {pages.map((item, index) => (
        <span key={item} className="flex items-center gap-2">
          {index > 0 && item - pages[index - 1] > 1 && <span className="text-[#B8A894]">...</span>}
          <Link href={buildPageHref(params, item)} className={`min-w-10 rounded-md border px-3 py-2 text-center text-sm font-bold no-underline ${item === page ? 'border-[#9A6429] bg-[#9A6429] text-white' : 'border-[#D6C5AD] text-[#7A4B22] hover:bg-[#F8EFE4]'}`}>
            {item}
          </Link>
        </span>
      ))}
      <Link href={buildPageHref(params, Math.min(totalPages, page + 1))} aria-disabled={page === totalPages} className={`rounded-md border px-3 py-2 text-sm font-bold no-underline ${page === totalPages ? 'pointer-events-none border-[#E7D9C7] text-[#C6B8A5]' : 'border-[#D6C5AD] text-[#7A4B22] hover:bg-[#F8EFE4]'}`}>
        下一页
      </Link>
    </nav>
  );
}

export default async function AthletesPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; tier?: string; discipline?: string; gender?: string; nationality?: string; page?: string }>;
}) {
  const params = await searchParams;
  const filters = {
    search: cleanParam(params.search),
    tier: cleanParam(params.tier),
    discipline: cleanParam(params.discipline),
    gender: cleanParam(params.gender),
    nationality: cleanParam(params.nationality) || '中国',
    page: clampPage(params.page),
  };
  const queryParams = {
    search: filters.search,
    tier: filters.tier,
    discipline: filters.discipline,
    gender: filters.gender,
    nationality: filters.nationality,
  };
  const [pagedAthletes, featured, nationalities] = await Promise.all([
    getAthleteCenterData(filters),
    getFeaturedAthletes(filters),
    getNationalities(),
  ]);
  const athletes = pagedAthletes.items;
  const stats = {
    total: pagedAthletes.total,
    active: athletes.filter((item) => Number(item.result_count || 0) > 0).length,
  };
  const marqueeAthletes = featured.length > 4 ? [...featured, ...featured] : featured;

  return (
    <main className="min-h-screen bg-[#FBF7F1] text-[#2D261F]">
      <style>{`
        @keyframes athlete-marquee {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        .athlete-marquee-track {
          animation: athlete-marquee 34s linear infinite;
        }
        .athlete-marquee:hover .athlete-marquee-track {
          animation-play-state: paused;
        }
        @media (max-width: 768px) {
          .athlete-marquee-track { animation: none; }
        }
      `}</style>

      <section className="relative overflow-hidden border-b border-[#E7D9C7] bg-[#FFF9EF]">
        <div className="absolute right-0 top-0 hidden h-full w-[34%] bg-[radial-gradient(circle_at_55%_42%,rgba(205,150,72,0.26),transparent_34%),linear-gradient(90deg,transparent,#F5E7D3)] lg:block" />
        <div className="absolute right-20 top-8 hidden text-[150px] font-black leading-none text-[#B98135]/10 lg:block">SUP</div>
        <div className="relative mx-auto flex max-w-7xl flex-col gap-7 px-4 py-8 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div className="flex items-center gap-5">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(145deg,#DDA04A,#8D561D)] text-white shadow-[0_18px_34px_rgba(141,86,29,0.22)]">
              <Icon name="board" />
            </div>
            <div>
              <h1 className="text-4xl font-black tracking-tight text-[#2F251C] md:text-5xl">运动员中心</h1>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ['users', '运动员总数', stats.total],
              ['medal', '重点展示', featured.length],
              ['team', '本页参赛中', stats.active],
              ['trophy', '每页展示', pagedAthletes.pageSize],
            ].map(([icon, label, value]) => (
              <div key={label} className="flex min-w-[150px] items-center gap-3 rounded-lg border border-[#E1D0BA] bg-white/82 px-4 py-3 shadow-[0_12px_26px_rgba(80,56,29,0.08)]">
                <span className="text-[#C17D24]"><Icon name={icon as 'users' | 'medal' | 'team' | 'trophy'} /></span>
                <div>
                  <div className="text-xs font-semibold text-[#8B7A67]">{label}</div>
                  <div className="text-2xl font-black text-[#3A2B20]">{value}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <form className="mb-6 rounded-xl border border-[#E4D7C6] bg-white/88 p-5 shadow-[0_18px_42px_rgba(91,68,43,0.08)]">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
            <label className="block">
              <span className="mb-1.5 block text-xs font-bold text-[#5F4D3A]">运动员</span>
              <input name="search" defaultValue={filters.search} placeholder="请输入姓名或ID" className="h-11 w-full rounded-md border border-[#E2D4C0] bg-white px-3 text-sm outline-none focus:border-[#A26D2F]" />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-bold text-[#5F4D3A]">梯队</span>
              <select name="tier" defaultValue={filters.tier} className="h-11 w-full rounded-md border border-[#E2D4C0] bg-white px-3 text-sm outline-none focus:border-[#A26D2F]">
                <option value="">全部梯队</option>
                <option value="elite">精英</option>
                <option value="training">长训队</option>
                <option value="squad">梯队队员</option>
                <option value="base">基础档案</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-bold text-[#5F4D3A]">级别</span>
              <select name="level" disabled className="h-11 w-full rounded-md border border-[#E2D4C0] bg-[#F8F0E5] px-3 text-sm text-[#9B8A76] outline-none">
                <option>由成绩自动计算</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-bold text-[#5F4D3A]">主项</span>
              <select name="discipline" defaultValue={filters.discipline} className="h-11 w-full rounded-md border border-[#E2D4C0] bg-white px-3 text-sm outline-none focus:border-[#A26D2F]">
                <option value="">请选择主项</option>
                <option value="race">竞速</option>
                <option value="distance">长距离</option>
                <option value="technical">技巧</option>
                <option value="surf">冲浪</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-bold text-[#5F4D3A]">性别</span>
              <select name="gender" defaultValue={filters.gender} className="h-11 w-full rounded-md border border-[#E2D4C0] bg-white px-3 text-sm outline-none focus:border-[#A26D2F]">
                <option value="">请选择性别</option>
                <option value="男子">男子</option>
                <option value="女子">女子</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-bold text-[#5F4D3A]">国籍/地区</span>
              <select name="nationality" defaultValue={filters.nationality} className="h-11 w-full rounded-md border border-[#E2D4C0] bg-white px-3 text-sm outline-none focus:border-[#A26D2F]">
                <option value="中国">中国</option>
                <option value="all">全部</option>
                {nationalities.filter((item) => item !== '中国').map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
          </div>
          <div className="mt-4 flex justify-end gap-3">
            <Link href="/athletes" className="inline-flex h-11 items-center gap-2 rounded-md border border-[#D6C5AD] bg-white px-5 text-sm font-bold text-[#7A4B22] no-underline hover:bg-[#F8EFE4]">
              <Icon name="rotate" />清空筛选
            </Link>
            <button className="inline-flex h-11 items-center gap-2 rounded-md bg-[#B67525] px-8 text-sm font-bold text-white shadow-[0_10px_22px_rgba(182,117,37,0.22)] hover:bg-[#965918]" type="submit">
              <Icon name="search" />查询
            </button>
          </div>
        </form>

        {featured.length > 0 && (
          <section className="mb-6 overflow-hidden">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-xl font-black text-[#3A2B20]"><span className="text-[#C17D24]"><Icon name="trophy" /></span>重点运动员</h2>
              <span className="hidden text-sm text-[#9B8A76] sm:inline">横向滑动查看更多</span>
            </div>
            <div className="athlete-marquee overflow-x-auto rounded-xl border border-[#E1D0BA] bg-white/62 p-3 shadow-[0_12px_34px_rgba(89,62,34,0.06)]">
              <div className={`athlete-marquee-track flex w-max gap-4 ${featured.length <= 4 ? 'animate-none' : ''}`}>
                {marqueeAthletes.map((athlete, index) => (
                  <Link key={`${athlete.athlete_id}-${index}`} href={`/athletes/${athlete.athlete_id}`} className="group grid w-[300px] shrink-0 grid-cols-[104px_1fr] overflow-hidden rounded-lg border border-[#E1D0BA] bg-white no-underline shadow-[0_10px_26px_rgba(89,62,34,0.08)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_42px_rgba(89,62,34,0.14)] sm:w-[340px]">
                    <div className="flex h-[144px] items-center justify-center overflow-hidden bg-[#F2E3CF]"><AthleteAvatar athlete={athlete} /></div>
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate text-lg font-black text-[#2F251C]">{athlete.name}</div>
                          <div className="mt-1 text-xs text-[#A09284]">{[athlete.nationality, athlete.city].filter(Boolean).join(' · ') || '资料待补充'}</div>
                        </div>
                        <TierBadge tier={athlete.tier} />
                      </div>
                      <div className="mt-3 text-sm text-[#6B5A49]">{disciplineLabels[athlete.discipline || ''] || athlete.discipline || '主项待补充'}</div>
                      <div className="mt-3 flex items-center gap-2 text-sm font-bold text-[#7A4B22]">
                        <Icon name="trophy" />最佳成绩 {athlete.best_finish_time || '-'}
                      </div>
                      <div className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-[#A26D2F] group-hover:text-[#6B3E1E]">查看详情 <Icon name="chevron" /></div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}

        <section>
          <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-black text-[#3A2B20]">运动员列表</h2>
              <span className="text-sm text-[#9B8A76]">共 {pagedAthletes.total} 名运动员</span>
            </div>
            <span className="text-sm text-[#9B8A76]">第 {pagedAthletes.page} / {pagedAthletes.totalPages} 页</span>
          </div>
          <div className="overflow-hidden rounded-xl border border-[#E1D0BA] bg-white shadow-[0_14px_34px_rgba(89,62,34,0.08)]">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-sm">
                <thead className="bg-[#F4EDDF] text-left text-xs font-bold text-[#746556]">
                  <tr>
                    <th className="px-4 py-3">运动员</th>
                    <th className="px-4 py-3">梯队</th>
                    <th className="px-4 py-3">级别</th>
                    <th className="px-4 py-3">主项</th>
                    <th className="px-4 py-3">最佳成绩</th>
                    <th className="px-4 py-3">最近参赛</th>
                    <th className="px-4 py-3">状态</th>
                  </tr>
                </thead>
                <tbody>
                  {athletes.map((athlete) => (
                    <tr key={athlete.athlete_id} className="border-t border-[#EFE5D8] hover:bg-[#FFF8EE]">
                      <td className="px-4 py-3">
                        <Link href={`/athletes/${athlete.athlete_id}`} className="flex items-center gap-3 no-underline">
                          <span className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-[#F2E3CF] ring-1 ring-[#E6D4BD]"><AthleteAvatar athlete={athlete} size="small" /></span>
                          <span className="min-w-0">
                            <span className="block truncate font-bold text-[#3A2B20]">{athlete.name}</span>
                            <span className="text-xs text-[#A09284]">{[athlete.nationality, athlete.city].filter(Boolean).join(' · ') || '-'}</span>
                          </span>
                        </Link>
                      </td>
                      <td className="px-4 py-3"><TierBadge tier={athlete.tier} /></td>
                      <td className="px-4 py-3 font-bold text-[#7A4B22]">{athlete.levelLabel}</td>
                      <td className="px-4 py-3">{disciplineLabels[athlete.discipline || ''] || athlete.discipline || '-'}</td>
                      <td className="px-4 py-3 font-bold text-[#3A2B20]">{athlete.best_finish_time || '-'}<div className="text-xs font-normal text-[#A09284]">{athlete.best_discipline || ''}</div></td>
                      <td className="max-w-[260px] px-4 py-3">{athlete.recent_event_name || '-'}<div className="text-xs text-[#A09284]">{formatDate(athlete.recent_event_date)}</div></td>
                      <td className="px-4 py-3"><span className="inline-flex items-center gap-1.5"><span className={`h-2 w-2 rounded-full ${athlete.statusLabel === '参赛中' ? 'bg-[#28A06B]' : 'bg-[#C9AA77]'}`} />{athlete.statusLabel}</span></td>
                    </tr>
                  ))}
                  {athletes.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-14 text-center text-[#9B8A76]">
                        暂无符合条件的运动员
                        <div className="mt-4"><Link href="/athletes" className="rounded-md border border-[#D6C5AD] px-4 py-2 text-sm font-bold text-[#7A4B22] no-underline hover:bg-[#F8EFE4]">返回全部运动员</Link></div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <Pagination page={pagedAthletes.page} totalPages={pagedAthletes.totalPages} params={queryParams} />
        </section>
      </section>
    </main>
  );
}
