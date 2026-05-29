import Link from 'next/link';
import { notFound } from 'next/navigation';
import pool from '@/lib/db';
import type { RowDataPacket } from 'mysql2';
import { getEventResultStatusLabel, getEventStarBadgeStyle } from '@/lib/event-stars';
import { localResultSourceCondition } from '@/lib/result-source-scope';
import EventResultsPanel from '@/components/EventResultsPanel';
import ShareEventButton from '@/components/ShareEventButton';

interface EventRow extends RowDataPacket {
  event_id: number;
  name: string;
  name_en: string | null;
  slug: string;
  event_type: string;
  location: string | null;
  province: string | null;
  city: string | null;
  venue: string | null;
  start_date: string | null;
  end_date: string | null;
  registration_deadline: string | null;
  organizer: string | null;
  description: string | null;
  requirements: string | null;
  website: string | null;
  registration_url: string | null;
  contact_info: string | null;
  images: string | null;
  schedule: string | null;
  disciplines: string | null;
  price_range: string | null;
  max_participants: number | null;
  event_status: string;
  star_level: string | null;
  score_coefficient: string | null;
  source_scope: string | null;
  result_status: string | null;
  result_source_note: string | null;
  result_source_links: string | null;
}

interface EventStats extends RowDataPacket {
  result_count: number | string;
  module_count: number | string;
  point_count: number | string;
}

const eventTypeLabels: Record<string, string> = {
  race: '竞速赛',
  festival: '嘉年华',
  training: '训练营',
  exhibition: '展览赛',
};

