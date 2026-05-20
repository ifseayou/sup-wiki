'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useUser } from '@/components/UserContext';
import ResultStatusBadge from '@/components/ResultStatusBadge';
import AthleteResultName from '@/components/AthleteResultName';

const PAGE_SIZE = 50;

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

interface ResultModule {
  discipline: string;
  gender_group: string;
  total: number | string;
  round_count: number | string;
}

interface PointModule {
  group_name: string;
  total: number | string;
}

interface ModuleStats {
  resultCount: number;
  resultModuleCount: number;
  pointStandingCount: number;
  pointModuleCount: number;
}

interface PageData<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

interface MemberLike {
  name?: unknown;
  member_name?: unknown;
}

type ActiveModule =
  | { type: 'results'; discipline: string; genderGroup: string }
  | { type: 'points'; groupName: string };

function parseMembers(value: unknown) {
  if (Array.isArray(value)) {
    return value
      .map((item: MemberLike) => String(item?.name || item?.member_name || '').trim())
      .filter(Boolean);
  }
  if (!value) return [];
  try {
    const parsed = JSON.parse(String(value));
    return Array.isArray(parsed)
      ? parsed.map((item: MemberLike) => String(item?.name || item?.member_name || '').trim()).filter(Boolean)
      : [];
  } catch {
    return [];
  }
}

function numberValue(value: number | string | null | undefined) {
  return Number(value || 0);
}

function resultKey(module: Pick<ResultModule, 'discipline' | 'gender_group'>) {
  return `results:${module.discipline}:${module.gender_group}`;
}

function pointKey(module: Pick<PointModule, 'group_name'>) {
  return `points:${module.group_name}`;
}

function activeKey(active: ActiveModule | null) {
  if (!active) return '';
  return active.type === 'results'
    ? `results:${active.discipline}:${active.genderGroup}`
    : `points:${active.groupName}`;
}

function pageLabel(total: number, page: number, pageSize: number) {
  if (!total) return '0 条';
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(total, page * pageSize);
  return `${start}-${end} / ${total} 条`;
}

function Pager({
  page,
  totalPages,
  total,
  pageSize,
  onChange,
}: {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  onChange: (page: number) => void;
}) {
  if (totalPages <= 1) {
    return <div className="text-xs text-stone-400">{pageLabel(total, page, pageSize)}</div>;
  }
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#E8DED1] px-4 py-3">
      <div className="text-xs text-stone-400">{pageLabel(total, page, pageSize)}</div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onChange(page - 1)}
          disabled={page <= 1}
          className="rounded-md border border-[#DED4C7] px-3 py-1.5 text-xs font-medium text-[#6F5B42] transition disabled:cursor-not-allowed disabled:opacity-35 hover:border-[#8B7355]"
        >
          上一页
        </button>
        <span className="min-w-16 text-center text-xs text-stone-500">{page} / {totalPages}</span>
        <button
          type="button"
          onClick={() => onChange(page + 1)}
          disabled={page >= totalPages}
          className="rounded-md border border-[#DED4C7] px-3 py-1.5 text-xs font-medium text-[#6F5B42] transition disabled:cursor-not-allowed disabled:opacity-35 hover:border-[#8B7355]"
        >
          下一页
        </button>
      </div>
    </div>
  );
}

