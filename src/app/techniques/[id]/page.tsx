import Link from 'next/link';
import { notFound } from 'next/navigation';
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

interface TechniqueDetail extends RowDataPacket {
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
}

interface CourseRow extends RowDataPacket {
  course_id: number;
  slug: string;
  title: string;
  subtitle: string | null;
  cover_image: string | null;
  price_display: string | null;
  duration_minutes: number | null;
  venue: string | null;
}

async function getTechnique(id: number) {
  try {
    const [rows] = await pool.execute<TechniqueDetail[]>(
      `SELECT technique_id, source_code, name, cover_image, images, stage, stage_label,
              level, category, points, key_points, common_errors, sort_order, updated_at
       FROM sup_techniques
       WHERE technique_id = ? AND status = 'published'
       LIMIT 1`,
      [id]
    );
    if (rows.length === 0) return null;

    const [courses] = await pool.execute<CourseRow[]>(
      `SELECT c.course_id, c.slug, c.title, c.subtitle, c.cover_image, c.price_display, c.duration_minutes, c.venue
       FROM sup_course_techniques ct
       INNER JOIN sup_courses c ON c.course_id = ct.course_id AND c.status = 'published'
       WHERE ct.technique_id = ?
       ORDER BY ct.sort_order ASC, c.sort_order ASC, c.course_id ASC`,
      [id]
    );

    const item = rows[0];
    const images = Array.from(new Set([item.cover_image, ...parseJsonArray(item.images)].filter((url): url is string => typeof url === 'string' && url.length > 0)));
    return { item, images, courses };
  } catch (error) {
    console.error('获取技术动作详情失败:', error);
    return null;
  }
}

function splitText(value: string | null) {
  return String(value || '')
    .split(/[\n；;]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatDuration(minutes: number | null) {
  if (!minutes) return '灵活约课';
  if (minutes % 60 === 0) return `${minutes / 60} 小时`;
  return `${minutes} 分钟`;
}

export default async function TechniqueDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getTechnique(Number(id));
  if (!data) notFound();
  const { item, images, courses } = data;
  const keyPoints = splitText(item.key_points);
  const errors = splitText(item.common_errors);

  return (
    <main className="min-h-screen bg-[#F6F0E7] text-[#2E2118]">
      <section className="border-b border-[#E2D3C1] bg-[#203D3D] text-white">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <nav className="mb-8 text-sm text-[#B9CCC7]">
            <Link href="/learn" className="hover:text-white">学习</Link>
            <span className="mx-2">/</span>
            <Link href="/techniques" className="hover:text-white">技术动作库</Link>
            <span className="mx-2">/</span>
            <span className="text-white">{item.name}</span>
          </nav>
          <div className="grid gap-8 lg:grid-cols-[1fr_420px]">
            <div>
              <div className="flex flex-wrap gap-2">
                {item.source_code && <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs">动作 {item.source_code}</span>}
                <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs">{item.stage_label}</span>
                <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs">{levelLabels[item.level] || item.level}</span>
              </div>
              <h1 className="mt-5 font-[var(--font-display)] text-5xl font-normal leading-tight sm:text-6xl">{item.name}</h1>
              <p className="mt-5 max-w-2xl text-base leading-8 text-[#D9E7E2]">
                {keyPoints[0] || '动作详情正在完善，课程中会结合水上练习进行讲解。'}
              </p>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/10 p-5">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <Info label="阶段" value={item.stage_label} />
                <Info label="难度" value={levelLabels[item.level] || item.level} />
                <Info label="分类" value={categoryLabels[item.category || 'general'] || item.category || '通用'} />
                <Info label="课程引用" value={`${courses.length} 门`} />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[1fr_360px] lg:px-8">
        <div className="space-y-8">
          <div className="overflow-hidden rounded-2xl border border-[#DED0BE] bg-[#FEFCF8]">
            <div className="aspect-[16/9] bg-[#EDE2D4]">
              {images[0] ? (
                <img src={images[0]} alt={item.name} className="h-full w-full object-cover" />
              ) : (
                <div className="grid h-full place-items-center bg-[linear-gradient(135deg,#E9DDCE,#F8F0E5)]">
                  <div className="text-center">
                    <div className="font-[var(--font-display)] text-7xl text-[#B08A5D]">{item.source_code || item.stage}</div>
                    <div className="mt-2 text-sm tracking-[0.2em] text-[#8B7355]">ACTION CARD</div>
                  </div>
                </div>
              )}
            </div>
            {images.length > 1 && (
              <div className="grid grid-cols-3 gap-2 border-t border-[#E8DCCD] p-3 sm:grid-cols-5">
                {images.slice(1).map((url) => (
                  <div key={url} className="aspect-[4/3] overflow-hidden rounded-xl bg-[#EDE2D4]">
                    <img src={url} alt={item.name} className="h-full w-full object-cover" />
                  </div>
                ))}
              </div>
            )}
          </div>

          <section className="rounded-2xl border border-[#DED0BE] bg-[#FEFCF8] p-6">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[#9B6B2F]">Key Points</div>
            <h2 className="mt-2 font-[var(--font-display)] text-3xl font-normal">动作要点</h2>
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {(keyPoints.length ? keyPoints : ['动作要点待后台补充。']).map((point, index) => (
                <div key={`${point}-${index}`} className="rounded-xl border border-[#E8DCCD] bg-white px-4 py-3 text-sm leading-7 text-stone-700">
                  {point}
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-[#DED0BE] bg-[#FEFCF8] p-6">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[#9B6B2F]">Common Errors</div>
            <h2 className="mt-2 font-[var(--font-display)] text-3xl font-normal">常见错误</h2>
            <div className="mt-5 space-y-3">
              {(errors.length ? errors : ['常见错误待后台补充。']).map((error, index) => (
                <div key={`${error}-${index}`} className="rounded-xl border border-[#E8DCCD] bg-white px-4 py-3 text-sm leading-7 text-stone-700">
                  {error}
                </div>
              ))}
            </div>
          </section>
        </div>

        <aside className="space-y-5 lg:sticky lg:top-20 lg:self-start">
          <div className="rounded-2xl border border-[#DED0BE] bg-[#FEFCF8] p-5">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[#9B6B2F]">Related Courses</div>
            <h2 className="mt-2 text-xl font-semibold">关联课程</h2>
            <div className="mt-4 space-y-3">
              {courses.length ? courses.map((course) => (
                <Link key={course.course_id} href={`/courses/${course.slug}`} className="block rounded-xl border border-[#E8DCCD] bg-white p-4 transition hover:border-[#8B7355]">
                  <div className="font-semibold text-[#2E2118]">{course.title}</div>
                  <div className="mt-1 text-xs leading-5 text-stone-500">{course.price_display || '价格面议'} · {formatDuration(course.duration_minutes)}</div>
                </Link>
              )) : (
                <div className="rounded-xl border border-[#E8DCCD] bg-white p-4 text-sm leading-7 text-stone-500">暂无课程引用该动作。</div>
              )}
            </div>
          </div>
          <Link href="/techniques" className="block text-sm text-stone-500 hover:text-[#8B7355]">返回技术动作库</Link>
        </aside>
      </section>
    </main>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-[#B9CCC7]">{label}</div>
      <div className="mt-1 font-semibold text-white">{value}</div>
    </div>
  );
}
