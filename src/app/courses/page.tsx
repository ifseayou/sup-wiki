import Link from 'next/link';
import pool from '@/lib/db';
import { parseJsonArray, parseStringArray } from '@/lib/course-utils';
import { CUSTOMER_SERVICE_WECHAT } from '@/lib/constants';
import type { RowDataPacket } from 'mysql2';

export const dynamic = 'force-dynamic';

interface CourseRow extends RowDataPacket {
  course_id: number;
  slug: string;
  title: string;
  subtitle: string | null;
  summary: string | null;
  positioning: string | null;
  course_type: string | null;
  audience_tags: unknown;
  learning_outcomes: unknown;
  target_audience: unknown;
  venue: string | null;
  capacity_note: string | null;
  equipment_note: string | null;
  board_note: string | null;
  duration_minutes: number | null;
  price_display: string | null;
  cover_image: string | null;
  images: unknown;
  techniques_count: number;
}

interface CourseCardItem extends Omit<CourseRow, 'images' | 'audience_tags' | 'learning_outcomes' | 'target_audience'> {
  images: string[];
  audience_tags: string[];
  learning_outcomes: string[];
  target_audience: string[];
}

const fallbackImages = [
  '/quiz-images/correct-stance.svg',
  '/quiz-images/paddle-stroke-angle.svg',
  '/quiz-images/paddle-blade-direction.svg',
  '/quiz-images/board-types-overview.svg',
];

const courseGuide = [
  ['第一次玩、只想体验', '选体验课'],
  ['想真正学会独立划行', '选入门课'],
  ['已经会划，想练竞速板', '选进阶课'],
  ['想从零基础一路系统训练', '选入门&进阶完整课'],
];

const safetyNotes = ['全程穿戴救生衣', '选择静水安全上下水区域', '根据天气、风力和水流决定是否下水', '雷雨、大风、水况异常时延期'];
const faq = [
  ['不会游泳可以参加吗？', '可以提前沟通。课程全程穿救生衣，并在安全水域进行，但需要能接受落水。'],
  ['一定会掉水吗？', '桨板是水上运动，落水是正常学习过程，课程会专门讲解回板。'],
  ['需要自己带桨板吗？', '不需要，课程提供基础教学器材。'],
  ['下雨还能上课吗？', '小雨视情况决定；雷雨、大风、水流异常、能见度差等情况延期。'],
];