export default function EventResultsPanel({ eventId }: { eventId: number }) {
  const { token, loading } = useUser();
  const pathname = usePathname();
  const [resultModules, setResultModules] = useState<ResultModule[]>([]);
  const [pointModules, setPointModules] = useState<PointModule[]>([]);
  const [stats, setStats] = useState<ModuleStats | null>(null);
  const [active, setActive] = useState<ActiveModule | null>(null);
  const [pages, setPages] = useState<Record<string, PageData<EventResultRow> | PageData<PointStandingRow>>>({});
  const [moduleError, setModuleError] = useState('');
  const [detailError, setDetailError] = useState('');
  const [loadingModules, setLoadingModules] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setResultModules([]);
      setPointModules([]);
      setStats(null);
      setActive(null);
      setPages({});
      setModuleError('');
      setDetailError('');
      setCurrentPage(1);
      if (!token) return;

      setLoadingModules(true);
      fetch(`/api/events/${eventId}/results?section=modules`, { headers: { Authorization: `Bearer ${token}` } })
        .then(async (res) => {
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || '赛事成绩模块加载失败');
          if (cancelled) return;
          setResultModules(data.result_modules || []);
          setPointModules(data.point_modules || []);
          setStats(data.stats || null);
        })
        .catch((err) => {
          if (!cancelled) setModuleError(err instanceof Error ? err.message : '赛事成绩模块加载失败');
        })
        .finally(() => {
          if (!cancelled) setLoadingModules(false);
        });
    });
    return () => {
      cancelled = true;
    };
  }, [eventId, token]);

  const selectResultModule = useCallback((module: ResultModule) => {
    setActive({ type: 'results', discipline: module.discipline, genderGroup: module.gender_group });
    setCurrentPage(1);
    setDetailError('');
  }, []);

  const selectPointModule = useCallback((module: PointModule) => {
    setActive({ type: 'points', groupName: module.group_name });
    setCurrentPage(1);
    setDetailError('');
  }, []);

  const selectedResultModule = useMemo(() => {
    if (!active || active.type !== 'results') return null;
    return resultModules.find((item) => item.discipline === active.discipline && item.gender_group === active.genderGroup) || null;
  }, [active, resultModules]);

  const selectedPointModule = useMemo(() => {
    if (!active || active.type !== 'points') return null;
    return pointModules.find((item) => item.group_name === active.groupName) || null;
  }, [active, pointModules]);

  useEffect(() => {
    if (!token || !active) return;
    let cancelled = false;
    const key = `${activeKey(active)}:page:${currentPage}`;
    if (pages[key]) return;

    const params = new URLSearchParams({
      section: active.type,
      page: String(currentPage),
      pageSize: String(PAGE_SIZE),
    });
    if (active.type === 'results') {
      params.set('discipline', active.discipline);
      params.set('gender_group', active.genderGroup);
    } else {
      params.set('group_name', active.groupName);
    }

    queueMicrotask(() => {
      if (cancelled) return;
      setLoadingDetail(true);
      setDetailError('');
      fetch(`/api/events/${eventId}/results?${params.toString()}`, { headers: { Authorization: `Bearer ${token}` } })
        .then(async (res) => {
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || '成绩明细加载失败');
          if (!cancelled) setPages((prev) => ({ ...prev, [key]: data }));
        })
        .catch((err) => {
          if (!cancelled) setDetailError(err instanceof Error ? err.message : '成绩明细加载失败');
        })
        .finally(() => {
          if (!cancelled) setLoadingDetail(false);
        });
    });
    return () => {
      cancelled = true;
    };
  }, [active, currentPage, eventId, pages, token]);

  const currentData = active ? pages[`${activeKey(active)}:page:${currentPage}`] : null;
  const resultRows = active?.type === 'results' ? (currentData?.items || []) as EventResultRow[] : [];
  const pointRows = active?.type === 'points' ? (currentData?.items || []) as PointStandingRow[] : [];
  const activeTitle = active?.type === 'results'
    ? `${active.discipline} · ${active.genderGroup}`
    : active?.type === 'points'
      ? `${active.groupName} 积分榜`
      : '';
  const totalResults = stats?.resultCount ?? resultModules.reduce((sum, item) => sum + numberValue(item.total), 0);
  const totalPoints = stats?.pointStandingCount ?? pointModules.reduce((sum, item) => sum + numberValue(item.total), 0);

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

  if (moduleError) {
    return <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">{moduleError}</div>;
  }

  if (loadingModules) {
    return (
      <div className="mb-6 rounded-xl border border-[#E0D8CC] bg-[#FEFCF9] p-6">
        <div className="mb-4 h-5 w-32 animate-pulse rounded bg-[#E8DED1]" />
        <div className="grid gap-3 sm:grid-cols-3">
          {[0, 1, 2].map((item) => <div key={item} className="h-20 animate-pulse rounded-lg bg-[#F2EAE0]" />)}
        </div>
      </div>
    );
  }

  if (!resultModules.length && !pointModules.length) return null;

  return (
    <section className="mb-6 rounded-2xl border border-[#DDD2C3] bg-[#FEFCF9] shadow-[0_18px_45px_rgba(85,65,40,0.07)]">
      <div className="border-b border-[#E6DCCC] px-5 py-5 sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-[#B39A78]">Result Archive</div>
            <h2 className="mt-1 text-xl font-semibold text-[#2E2118]">赛事成绩档案</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-500">选择项目模块后加载对应成绩，适合黄石亚洲锦标赛这类大体量成绩册快速浏览。</p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center sm:min-w-72">
            <div className="rounded-lg border border-[#E8DED1] bg-white/70 px-3 py-2">
              <div className="text-base font-semibold text-[#6F5B42]">{totalResults}</div>
              <div className="text-[11px] text-stone-400">成绩</div>
            </div>
            <div className="rounded-lg border border-[#E8DED1] bg-white/70 px-3 py-2">
              <div className="text-base font-semibold text-[#6F5B42]">{resultModules.length}</div>
              <div className="text-[11px] text-stone-400">模块</div>
            </div>
            <div className="rounded-lg border border-[#E8DED1] bg-white/70 px-3 py-2">
              <div className="text-base font-semibold text-[#6F5B42]">{totalPoints}</div>
              <div className="text-[11px] text-stone-400">积分</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-0 lg:grid-cols-[320px_1fr]">
        <aside className="border-b border-[#E6DCCC] p-4 lg:border-b-0 lg:border-r">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-sm font-semibold text-stone-700">项目模块</div>
            <div className="text-xs text-stone-400">点击加载</div>
          </div>
          <div className="max-h-[520px] space-y-2 overflow-y-auto pr-1">
            {resultModules.map((module) => {
              const key = resultKey(module);
              const selected = activeKey(active) === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => selectResultModule(module)}
                  className={`w-full rounded-lg border px-3 py-3 text-left transition ${selected ? 'border-[#8B7355] bg-[#F0E7D8] shadow-sm' : 'border-[#E8DED1] bg-white/70 hover:border-[#CDBA9F] hover:bg-[#FAF6EF]'}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-[#2E2118]">{module.discipline || '未分项目'}</div>
                      <div className="mt-1 text-xs text-stone-500">{module.gender_group || '公开组'}</div>
                    </div>
                    <div className="shrink-0 rounded-full bg-white px-2 py-1 text-xs font-medium text-[#7A6145]">{numberValue(module.total)}</div>
                  </div>
                  {numberValue(module.round_count) > 1 && <div className="mt-2 text-[11px] text-stone-400">{numberValue(module.round_count)} 个赛段</div>}
                </button>
              );
            })}
          </div>

          {pointModules.length > 0 && (
            <div className="mt-5">
              <div className="mb-2 text-sm font-semibold text-stone-700">积分榜</div>
              <div className="space-y-2">
                {pointModules.map((module) => {
                  const key = pointKey(module);
                  const selected = activeKey(active) === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => selectPointModule(module)}
                      className={`w-full rounded-lg border px-3 py-3 text-left transition ${selected ? 'border-[#8B7355] bg-[#F0E7D8]' : 'border-[#E8DED1] bg-white/70 hover:border-[#CDBA9F] hover:bg-[#FAF6EF]'}`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="truncate text-sm font-semibold text-[#2E2118]">{module.group_name}</span>
                        <span className="rounded-full bg-white px-2 py-1 text-xs font-medium text-[#7A6145]">{numberValue(module.total)}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </aside>

        <div className="min-w-0 p-4 sm:p-5">
          {!active && (
            <div className="flex min-h-80 items-center justify-center rounded-xl border border-dashed border-[#D8CBB9] bg-[#FBF7F0] px-6 py-12 text-center">
              <div>
                <div className="text-base font-semibold text-[#2E2118]">选择左侧模块查看成绩</div>
                <p className="mt-2 max-w-md text-sm leading-6 text-stone-500">页面不会一次性读取完整成绩册；每个模块按 50 条分页加载，切换模块时保留已加载页面。</p>
              </div>
            </div>
          )}

          {active && (
            <div className="overflow-hidden rounded-xl border border-[#E2D7C8] bg-white">
              <div className="flex flex-col gap-2 border-b border-[#E8DED1] bg-[#F8F2EA] px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-xs uppercase tracking-[0.18em] text-[#B39A78]">{active.type === 'results' ? 'Result Module' : 'Point Standing'}</div>
                  <div className="mt-1 text-base font-semibold text-[#2E2118]">{activeTitle}</div>
                </div>
                <div className="text-sm font-medium text-[#7A6145]">
                  {active.type === 'results' && selectedResultModule ? `${numberValue(selectedResultModule.total)} 条` : ''}
                  {active.type === 'points' && selectedPointModule ? `${numberValue(selectedPointModule.total)} 条` : ''}
                </div>
              </div>

              {detailError && <div className="m-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{detailError}</div>}
              {loadingDetail && !currentData && <div className="p-8 text-center text-sm text-stone-500">正在加载当前模块...</div>}

              {active.type === 'results' && currentData && (
                <>
                  <div className="hidden overflow-x-auto md:block">
                    <table className="w-full text-sm">
                      <thead className="bg-[#F5F1EB] text-stone-500">
                        <tr>
                          <th className="px-4 py-3 text-left">名次</th>
                          <th className="px-4 py-3 text-left">运动员</th>
                          <th className="px-4 py-3 text-left">赛段</th>
                          <th className="px-4 py-3 text-left">说明</th>
                          <th className="px-4 py-3 text-right">耗时</th>
                          <th className="px-4 py-3 text-left">来源</th>
                        </tr>
                      </thead>
                      <tbody>
                        {resultRows.map((row) => {
                          const members = parseMembers(row.team_members);
                          return (
                            <tr key={row.result_id} className="border-t border-[#EEE4D8]">
                              <td className="px-4 py-3 font-medium text-stone-700">{row.rank_position >= 9000 ? '-' : row.rank_position}</td>
                              <td className="px-4 py-3 text-stone-700">
                                <AthleteResultName athleteId={row.athlete_id} name={row.athlete_name || row.athlete_name_snapshot} photo={row.athlete_photo} bibNumber={row.bib_number} />
                                {members.length > 0 && <div className="mt-1 text-xs text-stone-400">成员：{members.join('、')}</div>}
                              </td>
                              <td className="px-4 py-3 text-stone-500">{row.round_label || '-'}</td>
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
                  <div className="divide-y divide-[#EEE4D8] md:hidden">
                    {resultRows.map((row) => {
                      const members = parseMembers(row.team_members);
                      return (
                        <div key={row.result_id} className="p-4">
                          <div className="mb-3 flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <AthleteResultName athleteId={row.athlete_id} name={row.athlete_name || row.athlete_name_snapshot} photo={row.athlete_photo} bibNumber={row.bib_number} />
                              {members.length > 0 && <div className="mt-1 text-xs text-stone-400">成员：{members.join('、')}</div>}
                            </div>
                            <div className="shrink-0 text-right">
                              <div className="text-xs text-stone-400">名次</div>
                              <div className="font-semibold text-stone-700">{row.rank_position >= 9000 ? '-' : row.rank_position}</div>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-3 text-sm">
                            <div><div className="text-xs text-stone-400">赛段</div><div className="mt-0.5 text-stone-600">{row.round_label || '-'}</div></div>
                            <div><div className="text-xs text-stone-400">成绩</div><div className="mt-0.5 font-medium text-[#8B7355]"><ResultStatusBadge finishTime={row.finish_time} statusCode={row.result_status_code} statusNote={row.result_status_note} /></div></div>
                          </div>
                          <div className="mt-3 text-xs text-stone-400">
                            {(row.source_file_url || row.source_url) ? (
                              <a href={row.source_file_url || row.source_url || '#'} target="_blank" rel="noopener noreferrer" className="text-[#7A6145]">
                                {row.source_file_name || row.source_title || '成绩册'}{row.source_locator ? ` · ${row.source_locator}` : ''}
                              </a>
                            ) : '无来源链接'}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

              {active.type === 'points' && currentData && (
                <>
                  <div className="hidden overflow-x-auto md:block">
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
                        {pointRows.map((row) => (
                          <tr key={row.standing_id} className="border-t border-[#EEE4D8]">
                            <td className="px-4 py-3 font-medium text-stone-700">{row.rank_position ?? row.status_rank ?? '-'}</td>
                            <td className="px-4 py-3 text-stone-700">
                              <AthleteResultName athleteId={row.athlete_id} name={row.athlete_name || row.athlete_name_snapshot} photo={row.athlete_photo} bibNumber={row.bib_number} />
                            </td>
                            <td className="px-4 py-3 text-stone-500">{row.team_name || '个人'}</td>
                            <td className="px-4 py-3 text-right text-stone-600">{row.endurance_rank || '-'}{row.endurance_points != null ? ` / ${row.endurance_points}` : ''}</td>
                            <td className="px-4 py-3 text-right text-stone-600">{row.sprint_rank || '-'}{row.sprint_points != null ? ` / ${row.sprint_points}` : ''}</td>
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
                  <div className="divide-y divide-[#EEE4D8] md:hidden">
                    {pointRows.map((row) => (
                      <div key={row.standing_id} className="p-4">
                        <div className="mb-3 flex items-start justify-between gap-3">
                          <AthleteResultName athleteId={row.athlete_id} name={row.athlete_name || row.athlete_name_snapshot} photo={row.athlete_photo} bibNumber={row.bib_number} />
                          <div className="shrink-0 text-right">
                            <div className="text-xs text-stone-400">名次</div>
                            <div className="font-semibold text-stone-700">{row.rank_position ?? row.status_rank ?? '-'}</div>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-sm">
                          <div><div className="text-xs text-stone-400">耐力</div><div className="text-stone-600">{row.endurance_rank || '-'}{row.endurance_points != null ? `/${row.endurance_points}` : ''}</div></div>
                          <div><div className="text-xs text-stone-400">冲刺</div><div className="text-stone-600">{row.sprint_rank || '-'}{row.sprint_points != null ? `/${row.sprint_points}` : ''}</div></div>
                          <div><div className="text-xs text-stone-400">总分</div><div className="font-semibold text-[#8B7355]">{row.total_points ?? '-'}</div></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {currentData && (
                <Pager
                  page={currentData.page}
                  totalPages={currentData.totalPages}
                  total={currentData.total}
                  pageSize={currentData.pageSize}
                  onChange={setCurrentPage}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