const eventStatusLabels: Record<string, { label: string; style: string }> = {
  upcoming: { label: '即将开始', style: 'bg-[#FFF4DA] text-[#8A612F] border-[#E9D1A6]' },
  ongoing: { label: '进行中', style: 'bg-[#E8F2E5] text-[#567146] border-[#C8DEC1]' },
  completed: { label: '已结束', style: 'bg-[#EEF3F6] text-[#51636D] border-[#D6E0E6]' },
  cancelled: { label: '已取消', style: 'bg-red-50 text-red-700 border-red-200' },
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function parseJsonArray<T = unknown>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (!value) return [];
  try {
    const parsed = JSON.parse(String(value));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function getEvent(id: string) {
  try {
    const [rows] = await pool.execute<EventRow[]>(
      `SELECT * FROM sup_events WHERE event_id = ? AND status = 'published'`,
      [id]
    );
    if (rows.length === 0) return null;
    const e = rows[0];
    return {
      ...e,
      images: parseJsonArray<string>(e.images),
      schedule: parseJsonArray<{ date: string; time: string; event: string }>(e.schedule),
      disciplines: parseJsonArray<string>(e.disciplines),
      result_source_links: parseJsonArray<{ title: string; url: string }>(e.result_source_links),
    };
  } catch (error) {
    console.error('获取赛事详情失败:', error);
    return null;
  }
}

async function getEventStats(eventId: number) {
  try {
    const [resultRows] = await pool.execute<EventStats[]>(
      `SELECT
         COUNT(*) AS result_count,
         COUNT(DISTINCT CONCAT(er.discipline, '||', er.gender_group, '||', COALESCE(er.board_class, ''))) AS module_count
       FROM sup_event_results er
       INNER JOIN sup_event_result_sources src ON src.source_id = er.source_id
       INNER JOIN sup_events e ON e.event_id = er.event_id
       WHERE er.event_id = ? AND e.status = 'published'
         AND er.review_status = 'confirmed'
         AND er.is_verified = 1
         AND ${localResultSourceCondition}`,
      [eventId]
    );
    const [pointRows] = await pool.execute<EventStats[]>(
      `SELECT COUNT(*) AS point_count
       FROM sup_event_point_standings ps
       INNER JOIN sup_events e ON e.event_id = ps.event_id
       WHERE ps.event_id = ? AND e.status = 'published'`,
      [eventId]
    );
    return {
      resultCount: Number(resultRows[0]?.result_count || 0),
      moduleCount: Number(resultRows[0]?.module_count || 0),
      pointCount: Number(pointRows[0]?.point_count || 0),
    };
  } catch (error) {
    console.error('获取赛事成绩统计失败:', error);
    return { resultCount: 0, moduleCount: 0, pointCount: 0 };
  }
}

function InfoIcon({ type }: { type: 'calendar' | 'pin' | 'file' | 'fee' | 'trophy' | 'cube' | 'star' }) {
  const paths = {
    calendar: 'M7 3v3M17 3v3M4.5 9h15M6 5h12a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z',
    pin: 'M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11Zm0-8.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z',
    file: 'M7 3h7l4 4v14H7V3Zm7 0v5h5M9.5 13h5M9.5 17h4',
    fee: 'M12 3v18M7 7.5h7a3 3 0 0 1 0 6H9a3 3 0 0 0 0 6h8',
    trophy: 'M8 4h8v3.5a4 4 0 0 1-8 0V4Zm0 2H5.5a2.5 2.5 0 0 0 0 5H8m8-5h2.5a2.5 2.5 0 0 1 0 5H16M12 12v4M9 20h6M10 16h4v4h-4v-4Z',
    cube: 'm12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Zm0 0v9m8-4.5-8 4.5m-8-4.5 8 4.5',
    star: 'm12 3 2.6 5.5 6 .9-4.3 4.2 1 6-5.3-2.9-5.3 2.9 1-6-4.3-4.2 6-.9L12 3Z',
  };
  return (
    <svg className="h-5 w-5 text-[#8A612F]" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d={paths[type]} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function buildResultBookUploadHref(event: Pick<EventRow, 'event_id' | 'name' | 'start_date'>, dateLabel: string, placeLabel: string) {
  const params = new URLSearchParams({
    event_id: String(event.event_id),
    event_name: event.name,
    location: placeLabel === '待公布' ? '' : placeLabel,
  });
  if (event.start_date) params.set('event_date', formatDate(event.start_date));
  else if (dateLabel !== '待公布') params.set('event_date', dateLabel);
  return `/events/upload-results?${params.toString()}`;
}

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const event = await getEvent(id);
  if (!event) notFound();

  const stats = await getEventStats(event.event_id);
  const statusInfo = eventStatusLabels[event.event_status] || { label: event.event_status, style: 'bg-stone-100 text-stone-600 border-stone-200' };
  const heroImage = Array.isArray(event.images) && event.images.length > 0 ? event.images[0] : null;
  const dateLabel = event.start_date
    ? `${formatDate(event.start_date)}${event.end_date ? ` — ${formatDate(event.end_date)}` : ''}`
    : '待公布';
  const placeLabel = [event.venue, event.city, event.province].filter(Boolean).join('，') || event.location || '待公布';
  const needsResultBook = event.event_status === 'completed' && (stats.resultCount === 0 || event.result_status === 'none' || !event.result_status);
  const resultBookUploadHref = buildResultBookUploadHref(event, dateLabel, placeLabel);

  return (
    <main className="min-h-screen bg-[#F7F1E8] text-[#2E2118]">
      <div className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8">
        <nav className="mb-6 flex flex-wrap items-center gap-2 text-sm text-[#8A8078]">
          <Link href="/" className="no-underline hover:text-[#8A612F]">首页</Link>
          <span>/</span>
          <Link href="/events" className="no-underline hover:text-[#8A612F]">赛事</Link>
          <span>/</span>
          <span className="font-medium text-[#2E2118]">{event.name}</span>
        </nav>

        <div className="mb-4 flex flex-wrap gap-7 border-b border-[#E6DCCC] text-sm font-semibold text-[#655D56]">
          {[
            { href: '#overview', label: '赛事概览', icon: 'calendar' as const },
            { href: '#results', label: '成绩档案', icon: 'trophy' as const },
            { href: '#notes', label: '赛事说明', icon: 'file' as const },
          ].map((tab) => (
            <a
              key={tab.href}
              href={tab.href}
              className={`inline-flex items-center gap-2 border-b-2 px-3 py-4 no-underline transition ${tab.href === '#results' ? 'border-[#B58A48] text-[#8A612F]' : 'border-transparent hover:text-[#8A612F]'}`}
            >
              <InfoIcon type={tab.icon} />
              {tab.label}
            </a>
          ))}
        </div>

        <section id="overview" className="mb-0 overflow-hidden rounded-2xl border border-[#E4D8C8] bg-white/78 p-4 shadow-[0_18px_50px_rgba(88,63,36,0.10)]">
          <div className="grid gap-4 lg:grid-cols-[1fr_220px]">
            <div
              className="relative min-h-[300px] overflow-hidden rounded-xl bg-[#EFE5D6] p-6 sm:p-8"
              style={{
                backgroundImage: heroImage
                  ? `linear-gradient(90deg, rgba(250,247,242,0.96) 0%, rgba(250,247,242,0.82) 45%, rgba(250,247,242,0.36) 100%), url(${heroImage})`
                  : 'linear-gradient(90deg, rgba(250,247,242,0.98) 0%, rgba(250,247,242,0.84) 44%, rgba(214,196,165,0.26) 100%), radial-gradient(circle at 70% 50%, rgba(130,154,147,0.32), transparent 35%)',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }}
            >
              <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-[#F7F1E8]/80 to-transparent" />
              <div className="relative max-w-4xl">
                <div className="mb-8 flex flex-wrap items-center gap-2">
                  <span className={`rounded-full border px-4 py-1.5 text-sm font-semibold ${statusInfo.style}`}>
                    {statusInfo.label}
                  </span>
                  {event.star_level && (
                    <span className={`rounded-full border px-4 py-1.5 text-sm font-semibold ${getEventStarBadgeStyle(event.star_level)}`}>
                      {event.star_level}{event.score_coefficient ? ` / ${event.score_coefficient}` : ''}
                    </span>
                  )}
                  <span className="rounded-full border border-[#EAD8B9] bg-[#FFF7E8] px-4 py-1.5 text-sm font-semibold text-[#8A612F]">
                    {eventTypeLabels[event.event_type] || event.event_type}
                  </span>
                </div>

                <h1 className="max-w-4xl font-[var(--font-display)] text-4xl font-semibold leading-tight tracking-[0.01em] text-[#2E2118] sm:text-5xl">
                  {event.name}
                </h1>
                {event.name_en && <p className="mt-3 max-w-3xl text-sm text-[#655D56]">{event.name_en}</p>}

                <div className="mt-9 grid gap-5 text-sm sm:grid-cols-2 lg:grid-cols-4">
                  <div className="flex items-start gap-3">
                    <InfoIcon type="calendar" />
                    <div>
                      <div className="text-xs text-[#8A8078]">赛事日期</div>
                      <div className="mt-1 font-semibold text-[#2E2118]">{dateLabel}</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <InfoIcon type="pin" />
                    <div>
                      <div className="text-xs text-[#8A8078]">举办地点</div>
                      <div className="mt-1 font-semibold text-[#2E2118]">{placeLabel}</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <InfoIcon type="file" />
                    <div>
                      <div className="text-xs text-[#8A8078]">成绩档案</div>
                      <div className="mt-1 font-semibold text-[#2E2118]">{getEventResultStatusLabel(event.result_status)}</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <InfoIcon type="fee" />
                    <div>
                      <div className="text-xs text-[#8A8078]">报名费用</div>
                      <div className="mt-1 font-semibold text-[#2E2118]">{event.price_range || '待公布'}</div>
                    </div>
                  </div>
                </div>

                <div className="mt-9 flex flex-wrap gap-3">
                  <a
                    href="#notes"
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-[#CFAE7D] bg-white/72 px-8 text-sm font-semibold text-[#8A612F] no-underline transition hover:bg-white"
                  >
                    <InfoIcon type="file" />
                    查看赛事说明
                  </a>
                  {event.registration_url && event.event_status !== 'completed' && event.event_status !== 'cancelled' ? (
                    <a
                      href={event.registration_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-11 items-center justify-center rounded-lg bg-[#B58A48] px-8 text-sm font-semibold text-white no-underline shadow-[0_10px_20px_rgba(138,97,47,0.20)] transition hover:bg-[#8A612F]"
                    >
                      立即报名
                    </a>
                  ) : (
                    <span className="inline-flex h-11 items-center justify-center rounded-lg bg-[#EAE4DB] px-8 text-sm font-semibold text-[#A99D90]">
                      报名已结束
                    </span>
                  )}
                  <ShareEventButton title={event.name} />
                </div>
              </div>
            </div>

            <aside className="rounded-xl border border-[#E4D8C8] bg-[#FEFCF9]/88 p-5">
              {[
                { label: '成绩', value: stats.resultCount, icon: 'trophy' as const },
                { label: '模块', value: stats.moduleCount, icon: 'cube' as const },
                { label: '积分', value: stats.pointCount, icon: 'star' as const },
              ].map((item, index) => (
                <div key={item.label} className={`flex items-center gap-4 py-5 ${index > 0 ? 'border-t border-[#E4D8C8]' : ''}`}>
                  <InfoIcon type={item.icon} />
                  <div>
                    <div className="font-[var(--font-display)] text-4xl font-semibold leading-none text-[#2E2118]">{item.value}</div>
                    <div className="mt-1 text-sm text-[#655D56]">{item.label}</div>
                  </div>
                </div>
              ))}
            </aside>
          </div>
        </section>

        <div id="results">
          <EventResultsPanel eventId={event.event_id} />
        </div>

        {needsResultBook && (
          <section
            id="result-book-submit"
            className="mt-8 overflow-hidden rounded-[28px] border border-[#D9B574] bg-[#FFF8EA] shadow-[0_22px_60px_rgba(110,78,36,0.13)]"
          >
            <div
              className="grid gap-6 p-6 sm:p-8 lg:grid-cols-[1fr_280px]"
              style={{
                background:
                  'radial-gradient(circle at 12% 18%, rgba(255,255,255,0.92), transparent 30%), radial-gradient(circle at 86% 0%, rgba(203,151,78,0.24), transparent 28%), linear-gradient(135deg, rgba(255,248,234,0.98), rgba(249,236,211,0.88))',
              }}
            >
              <div>
                <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#D9B574] bg-white/70 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-[#8A612F]">
                  Result Book Needed
                </div>
                <h2 className="font-[var(--font-display)] text-3xl font-semibold leading-tight text-[#2E2118] sm:text-4xl">
                  上传官方成绩册 PDF
                </h2>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-[#655D56]">
                  这场比赛目前还缺官方成绩册。仅支持 PDF，单个不超过 20MB，管理员复核后收录到赛事成绩档案。
                </p>
                <div className="mt-5 grid gap-3 text-sm text-[#6F6258] sm:grid-cols-3">
                  <div className="rounded-2xl border border-white/70 bg-white/62 px-4 py-3">
                    <div className="text-xs text-[#9A8978]">赛事</div>
                    <div className="mt-1 font-semibold text-[#2E2118]">{event.name}</div>
                  </div>
                  <div className="rounded-2xl border border-white/70 bg-white/62 px-4 py-3">
                    <div className="text-xs text-[#9A8978]">日期</div>
                    <div className="mt-1 font-semibold text-[#2E2118]">{dateLabel}</div>
                  </div>
                  <div className="rounded-2xl border border-white/70 bg-white/62 px-4 py-3">
                    <div className="text-xs text-[#9A8978]">地点</div>
                    <div className="mt-1 font-semibold text-[#2E2118]">{placeLabel}</div>
                  </div>
                </div>
              </div>
              <div className="flex flex-col justify-between rounded-[22px] border border-[#D8B273] bg-[#2E2118] p-5 text-white shadow-[0_18px_36px_rgba(46,33,24,0.20)]">
                <div>
                  <div className="text-xs uppercase tracking-[0.24em] text-[#E3C892]">Community Archive</div>
                  <p className="mt-4 text-sm leading-7 text-[#F7E9D0]">
                    有完整成绩册的人，实际上是在帮这场比赛建立可引用的公共档案。
                  </p>
                </div>
                <Link
                  href={resultBookUploadHref}
                  className="mt-6 inline-flex h-12 items-center justify-center rounded-2xl bg-[#D7A04E] px-5 text-sm font-semibold text-[#2E2118] no-underline transition hover:bg-[#E6B966]"
                >
                  选择 PDF 并提交
                </Link>
              </div>
            </div>
          </section>
        )}

        <section id="notes" className="mt-8 grid gap-6 lg:grid-cols-2">
          {event.description && (
            <div className="rounded-2xl border border-[#E4D8C8] bg-[#FEFCF9] p-6">
              <h2 className="text-lg font-semibold text-[#2E2118]">赛事介绍</h2>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-[#655D56]">{event.description}</p>
            </div>
          )}
          {event.requirements && (
            <div className="rounded-2xl border border-[#E4D8C8] bg-[#FEFCF9] p-6">
              <h2 className="text-lg font-semibold text-[#2E2118]">参赛要求</h2>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-[#655D56]">{event.requirements}</p>
            </div>
          )}
          {event.disciplines.length > 0 && (
            <div className="rounded-2xl border border-[#E4D8C8] bg-[#FEFCF9] p-6">
              <h2 className="text-lg font-semibold text-[#2E2118]">参赛项目</h2>
              <div className="mt-4 flex flex-wrap gap-2">
                {event.disciplines.map((discipline) => (
                  <span key={discipline} className="rounded-lg bg-[#F0E7D8] px-3 py-1.5 text-sm font-medium text-[#7A6145]">
                    {discipline}
                  </span>
                ))}
              </div>
            </div>
          )}
          {event.schedule.length > 0 && (
            <div className="rounded-2xl border border-[#E4D8C8] bg-[#FEFCF9] p-6">
              <h2 className="text-lg font-semibold text-[#2E2118]">赛程安排</h2>
              <div className="mt-4 overflow-hidden rounded-xl border border-[#E6DCCC]">
                {event.schedule.map((item, index) => (
                  <div key={`${item.date}-${item.time}-${index}`} className={`grid grid-cols-[88px_64px_1fr] gap-3 px-4 py-3 text-sm ${index % 2 ? 'bg-[#F8F2EA]' : 'bg-white'}`}>
                    <span className="text-[#8A8078]">{item.date}</span>
                    <span className="text-[#8A8078]">{item.time}</span>
                    <span className="text-[#655D56]">{item.event}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {(event.contact_info || event.result_source_note) && (
            <div className="rounded-2xl border border-[#E4D8C8] bg-[#FEFCF9] p-6 lg:col-span-2">
              <h2 className="text-lg font-semibold text-[#2E2118]">补充信息</h2>
              {event.contact_info && <p className="mt-3 text-sm leading-7 text-[#655D56]">{event.contact_info}</p>}
              {event.result_source_note && <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-[#655D56]">{event.result_source_note}</p>}
            </div>
          )}
        </section>

        <div className="mt-8">
          <Link href="/events" className="text-sm font-medium text-[#8A8078] no-underline transition hover:text-[#8A612F]">
            ← 返回赛事列表
          </Link>
        </div>
      </div>
    </main>
  );
}
