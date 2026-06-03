'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useUser } from '@/components/UserContext';
import ResultStatusBadge from '@/components/ResultStatusBadge';
import Tooltip from '@/components/Tooltip';

const PAGE_SIZE = 10;
const NON_FINISH_CODES = new Set(['DNS', 'DNF', 'DQ', 'DSQ', 'DNQ', 'OTL']);

interface EventResultRow {
  result_id: number;
  athlete_id: number | null;
  athlete_name_snapshot: string;
  bib_number: string | null;
  gender_group: string;
  discipline: string;
  round_label: string | null;
  rank_position: number | string | null;
  result_label: string | null;
  finish_time: string;
  result_status_code: string | null;
  result_status_note: string | null;
  pace_display: string | null;
  is_long_distance: boolean;
  team_name: string | null;
  team_club_slug?: string | null;
  team_club_name?: string | null;
  team_members: unknown;
  athlete_name: string | null;
  athlete_photo: string | null;
  privacy_actions?: string[];
  results_points_hidden?: boolean;
  privacy_notice?: string | null;
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
  endurance_points: number | string | null;
  sprint_rank: string | null;
  sprint_points: number | string | null;
  total_points: number | string | null;
  results_points_hidden?: boolean;
  privacy_notice?: string | null;
}

interface ResultModule {
  discipline: string;
  gender_group: string;
  board_class: string | null;
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
  preview_locked?: boolean;
}

interface MemberLike {
  name?: unknown;
  member_name?: unknown;
}

type ActiveModule =
  | { type: 'results'; discipline: string; genderGroup: string; boardClass: string | null }
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

function TeamNameValue({ row }: { row: { team_name: string | null; team_club_slug?: string | null; team_club_name?: string | null } }) {
  const name = row.team_name || '个人';
  if (row.team_club_slug) {
    return <Link href={`/clubs/${row.team_club_slug}`} className="font-semibold text-[#7A5530] no-underline hover:text-[#3A2B20]">{row.team_club_name || name}</Link>;
  }
  if (name !== '个人') {
    return <Link href={`/clubs/claim?team_name=${encodeURIComponent(name)}`} className="text-[#655D56] underline decoration-[#D8C8B6] underline-offset-4 hover:text-[#7A5530]">{name}</Link>;
  }
  return <>{name}</>;
}

function numberValue(value: number | string | null | undefined) {
  return Number(value || 0);
}

function isNonFinishResult(row: Pick<EventResultRow, 'finish_time' | 'result_status_code'>) {
  const status = String(row.result_status_code || row.finish_time || '').trim().toUpperCase();
  return NON_FINISH_CODES.has(status);
}

function displayRank(row: EventResultRow) {
  return isNonFinishResult(row) ? null : row.rank_position;
}

function byModuleSizeDesc<T extends { total: number | string }>(left: T, right: T) {
  return numberValue(right.total) - numberValue(left.total);
}

function cleanModuleDiscipline(value: string, genderGroup?: string | null) {
  let title = String(value || '').trim();
  const longRaceIndex = title.indexOf('古镇长程赛');
  if (longRaceIndex >= 0) title = title.slice(longRaceIndex);
  title = title
    .replace(/^2024第六届南浔古镇桨板公开赛（水上运动户外运动周）\s*/, '')
    .replace(/^第六届南浔古镇桨板公开赛暨水上运动户外运动周\s*/, '')
    .replace(/\s*成绩公告.*$/, '')
    .trim();
  if (genderGroup && title.endsWith(`-${genderGroup}`)) return title;
  return title || '未分项目';
}

function formatResultModuleTitle(discipline: string, genderGroup: string, boardClass?: string | null) {
  const cleanDiscipline = cleanModuleDiscipline(discipline, genderGroup);
  const groupParts = [boardClass, genderGroup].filter(Boolean);
  if (genderGroup && cleanDiscipline.includes(genderGroup)) return cleanDiscipline;
  return [cleanDiscipline, ...groupParts].join(' · ');
}

function resultKey(module: Pick<ResultModule, 'discipline' | 'gender_group' | 'board_class'>) {
  return `results:${module.discipline}:${module.gender_group}:${module.board_class || ''}`;
}

function pointKey(module: Pick<PointModule, 'group_name'>) {
  return `points:${module.group_name}`;
}

