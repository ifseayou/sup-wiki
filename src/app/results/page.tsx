'use client';

import Link from 'next/link';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useUser } from '@/components/UserContext';
import ResultStatusBadge from '@/components/ResultStatusBadge';
import AthleteResultName from '@/components/AthleteResultName';

interface ResultRow {
  result_id: number;
  event_id: number;
  athlete_id: number | null;
  athlete_name_snapshot: string;
  bib_number: string | null;
  gender_group: string;
  discipline: string;
  board_class: string | null;
  round_label: string | null;
  rank_position: number;
  result_label: string | null;
  finish_time: string;
  result_status_code: string | null;
  result_status_note: string | null;
  team_name: string | null;
  team_members: unknown;
  source_title: string | null;
  source_url: string | null;
  source_locator: string | null;
  event_name: string;
  start_date: string | null;
  city: string | null;
  province: string | null;
  star_level: string | null;
  athlete_name: string | null;
  athlete_photo: string | null;
  source_file_url: string | null;
  source_file_name: string | null;
}

interface FilterOption {
  value: string;
  label: string;
  meta?: string | null;
}

const rankOptions: FilterOption[] = [
  { value: '', label: '全部名次' },
  { value: '3', label: '前三' },
  { value: '10', label: '前十' },
  { value: '30', label: '前三十' },
];

const pageSize = 30;

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

