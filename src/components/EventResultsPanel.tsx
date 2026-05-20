'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useUser } from '@/components/UserContext';
import ResultStatusBadge from '@/components/ResultStatusBadge';
import AthleteResultName from '@/components/AthleteResultName';

interface EventResultRow {
  result_id: number;
  athlete_id: number | null;
  athlete_name_snapshot: string;
  bib_number: string | null;
  gender_group: string;
  discipline: string;
  round_label: string | null;
  rank_position: number;
  result_label: string | null;
  finish_time: string;
  result_status_code: string | null;
  result_status_note: string | null;
  team_name: string | null;
  team_members: unknown;
  athlete_name: string | null;
  athlete_photo: string | null;
  source_file_url: string | null;
  source_file_name: string | null;
  source_url: string | null;
  source_title: string | null;
  source_locator: string | null;
}

interface PointStandingRow {
  standing_id: number;
  group_name: string;
  rank_position: number | null;
  status_rank: string | null;
  bib_number: string | null;
  athlete_id: number | null;
  athlete_name_snapshot: string;
  athlete_name: string | null;
  athlete_photo: string | null;
  team_name: string | null;
  endurance_rank: string | null;
  endurance_points: number | null;
  sprint_rank: string | null;
  sprint_points: number | null;
  total_points: number | null;
  source_locator: string | null;
  source_file_url: string | null;
  source_file_name: string | null;
}

function parseMembers(value: unknown) {
  if (Array.isArray(value)) return value.map((item: any) => item?.name || item?.member_name || '').filter(Boolean);
  if (!value) return [];
  try {
    const parsed = JSON.parse(String(value));
    return Array.isArray(parsed) ? parsed.map((item) => item?.name || item?.member_name || '').filter(Boolean) : [];
  } catch {
    return [];
  }
}

