import Link from 'next/link';
import { Suspense } from 'react';
import pool from '@/lib/db';
import type { RowDataPacket } from 'mysql2';
import FilterBar from '@/components/FilterBar';
import ArticleGuideTabs from '@/components/ArticleGuideTabs';
import AnnualGuideTimeline from '@/components/events/AnnualGuideTimeline';
import { GUIDE_EVENT_ORDER, type GuideTimelineEvent } from '@/lib/event-guide';
import { getEventStarBadgeStyle } from '@/lib/event-stars';

interface EventRow extends RowDataPacket {
  event_id: number;
  name: string;
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
  disciplines: string | null;
  price_range: string | null;
  event_status: string;
  star_level: string | null;
  score_coefficient: string | null;
  results_count: number;
}

type EventWithDisciplines = Omit<EventRow, 'disciplines'> & { disciplines: string[] };

const eventTypeLabels: Record<string, string> = {
  race: '竞速赛',
  festival: '嘉年华',
  training: '训练营',
  exhibition: '展览赛',
};

const eventStatusLabels: Record<string, { label: string; style: string }> = {
  upcoming: { label: '即将开始', style: 'bg-amber-100 text-amber-800' },
  ongoing: { label: '进行中', style: 'bg-green-100 text-green-800' },
  completed: { label: '已结束', style: 'bg-stone-100 text-stone-600' },
  cancelled: { label: '已取消', style: 'bg-red-100 text-red-600' },
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function getGuideArticles() {
  try {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT article_id, title, summary, content FROM sup_articles
       WHERE status = 'published' AND category = 'event_guide'
       ORDER BY sort_order ASC, article_id ASC`
    );
    return rows as { article_id: number; title: string; summary: string | null; content: string | null }[];
  } catch {
    return [];
  }
}

async function getEvents(event_type?: string, event_status?: string, province?: string) {
  try {
    const conditions: string[] = ["status = 'published'"];
    const params: string[] = [];

    if (event_type) {
      conditions.push('event_type = ?');
      params.push(event_type);
    }
    if (event_status) {
      conditions.push('event_status = ?');
      params.push(event_status);
    }
    if (province) {
      conditions.push('province = ?');
      params.push(province);
    }

    const where = `WHERE ${conditions.join(' AND ')}`;

    const [events] = await pool.execute<EventRow[]>(
      `SELECT event_id, name, slug, event_type, location, province, city, venue,
              start_date, end_date, registration_deadline, organizer,
              description, disciplines, price_range, event_status, star_level,
              score_coefficient, COALESCE(r.results_count, 0) AS results_count
       FROM sup_events
       LEFT JOIN (
         SELECT event_id, COUNT(*) AS results_count
         FROM sup_event_results
         GROUP BY event_id
       ) r ON r.event_id = sup_events.event_id
       ${where}
       ORDER BY
         CASE event_status WHEN 'ongoing' THEN 0 WHEN 'upcoming' THEN 1 WHEN 'completed' THEN 2 ELSE 3 END,
         start_date ASC`,
      params
    );

    return events.map((e) => ({
      ...e,
      disciplines: Array.isArray(e.disciplines) ? e.disciplines : (e.disciplines ? JSON.parse(e.disciplines) : []),
    }));
  } catch (error) {
    console.error('获取赛事列表失败:', error);
    return [];
  }
}

async function getGuideTimelineEvents() {
  try {
    const [events] = await pool.execute<EventRow[]>(
      `SELECT event_id, name, slug, event_type, province, city,
              start_date, end_date, organizer, description, disciplines
       FROM sup_events
       WHERE status = 'published'
         AND start_date >= '2025-01-01'
         AND start_date < '2026-01-01'
         AND slug IN (${GUIDE_EVENT_ORDER.map(() => '?').join(', ')})
       ORDER BY start_date ASC`,
      GUIDE_EVENT_ORDER
    );

    const parsed: GuideTimelineEvent[] = events.map((e) => ({
      event_id: e.event_id,
      name: e.name,
      slug: e.slug,
      province: e.province,
      city: e.city,
      start_date: e.start_date,
      end_date: e.end_date,
      organizer: e.organizer,
      description: e.description,
      disciplines: Array.isArray(e.disciplines) ? e.disciplines : (e.disciplines ? JSON.parse(e.disciplines) : []),
    }));

    return GUIDE_EVENT_ORDER.flatMap((slug) => {
      const match = parsed.find((event) => event.slug === slug);
      return match ? [match] : [];
    });
  } catch (error) {
    console.error('获取赛事导览图数据失败:', error);
    return [];
  }
}

const filters = [
  {
    key: 'event_type',
    placeholder: '全部类型',
    options: [
      { label: '竞速赛', value: 'race' },
      { label: '嘉年华', value: 'festival' },
      { label: '训练营', value: 'training' },
      { label: '展览赛', value: 'exhibition' },
    ],
  },
  {
    key: 'event_status',
    placeholder: '全部状态',
    options: [
      { label: '即将开始', value: 'upcoming' },
      { label: '进行中', value: 'ongoing' },
      { label: '已结束', value: 'completed' },
    ],
  },
  {
    key: 'province',
    placeholder: '全部省份',
    options: [
      { label: '北京', value: '北京' },
      { label: '浙江', value: '浙江' },
      { label: '海南', value: '海南' },
      { label: '云南', value: '云南' },
      { label: '山东', value: '山东' },
      { label: '江苏', value: '江苏' },
      { label: '河南', value: '河南' },
      { label: '宁夏', value: '宁夏' },
      { label: '湖南', value: '湖南' },
    ],
  },
];

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<{ event_type?: string; event_status?: string; province?: string }>;
}) {
  const { event_type, event_status, province } = await searchParams;
  const [events, guideArticles, timelineEvents] = await Promise.all([
    getEvents(event_type, event_status, province),
    getGuideArticles(),
    getGuideTimelineEvents(),
  ]);

  const upcomingOrOngoing = events.filter((e) => e.event_status === 'upcoming' || e.event_status === 'ongoing');
  const completed = events
    .filter((e) => e.event_status === 'completed')
    .sort((a, b) => new Date(b.start_date || 0).getTime() - new Date(a.start_date || 0).getTime());

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="mb-10">
        <h1 className="mb-2 text-3xl font-bold text-stone-800">国内赛事</h1>
        <p className="text-stone-500">掌握国内 SUP 桨板赛事动态，报名参与或关注精彩比赛</p>
      </div>

      <ArticleGuideTabs articles={guideArticles} />

      <Suspense>
        <FilterBar filters={filters} />
      </Suspense>

      {upcomingOrOngoing.length > 0 && (
        <section className="mb-12">
          <h2 className="mb-5 flex items-center gap-2 text-lg font-semibold text-stone-700">
            <span className="inline-block h-2 w-2 rounded-full bg-amber-500" />
            即将举办 / 进行中
          </h2>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {upcomingOrOngoing.map((event) => (
              <EventCard key={event.event_id} event={event} highlighted />
            ))}
          </div>
        </section>
      )}

      {timelineEvents.length > 0 && <AnnualGuideTimeline events={timelineEvents} />}

      {completed.length > 0 && (
        <section className="mb-12">
          <h2 className="mb-5 flex items-center gap-2 text-lg font-semibold text-stone-700">
            <span className="inline-block h-2 w-2 rounded-full bg-stone-400" />
            已结束赛事
          </h2>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {completed.map((event) => (
              <EventCard key={event.event_id} event={event} />
            ))}
          </div>
        </section>
      )}

      {events.length === 0 && (
        <div className="py-20 text-center">
          <p className="text-stone-500">暂无符合条件的赛事</p>
        </div>
      )}
    </div>
  );
}

function EventCard({ event, highlighted = false }: {
  event: EventWithDisciplines;
  highlighted?: boolean;
}) {
  const statusInfo = eventStatusLabels[event.event_status] || { label: event.event_status, style: 'bg-stone-100 text-stone-600' };
  const typeLabel = eventTypeLabels[event.event_type] || event.event_type;

  return (
    <Link
      href={`/events/${event.event_id}`}
      className={`group block rounded-xl border transition-all duration-200 hover:shadow-md ${
        highlighted
          ? 'border-[#E0D8CC] bg-[#FEFCF9] hover:border-[#8B7355]'
          : 'border-[#E0D8CC] bg-[#FEFCF9] opacity-80 hover:opacity-100'
      }`}
    >
      <div className={`h-1.5 rounded-t-xl ${highlighted ? 'bg-amber-400' : 'bg-stone-300'}`} />
      <div className="p-5">
        <div className="mb-3 flex items-center gap-2">
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusInfo.style}`}>
            {statusInfo.label}
          </span>
          {event.star_level && (
            <span className={`rounded-full border px-2 py-0.5 text-xs ${getEventStarBadgeStyle(event.star_level)}`}>
              {event.star_level}
              {event.score_coefficient ? ` / ${event.score_coefficient}` : ''}
            </span>
          )}
          <span className="rounded-full bg-[#F0EBE1] px-2 py-0.5 text-xs text-[#8B7355]">
            {typeLabel}
          </span>
        </div>
        <h3 className="mb-2 font-semibold leading-snug text-stone-800 transition-colors group-hover:text-[#8B7355]">
          {event.name}
        </h3>
        {event.start_date && (
          <div className="mb-1 text-sm text-stone-500">
            {formatDate(event.start_date)}
            {event.end_date && event.end_date !== event.start_date && ` — ${formatDate(event.end_date)}`}
          </div>
        )}
        {(event.city || event.province) && (
          <div className="mb-1 text-sm text-stone-500">
            {[event.city, event.province].filter(Boolean).join('，')}
          </div>
        )}
        {event.organizer && (
          <div className="mt-3 truncate text-xs text-stone-400">主办：{event.organizer}</div>
        )}
        {event.results_count > 0 && (
          <div className="mt-2 text-xs text-stone-400">已录成绩 {event.results_count} 条</div>
        )}
        {event.price_range && (
          <div className="mt-2 text-sm font-medium text-[#8B7355]">{event.price_range}</div>
        )}
      </div>
    </Link>
  );
}
