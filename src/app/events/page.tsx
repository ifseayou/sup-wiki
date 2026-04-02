import Link from 'next/link';
import pool from '@/lib/db';
import type { RowDataPacket } from 'mysql2';

interface EventRow extends RowDataPacket {
  event_id: number;
  name: string;
  slug: string;
  event_type: string;
  location: string | null;
  province: string | null;
  city: string | null;
  start_date: string | null;
  end_date: string | null;
  registration_deadline: string | null;
  organizer: string | null;
  description: string | null;
  disciplines: string | null;
  price_range: string | null;
  event_status: string;
}

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

async function getEvents() {
  try {
    const [events] = await pool.execute<EventRow[]>(
      `SELECT event_id, name, slug, event_type, location, province, city,
              start_date, end_date, registration_deadline, organizer,
              description, disciplines, price_range, event_status
       FROM sup_events
       WHERE status = 'published'
       ORDER BY
         CASE event_status WHEN 'ongoing' THEN 0 WHEN 'upcoming' THEN 1 WHEN 'completed' THEN 2 ELSE 3 END,
         start_date ASC`
    );
    return events.map(e => ({
      ...e,
      disciplines: Array.isArray(e.disciplines) ? e.disciplines : (e.disciplines ? JSON.parse(e.disciplines) : []),
    }));
  } catch (error) {
    console.error('获取赛事列表失败:', error);
    return [];
  }
}

export default async function EventsPage() {
  const events = await getEvents();
  const upcomingOrOngoing = events.filter(e => e.event_status === 'upcoming' || e.event_status === 'ongoing');
  const completed = events.filter(e => e.event_status === 'completed' || e.event_status === 'cancelled');

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Header */}
      <div className="mb-10">
        <h1 className="text-3xl font-bold text-stone-800 mb-2">国内赛事</h1>
        <p className="text-stone-500">掌握国内 SUP 桨板赛事动态，报名参与或关注精彩比赛</p>
      </div>

      {/* Upcoming & Ongoing */}
      {upcomingOrOngoing.length > 0 && (
        <section className="mb-12">
          <h2 className="text-lg font-semibold text-stone-700 mb-5 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-500 inline-block"></span>
            即将举办 / 进行中
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {upcomingOrOngoing.map(event => (
              <EventCard key={event.event_id} event={event} highlighted />
            ))}
          </div>
        </section>
      )}

      {/* Completed */}
      {completed.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-stone-500 mb-5 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-stone-400 inline-block"></span>
            往届赛事
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {completed.map(event => (
              <EventCard key={event.event_id} event={event} />
            ))}
          </div>
        </section>
      )}

      {events.length === 0 && (
        <div className="text-center py-20">
          <span className="text-6xl mb-4 block">🏆</span>
          <h3 className="text-xl font-semibold text-stone-800 mb-2">暂无赛事信息</h3>
          <p className="text-stone-500">赛事信息正在收录整理中，请稍后再来</p>
        </div>
      )}
    </div>
  );
}

function EventCard({ event, highlighted = false }: {
  event: ReturnType<typeof Object.assign> & EventRow & { disciplines: string[] };
  highlighted?: boolean;
}) {
  const statusInfo = eventStatusLabels[event.event_status] || { label: event.event_status, style: 'bg-stone-100 text-stone-600' };
  const typeLabel = eventTypeLabels[event.event_type] || event.event_type;

  return (
    <Link
      href={`/events/${event.event_id}`}
      className={`block rounded-xl border transition-all duration-200 hover:shadow-md group ${
        highlighted
          ? 'bg-[#FEFCF9] border-[#E0D8CC] hover:border-[#8B7355]'
          : 'bg-[#FEFCF9] border-[#E0D8CC] opacity-80 hover:opacity-100'
      }`}
    >
      {/* Top bar */}
      <div className={`h-1.5 rounded-t-xl ${highlighted ? 'bg-amber-400' : 'bg-stone-300'}`} />

      <div className="p-5">
        {/* Status + Type */}
        <div className="flex items-center gap-2 mb-3">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusInfo.style}`}>
            {statusInfo.label}
          </span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-[#F0EBE1] text-[#8B7355]">
            {typeLabel}
          </span>
        </div>

        {/* Name */}
        <h3 className="font-semibold text-stone-800 group-hover:text-[#8B7355] transition-colors leading-snug mb-2">
          {event.name}
        </h3>

        {/* Date */}
        {event.start_date && (
          <div className="text-sm text-stone-500 mb-1">
            📅 {formatDate(event.start_date)}
            {event.end_date && event.end_date !== event.start_date && ` — ${formatDate(event.end_date)}`}
          </div>
        )}

        {/* Location */}
        {(event.city || event.province) && (
          <div className="text-sm text-stone-500 mb-1">
            📍 {[event.city, event.province].filter(Boolean).join('，')}
          </div>
        )}

        {/* Organizer */}
        {event.organizer && (
          <div className="text-xs text-stone-400 mt-3 truncate">主办：{event.organizer}</div>
        )}

        {/* Price */}
        {event.price_range && (
          <div className="text-sm font-medium text-[#8B7355] mt-2">{event.price_range}</div>
        )}
      </div>
    </Link>
  );
}
