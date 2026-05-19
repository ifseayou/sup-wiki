import Link from 'next/link';
import pool from '@/lib/db';
import { parseJsonArray } from '@/lib/course-utils';
import type { RowDataPacket } from 'mysql2';

export const dynamic = 'force-dynamic';

interface CourseRow extends RowDataPacket {
  course_id: number;
  slug: string;
  title: string;
  subtitle: string | null;
  summary: string | null;
  venue: string | null;
  schedule_note: string | null;
  equipment_note: string | null;
  board_note: string | null;
  duration_minutes: number | null;
  price_display: string | null;
  cover_image: string | null;
  images: unknown;
  techniques_count: number;
}

interface CourseCardItem extends Omit<CourseRow, 'images'> {
  images: string[];
}

const fallbackImages = [
  '/quiz-images/correct-stance.svg',
  '/quiz-images/paddle-stroke-angle.svg',
  '/quiz-images/paddle-blade-direction.svg',
  '/quiz-images/board-types-overview.svg',
];

async function getCourses(): Promise<CourseCardItem[]> {
  try {
    const [rows] = await pool.execute<CourseRow[]>(
      `SELECT c.course_id, c.slug, c.title, c.subtitle, c.summary, c.venue, c.schedule_note,
              c.equipment_note, c.board_note, c.duration_minutes, c.price_display,
              c.cover_image, c.images, COUNT(ct.technique_id) AS techniques_count
       FROM sup_courses c
       LEFT JOIN sup_course_techniques ct ON ct.course_id = c.course_id
       WHERE c.status = 'published'
       GROUP BY c.course_id
       ORDER BY c.sort_order ASC, c.course_id ASC`
    );
    return rows.map((row) => ({
      ...row,
      images: parseJsonArray(row.images).filter((item): item is string => typeof item === 'string'),
    }));
  } catch (error) {
    console.error('获取课程列表失败:', error);
    return [];
  }
}

function formatDuration(minutes: number | null) {
  if (!minutes) return '灵活约课';
  if (minutes % 60 === 0) return `${minutes / 60} 小时`;
  return `${minutes} 分钟`;
}

function getCover(course: CourseCardItem, index: number) {
  return course.cover_image || course.images[0] || fallbackImages[index % fallbackImages.length];
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
        <div className="relative mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <div className="mb-4 text-xs font-semibold uppercase tracking-[0.22em] text-[#DFAE72]">SUP Courses</div>
            <h1 className="font-[var(--font-display)] text-4xl font-normal leading-tight sm:text-5xl">
              余杭塘河桨板课程
            </h1>
            <p className="mt-5 text-base leading-8 text-[#DDE8E2]">
              先选课程，再进详情看完整内容、课程图片和技术动作安排。默认场地为中流击水桨板俱乐部（余杭塘河-梦想小镇段），课程时间和教练自行约定。
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        {courses.length === 0 ? (
          <div className="rounded-xl border border-[#E0D8CC] bg-[#FEFCF9] py-20 text-center text-stone-500">
            暂无已发布课程
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            {courses.map((course, index) => (
              <Link
                key={course.course_id}
                href={`/courses/${course.slug}`}
                className="group overflow-hidden rounded-xl border border-[#E0D8CC] bg-[#FEFCF9] shadow-sm transition-all hover:-translate-y-1 hover:border-[#8B7355] hover:shadow-md"
              >
                <div className="relative aspect-[4/3] bg-[#EFE7DA]">
                  <img
                    src={getCover(course, index)}
                    alt={course.title}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                  />
                  <div className="absolute left-4 top-4 rounded-full bg-[#112F32] px-3 py-1 text-xs font-medium text-white">
                    {formatDuration(course.duration_minutes)}
                  </div>
                </div>
                <div className="p-5">
                  <div className="mb-3 flex flex-wrap gap-2">
                    {course.board_note && (
                      <span className="rounded-full bg-[#F4ECF7] px-2.5 py-1 text-xs text-[#6C3483]">{course.board_note}</span>
                    )}
                    <span className="rounded-full bg-[#E9F7EF] px-2.5 py-1 text-xs text-[#0E6655]">
                      {course.techniques_count || 0} 个动作
                    </span>
                  </div>
                  <h2 className="font-[var(--font-display)] text-2xl font-normal leading-tight text-[#2E2118] group-hover:text-[#7A6145]">
                    {course.title}
                  </h2>
                  {course.subtitle && <p className="mt-1 text-sm font-medium text-[#8B7355]">{course.subtitle}</p>}
                  {course.summary && <p className="mt-4 line-clamp-3 text-sm leading-7 text-stone-600">{course.summary}</p>}
                  <div className="mt-5 border-t border-[#EDE5D8] pt-4">
                    <div className="text-xs text-stone-400">课程费用</div>
                    <div className="mt-1 text-base font-semibold text-[#7A4F24]">{course.price_display || '价格面议'}</div>
                  </div>
                  <div className="mt-4 text-xs text-stone-400">查看课程详情 →</div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