export default function EventResultsPanel({ eventId }: { eventId: number }) {
  const { token, loading } = useUser();
  const pathname = usePathname();
  const [items, setItems] = useState<EventResultRow[]>([]);
  const [pointStandings, setPointStandings] = useState<PointStandingRow[]>([]);
  const [error, setError] = useState('');
  const [fetching, setFetching] = useState(false);

  useEffect(() => {
    if (!token) return;
    setFetching(true);
    fetch(`/api/events/${eventId}/results`, { headers: { Authorization: `Bearer ${token}` } })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || '赛事成绩加载失败');
        setItems(data.items || []);
        setPointStandings(data.point_standings || []);
      })
      .catch((err) => setError(err instanceof Error ? err.message : '赛事成绩加载失败'))
      .finally(() => setFetching(false));
  }, [eventId, token]);

  const groupedResults = useMemo(() => items.reduce<Record<string, EventResultRow[]>>((acc, item) => {
    const key = `${item.discipline || '未分项目'} · ${item.gender_group || '公开组'}`;
    acc[key] ||= [];
    acc[key].push(item);
    return acc;
  }, {}), [items]);

  const groupedPoints = useMemo(() => pointStandings.reduce<Record<string, PointStandingRow[]>>((acc, item) => {
    const key = item.group_name || '未分组';
    acc[key] ||= [];
    acc[key].push(item);
    return acc;
  }, {}), [pointStandings]);

  if (loading) {
    return <div className="mb-6 rounded-xl border border-[#E0D8CC] bg-[#FEFCF9] p-6 text-sm text-stone-500">正在检查登录状态...</div>;
  }

  if (!token) {
    return (
      <div className="mb-6 rounded-xl border border-[#E0D8CC] bg-[#FEFCF9] p-6">
        <h2 className="mb-2 text-lg font-semibold text-stone-800">赛事成绩档案</h2>
        <p className="mb-4 text-sm text-stone-500">成绩明细和原始成绩册是登录用户可见内容。</p>
        <Link href={`/login?redirect=${encodeURIComponent(pathname)}`} className="inline-flex rounded-lg bg-[#8B7355] px-4 py-2 text-sm font-medium text-white hover:bg-[#6F5B42]">
          登录后查看
        </Link>
      </div>
    );
  }

  if (error) {
    return <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">{error}</div>;
  }

  if (fetching) {
    return <div className="mb-6 rounded-xl border border-[#E0D8CC] bg-[#FEFCF9] p-6 text-sm text-stone-500">成绩加载中...</div>;
  }

  if (!items.length && !pointStandings.length) return null;

  return (
    <div className="mb-6">
      <h2 className="mb-3 text-lg font-semibold text-stone-800">赛事成绩档案</h2>
      <div className="space-y-4">
        {Object.entries(groupedResults).map(([title, rows]) => (
          <div key={title} className="rounded-xl border border-[#E0D8CC] bg-[#FEFCF9] p-5 shadow-[0_12px_30px_rgba(93,72,48,0.06)]">
            {(() => {
              const showRound = rows.some((row) => row.round_label);
              return (
            <>
            <div className="mb-4 flex items-end justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-[0.18em] text-[#B39A78]">Result Group</div>
                <div className="mt-1 text-base font-semibold text-[#2E2118]">{title}</div>
              </div>
              <div className="rounded-full bg-[#F3E9DA] px-3 py-1 text-xs font-medium text-[#7A6145]">{rows.length} 条</div>
            </div>
                  <div className="overflow-x-auto rounded-lg border border-[#E8DED1]">
                    <table className="w-full text-sm">
                      <thead className="bg-[#F5F1EB] text-stone-500">
                        <tr>
                          <th className="px-4 py-3 text-left">名次</th>
                          <th className="px-4 py-3 text-left">运动员</th>
                          {showRound && <th className="px-4 py-3 text-left">赛段</th>}
                          <th className="px-4 py-3 text-left">说明</th>
                          <th className="px-4 py-3 text-right">耗时</th>
                          <th className="px-4 py-3 text-left">来源</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((row) => {
                          const members = parseMembers(row.team_members);
                          return (
                          <tr key={row.result_id} className="border-t border-[#EEE4D8]">
                            <td className="px-4 py-3 font-medium text-stone-700">{row.rank_position >= 9000 ? '—' : row.rank_position}</td>
                            <td className="px-4 py-3 text-stone-700">
                              <AthleteResultName athleteId={row.athlete_id} name={row.athlete_name || row.athlete_name_snapshot} photo={row.athlete_photo} bibNumber={row.bib_number} />
                              {members.length > 0 && <div className="mt-1 text-xs text-stone-400">成员：{members.join('、')}</div>}
                            </td>
                            {showRound && <td className="px-4 py-3 text-stone-500">{row.round_label || '-'}</td>}
                            <td className="px-4 py-3 text-stone-500">{row.result_label || '-'}</td>
                            <td className="px-4 py-3 text-right font-medium text-[#8B7355]"><ResultStatusBadge finishTime={row.finish_time} statusCode={row.result_status_code} statusNote={row.result_status_note} /></td>
                            <td className="px-4 py-3 text-xs">
                              {(row.source_file_url || row.source_url) ? (
                                <a href={row.source_file_url || row.source_url || '#'} target="_blank" rel="noopener noreferrer" className="text-[#7A6145] hover:text-[#5E4A33]">
                                  {row.source_file_name || row.source_title || '成绩册'}{row.source_locator ? ` · ${row.source_locator}` : ''}
                                </a>
                              ) : '-'}
                            </td>
                          </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
            </>
              );
            })()}
          </div>
        ))}
      </div>
      {pointStandings.length > 0 && (
        <div className="mt-6">
          <h2 className="mb-3 text-lg font-semibold text-stone-800">赛事积分榜</h2>
          <div className="space-y-4">
            {Object.entries(groupedPoints).map(([title, rows]) => (
              <div key={title} className="rounded-xl border border-[#E0D8CC] bg-[#FEFCF9] p-5 shadow-[0_12px_30px_rgba(93,72,48,0.06)]">
                <div className="mb-4 flex items-end justify-between gap-3">
                  <div>
                    <div className="text-xs uppercase tracking-[0.18em] text-[#B39A78]">Point Standing</div>
                    <div className="mt-1 text-base font-semibold text-[#2E2118]">{title}</div>
                  </div>
                  <div className="rounded-full bg-[#F3E9DA] px-3 py-1 text-xs font-medium text-[#7A6145]">{rows.length} 条</div>
                </div>
                <div className="overflow-x-auto rounded-lg border border-[#E8DED1]">
                  <table className="w-full text-sm">
                    <thead className="bg-[#F5F1EB] text-stone-500">
                      <tr>
                        <th className="px-4 py-3 text-left">名次</th>
                        <th className="px-4 py-3 text-left">运动员</th>
                        <th className="px-4 py-3 text-left">队伍</th>
                        <th className="px-4 py-3 text-right">耐力赛</th>
                        <th className="px-4 py-3 text-right">冲刺赛</th>
                        <th className="px-4 py-3 text-right">总积分</th>
                        <th className="px-4 py-3 text-left">来源</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => (
                        <tr key={row.standing_id} className="border-t border-[#EEE4D8]">
                          <td className="px-4 py-3 font-medium text-stone-700">{row.rank_position ?? row.status_rank ?? '-'}</td>
                          <td className="px-4 py-3 text-stone-700">
                            <AthleteResultName athleteId={row.athlete_id} name={row.athlete_name || row.athlete_name_snapshot} photo={row.athlete_photo} bibNumber={row.bib_number} />
                          </td>
                          <td className="px-4 py-3 text-stone-500">{row.team_name || '个人'}</td>
                          <td className="px-4 py-3 text-right text-stone-600">
                            {row.endurance_rank || '-'}{row.endurance_points != null ? ` / ${row.endurance_points}` : ''}
                          </td>
                          <td className="px-4 py-3 text-right text-stone-600">
                            {row.sprint_rank || '-'}{row.sprint_points != null ? ` / ${row.sprint_points}` : ''}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-[#8B7355]">{row.total_points ?? '-'}</td>
                          <td className="px-4 py-3 text-xs">
                            {row.source_file_url ? (
                              <a href={row.source_file_url} target="_blank" rel="noopener noreferrer" className="text-[#7A6145] hover:text-[#5E4A33]">
                                {row.source_file_name || '成绩册'}{row.source_locator ? ` · ${row.source_locator}` : ''}
                              </a>
                            ) : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
