import Link from 'next/link';
import pool from '@/lib/db';
import { parseJsonArray } from '@/lib/course-utils';
import type { RowDataPacket } from 'mysql2';

export const dynamic = 'force-dynamic';

const levelLabels: Record<string, string> = {
  beginner: '入门',
  intermediate: '进阶',
  advanced: '高阶',
};

const categoryLabels: Record<string, string> = {
  foundation: '基础',
  paddling: '划行',
  turning: '转向',
  braking: '停止',
  balance: '平衡',
  posture: '姿态',
  safety: '安全',
  support: '支撑',
  footwork: '走板',
  maneuver: '控板',
  rescue: '救援',
  general: '通用',
};

interface TechniqueRow extends RowDataPacket {
  technique_id: number;
  source_code: string | null;
  name: string;
  cover_image: string | null;
  images: unknown;
  stage: number;
  stage_label: string;
  level: string;
  category: string | null;
  points: number;
  key_points: string | null;
  common_errors: string | null;
  related_courses_count: number;
}

interface TechniqueItem extends Omit<TechniqueRow, 'images'> {
  images: string[];
}

interface TechniqueFacet extends RowDataPacket {
  stage: number;
  stage_label: string;
  level: string;
  category: string | null;
}

function normalizeRow(row: TechniqueRow): TechniqueItem {
  return {
    ...row,
    images: parseJsonArray(row.images).filter((url): url is string => typeof url === 'string' && url.length > 0),
    related_courses_count: Number(row.related_courses_count || 0),
  };
}

async function getTechniques(searchParams: Record<string, string | string[] | undefined>) {
  const search = String(searchParams.search || '').trim();
  const stage = String(searchParams.stage || '');
  const level = String(searchParams.level || '');
  const category = String(searchParams.category || '');
  const conditions = ["t.status = 'published'"];
  const params: (string | number)[] = [];

  if (search) {
    conditions.push('(t.name LIKE ? OR t.source_code LIKE ? OR t.stage_label LIKE ? OR t.key_points LIKE ?)');
    const like = `%${search}%`;
    params.push(like, like, like, like);
  }
  if (stage) {
    conditions.push('t.stage = ?');
    params.push(Number(stage));
  }
  if (level) {
    conditions.push('t.level = ?');
    params.push(level);
  }
  if (category) {
    conditions.push('t.category = ?');
    params.push(category);
  }
  const where = `WHERE ${conditions.join(' AND ')}`;

  try {
    const [rows] = await pool.execute<TechniqueRow[]>(
      `SELECT t.*, COUNT(DISTINCT ct.course_id) AS related_courses_count
       FROM sup_techniques t
       LEFT JOIN sup_course_techniques ct ON ct.technique_id = t.technique_id
       ${where}
       GROUP BY t.technique_id
       ORDER BY t.stage ASC, t.sort_order ASC, t.technique_id ASC
       LIMIT 80`,
      params
    );

    const [facetRows] = await pool.execute<TechniqueFacet[]>(
      `SELECT stage, stage_label, level, category
       FROM sup_techniques
       WHERE status = 'published'
       ORDER BY stage ASC, sort_order ASC, technique_id ASC`
    );

    return {
      items: rows.map(normalizeRow),
      stages: Array.from(new Map(facetRows.map((item) => [String(item.stage), item])).values()),
      levels: Array.from(new Set(facetRows.map((item) => item.level).filter(Boolean))),
      categories: Array.from(new Set(facetRows.map((item) => item.category || 'general').filter(Boolean))),
      filters: { search, stage, level, category },
    };
  } catch (error) {
    console.error('获取技术动作列表失败:', error);
    return { items: [], stages: [], levels: [], categories: [], filters: { search, stage, level, category } };
  }
}

function filterHref(filters: Record<string, string>, patch: Record<string, string>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...filters, ...patch })) {
    if (value) params.set(key, value);
  }
  const query = params.toString();
  return query ? `/techniques?${query}` : '/techniques';
}

function imageFor(item: TechniqueItem) {
  return item.cover_image || item.images[0] || '';
}