function activeKey(active: ActiveModule | null) {
  if (!active) return '';
  return active.type === 'results'
    ? `results:${active.discipline}:${active.genderGroup}:${active.boardClass || ''}`
    : `points:${active.groupName}`;
}

function pageLabel(total: number, page: number, pageSize: number) {
  if (!total) return '0 条';
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(total, page * pageSize);
  return `${start}-${end} / ${total} 条`;
}

function ModuleIcon() {
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/78 text-[#8A612F] shadow-sm">
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M7 19 17 5M8 16h8M6.5 20.5h11M11 7l4 2M9 11l4 2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

function SmallIcon({ type }: { type: 'search' | 'grid' | 'rotate' | 'list' }) {
  const path = {
    search: 'm21 21-4.3-4.3m1.3-5.2a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0Z',
    grid: 'M4 4h6v6H4V4Zm10 0h6v6h-6V4ZM4 14h6v6H4v-6Zm10 0h6v6h-6v-6Z',
    rotate: 'M4 12a8 8 0 0 1 13.7-5.6L20 8.7M20 12A8 8 0 0 1 6.3 17.6L4 15.3',
    list: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
  };
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d={path[type]} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function RankBadge({ rank }: { rank: number | string | null }) {
  if (String(rank || '') === '隐藏') return <HiddenValue />;
  const numeric = Number(rank);
  if (!rank || numeric >= 9000 || Number.isNaN(numeric)) return <span className="text-[#9B9187]">-</span>;
  if (numeric <= 3) {
    const medalClass = numeric === 1
      ? 'border-[#F5B82E] bg-[radial-gradient(circle_at_38%_28%,#FFF8D7,#FFD45C_54%,#B97312)] text-[#5D3700] shadow-[0_0_0_5px_rgba(245,184,46,0.16),0_8px_18px_rgba(185,115,18,0.22)]'
      : numeric === 2
        ? 'border-[#BFC7D0] bg-[radial-gradient(circle_at_38%_28%,#FFFFFF,#DCE3EA_58%,#9BA8B5)] text-[#33404C] shadow-[0_0_0_5px_rgba(160,174,189,0.16),0_8px_18px_rgba(92,107,121,0.18)]'
        : 'border-[#DE9351] bg-[radial-gradient(circle_at_38%_28%,#FFF1DF,#E9A45F_56%,#A85D26)] text-[#5D2E07] shadow-[0_0_0_5px_rgba(222,147,81,0.16),0_8px_18px_rgba(168,93,38,0.18)]';
    return (
      <span className="relative inline-flex h-12 w-12 items-center justify-center">
        <span className="absolute inset-x-1 bottom-0 h-2 rounded-full bg-black/10 blur-sm" />
        <span className={`relative inline-flex h-11 w-11 items-center justify-center rounded-full border-2 text-lg font-black ${medalClass}`}>
          <span className="absolute inset-1 rounded-full border border-white/65" />
          <span className="relative">{numeric}</span>
        </span>
      </span>
    );
  }
  return (
    <span className="inline-flex h-8 min-w-8 items-center justify-center rounded-full border border-[#E6D9C9] bg-white px-2 font-semibold text-[#5B4A38]">
      {numeric}
    </span>
  );
}

function HiddenValue({ tip = '该运动员已选择隐藏成绩&积分' }: { tip?: string | null }) {
  return (
    <Tooltip tip={tip || '该运动员已选择隐藏成绩&积分'} dotted={false}>
      <span className="inline-flex items-center rounded-full border border-[#E1D0B8] bg-[#FFF8ED] px-2.5 py-1 text-xs font-semibold text-[#8A6A45]">隐藏</span>
    </Tooltip>
  );
}

function PodiumBadge({ rank }: { rank: number | string | null }) {
  const numeric = Number(rank);
  const tone = numeric === 1
    ? 'border-[#E7BA3D] bg-[#FFF3C7] text-[#8A612F]'
    : numeric === 2
      ? 'border-[#C9D3DA] bg-[#EFF4F6] text-[#4F6572]'
      : 'border-[#E5AD81] bg-[#FFF0E4] text-[#9B5A2D]';
  return (
    <span className={`inline-flex h-8 items-center rounded-full border px-3 text-xs font-black tracking-[0.18em] ${tone}`}>
      TOP {Number.isFinite(numeric) ? numeric : '-'}
    </span>
  );
}

function AthleteCell({
  athleteId,
  name,
  photo,
  members = [],
  teamName,
  meta,
}: {
  athleteId?: number | null;
  name: string;
  photo?: string | null;
  members?: string[];
  teamName?: string | null;
  meta?: string | null;
}) {
  const avatar = (
    <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#E1D2BF] bg-[#F6EBDD] shadow-[0_5px_12px_rgba(86,63,38,0.14)]">
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo} alt={name} className="h-full w-full object-cover" />
      ) : (
        <span className="text-sm font-black text-[#7A4B22]">{name.slice(0, 1) || '?'}</span>
      )}
    </span>
  );
  const body = (
    <span className="flex min-w-0 items-center gap-3">
      {avatar}
      <span className="min-w-0">
        <span className="block truncate text-base font-bold text-[#3A2B20]">{name}</span>
        {teamName && <span className="mt-0.5 block truncate text-xs text-[#9B8A76]">{teamName}</span>}
        {members.length > 0 && <span className="mt-0.5 block max-w-[280px] truncate text-xs text-[#9B8A76]">成员：{members.join('、')}</span>}
        {meta && <span className="mt-0.5 block truncate text-xs text-[#9B8A76]">{meta}</span>}
      </span>
    </span>
  );
  if (!athleteId || name === '隐藏') return body;
  return <Link href={`/athletes/${athleteId}`} className="inline-flex max-w-full no-underline">{body}</Link>;
}

