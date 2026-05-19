import Image from 'next/image';
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
  venue: string | null;
  schedule_note: string | null;
  equipment_note: string | null;
  board_note: string | null;
  duration_minutes: number | null;
  price_display: string | null;
  price_options: unknown;
  sort_order: number;
  techniques: unknown;
}

interface CourseItem extends Omit<CourseRow, 'price_options' | 'techniques'> {
  price_options: unknown[];
  techniques: TechniqueItem[];
}

const courseImages = [
  '/quiz-images/correct-stance.svg',
  '/quiz-images/paddle-stroke-angle.svg',
  '/quiz-images/paddle-blade-direction.svg',
  '/quiz-images/board-types-overview.svg',
];

const levelLabels: Record<string, string> = {
  beginner: '入门',
  intermediate: '进阶',
  advanced: '高阶',
};

async function getCourses(): Promise<CourseItem[]> {
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
       WHERE c.status = 'published'
       GROUP BY c.course_id
       ORDER BY c.sort_order ASC, c.course_id ASC`
    );
    return rows.map((row) => ({
      ...row,
      price_options: parseJsonArray(row.price_options),
      techniques: parseTechniqueJson(row.techniques).filter(Boolean),
    }));
  } catch (error) {
    console.error('获取课程列表失败:', error);
    return [];
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
  if (!minutes) return '灵活';
  if (minutes % 60 === 0) return `${minutes / 60} 小时`;
  return `${minutes} 分钟`;
}

export default async function CoursesPage() {
  const courses = await getCourses();

  return (
    <main className="bg-[#F8F3EA]">
      <section className="relative overflow-hidden border-b border-[#E3D7C7] bg-[#112F32] text-white">
        <div className="absolute inset-0 opacity-25" style={{
          backgroundImage: 'linear-gradient(115deg, rgba(255,255,255,.08) 0 1px, transparent 1px), linear-gradient(145deg, rgba(218,163,84,.22), transparent 55%)',
          backgroundSize: '36px 36px, auto',
        }} />
        <div className="relative mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 lg:grid-cols-[1.05fr_.95fr] lg:px-8 lg:py-16">
          <div className="flex flex-col justify-center">
            <div className="mb-4 text-xs font-semibold uppercase tracking-[0.22em] text-[#DFAE72]">SUP Courses</div>
            <h1 className="font-[var(--font-display)] text-4xl font-normal leading-tight sm:text-5xl">
              余杭塘河桨板课程
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-8 text-[#DDE8E2]">
              从第一次下水体验，到完整技术路径训练。课程默认在中流击水桨板俱乐部（余杭塘河-梦想小镇段）开展，时间和教练自行约定。
            </p>
            <div className="mt-7 grid max-w-2xl grid-cols-3 gap-3">
              {[
                ['4', '课程方案'],
                ['35', '技术动作库'],
                ['1:1', '可约教练'],
              ].map(([value, label]) => (
                <div key={label} className="border-l border-[#DFAE72]/60 pl-4">
                  <div className="font-[var(--font-display)] text-3xl text-[#F4D3A2]">{value}</div>
                  <div className="mt-1 text-xs text-[#B8CCC4]">{label}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="relative min-h-[260px] overflow-hidden rounded-xl border border-white/15 bg-[#F8F3EA] p-4 shadow-2xl">
            <div className="grid h-full grid-cols-2 gap-3">
              {courseImages.map((src, index) => (
                <div key={src} className="relative min-h-[130px] overflow-hidden rounded-lg bg-white">
                  <Image src={src} alt="桨板课程技术示意" fill className="object-contain p-3" priority={index === 0} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        {courses.length === 0 ? (
          <div className="rounded-xl border border-[#E0D8CC] bg-[#FEFCF9] py-20 text-center text-stone-500">
            暂无已发布课程
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-2">
            {courses.map((course, index) => (
              <article key={course.course_id} className="overflow-hidden rounded-xl border border-[#E0D8CC] bg-[#FEFCF9] shadow-sm transition-all hover:-translate-y-0.5 hover:border-[#8B7355] hover:shadow-md">
                <div className="grid gap-0 md:grid-cols-[220px_1fr]">
                  <div className="relative min-h-[220px] bg-[#EFE7DA]">
                    <Image
                      src={courseImages[index % courseImages.length]}
                      alt={`${course.title} 技术示意`}
                      fill
                      className="object-contain p-6"
                    />
                    <div className="absolute left-4 top-4 rounded-full bg-[#112F32] px-3 py-1 text-xs font-medium text-white">
                      {formatDuration(course.duration_minutes)}
                    </div>
                  </div>
                  <div className="p-5">
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-[#E9F7EF] px-3 py-1 text-xs font-medium text-[#0E6655]">
                        {course.schedule_note || '课程时间和教练自行约定'}
                      </span>
                      {course.board_note && (
                        <span className="rounded-full bg-[#F4ECF7] px-3 py-1 text-xs font-medium text-[#6C3483]">
                          {course.board_note}
                        </span>
                      )}
                    </div>
                    <h2 className="font-[var(--font-display)] text-3xl font-normal leading-tight text-[#2E2118]">
                      {course.title}
                    </h2>
                    {course.subtitle && <p className="mt-1 text-sm font-medium text-[#8B7355]">{course.subtitle}</p>}
                    {course.summary && <p className="mt-4 text-sm leading-7 text-stone-600">{course.summary}</p>}
                    <div className="mt-5 rounded-lg bg-[#F8F3EA] p-4">
                      <div className="text-xs text-stone-400">课程费用</div>
                      <div className="mt-1 text-lg font-semibold text-[#7A4F24]">{course.price_display || '价格面议'}</div>
                    </div>
                    <div className="mt-4 grid gap-3 text-sm text-stone-600 sm:grid-cols-2">
                      <div>
                        <span className="block text-xs text-stone-400">场地</span>
                        {course.venue}
                      </div>
                      <div>
                        <span className="block text-xs text-stone-400">器材</span>
                        {course.equipment_note || '按课程提供'}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="border-t border-[#EDE5D8] p-5">
                  {course.description && <p className="mb-4 text-sm leading-7 text-stone-600">{course.description}</p>}
                  {course.techniques.length > 0 && (
                    <div className="space-y-4">
                      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8B7355]">
                        技术动作安排
                      </div>
                      {groupTechniques(course.techniques).map(([stageLabel, techniques]) => (
                        <div key={stageLabel}>
                          <div className="mb-2 text-sm font-semibold text-stone-700">{stageLabel}</div>
                          <div className="flex flex-wrap gap-2">
                            {techniques.map((technique) => (
                              <span key={technique.technique_id} className="rounded-lg border border-[#E0D8CC] bg-white px-2.5 py-1.5 text-xs text-stone-600">
                                {technique.source_code && <span className="mr-1 text-[#A08060]">{technique.source_code}</span>}
                                {technique.name}
                                <span className="ml-1 text-stone-400">{levelLabels[technique.level] || technique.level}</span>
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="mt-5">
                    <CourseContactCard />
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
