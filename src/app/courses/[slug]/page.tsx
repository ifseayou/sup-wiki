import Link from 'next/link';
import { notFound } from 'next/navigation';
import pool from '@/lib/db';
import { parseJsonArray, parseTechniqueJson, type TechniqueItem } from '@/lib/course-utils';
import CourseContactCard from '@/components/courses/CourseContactCard';
import type { RowDataPacket } from 'mysql2';

export const dynamic = 'force-dynamic';

interface CourseRow extends RowDataPacket {
  course_id: number;
  slug: string;
  title: string;
  subtitle: string | null;
  summary: string | null;
  description: string | null;
  cover_image: string | null;
  images: unknown;
  venue: string | null;
  schedule_note: string | null;
  equipment_note: string | null;
  board_note: string | null;
  duration_minutes: number | null;
  price_display: string | null;
  price_options: unknown;
  techniques: unknown;
}

interface CourseDetail extends Omit<CourseRow, 'images' | 'price_options' | 'techniques'> {
  images: string[];
  price_options: unknown[];
  techniques: TechniqueItem[];
}

const fallbackImage = '/quiz-images/board-types-overview.svg';

async function getCourse(slug: string): Promise<CourseDetail | null> {
  try {
    const [rows] = await pool.execute<CourseRow[]>(
      `SELECT
         c.*,
         COALESCE(
           JSON_ARRAYAGG(
             CASE
               WHEN t.technique_id IS NULL THEN NULL
               ELSE JSON_OBJECT(
                 'technique_id', t.technique_id,
                 'source_code', t.source_code,
                 'name', t.name,
                 'cover_image', t.cover_image,
                 'images', t.images,
                 'stage', t.stage,
                 'stage_label', t.stage_label,
                 'level', t.level,
                 'category', t.category,
                 'points', t.points,
                 'key_points', t.key_points,
                 'common_errors', t.common_errors,
                 'sort_order', t.sort_order,
                 'status', t.status
               )
             END
           ),
           JSON_ARRAY()
         ) AS techniques
       FROM sup_courses c
       LEFT JOIN sup_course_techniques ct ON ct.course_id = c.course_id
       LEFT JOIN sup_techniques t ON t.technique_id = ct.technique_id AND t.status = 'published'
       WHERE c.slug = ? AND c.status = 'published'
       GROUP BY c.course_id
       LIMIT 1`,
      [slug]
    );
    if (rows.length === 0) return null;
    const row = rows[0];
    return {
      ...row,
      images: parseJsonArray(row.images).filter((item): item is string => typeof item === 'string'),
      price_options: parseJsonArray(row.price_options),
      techniques: parseTechniqueJson(row.techniques).filter(Boolean),
    };
  } catch (error) {
    console.error('获取课程详情失败:', error);
    return null;
  }
}

function groupTechniques(techniques: TechniqueItem[]) {
  const groups = new Map<string, TechniqueItem[]>();
  for (const technique of techniques) {
    const key = technique.stage_label || '技术动作';
    groups.set(key, [...(groups.get(key) || []), technique]);
  }
  return Array.from(groups.entries());
}

function formatDuration(minutes: number | null) {
  if (!minutes) return '灵活约课';
  if (minutes % 60 === 0) return `${minutes / 60} 小时`;
  return `${minutes} 分钟`;
}