async function getCourses(): Promise<CourseCardItem[]> {
  try {
    const [rows] = await pool.execute<CourseRow[]>(
      `SELECT c.*, COUNT(ct.technique_id) AS techniques_count
       FROM sup_courses c
       LEFT JOIN sup_course_techniques ct ON ct.course_id = c.course_id
       WHERE c.status = 'published'
       GROUP BY c.course_id
       ORDER BY c.sort_order ASC, c.course_id ASC`
    );
    return rows.map((row) => ({
      ...row,
      images: parseJsonArray(row.images).filter((item): item is string => typeof item === 'string'),
      audience_tags: parseStringArray(row.audience_tags),
      learning_outcomes: parseStringArray(row.learning_outcomes),
      target_audience: parseStringArray(row.target_audience),
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
    <main className="bg-[#F8F3EA] text-[#2E2118]">
      <section className="relative overflow-hidden border-b border-[#E3D7C7] bg-[#163B3B] text-white">
        <div className="absolute inset-0 opacity-25" style={{
          backgroundImage: 'linear-gradient(115deg, rgba(255,255,255,.08) 0 1px, transparent 1px), linear-gradient(145deg, rgba(218,163,84,.25), transparent 58%)',
          backgroundSize: '38px 38px, auto',
        }} />
        <div className="relative mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1.1fr_.9fr] lg:px-8">
          <div>
            <div className="mb-4 text-xs font-semibold uppercase tracking-[0.22em] text-[#DFAE72]">SUP Course Center</div>
            <h1 className="font-[var(--font-display)] text-4xl font-normal leading-tight sm:text-5xl">
              杭州余杭塘河桨板课程
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-8 text-[#DDE8E2]">
              从第一次安全下水，到独立划行，再到竞速进阶。提供体验课、零基础入门课、进阶训练课和完整技术路径课程，全程提供器材。
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href="#course-list" className="rounded-full bg-[#D39A3D] px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-[#BC8129]">查看适合我的课程</a>
              <a href="#faq" className="rounded-full border border-white/25 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10">先看常见问题</a>
            </div>
          </div>
          <div className="rounded-2xl border border-white/15 bg-white/10 p-6 backdrop-blur">
            <div className="text-sm text-[#F4D3A2]">微信咨询课程</div>
            <div className="mt-2 font-[var(--font-display)] text-4xl tracking-wide">{CUSTOMER_SERVICE_WECHAT}</div>
            <p className="mt-4 text-sm leading-7 text-[#DDE8E2]">添加微信后备注：课程名 + 姓名 + 人数 + 希望上课时间。课程信息仅供参考，最终以教练沟通为准。</p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid gap-4 md:grid-cols-4">
          {courseGuide.map(([need, suggestion]) => (
            <div key={need} className="rounded-xl border border-[#E0D8CC] bg-[#FEFCF9] p-5">
              <div className="text-sm text-stone-500">{need}</div>
              <div className="mt-2 text-lg font-semibold text-[#7A4F24]">{suggestion}</div>
            </div>
          ))}
        </div>
      </section>

      <section id="course-list" className="mx-auto max-w-7xl px-4 pb-10 sm:px-6 lg:px-8">
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[#9B6B2F]">Courses</div>
            <h2 className="mt-2 font-[var(--font-display)] text-3xl font-normal">选择你的课程</h2>
          </div>
        </div>
        {courses.length === 0 ? (
          <div className="rounded-xl border border-[#E0D8CC] bg-[#FEFCF9] py-20 text-center text-stone-500">暂无已发布课程</div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            {courses.map((course, index) => (
              <Link key={course.course_id} href={`/courses/${course.slug}`} className="group flex min-h-full flex-col overflow-hidden rounded-xl border border-[#E0D8CC] bg-[#FEFCF9] shadow-sm transition-all hover:-translate-y-1 hover:border-[#8B7355] hover:shadow-md">
                <div className="relative aspect-[4/3] bg-[#EFE7DA]">
                  <img src={getCover(course, index)} alt={course.title} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
                  <div className="absolute left-4 top-4 rounded-full bg-[#163B3B] px-3 py-1 text-xs font-medium text-white">{formatDuration(course.duration_minutes)}</div>
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <div className="mb-3 flex flex-wrap gap-2">
                    {course.audience_tags.slice(0, 3).map((tag) => <span key={tag} className="rounded-full bg-[#F2E8D9] px-2.5 py-1 text-xs text-[#8B5A21]">{tag}</span>)}
                    <span className="rounded-full bg-[#E8F5EF] px-2.5 py-1 text-xs text-[#0E6655]">{course.techniques_count || 0} 个动作</span>
                  </div>
                  <h3 className="font-[var(--font-display)] text-2xl font-normal leading-tight group-hover:text-[#7A6145]">{course.title}</h3>
                  <p className="mt-2 text-sm font-medium text-[#8B7355]">{course.positioning || course.subtitle || '安全、系统、专业的桨板课程'}</p>
                  <div className="mt-4 space-y-2 text-sm leading-6 text-stone-600">
                    {(course.learning_outcomes.length ? course.learning_outcomes : course.target_audience).slice(0, 3).map((item) => <div key={item}>• {item}</div>)}
                  </div>
                  <div className="mt-auto border-t border-[#EDE5D8] pt-4">
                    <div className="text-xs text-stone-400">课程费用</div>
                    <div className="mt-1 text-base font-semibold text-[#7A4F24]">{course.price_display || '价格面议'}</div>
                    <div className="mt-2 text-xs leading-5 text-stone-400">{course.capacity_note || course.equipment_note || '提供基础教学器材'}</div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="border-y border-[#E3D7C7] bg-[#FEFCF9]">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[.9fr_1.1fr] lg:px-8">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[#9B6B2F]">Safety First</div>
            <h2 className="mt-2 font-[var(--font-display)] text-3xl font-normal">安全保障写在前面</h2>
            <p className="mt-4 text-sm leading-7 text-stone-600">桨板是水上运动，落水是正常学习过程。课程会优先处理救生衣、天气、水域和回板问题。</p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {safetyNotes.map((note) => <div key={note} className="rounded-xl border border-[#E0D8CC] bg-[#F8F3EA] p-4 text-sm font-medium text-[#3E3024]">✓ {note}</div>)}
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-3 lg:px-8">
        <Link href="/learn/quiz" className="rounded-xl border border-[#E0D8CC] bg-[#FEFCF9] p-5 hover:border-[#8B7355]">
          <div className="text-sm font-semibold text-[#7A4F24]">报名前做 5 道安全题</div>
          <p className="mt-2 text-sm leading-7 text-stone-600">先了解救生衣、天气、水域和落水回板。</p>
        </Link>
        <Link href="/learn/docs" className="rounded-xl border border-[#E0D8CC] bg-[#FEFCF9] p-5 hover:border-[#8B7355]">
          <div className="text-sm font-semibold text-[#7A4F24]">学习文档</div>
          <p className="mt-2 text-sm leading-7 text-stone-600">课程前后都可以复习装备和基础动作。</p>
        </Link>
        <Link href="/learn" className="rounded-xl border border-[#E0D8CC] bg-[#FEFCF9] p-5 hover:border-[#8B7355]">
          <div className="text-sm font-semibold text-[#7A4F24]">技术动作体系</div>
          <p className="mt-2 text-sm leading-7 text-stone-600">把线下课程和 SUP Wiki 知识库打通。</p>
        </Link>
      </section>

      <section id="faq" className="mx-auto max-w-7xl px-4 pb-14 sm:px-6 lg:px-8">
        <h2 className="font-[var(--font-display)] text-3xl font-normal">常见问题</h2>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {faq.map(([question, answer]) => (
            <div key={question} className="rounded-xl border border-[#E0D8CC] bg-[#FEFCF9] p-5">
              <div className="font-semibold text-[#2E2118]">{question}</div>
              <p className="mt-2 text-sm leading-7 text-stone-600">{answer}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