function SearchSelect({
  label,
  type,
  value,
  display,
  onChange,
  staticOptions,
}: {
  label: string;
  type?: string;
  value: string;
  display: string;
  onChange: (value: string, display: string) => void;
  staticOptions?: FilterOption[];
}) {
  const { token } = useUser();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(display);
  const [options, setOptions] = useState<FilterOption[]>(staticOptions || []);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => setText(display), [display]);

  useEffect(() => {
    if (staticOptions || !token || !type || !open) return;
    const controller = new AbortController();
    const params = new URLSearchParams({ type, q: text });
    fetch(`/api/results/options?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    })
      .then((res) => res.json())
      .then((data) => setOptions(data.items || []))
      .catch(() => undefined);
    return () => controller.abort();
  }, [open, staticOptions, text, token, type]);

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (boxRef.current && !boxRef.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, []);

  return (
    <div ref={boxRef} className="relative">
      <input
        className="h-12 w-full rounded-md border border-[#D8CDBE] bg-[#FEFCF9] px-3 text-sm text-stone-700 outline-none transition focus:border-[#8B7355] focus:ring-2 focus:ring-[#8B7355]/15"
        placeholder={label}
        value={text}
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          const next = event.target.value;
          setText(next);
          setOpen(true);
          if (!next && value) onChange('', '');
        }}
      />
      {open && (
        <div className="absolute left-0 right-0 z-20 mt-2 max-h-72 overflow-auto rounded-md border border-[#D8CDBE] bg-[#FFFCF7] shadow-[0_16px_40px_rgba(74,56,37,0.14)]">
          {options.map((option) => (
            <button
              type="button"
              key={`${option.value}-${option.label}`}
              className="flex w-full items-center justify-between gap-3 border-b border-[#EFE5D8] px-3 py-2.5 text-left text-sm last:border-b-0 hover:bg-[#F4EBDD]"
              onClick={() => {
                onChange(option.value, option.label);
                setText(option.label);
                setOpen(false);
              }}
            >
              <span className="truncate font-medium text-[#3A2B20]">{option.label}</span>
              {option.meta && <span className="shrink-0 text-xs text-stone-400">{option.meta}</span>}
            </button>
          ))}
          {options.length === 0 && <div className="px-3 py-3 text-sm text-stone-400">没有匹配选项</div>}
        </div>
      )}
    </div>
  );
}

function ResultsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { token, loading } = useUser();
  const [items, setItems] = useState<ResultRow[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState({ resultCount: 0, athleteCount: 0, eventCount: 0 });
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [jumpPage, setJumpPage] = useState('1');
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({
    athlete_id: '',
    athlete_label: '',
    event_id: '',
    event_label: '',
    gender: '',
    gender_label: '',
    discipline: '',
    discipline_label: '',
    year: '',
    year_label: '',
    rank_max: '',
    rank_label: '',
    star_level: '',
    star_label: '',
  });

  useEffect(() => {
    const athleteId = searchParams.get('athlete_id') || '';
    if (!athleteId) return;
    setFilters((prev) => prev.athlete_id === athleteId ? prev : {
      ...prev,
      athlete_id: athleteId,
      athlete_label: prev.athlete_label || `运动员 #${athleteId}`,
    });
  }, [searchParams]);

  useEffect(() => {
    if (!loading && !token) {
      router.replace(`/login?redirect=${encodeURIComponent('/results')}`);
    }
  }, [loading, token, router]);

  const query = useMemo(() => {
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (filters.athlete_id) params.set('athlete_id', filters.athlete_id);
    if (filters.event_id) params.set('event_id', filters.event_id);
    if (filters.gender) params.set('gender', filters.gender);
    if (filters.discipline) params.set('discipline', filters.discipline);
    if (filters.year) params.set('year', filters.year);
    if (filters.rank_max) params.set('rank_max', filters.rank_max);
    if (filters.star_level) params.set('star_level', filters.star_level);
    return params.toString();
  }, [filters, page]);

  useEffect(() => {
    if (!token) return;
    setFetching(true);
    setError('');
    fetch(`/api/results?${query}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || '成绩查询失败');
        setItems(data.items || []);
        setTotal(Number(data.total || 0));
        setStats({
          resultCount: Number(data.stats?.resultCount || data.total || 0),
          athleteCount: Number(data.stats?.athleteCount || 0),
          eventCount: Number(data.stats?.eventCount || 0),
        });
        setTotalPages(Math.max(1, Number(data.totalPages || 1)));
      })
      .catch((err) => setError(err instanceof Error ? err.message : '成绩查询失败'))
      .finally(() => setFetching(false));
  }, [token, query]);

  useEffect(() => setJumpPage(String(page)), [page]);

  function updateFilter(valueKey: keyof typeof filters, labelKey: keyof typeof filters, value: string, label: string) {
    setFilters((prev) => ({ ...prev, [valueKey]: value, [labelKey]: label }));
    setPage(1);
  }

  function clearFilters() {
    setFilters({
      athlete_id: '',
      athlete_label: '',
      event_id: '',
      event_label: '',
      gender: '',
      gender_label: '',
      discipline: '',
      discipline_label: '',
      year: '',
      year_label: '',
      rank_max: '',
      rank_label: '',
      star_level: '',
      star_label: '',
    });
    setPage(1);
  }

  function jumpToPage() {
    const next = Math.min(totalPages, Math.max(1, Number(jumpPage) || 1));
    setPage(next);
  }

  if (loading || !token) {
    return <div className="min-h-[60vh] px-6 py-20 text-center text-stone-500">正在检查登录状态...</div>;
  }

  return (
    <main className="min-h-screen bg-[#F7F2EA]">
      <section className="border-b border-[#E5D9C8] bg-[#29231B] text-[#F9F3E8]">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="mb-2 text-xs uppercase tracking-[0.28em] text-[#CDBB9E]">Race Intelligence</p>
              <h1 className="text-3xl font-semibold tracking-tight md:text-5xl">桨板成绩查询</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-[#D9CDBA]">
                用结构化成绩册筛选运动员、赛事、项目和组别，查看个人档案、对标目标选手并回溯原始成绩来源。
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
              <div className="rounded-md border border-[#7D6B52] px-4 py-3">
                <div className="text-xs text-[#BCA98B]">成绩数</div>
                <div className="mt-1 text-2xl font-semibold text-white">{stats.resultCount}</div>
              </div>
              <div className="rounded-md border border-[#7D6B52] px-4 py-3">
                <div className="text-xs text-[#BCA98B]">参赛运动员数</div>
                <div className="mt-1 text-2xl font-semibold text-white">{stats.athleteCount}</div>
              </div>
              <div className="rounded-md border border-[#7D6B52] px-4 py-3">
                <div className="text-xs text-[#BCA98B]">比赛数</div>
                <div className="mt-1 text-2xl font-semibold text-white">{stats.eventCount}</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-5 rounded-lg border border-[#DED2C1] bg-[#FFFCF7] p-4 shadow-[0_14px_36px_rgba(93,72,48,0.07)]">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-7">
            <div className="xl:col-span-2">
              <SearchSelect label="运动员" type="athlete" value={filters.athlete_id} display={filters.athlete_label} onChange={(v, l) => updateFilter('athlete_id', 'athlete_label', v, l)} />
            </div>
            <div className="xl:col-span-2">
              <SearchSelect label="赛事" type="event" value={filters.event_id} display={filters.event_label} onChange={(v, l) => updateFilter('event_id', 'event_label', v, l)} />
            </div>
            <SearchSelect label="项目" type="discipline" value={filters.discipline} display={filters.discipline_label} onChange={(v, l) => updateFilter('discipline', 'discipline_label', v, l)} />
            <SearchSelect label="性别组" type="gender" value={filters.gender} display={filters.gender_label} onChange={(v, l) => updateFilter('gender', 'gender_label', v, l)} />
            <SearchSelect label="年份" type="year" value={filters.year} display={filters.year_label} onChange={(v, l) => updateFilter('year', 'year_label', v, l)} />
            <SearchSelect label="名次" value={filters.rank_max} display={filters.rank_label} staticOptions={rankOptions} onChange={(v, l) => updateFilter('rank_max', 'rank_label', v, l)} />
            <SearchSelect label="星级" type="star_level" value={filters.star_level} display={filters.star_label} onChange={(v, l) => updateFilter('star_level', 'star_label', v, l)} />
          </div>
          <div className="mt-3 flex items-center justify-between gap-3 text-sm text-stone-500">
            <span>每页 {pageSize} 条，当前筛选命中 {total} 条</span>
            <button type="button" onClick={clearFilters} className="rounded-md border border-[#D8CDBE] px-3 py-2 text-[#6F563B] hover:bg-[#F4EBDD]">清空筛选</button>
          </div>
        </div>

        {error && <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        <div className="overflow-hidden rounded-lg border border-[#DED2C1] bg-[#FFFCF7] shadow-[0_18px_42px_rgba(93,72,48,0.08)]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-sm">
              <thead className="bg-[#E9DECD] text-left text-xs uppercase tracking-wide text-[#6E604E]">
                <tr>
                  <th className="px-4 py-3">运动员</th>
                  <th className="px-4 py-3">赛事</th>
                  <th className="px-4 py-3">项目</th>
                  <th className="px-4 py-3">组别</th>
                  <th className="px-4 py-3 text-center">名次</th>
                  <th className="px-4 py-3 text-right">成绩</th>
                  <th className="px-4 py-3">队伍</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => {
                  const members = parseMembers(row.team_members);
                  return (
                  <tr key={row.result_id} className="border-t border-[#EEE4D8] hover:bg-[#F8F0E5]">
                    <td className="px-4 py-3 font-medium text-[#34291F]">
                      <AthleteResultName athleteId={row.athlete_id} name={row.athlete_name || row.athlete_name_snapshot} photo={row.athlete_photo} bibNumber={row.bib_number} />
                      {row.bib_number && <div className="text-xs font-normal text-stone-400">#{row.bib_number}</div>}
                      {members.length > 0 && <div className="mt-1 text-xs font-normal text-stone-400">成员：{members.join('、')}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/events/${row.event_id}`} className="font-medium text-[#6F563B] hover:text-[#4B3927]">{row.event_name}</Link>
                      <div className="text-xs text-stone-400">{[row.province, row.city].filter(Boolean).join(' · ')} {row.start_date?.slice(0, 10)}</div>
                    </td>
                    <td className="px-4 py-3 text-stone-700">{row.discipline}{row.board_class ? ` / ${row.board_class}` : ''}</td>
                    <td className="px-4 py-3 text-stone-600">{row.gender_group}{row.round_label ? ` · ${row.round_label}` : ''}</td>
                    <td className="px-4 py-3 text-center font-semibold text-[#2E281F]">{row.rank_position >= 9000 ? '—' : row.rank_position}</td>
                    <td className="px-4 py-3 text-right font-semibold text-[#7A6145]"><ResultStatusBadge finishTime={row.finish_time} statusCode={row.result_status_code} statusNote={row.result_status_note} /></td>
                    <td className="px-4 py-3 text-stone-500">{row.team_name || '个人'}</td>
                  </tr>
                  );
                })}
                {!fetching && items.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-12 text-center text-stone-400">没有匹配的成绩</td></tr>
                )}
              </tbody>
            </table>
          </div>
          {fetching && <div className="border-t border-[#EEE4D8] px-4 py-4 text-center text-sm text-stone-400">加载中...</div>}
        </div>

        <div className="mt-5 flex flex-col gap-3 rounded-lg border border-[#DED2C1] bg-[#FFFCF7] px-4 py-3 text-sm text-stone-500 sm:flex-row sm:items-center sm:justify-between">
          <span>共 {total} 条记录，第 {page} / {totalPages} 页</span>
          <div className="flex flex-wrap items-center gap-2">
            <button disabled={page <= 1} onClick={() => setPage((v) => Math.max(1, v - 1))} className="rounded-md border border-[#D8CDBE] px-3 py-2 disabled:opacity-40">上一页</button>
            <button disabled={page >= totalPages} onClick={() => setPage((v) => Math.min(totalPages, v + 1))} className="rounded-md border border-[#D8CDBE] px-3 py-2 disabled:opacity-40">下一页</button>
            <input value={jumpPage} onChange={(e) => setJumpPage(e.target.value.replace(/[^\d]/g, ''))} className="h-10 w-20 rounded-md border border-[#D8CDBE] bg-[#FEFCF9] px-3 text-center outline-none focus:border-[#8B7355]" />
            <button onClick={jumpToPage} className="rounded-md bg-[#8B7355] px-3 py-2 text-white hover:bg-[#6F5B42]">跳转</button>
          </div>
        </div>
      </section>
    </main>
  );
}

export default function ResultsPage() {
  return (
    <Suspense fallback={<div className="min-h-[60vh] px-6 py-20 text-center text-stone-500">正在加载成绩查询...</div>}>
      <ResultsContent />
    </Suspense>
  );
}