function ResultValue({ row }: { row: EventResultRow }) {
  if (row.results_points_hidden) return <HiddenValue tip={row.privacy_notice} />;
  return <ResultStatusBadge finishTime={row.finish_time} statusCode={row.result_status_code} statusNote={row.result_status_note} />;
}

function ResultPaceValue({ row }: { row: EventResultRow }) {
  if (row.results_points_hidden) return <HiddenValue tip={row.privacy_notice} />;
  return <>{row.is_long_distance ? (row.pace_display || '-') : '-'}</>;
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
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#E8DED1] px-4 py-3">
      <div className="text-xs text-[#8A8078]">{pageLabel(total, page, pageSize)}</div>
      {totalPages > 1 && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onChange(page - 1)}
            disabled={page <= 1}
            className="rounded-md border border-[#DED4C7] px-3 py-1.5 text-xs font-semibold text-[#6F5B42] transition disabled:cursor-not-allowed disabled:opacity-35 hover:border-[#8B7355]"
          >
            上一页
          </button>
          <span className="min-w-16 text-center text-xs text-[#655D56]">{page} / {totalPages}</span>
          <button
            type="button"
            onClick={() => onChange(page + 1)}
            disabled={page >= totalPages}
            className="rounded-md border border-[#DED4C7] px-3 py-1.5 text-xs font-semibold text-[#6F5B42] transition disabled:cursor-not-allowed disabled:opacity-35 hover:border-[#8B7355]"
          >
            下一页
          </button>
        </div>
      )}
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
  const [search, setSearch] = useState('');
  const [disciplineFilter, setDisciplineFilter] = useState('');
  const [groupFilter, setGroupFilter] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');

  useEffect(() => {
    if (loading) return;
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

      setLoadingModules(true);
      fetch(`/api/events/${eventId}/results?section=modules`, token ? { headers: { Authorization: `Bearer ${token}` } } : undefined)
        .then(async (res) => {
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || '赛事成绩模块加载失败');
          if (cancelled) return;
          const nextResultModules = [...(data.result_modules || [])].sort(byModuleSizeDesc);
          const nextPointModules = [...(data.point_modules || [])].sort(byModuleSizeDesc);
          setResultModules(nextResultModules);
          setPointModules(nextPointModules);
          setStats(data.stats || null);
          if (nextResultModules.length > 0) {
            const first = nextResultModules[0] as ResultModule;
            setActive({ type: 'results', discipline: first.discipline, genderGroup: first.gender_group, boardClass: first.board_class || null });
          } else if (nextPointModules.length > 0) {
            const first = nextPointModules[0] as PointModule;
            setActive({ type: 'points', groupName: first.group_name });
          }
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
  }, [eventId, loading, token]);

  const selectResultModule = useCallback((module: ResultModule) => {
    setActive({ type: 'results', discipline: module.discipline, genderGroup: module.gender_group, boardClass: module.board_class || null });
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
    return resultModules.find((item) => item.discipline === active.discipline && item.gender_group === active.genderGroup && (item.board_class || null) === active.boardClass) || null;
  }, [active, resultModules]);

  const selectedPointModule = useMemo(() => {
    if (!active || active.type !== 'points') return null;
    return pointModules.find((item) => item.group_name === active.groupName) || null;
  }, [active, pointModules]);

  useEffect(() => {
    if (loading || !active) return;
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
      if (active.boardClass) params.set('board_class', active.boardClass);
    } else {
      params.set('group_name', active.groupName);
    }

    queueMicrotask(() => {
      if (cancelled) return;
      setLoadingDetail(true);
      setDetailError('');
      fetch(`/api/events/${eventId}/results?${params.toString()}`, token ? { headers: { Authorization: `Bearer ${token}` } } : undefined)
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
  }, [active, currentPage, eventId, loading, pages, token]);

  const currentData = active ? pages[`${activeKey(active)}:page:${currentPage}`] : null;
  const resultRows = useMemo(
    () => active?.type === 'results' ? (currentData?.items || []) as EventResultRow[] : [],
    [active?.type, currentData]
  );
  const pointRows = useMemo(
    () => active?.type === 'points' ? (currentData?.items || []) as PointStandingRow[] : [],
    [active?.type, currentData]
  );
  const searchText = search.trim().toLowerCase();
  const displayedResultRows = useMemo(() => {
    if (!searchText) return resultRows;
    return resultRows.filter((row) => {
      const members = parseMembers(row.team_members).join(' ');
      return [
        row.athlete_name,
        row.athlete_name_snapshot,
        row.bib_number,
        row.team_name,
        members,
      ].filter(Boolean).join(' ').toLowerCase().includes(searchText);
    });
  }, [resultRows, searchText]);
  const displayedPointRows = useMemo(() => {
    if (!searchText) return pointRows;
    return pointRows.filter((row) => [
      row.athlete_name,
      row.athlete_name_snapshot,
      row.bib_number,
      row.team_name,
    ].filter(Boolean).join(' ').toLowerCase().includes(searchText));
  }, [pointRows, searchText]);

  const disciplineOptions = useMemo(() => Array.from(new Set(resultModules.map((item) => item.discipline))).filter(Boolean), [resultModules]);
  const groupOptions = useMemo(() => Array.from(new Set(resultModules.map((item) => item.gender_group))).filter(Boolean), [resultModules]);
  const filteredResultModules = useMemo(() => resultModules
    .filter((item) => (
      (!disciplineFilter || item.discipline === disciplineFilter)
      && (!groupFilter || item.gender_group === groupFilter)
    ))
    .sort(byModuleSizeDesc), [disciplineFilter, groupFilter, resultModules]);
  const activeTitle = active?.type === 'results'
    ? formatResultModuleTitle(active.discipline, active.genderGroup, active.boardClass)
    : active?.type === 'points'
      ? `${active.groupName} 积分榜`
      : '';
  const activeTotal = active?.type === 'results' && selectedResultModule
    ? numberValue(selectedResultModule.total)
    : active?.type === 'points' && selectedPointModule
      ? numberValue(selectedPointModule.total)
      : 0;
  const totalResults = stats?.resultCount ?? resultModules.reduce((sum, item) => sum + numberValue(item.total), 0);
  const totalPoints = stats?.pointStandingCount ?? pointModules.reduce((sum, item) => sum + numberValue(item.total), 0);
  const podiumRows = displayedResultRows
    .filter((row) => {
      const rank = Number(displayRank(row));
      return Number.isFinite(rank) && rank > 0 && rank <= 3;
    })
    .slice(0, 3);

  function resetFilters() {
    setSearch('');
    setDisciplineFilter('');
    setGroupFilter('');
  }

  if (loading) {
    return <div className="mt-0 rounded-b-2xl border border-[#E0D8CC] bg-[#FEFCF9] p-6 text-sm text-[#655D56]">正在检查登录状态...</div>;
  }

  if (moduleError) {
    return <div className="mt-0 rounded-b-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">{moduleError}</div>;
  }

  if (loadingModules) {
    return (
      <section className="mt-0 rounded-b-2xl border border-[#E0D8CC] bg-[#FEFCF9] p-6">
        <div className="mb-4 h-6 w-32 animate-pulse rounded bg-[#E8DED1]" />
        <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
          <div className="space-y-3">
            {[0, 1, 2, 3].map((item) => <div key={item} className="h-16 animate-pulse rounded-xl bg-[#F2EAE0]" />)}
          </div>
          <div className="h-80 animate-pulse rounded-xl bg-[#F2EAE0]" />
        </div>
      </section>
    );
  }

  if (!resultModules.length && !pointModules.length) return null;

  return (
    <section className="mt-0 overflow-hidden rounded-b-2xl border border-t-0 border-[#DDD2C3] bg-[#FEFCF9] shadow-[0_18px_45px_rgba(85,65,40,0.07)]">
      <div className="grid min-h-[580px] lg:grid-cols-[340px_1fr]">
        <aside className="border-b border-[#E6DCCC] p-5 lg:border-b-0 lg:border-r">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-[#2E2118]">模块列表</h2>
            <span className="text-xs text-[#8A8078]">{resultModules.length + pointModules.length} 个模块</span>
          </div>
          <div className="max-h-[610px] space-y-2 overflow-y-auto pr-1">
            {filteredResultModules.map((module) => {
              const key = resultKey(module);
              const selected = activeKey(active) === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => selectResultModule(module)}
                  className={`w-full rounded-xl border px-4 py-3 text-left transition ${selected ? 'border-[#B58A48] bg-[#E9D7B6] shadow-[0_8px_20px_rgba(138,97,47,0.12)]' : 'border-[#E8DED1] bg-white/72 hover:border-[#CDBA9F] hover:bg-[#FAF6EF]'}`}
                >
                  <div className="flex items-center gap-3">
                    <ModuleIcon />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-base font-semibold text-[#2E2118]">{cleanModuleDiscipline(module.discipline, module.gender_group)}</div>
                      <div className="mt-1 truncate text-sm text-[#7C7064]">
                        {module.board_class ? `${module.board_class} · ` : ''}{module.gender_group || '公开组'}
                      </div>
                    </div>
                    <div className="shrink-0 font-semibold text-[#8A612F]">{numberValue(module.total)}</div>
                  </div>
                </button>
              );
            })}

            {pointModules.length > 0 && (
              <div className="pt-3">
                <div className="mb-2 text-sm font-semibold text-[#655D56]">积分榜</div>
                <div className="space-y-2">
                  {pointModules.map((module) => {
                    const key = pointKey(module);
                    const selected = activeKey(active) === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => selectPointModule(module)}
                        className={`w-full rounded-xl border px-4 py-3 text-left transition ${selected ? 'border-[#B58A48] bg-[#E9D7B6]' : 'border-[#E8DED1] bg-white/72 hover:border-[#CDBA9F] hover:bg-[#FAF6EF]'}`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="truncate text-base font-semibold text-[#2E2118]">{module.group_name}</span>
                          <span className="font-semibold text-[#8A612F]">{numberValue(module.total)}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </aside>

        <div className="min-w-0 p-5 lg:p-6">
          <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <div className="flex flex-wrap items-end gap-4">
                <h2 className="text-2xl font-semibold text-[#2E2118]">{activeTitle || '成绩档案'}</h2>
                <span className="pb-1 text-sm text-[#8A8078]">共 {activeTotal} 条</span>
              </div>
              <div className="mt-1 text-xs text-[#8A8078]">总成绩 {totalResults} 条 · 积分 {totalPoints} 条</div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setViewMode((mode) => mode === 'table' ? 'cards' : 'table')}
                className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#D6C5AE] bg-white px-4 text-sm font-semibold text-[#8A612F] transition hover:bg-[#FAF6EF]"
              >
                <SmallIcon type={viewMode === 'table' ? 'grid' : 'list'} />
                切换视图
              </button>
            </div>
          </div>

          <div className="mb-4 grid gap-3 xl:grid-cols-[minmax(220px,1fr)_200px_200px_auto]">
            <label className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8A8078]"><SmallIcon type="search" /></span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="搜索运动员姓名"
                className="h-11 w-full rounded-lg border border-[#DDD2C3] bg-white pl-11 pr-4 text-sm text-[#2E2118] outline-none transition focus:border-[#B58A48]"
              />
            </label>
            <label className="flex items-center gap-2">
              <span className="text-sm text-[#655D56]">项目</span>
              <select
                value={disciplineFilter}
                onChange={(event) => setDisciplineFilter(event.target.value)}
                className="h-11 min-w-0 flex-1 rounded-lg border border-[#DDD2C3] bg-white px-3 text-sm text-[#655D56] outline-none transition focus:border-[#B58A48]"
              >
                <option value="">全部项目</option>
                {disciplineOptions.map((option) => (
                  <option key={option} value={option}>{cleanModuleDiscipline(option)}</option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2">
              <span className="text-sm text-[#655D56]">组别</span>
              <select
                value={groupFilter}
                onChange={(event) => setGroupFilter(event.target.value)}
                className="h-11 min-w-0 flex-1 rounded-lg border border-[#DDD2C3] bg-white px-3 text-sm text-[#655D56] outline-none transition focus:border-[#B58A48]"
              >
                <option value="">全部组别</option>
                {groupOptions.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-[#D6C5AE] bg-white px-5 text-sm font-semibold text-[#8A612F] transition hover:bg-[#FAF6EF]"
            >
              <SmallIcon type="rotate" />
              重置
            </button>
          </div>

          {detailError && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{detailError}</div>}
          {currentData && 'preview_locked' in currentData && (currentData as PageData<EventResultRow> & { preview_locked?: boolean }).preview_locked && (
            <div className="mb-4 flex flex-col gap-2 rounded-lg border border-[#DFC7A7] bg-[#FFF8EA] p-4 text-sm text-[#6B4A24] sm:flex-row sm:items-center sm:justify-between">
              <span>未登录可预览前 3 条成绩，登录后查看完整项目成绩。</span>
              <Link href={`/login?redirect=${encodeURIComponent(pathname)}`} className="font-semibold text-[#6B3E1E] no-underline">登录查看全部</Link>
            </div>
          )}
          {loadingDetail && !currentData && <div className="rounded-xl border border-dashed border-[#D8CBB9] bg-[#FBF7F0] p-12 text-center text-sm text-[#655D56]">正在加载当前模块...</div>}

          {active?.type === 'results' && currentData && (
            <>
              {podiumRows.length > 0 && (
                <div className="mb-4 grid gap-4 md:grid-cols-3">
                  {podiumRows.map((row) => {
                    const name = row.athlete_name || row.athlete_name_snapshot;
                    const members = parseMembers(row.team_members);
                    return (
                      <div key={row.result_id} className="flex items-center gap-4 rounded-xl border border-[#E9DFD1] bg-gradient-to-br from-[#FFF9EC] via-white to-[#FFFDF8] p-4 shadow-sm">
                        {row.results_points_hidden ? <HiddenValue tip={row.privacy_notice} /> : <PodiumBadge rank={displayRank(row)} />}
                        <div className="min-w-0 flex-1">
                          <AthleteCell
                            athleteId={row.athlete_id}
                            name={name}
                            photo={row.athlete_photo}
                            members={members}
                            meta={row.round_label || null}
                          />
                        </div>
                        <div className="shrink-0 text-base font-bold text-[#8A612F]">
                          <ResultValue row={row} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {(viewMode === 'table') && (
                <div className="hidden overflow-hidden rounded-xl border border-[#E2D7C8] bg-white md:block">
                  <table className="w-full text-sm">
                    <thead className="bg-[#F5F1EB] text-[#655D56]">
                      <tr>
                        <th className="px-5 py-3 text-left">名次</th>
                        <th className="px-5 py-3 text-left">运动员</th>
                        <th className="px-5 py-3 text-right">成绩</th>
                        <th className="px-5 py-3 text-right">配速</th>
                        <th className="px-5 py-3 text-left">队伍</th>
                        <th className="px-5 py-3 text-left">说明</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayedResultRows.map((row) => {
                        const members = parseMembers(row.team_members);
                        return (
                          <tr key={row.result_id} className="border-t border-[#EEE4D8]">
                            <td className="px-5 py-3">{row.results_points_hidden ? <HiddenValue tip={row.privacy_notice} /> : <RankBadge rank={displayRank(row)} />}</td>
                            <td className="px-5 py-3 text-[#655D56]">
                              {row.results_points_hidden ? <HiddenValue tip={row.privacy_notice} /> : (
                                <AthleteCell
                                  athleteId={row.athlete_id}
                                  name={row.athlete_name || row.athlete_name_snapshot}
                                  photo={row.athlete_photo}
                                  members={members}
                                  meta={row.round_label || null}
                                />
                              )}
                            </td>
                            <td className="px-5 py-3 text-right font-bold text-[#8A612F]"><ResultValue row={row} /></td>
                            <td className="px-5 py-3 text-right font-semibold text-[#6F6255]"><ResultPaceValue row={row} /></td>
                            <td className="px-5 py-3 text-[#655D56]"><TeamNameValue row={row} /></td>
                            <td className="px-5 py-3 text-[#655D56]">{row.results_points_hidden ? <HiddenValue tip={row.privacy_notice} /> : row.result_label || '-'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {(viewMode === 'cards') && (
                <div className="hidden grid-cols-1 gap-3 rounded-xl md:grid md:grid-cols-2">
                  {displayedResultRows.map((row) => {
                    const members = parseMembers(row.team_members);
                    return (
                      <div key={row.result_id} className="rounded-xl border border-[#E2D7C8] bg-white p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                              {row.results_points_hidden ? <HiddenValue tip={row.privacy_notice} /> : (
                                <AthleteCell
                                  athleteId={row.athlete_id}
                                  name={row.athlete_name || row.athlete_name_snapshot}
                                  photo={row.athlete_photo}
                                  members={members}
                                  meta={row.round_label || null}
                                />
                              )}
                          </div>
                          {row.results_points_hidden ? <HiddenValue tip={row.privacy_notice} /> : <RankBadge rank={displayRank(row)} />}
                        </div>
                        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                          <div><div className="text-xs text-[#8A8078]">成绩</div><div className="mt-1 font-semibold text-[#8A612F]"><ResultValue row={row} /></div></div>
                          <div><div className="text-xs text-[#8A8078]">配速</div><div className="mt-1 text-[#655D56]"><ResultPaceValue row={row} /></div></div>
                          <div><div className="text-xs text-[#8A8078]">队伍</div><div className="mt-1 text-[#655D56]"><TeamNameValue row={row} /></div></div>
                          <div><div className="text-xs text-[#8A8078]">说明</div><div className="mt-1 text-[#655D56]">{row.results_points_hidden ? <HiddenValue tip={row.privacy_notice} /> : row.result_label || '-'}</div></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="divide-y divide-[#EEE4D8] overflow-hidden rounded-xl border border-[#E2D7C8] bg-white md:hidden">
                {displayedResultRows.map((row) => {
                  const members = parseMembers(row.team_members);
                  return (
                    <div key={row.result_id} className="p-4">
                      <div className="mb-3 flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          {row.results_points_hidden ? <HiddenValue tip={row.privacy_notice} /> : (
                            <AthleteCell
                              athleteId={row.athlete_id}
                              name={row.athlete_name || row.athlete_name_snapshot}
                              photo={row.athlete_photo}
                              members={members}
                              meta={row.round_label || null}
                            />
                          )}
                        </div>
                        {row.results_points_hidden ? <HiddenValue tip={row.privacy_notice} /> : <RankBadge rank={displayRank(row)} />}
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div><div className="text-xs text-[#8A8078]">成绩</div><div className="mt-1 font-semibold text-[#8A612F]"><ResultValue row={row} /></div></div>
                        <div><div className="text-xs text-[#8A8078]">配速</div><div className="mt-1 text-[#655D56]"><ResultPaceValue row={row} /></div></div>
                        <div><div className="text-xs text-[#8A8078]">队伍</div><div className="mt-1 text-[#655D56]"><TeamNameValue row={row} /></div></div>
                        <div><div className="text-xs text-[#8A8078]">说明</div><div className="mt-1 text-[#655D56]">{row.results_points_hidden ? <HiddenValue tip={row.privacy_notice} /> : row.result_label || '-'}</div></div>
                      </div>
                    </div>
                  );
                })}
              </div>
              {displayedResultRows.length === 0 && <div className="rounded-xl border border-dashed border-[#D8CBB9] bg-[#FBF7F0] p-10 text-center text-sm text-[#655D56]">当前筛选没有匹配成绩。</div>}
            </>
          )}

          {active?.type === 'points' && currentData && (
            <>
              <div className="hidden overflow-hidden rounded-xl border border-[#E2D7C8] bg-white md:block">
                <table className="w-full text-sm">
                  <thead className="bg-[#F5F1EB] text-[#655D56]">
                    <tr>
                      <th className="px-5 py-3 text-left">名次</th>
                      <th className="px-5 py-3 text-left">运动员</th>
                      <th className="px-5 py-3 text-left">队伍</th>
                      <th className="px-5 py-3 text-right">耐力赛</th>
                      <th className="px-5 py-3 text-right">冲刺赛</th>
                      <th className="px-5 py-3 text-right">总积分</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayedPointRows.map((row) => (
                      <tr key={row.standing_id} className="border-t border-[#EEE4D8]">
                        <td className="px-5 py-3">{row.results_points_hidden ? <HiddenValue tip={row.privacy_notice} /> : <RankBadge rank={row.rank_position ?? row.status_rank} />}</td>
                        <td className="px-5 py-3 text-[#655D56]">
                          {row.results_points_hidden ? <HiddenValue tip={row.privacy_notice} /> : (
                            <AthleteCell
                              athleteId={row.athlete_id}
                              name={row.athlete_name || row.athlete_name_snapshot}
                              photo={row.athlete_photo}
                              teamName={row.team_name || '个人'}
                            />
                          )}
                        </td>
                        <td className="px-5 py-3 text-[#655D56]">{row.team_name || '个人'}</td>
                        <td className="px-5 py-3 text-right text-[#655D56]">{row.results_points_hidden ? <HiddenValue tip={row.privacy_notice} /> : <>{row.endurance_rank || '-'}{row.endurance_points != null ? ` / ${row.endurance_points}` : ''}</>}</td>
                        <td className="px-5 py-3 text-right text-[#655D56]">{row.results_points_hidden ? <HiddenValue tip={row.privacy_notice} /> : <>{row.sprint_rank || '-'}{row.sprint_points != null ? ` / ${row.sprint_points}` : ''}</>}</td>
                        <td className="px-5 py-3 text-right font-semibold text-[#8A612F]">{row.results_points_hidden ? <HiddenValue tip={row.privacy_notice} /> : row.total_points ?? '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="divide-y divide-[#EEE4D8] overflow-hidden rounded-xl border border-[#E2D7C8] bg-white md:hidden">
                {displayedPointRows.map((row) => (
                  <div key={row.standing_id} className="p-4">
                    <div className="mb-3 flex items-start justify-between gap-3">
                      {row.results_points_hidden ? <HiddenValue tip={row.privacy_notice} /> : (
                        <AthleteCell
                          athleteId={row.athlete_id}
                          name={row.athlete_name || row.athlete_name_snapshot}
                          photo={row.athlete_photo}
                          teamName={row.team_name || '个人'}
                        />
                      )}
                      {row.results_points_hidden ? <HiddenValue tip={row.privacy_notice} /> : <RankBadge rank={row.rank_position ?? row.status_rank} />}
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <div><div className="text-xs text-[#8A8078]">耐力</div><div className="text-[#655D56]">{row.results_points_hidden ? <HiddenValue tip={row.privacy_notice} /> : <>{row.endurance_rank || '-'}{row.endurance_points != null ? `/${row.endurance_points}` : ''}</>}</div></div>
                      <div><div className="text-xs text-[#8A8078]">冲刺</div><div className="text-[#655D56]">{row.results_points_hidden ? <HiddenValue tip={row.privacy_notice} /> : <>{row.sprint_rank || '-'}{row.sprint_points != null ? `/${row.sprint_points}` : ''}</>}</div></div>
                      <div><div className="text-xs text-[#8A8078]">总分</div><div className="font-semibold text-[#8A612F]">{row.results_points_hidden ? <HiddenValue tip={row.privacy_notice} /> : row.total_points ?? '-'}</div></div>
                    </div>
                  </div>
                ))}
              </div>
              {displayedPointRows.length === 0 && <div className="rounded-xl border border-dashed border-[#D8CBB9] bg-[#FBF7F0] p-10 text-center text-sm text-[#655D56]">当前筛选没有匹配积分记录。</div>}
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
      </div>
    </section>
  );
}
