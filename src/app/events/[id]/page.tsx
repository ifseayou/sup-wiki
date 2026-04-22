import Link from 'next/link';
import { notFound } from 'next/navigation';
import pool from '@/lib/db';
import type { RowDataPacket } from 'mysql2';
import { getEventResultStatusLabel, getEventStarBadgeStyle } from '@/lib/event-stars';

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

interface EventResultRow extends RowDataPacket {
  result_id: number;
  athlete_id: number | null;
  athlete_name_snapshot: string;
  gender_group: string;
  discipline: string;
  round_label: string | null;
  rank_position: number;
  result_label: string | null;
  finish_time: string;
  athlete_name: string | null;
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
    const parseJson = (v: unknown): unknown[] => Array.isArray(v) ? v : (v ? JSON.parse(String(v)) : []);
    const [results] = await pool.execute<EventResultRow[]>(
      `SELECT
         er.result_id,
         er.athlete_id,
         er.athlete_name_snapshot,
         er.gender_group,
         er.discipline,
         er.round_label,
         er.rank_position,
         er.result_label,
         er.finish_time,
         a.name AS athlete_name
       FROM sup_event_results er
       LEFT JOIN sup_athletes a ON a.athlete_id = er.athlete_id
       WHERE er.event_id = ?
       ORDER BY er.gender_group ASC, er.discipline ASC, er.round_label ASC, er.rank_position ASC`,
      [id]
    );
    return {
      ...e,
      images: parseJson(e.images),
      schedule: parseJson(e.schedule),
      disciplines: parseJson(e.disciplines),
      result_source_links: parseJson(e.result_source_links) as { title: string; url: string }[],
      results,
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
  const groupedResults = (event.results as EventResultRow[]).reduce<Record<string, Record<string, EventResultRow[]>>>((acc, item) => {
    const groupName = item.gender_group || '公开组';
    const discipline = item.discipline || '未分项目';
    acc[groupName] ||= {};
    acc[groupName][discipline] ||= [];
    acc[groupName][discipline].push(item);
    return acc;
  }, {});

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
          {event.star_level && (
            <span className={`text-sm px-3 py-1 rounded-full border ${getEventStarBadgeStyle(event.star_level)}`}>
              {event.star_level}
              {event.score_coefficient ? ` / ${event.score_coefficient}` : ''}
            </span>
          )}
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
          {event.result_status && event.result_status !== 'none' && (
            <div>
              <div className="text-xs text-stone-400 uppercase tracking-wide mb-1">成绩档案</div>
              <div className="text-stone-700 font-medium">{getEventResultStatusLabel(event.result_status)}</div>
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

      {(event.results as EventResultRow[]).length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-stone-800 mb-3">赛事成绩档案</h2>
          <div className="space-y-4">
            {Object.entries(groupedResults).map(([groupName, disciplines]) => (
              <div key={groupName} className="rounded-xl border border-[#E0D8CC] bg-[#FEFCF9] p-5">
                <div className="mb-4 text-sm font-medium text-[#7A6145]">{groupName}</div>
                <div className="space-y-4">
                  {Object.entries(disciplines).map(([discipline, rows]) => (
                    <div key={discipline}>
                      <div className="mb-2 text-sm text-stone-500">{discipline}</div>
                      <div className="overflow-x-auto rounded-lg border border-[#E8DED1]">
                        <table className="w-full text-sm">
                          <thead className="bg-[#F5F1EB] text-stone-500">
                            <tr>
                              <th className="px-4 py-3 text-left">名次</th>
                              <th className="px-4 py-3 text-left">运动员</th>
                              <th className="px-4 py-3 text-left">轮次</th>
                              <th className="px-4 py-3 text-left">成绩说明</th>
                              <th className="px-4 py-3 text-right">耗时</th>
                            </tr>
                          </thead>
                          <tbody>
                            {rows.map((row) => (
                              <tr key={row.result_id} className="border-t border-[#EEE4D8]">
                                <td className="px-4 py-3 font-medium text-stone-700">{row.rank_position}</td>
                                <td className="px-4 py-3 text-stone-700">
                                  {row.athlete_id ? (
                                    <Link href={`/athletes/${row.athlete_id}`} className="text-[#7A6145] hover:text-[#5E4A33]">
                                      {row.athlete_name || row.athlete_name_snapshot}
                                    </Link>
                                  ) : (
                                    row.athlete_name_snapshot
                                  )}
                                </td>
                                <td className="px-4 py-3 text-stone-500">{row.round_label || '—'}</td>
                                <td className="px-4 py-3 text-stone-500">{row.result_label || '—'}</td>
                                <td className="px-4 py-3 text-right font-medium text-[#8B7355]">{row.finish_time}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {(event.result_source_note || (event.result_source_links as { title: string; url: string }[]).length > 0) && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-stone-800 mb-3">结果来源</h2>
          <div className="bg-[#FEFCF9] border border-[#E0D8CC] rounded-xl p-6">
            {event.result_source_note && (
              <p className="text-stone-600 leading-relaxed whitespace-pre-wrap mb-4">{event.result_source_note}</p>
            )}
            {(event.result_source_links as { title: string; url: string }[]).length > 0 && (
              <div className="space-y-2">
                {(event.result_source_links as { title: string; url: string }[]).map((link, index) => (
                  <a
                    key={`${link.url}-${index}`}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-sm text-[#7A6145] hover:text-[#5E4A33]"
                  >
                    {link.title} ↗
                  </a>
                ))}
              </div>
            )}
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