export default async function CourseDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const course = await getCourse(slug);
  if (!course) notFound();

  const gallery = Array.from(new Set([course.cover_image, ...course.images].filter(Boolean) as string[]));
  const heroImage = gallery[0] || fallbackImage;

  return (
    <main className="bg-[#F8F3EA]">
      <section className="border-b border-[#E3D7C7] bg-[#112F32] text-white">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <nav className="mb-8 text-sm text-[#B8CCC4]">
            <Link href="/" className="hover:text-white">首页</Link>
            <span className="mx-2">/</span>
            <Link href="/courses" className="hover:text-white">课程</Link>
            <span className="mx-2">/</span>
            <span className="text-white">{course.title}</span>
          </nav>
          <div className="grid gap-8 lg:grid-cols-[1.1fr_.9fr]">
            <div>
              <div className="mb-4 text-xs font-semibold uppercase tracking-[0.22em] text-[#DFAE72]">Course Detail</div>
              <h1 className="font-[var(--font-display)] text-4xl font-normal leading-tight sm:text-5xl">{course.title}</h1>
              {course.subtitle && <p className="mt-3 text-lg text-[#F4D3A2]">{course.subtitle}</p>}
              {course.summary && <p className="mt-5 max-w-2xl text-base leading-8 text-[#DDE8E2]">{course.summary}</p>}
            </div>
            <div className="rounded-xl border border-white/15 bg-white/8 p-5">
              <div className="grid grid-cols-2 gap-4">
                <Info label="费用" value={course.price_display || '价格面议'} strong />
                <Info label="时长" value={formatDuration(course.duration_minutes)} />
                <Info label="场地" value={course.venue || '待定'} />
                <Info label="时间" value={course.schedule_note || '课程时间和教练自行约定'} />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[1fr_360px] lg:px-8">
        <div className="space-y-8">
          <div className="overflow-hidden rounded-xl border border-[#E0D8CC] bg-[#FEFCF9]">
            <div className="aspect-[16/9] bg-[#EFE7DA]">
              <img src={heroImage} alt={course.title} className="h-full w-full object-cover" />
            </div>
            {gallery.length > 1 && (
              <div className="grid grid-cols-4 gap-2 border-t border-[#EDE5D8] p-3 md:grid-cols-6">
                {gallery.slice(1).map((url) => (
                  <div key={url} className="aspect-[4/3] overflow-hidden rounded-lg bg-[#EFE7DA]">
                    <img src={url} alt={course.title} className="h-full w-full object-cover" />
                  </div>
                ))}
              </div>
            )}
          </div>

          <section className="rounded-xl border border-[#E0D8CC] bg-[#FEFCF9] p-6">
            <h2 className="font-[var(--font-display)] text-3xl font-normal text-[#2E2118]">课程内容</h2>
            <p className="mt-4 whitespace-pre-line text-sm leading-8 text-stone-600">
              {course.description || course.summary || '暂无课程介绍。'}
            </p>
          </section>

          {course.techniques.length > 0 && (
            <section className="rounded-xl border border-[#E0D8CC] bg-[#FEFCF9] p-6">
              <div className="mb-5 flex items-end justify-between gap-4">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8B7355]">Technique Library</div>
                  <h2 className="mt-2 font-[var(--font-display)] text-3xl font-normal text-[#2E2118]">技术动作安排</h2>
                </div>
                <div className="text-sm text-stone-400">{course.techniques.length} 个动作</div>
              </div>
              <div className="space-y-5">
                {groupTechniques(course.techniques).map(([stageLabel, techniques]) => (
                  <div key={stageLabel}>
                    <h3 className="mb-3 text-sm font-semibold text-stone-700">{stageLabel}</h3>
                    <div className="grid gap-2 md:grid-cols-2">
                      {techniques.map((technique) => (
                        <div key={technique.technique_id} className="rounded-lg border border-[#EDE5D8] bg-white p-3">
                          <div className="flex items-center gap-2">
                            {technique.source_code && <span className="rounded bg-[#F0EAE0] px-2 py-0.5 text-xs text-[#7A6145]">{technique.source_code}</span>}
                            <span className="text-sm font-medium text-[#2E2118]">{technique.name}</span>
                          </div>
                          {technique.key_points && <p className="mt-2 line-clamp-2 text-xs leading-6 text-stone-500">{technique.key_points}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        <aside className="space-y-5 lg:sticky lg:top-20 lg:self-start">
          <div className="rounded-xl border border-[#E0D8CC] bg-[#FEFCF9] p-5">
            <div className="text-xs text-stone-400">课程费用</div>
            <div className="mt-2 text-xl font-semibold text-[#7A4F24]">{course.price_display || '价格面议'}</div>
            <div className="mt-5 grid gap-4 text-sm text-stone-600">
              <InfoBlock label="场地" value={course.venue || '待定'} />
              <InfoBlock label="器材" value={course.equipment_note || '按课程提供'} />
              <InfoBlock label="板型" value={course.board_note || '按课程安排'} />
              <InfoBlock label="时间" value={course.schedule_note || '课程时间和教练自行约定'} />
            </div>
          </div>
          <CourseContactCard />
          <Link href="/courses" className="block text-sm text-stone-400 hover:text-[#8B7355]">← 返回课程列表</Link>
        </aside>
      </section>
    </main>
  );
}

function Info({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div>
      <div className="text-xs text-[#B8CCC4]">{label}</div>
      <div className={`mt-1 text-sm leading-6 ${strong ? 'font-semibold text-[#F4D3A2]' : 'text-white'}`}>{value}</div>
    </div>
  );
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-stone-400">{label}</div>
      <div className="mt-1 leading-6 text-stone-700">{value}</div>
    </div>
  );
}