export default async function TechniquesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const { items, stages, levels, categories, filters } = await getTechniques(params);

  return (
    <main className="min-h-screen bg-[#F6F0E7] text-[#2E2118]">
      <section className="border-b border-[#E2D3C1] bg-[#203D3D] text-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[1fr_360px] lg:px-8">
          <div>
            <nav className="mb-8 text-sm text-[#B9CCC7]">
              <Link href="/learn" className="hover:text-white">学习</Link>
              <span className="mx-2">/</span>
              <span className="text-white">技术动作库</span>
            </nav>
            <div className="text-xs font-semibold uppercase tracking-[0.22em] text-[#DBA95C]">Technique System</div>
            <h1 className="mt-4 font-[var(--font-display)] text-5xl font-normal leading-tight sm:text-6xl">桨板技术动作库</h1>
            <p className="mt-5 max-w-2xl text-base leading-8 text-[#D9E7E2]">
              把动作从课程中独立出来，按阶段、难度和分类系统查看。学员可以先理解动作，再回到课程里完成练习。
            </p>
          </div>
          <div className="self-end rounded-2xl border border-white/15 bg-white/10 p-5">
            <div className="text-sm text-[#B9CCC7]">已收录动作</div>
            <div className="mt-2 text-5xl font-semibold">{items.length}</div>
            <div className="mt-3 text-sm leading-7 text-[#D9E7E2]">入门、进阶、高阶动作统一维护，可被课程直接引用。</div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <form action="/techniques" className="rounded-2xl border border-[#DED0BE] bg-[#FEFCF8] p-4 shadow-sm">
          <div className="grid gap-3 md:grid-cols-[1.4fr_1fr_1fr_1fr_auto]">
            <input
              name="search"
              defaultValue={filters.search}
              placeholder="搜索动作名称、编号、要点"
              className="h-12 rounded-xl border border-[#DED0BE] bg-white px-4 text-sm outline-none focus:border-[#8B7355]"
            />
            <select name="stage" defaultValue={filters.stage} className="h-12 rounded-xl border border-[#DED0BE] bg-white px-4 text-sm outline-none focus:border-[#8B7355]">
              <option value="">全部阶段</option>
              {stages.map((stage) => <option key={stage.stage} value={stage.stage}>{stage.stage_label}</option>)}
            </select>
            <select name="level" defaultValue={filters.level} className="h-12 rounded-xl border border-[#DED0BE] bg-white px-4 text-sm outline-none focus:border-[#8B7355]">
              <option value="">全部难度</option>
              {levels.map((level) => <option key={level} value={level}>{levelLabels[level] || level}</option>)}
            </select>
            <select name="category" defaultValue={filters.category} className="h-12 rounded-xl border border-[#DED0BE] bg-white px-4 text-sm outline-none focus:border-[#8B7355]">
              <option value="">全部分类</option>
              {categories.map((category) => <option key={category} value={category}>{categoryLabels[category] || category}</option>)}
            </select>
            <button className="h-12 rounded-xl bg-[#7A6145] px-6 text-sm font-semibold text-white">筛选</button>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/techniques" className="rounded-full border border-[#D8C8B4] px-3 py-1.5 text-xs text-[#7A6145]">全部动作</Link>
            {stages.slice(0, 6).map((stage) => (
              <Link key={stage.stage} href={filterHref(filters, { stage: String(stage.stage) })} className="rounded-full border border-[#D8C8B4] px-3 py-1.5 text-xs text-[#7A6145]">
                {stage.stage_label}
              </Link>
            ))}
          </div>
        </form>

        {items.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-[#DED0BE] bg-[#FEFCF8] p-10 text-center text-stone-500">暂无符合条件的技术动作</div>
        ) : (
          <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {items.map((item) => {
              const image = imageFor(item);
              return (
                <Link key={item.technique_id} href={`/techniques/${item.technique_id}`} className="group overflow-hidden rounded-2xl border border-[#DED0BE] bg-[#FEFCF8] shadow-sm transition hover:-translate-y-1 hover:border-[#8B7355] hover:shadow-md">
                  <div className="relative aspect-[4/3] bg-[#EDE2D4]">
                    {image ? (
                      <img src={image} alt={item.name} className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]" />
                    ) : (
                      <div className="grid h-full place-items-center bg-[linear-gradient(135deg,#E9DDCE,#F8F0E5)] text-center">
                        <span className="font-[var(--font-display)] text-5xl text-[#B08A5D]">{item.source_code || item.stage}</span>
                      </div>
                    )}
                    <div className="absolute left-4 top-4 rounded-full bg-[#203D3D] px-3 py-1 text-xs font-semibold text-white">{item.stage_label}</div>
                  </div>
                  <div className="p-5">
                    <div className="flex items-center gap-2 text-xs text-[#8B7355]">
                      {item.source_code && <span className="rounded bg-[#EFE6DA] px-2 py-0.5">{item.source_code}</span>}
                      <span>{levelLabels[item.level] || item.level}</span>
                      <span>·</span>
                      <span>{categoryLabels[item.category || 'general'] || item.category}</span>
                    </div>
                    <h2 className="mt-3 text-xl font-semibold leading-snug text-[#2E2118]">{item.name}</h2>
                    <p className="mt-3 line-clamp-3 text-sm leading-7 text-stone-600">{item.key_points || '动作要点待补充。'}</p>
                    <div className="mt-5 flex items-center justify-between text-sm">
                      <span className="text-stone-400">{item.related_courses_count} 门课程引用</span>
                      <span className="font-semibold text-[#8B5A21]">查看动作</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
