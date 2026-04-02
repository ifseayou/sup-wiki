import Link from 'next/link';
import { notFound } from 'next/navigation';
import pool from '@/lib/db';
import type { RowDataPacket } from 'mysql2';

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
      images: e.images ? JSON.parse(e.images) : [],
      schedule: e.schedule ? JSON.parse(e.schedule) : [],
      disciplines: e.disciplines ? JSON.parse(e.disciplines) : [],
    };
  } catch (error) {
    console.error('获取赛事详情失败:', error);
    return null;
  }
}

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const event = await getEvent(id);
  if (!event) notFound();

  const statusInfo = eventStatusLabels[event.event_status] || { label: event.event_status, style: 'bg-stone-100 text-stone-600' };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Breadcrumb */}
      <nav className="text-sm text-stone-400 mb-6 flex items-center gap-1.5">
        <Link href="/" className="hover:text-[#8B7355]">首页</Link>
        <span>/</span>
        <Link href="/events" className="hover:text-[#8B7355]">赛事</Link>
        <span>/</span>
        <span className="text-stone-600">{event.name}</span>
      </nav>

      {/* Header */}
      <div className="bg-[#FEFCF9] border border-[#E0D8CC] rounded-2xl p-8 mb-6">
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <span className={`text-sm px-3 py-1 rounded-full font-medium ${statusInfo.style}`}>
            {statusInfo.label}
          </span>
          <span className="text-sm px-3 py-1 rounded-full bg-[#F0EBE1] text-[#8B7355]">
            {eventTypeLabels[event.event_type] || event.event_type}
          </span>
        </div>

        <h1 className="text-3xl font-bold text-stone-800 mb-1">{event.name}</h1>
        {event.name_en && (
          <p className="text-stone-400 text-sm mb-4">{event.name_en}</p>
        )}

        {/* Key info grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-5">
          {event.start_date && (
            <div>
              <div className="text-xs text-stone-400 uppercase tracking-wide mb-1">赛事日期</div>
              <div className="text-stone-700 font-medium">
                {formatDate(event.start_date)}
                {event.end_date && event.end_date !== event.start_date && ` — ${formatDate(event.end_date)}`}
              </div>
            </div>
          )}
          {event.registration_deadline && (
            <div>
              <div className="text-xs text-stone-400 uppercase tracking-wide mb-1">报名截止</div>
              <div className="text-stone-700 font-medium">{formatDate(event.registration_deadline)}</div>
            </div>
          )}
          {(event.venue || event.city || event.province) && (
            <div>
              <div className="text-xs text-stone-400 uppercase tracking-wide mb-1">举办地点</div>
              <div className="text-stone-700 font-medium">
                {[event.venue, event.city, event.province].filter(Boolean).join('，')}
              </div>
            </div>
          )}
          {event.organizer && (
            <div>
              <div className="text-xs text-stone-400 uppercase tracking-wide mb-1">主办方</div>
              <div className="text-stone-700 font-medium">{event.organizer}</div>
            </div>
          )}
          {event.price_range && (
            <div>
              <div className="text-xs text-stone-400 uppercase tracking-wide mb-1">报名费用</div>
              <div className="text-[#8B7355] font-semibold">{event.price_range}</div>
            </div>
          )}
          {event.max_participants && (
            <div>
              <div className="text-xs text-stone-400 uppercase tracking-wide mb-1">参赛人数</div>
              <div className="text-stone-700 font-medium">上限 {event.max_participants} 人</div>
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-3 mt-6">
          {event.registration_url && event.event_status !== 'completed' && event.event_status !== 'cancelled' && (
            <a
              href={event.registration_url}
              target="_blank"
              rel="noopener noreferrer"
              className="px-6 py-2.5 bg-[#8B7355] text-white rounded-lg text-sm font-medium hover:bg-[#6F5B42] transition-colors"
            >
              立即报名
            </a>
          )}
          {event.website && (
            <a
              href={event.website}
              target="_blank"
              rel="noopener noreferrer"
              className="px-6 py-2.5 border border-[#E0D8CC] text-stone-600 rounded-lg text-sm font-medium hover:border-[#8B7355] hover:text-[#8B7355] transition-colors"
            >
              官方网站
            </a>
          )}
        </div>
      </div>

      {/* Description */}
      {event.description && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-stone-800 mb-3">赛事介绍</h2>
          <div className="bg-[#FEFCF9] border border-[#E0D8CC] rounded-xl p-6">
            <p className="text-stone-600 leading-relaxed whitespace-pre-wrap">{event.description}</p>
          </div>
        </div>
      )}

      {/* Requirements */}
      {event.requirements && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-stone-800 mb-3">参赛要求</h2>
          <div className="bg-[#FEFCF9] border border-[#E0D8CC] rounded-xl p-6">
            <p className="text-stone-600 leading-relaxed whitespace-pre-wrap">{event.requirements}</p>
          </div>
        </div>
      )}

      {/* Disciplines */}
      {event.disciplines && event.disciplines.length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-stone-800 mb-3">参赛项目</h2>
          <div className="flex flex-wrap gap-2">
            {(event.disciplines as string[]).map((d: string) => (
              <span key={d} className="px-3 py-1.5 bg-[#F0EBE1] text-[#8B7355] rounded-lg text-sm">
                {d}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Schedule */}
      {event.schedule && (event.schedule as { date: string; time: string; event: string }[]).length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-stone-800 mb-3">赛程安排</h2>
          <div className="bg-[#FEFCF9] border border-[#E0D8CC] rounded-xl overflow-hidden">
            {(event.schedule as { date: string; time: string; event: string }[]).map((item, idx) => (
              <div key={idx} className={`flex gap-4 px-6 py-3.5 ${idx % 2 === 0 ? '' : 'bg-[#F5F1EB]'}`}>
                <div className="text-stone-400 text-sm w-24 shrink-0">{item.date}</div>
                <div className="text-stone-400 text-sm w-16 shrink-0">{item.time}</div>
                <div className="text-stone-700 text-sm">{item.event}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Contact */}
      {event.contact_info && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-stone-800 mb-3">联系方式</h2>
          <div className="bg-[#FEFCF9] border border-[#E0D8CC] rounded-xl p-6">
            <p className="text-stone-600">{event.contact_info}</p>
          </div>
        </div>
      )}

      {/* Back */}
      <div className="mt-8">
        <Link href="/events" className="text-sm text-stone-400 hover:text-[#8B7355] transition-colors">
          ← 返回赛事列表
        </Link>
      </div>
    </div>
  );
}
