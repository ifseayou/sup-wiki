'use client';

import Link from 'next/link';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useUser } from '@/components/UserContext';
import ResultStatusBadge from '@/components/ResultStatusBadge';
import type { ReactNode } from 'react';

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
  finish_time: string;
  result_status_code: string | null;
  result_status_note: string | null;
  team_name: string | null;
  team_members: unknown;
  event_name: string;
  start_date: string | null;
  city: string | null;
  province: string | null;
  star_level: string | null;
  athlete_name: string | null;
  athlete_photo: string | null;
  gap_display: string | null;
  pace_display: string | null;
  is_long_distance: boolean;
}

interface FilterOption {
  value: string;
  label: string;
  meta?: string | null;
}

interface MemberLike {
  name?: unknown;
  member_name?: unknown;
}

const rankOptions: FilterOption[] = [
  { value: '', label: '全部名次' },
  { value: '3', label: '前三名' },
  { value: '10', label: '前十名' },
  { value: '30', label: '前三十名' },
];

const pageSize = 20;

function parseMembers(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item: MemberLike) => String(item?.name || item?.member_name || '')).filter(Boolean);
  if (!value) return [];
  try {
    const parsed = JSON.parse(String(value));
    return Array.isArray(parsed) ? parsed.map((item: MemberLike) => String(item?.name || item?.member_name || '')).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function Icon({ name }: { name: 'search' | 'user' | 'trophy' | 'timer' | 'calendar' | 'rotate' | 'star' | 'upload' | 'file' | 'check' | 'help' }) {
  const paths: Record<string, ReactNode> = {
    search: <><circle cx="11" cy="11" r="6" /><path d="m16 16 4 4" /></>,
    user: <><path d="M20 21a8 8 0 0 0-16 0" /><circle cx="12" cy="8" r="4" /></>,
    trophy: <><path d="M8 21h8" /><path d="M12 17v4" /><path d="M7 4h10v5a5 5 0 0 1-10 0z" /><path d="M5 5H3v2a4 4 0 0 0 4 4" /><path d="M19 5h2v2a4 4 0 0 1-4 4" /></>,
    timer: <><circle cx="12" cy="13" r="8" /><path d="M12 13V8" /><path d="m12 13 3 2" /><path d="M9 2h6" /></>,
    calendar: <><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M8 3v4" /><path d="M16 3v4" /><path d="M4 10h16" /></>,
    rotate: <><path d="M21 12a9 9 0 1 1-2.64-6.36" /><path d="M21 4v6h-6" /></>,
    star: <path d="m12 3 2.7 5.48 6.05.88-4.38 4.27 1.03 6.02L12 16.8l-5.4 2.85 1.03-6.02-4.38-4.27 6.05-.88z" />,
    upload: <><path d="M12 16V4" /><path d="m7 9 5-5 5 5" /><path d="M20 16.5a4.5 4.5 0 0 1-4.5 4.5h-7A4.5 4.5 0 0 1 4 16.5a4.5 4.5 0 0 1 6.7-3.9" /></>,
    file: <><path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7z" /><path d="M14 2v5h5" /><path d="M9 13h6" /><path d="M9 17h4" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    help: <><circle cx="12" cy="12" r="9" /><path d="M9.4 9a3 3 0 0 1 5.2 2c0 2-2.6 2.2-2.6 4" /><path d="M12 18h.01" /></>,
  };

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {paths[name]}
    </svg>
  );
}

function SearchSelect({
  label,
  type,
  value,
  display,
  onChange,
  staticOptions,
  optionParams,
  icon = 'search',
}: {
  label: string;
  type?: string;
  value: string;
  display: string;
  onChange: (value: string, display: string) => void;
  staticOptions?: FilterOption[];
  optionParams?: Record<string, string>;
  icon?: 'search' | 'user' | 'trophy' | 'calendar' | 'star';
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(display);
  const [options, setOptions] = useState<FilterOption[]>(staticOptions || []);
  const boxRef = useRef<HTMLDivElement>(null);
  const optionParamKey = JSON.stringify(optionParams || {});

  useEffect(() => {
    queueMicrotask(() => setText(display));
  }, [display]);

  useEffect(() => {
    if (staticOptions || !type || !open) return;
    const controller = new AbortController();
    const params = new URLSearchParams({ type, q: text });
    const optionEntries = Object.entries(JSON.parse(optionParamKey) as Record<string, string>);
    for (const [key, paramValue] of optionEntries) {
      if (paramValue) params.set(key, paramValue);
    }
    fetch(`/api/results/options?${params}`, { signal: controller.signal })
      .then((res) => res.json())
      .then((data) => setOptions(data.items || []))
      .catch(() => undefined);
    return () => controller.abort();
  }, [open, optionParamKey, staticOptions, text, type]);

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (boxRef.current && !boxRef.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, []);

  return (
    <div ref={boxRef} className="relative">
      <label className="mb-1.5 block text-xs font-semibold text-[#5F4D3A]">{label}</label>
      <div className="relative">
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#987D59]">
          <Icon name={icon} />
        </span>
        <input
          className="h-12 w-full rounded-md border border-[#E3D5C2] bg-white/85 px-3 pr-9 text-sm text-[#3D3328] outline-none transition placeholder:text-[#B5AA9C] focus:border-[#8B5A2B] focus:ring-2 focus:ring-[#D79E49]/20"
          placeholder={type ? `请输入${label}` : label}
          value={text}
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            const next = event.target.value;
            setText(next);
            setOpen(true);
            if (!next && value) onChange('', '');
          }}
        />
      </div>
      {open && (
        <div className="absolute left-0 right-0 z-30 mt-2 max-h-72 overflow-auto rounded-md border border-[#DCCBB4] bg-[#FFFDF9] shadow-[0_18px_50px_rgba(54,38,24,0.16)]">
          {staticOptions && (
            <button
              type="button"
              className="flex w-full items-center justify-between gap-3 border-b border-[#F0E6D9] px-3 py-2.5 text-left text-sm hover:bg-[#F8EFE2]"
              onClick={() => {
                onChange('', '');
                setText('');
                setOpen(false);
              }}
            >
              <span className="truncate font-medium text-[#3A2B20]">全部</span>
            </button>
          )}
          {options.map((option) => (
            <button
              type="button"
              key={`${option.value}-${option.label}`}
              className="flex w-full items-center justify-between gap-3 border-b border-[#F0E6D9] px-3 py-2.5 text-left text-sm last:border-b-0 hover:bg-[#F8EFE2]"
              onClick={() => {
                onChange(option.value, option.label);
                setText(option.label);
                setOpen(false);
              }}
            >
              <span className="truncate font-medium text-[#3A2B20]">{option.label}</span>
              {option.meta && <span className="shrink-0 text-xs text-[#9E8F7E]">{option.meta}</span>}
            </button>
          ))}
          {options.length === 0 && <div className="px-3 py-3 text-sm text-[#9E8F7E]">没有匹配选项</div>}
        </div>
      )}
    </div>
  );
}

function RankBadge({ rank }: { rank: number }) {
  if (!rank || rank >= 9000) return <span className="text-[#9B9187]">-</span>;
  if (rank <= 3) {
    const style = rank === 1
      ? 'border-[#F5B82E] bg-[radial-gradient(circle_at_38%_28%,#FFF8D7,#FFD45C_54%,#B97312)] text-[#5D3700] shadow-[0_0_0_5px_rgba(245,184,46,0.16),0_8px_18px_rgba(185,115,18,0.22)]'
      : rank === 2
        ? 'border-[#BFC7D0] bg-[radial-gradient(circle_at_38%_28%,#FFFFFF,#DCE3EA_58%,#9BA8B5)] text-[#33404C] shadow-[0_0_0_5px_rgba(160,174,189,0.16),0_8px_18px_rgba(92,107,121,0.18)]'
        : 'border-[#DE9351] bg-[radial-gradient(circle_at_38%_28%,#FFF1DF,#E9A45F_56%,#A85D26)] text-[#5D2E07] shadow-[0_0_0_5px_rgba(222,147,81,0.16),0_8px_18px_rgba(168,93,38,0.18)]';
    return (
      <span className="relative inline-flex h-12 w-12 items-center justify-center">
        <span className="absolute inset-x-1 bottom-0 h-2 rounded-full bg-black/10 blur-sm" />
        <span className={`relative inline-flex h-11 w-11 items-center justify-center rounded-full border-2 text-lg font-black ${style}`}>
          <span className="absolute inset-1 rounded-full border border-white/65" />
          <span className="relative">{rank}</span>
        </span>
      </span>
    );
  }
  return <span className="inline-flex h-8 min-w-8 items-center justify-center rounded-full border border-[#E6D9C9] bg-white px-2 font-semibold text-[#5B4A38]">{rank}</span>;
}

function AthleteCell({ row, members }: { row: ResultRow; members: string[] }) {
  const name = row.athlete_name || row.athlete_name_snapshot || '未命名运动员';
  const avatar = row.athlete_photo ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={row.athlete_photo} alt={name} className="h-full w-full object-cover" />
  ) : (
    <span className="text-sm font-black text-[#7A4B22]">{name.slice(0, 1)}</span>
  );
  const body = (
    <span className="flex min-w-0 items-center gap-3">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#E1D2BF] bg-[#F6EBDD] shadow-[0_5px_12px_rgba(86,63,38,0.14)]">
        {avatar}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-base font-bold text-[#3A2B20]">{name}</span>
        {members.length > 0 && <span className="mt-0.5 block max-w-[220px] truncate text-xs font-normal text-[#9B8A76]">成员：{members.join('、')}</span>}
      </span>
    </span>
  );
  if (!row.athlete_id) return body;
  return <Link href={`/athletes/${row.athlete_id}`} className="block no-underline">{body}</Link>;
}

function pageItems(current: number, total: number) {
  const pages = new Set([1, 2, current - 1, current, current + 1, total]);
  return Array.from(pages)
    .filter((item) => item >= 1 && item <= total)
    .sort((a, b) => a - b)
    .reduce<(number | 'gap')[]>((acc, item) => {
      const last = acc[acc.length - 1];
      if (typeof last === 'number' && item - last > 1) acc.push('gap');
      acc.push(item);
      return acc;
    }, []);
}

function NoResultsUploadGuide({
  uploadHref,
  eventName,
  onClear,
  onRefilter,
}: {
  uploadHref: string;
  eventName: string;
  onClear: () => void;
  onRefilter: () => void;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-[#E5D7C4] bg-[#FFFCF7] shadow-[0_18px_48px_rgba(91,68,43,0.08)]">
      <div className="grid gap-0 lg:grid-cols-[0.95fr_1.2fr_0.85fr]">
        <div className="relative min-h-[300px] overflow-hidden bg-[radial-gradient(circle_at_35%_34%,rgba(206,151,72,0.22),transparent_30%),linear-gradient(135deg,#FFF7EA,#F9EFE0)] px-8 py-8">
          <div className="absolute -left-10 bottom-0 h-36 w-36 rounded-full border border-[#E7D8C2] bg-white/30" />
          <div className="absolute right-8 top-8 h-16 w-16 rounded-full border border-[#E0C9A9] bg-white/50 shadow-[0_12px_30px_rgba(101,71,36,0.12)]" />
          <div className="relative mx-auto mt-8 h-48 max-w-[320px]">
            <div className="absolute bottom-1 left-1/2 h-8 w-64 -translate-x-1/2 rounded-[50%] bg-[#D9B77C]/20 blur-sm" />
            <div className="absolute bottom-6 left-5 h-24 w-24 rounded-b-lg rounded-t-[44px] border border-[#D5A657] bg-[linear-gradient(145deg,#F6D47C,#B77722)] shadow-[0_18px_36px_rgba(133,82,27,0.22)]">
              <div className="absolute left-1/2 top-7 h-10 w-10 -translate-x-1/2 rounded-full border-4 border-[#FFF0BC]" />
              <div className="absolute -left-4 top-8 h-8 w-7 rounded-l-full border-4 border-r-0 border-[#C8953D]" />
              <div className="absolute -right-4 top-8 h-8 w-7 rounded-r-full border-4 border-l-0 border-[#C8953D]" />
              <div className="absolute bottom-[-18px] left-1/2 h-5 w-14 -translate-x-1/2 rounded-t-md bg-[#93601F]" />
            </div>
            <div className="absolute bottom-10 left-28 h-36 w-28 -rotate-3 rounded-md border border-[#E0D0BA] bg-white/78 p-4 shadow-[0_18px_38px_rgba(94,68,42,0.13)]">
              <div className="mb-4 h-2 w-12 rounded-full bg-[#D3B485]" />
              <div className="space-y-2">
                <div className="h-2 rounded bg-[#E9DDCC]" />
                <div className="h-2 rounded bg-[#E9DDCC]" />
                <div className="h-2 w-16 rounded bg-[#E9DDCC]" />
              </div>
              <div className="mt-4 grid grid-cols-3 gap-1">
                {Array.from({ length: 9 }).map((_, index) => <div key={index} className="h-4 rounded-sm border border-[#EFE2D0]" />)}
              </div>
            </div>
            <div className="absolute bottom-8 right-9 h-24 w-24 rounded-full border-[10px] border-[#C49A5A] bg-white/25 shadow-[0_18px_34px_rgba(92,62,31,0.18)]">
              <div className="absolute -bottom-8 -right-4 h-12 w-3 rotate-[-38deg] rounded-full bg-[#7C5430]" />
            </div>
          </div>
        </div>

        <div className="px-7 py-9 md:px-10">
          <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-full bg-[#8B6A3F] text-white shadow-[0_10px_22px_rgba(139,106,63,0.2)]">
            <Icon name="file" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-[#2D261F] md:text-3xl">未找到相关成绩记录</h2>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-[#7B6D5E]">
            当前按姓名或赛事查询暂无结果，你可以上传该比赛的成绩册，帮助补充和完善赛事数据。
          </p>
          {eventName && (
            <div className="mt-4 inline-flex max-w-full items-center gap-2 rounded-full border border-[#E8D9C4] bg-white px-3 py-1.5 text-xs font-semibold text-[#6B4A24]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#B77A2E]" />
              <span className="truncate">将为「{eventName}」预填赛事名称</span>
            </div>
          )}
          <div className="mt-5 flex flex-wrap items-center gap-3 text-sm text-[#8A7B6B]">
            <span className="inline-flex items-center gap-1.5"><Icon name="star" />当前支持 PDF 成绩册</span>
            <span className="hidden h-1 w-1 rounded-full bg-[#CDBAA4] sm:inline-block" />
            <span>上传后进入人工校对或智能识别流程</span>
          </div>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link href={uploadHref} className="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-[#B57B2F] px-6 text-sm font-semibold text-white no-underline shadow-[0_12px_26px_rgba(181,123,47,0.24)] transition hover:bg-[#945D1F]">
              <Icon name="upload" />上传比赛成绩册
            </Link>
            <button type="button" onClick={onRefilter} className="inline-flex h-12 items-center justify-center gap-2 rounded-md border border-[#DCCBB4] bg-white px-6 text-sm font-semibold text-[#6B3E1E] transition hover:bg-[#F8EFE4]">
              <Icon name="search" />重新筛选
            </button>
          </div>
          <div className="mt-7 rounded-xl border border-dashed border-[#D8C4A8] bg-white/70 px-5 py-5 text-center text-[#8A7B6B]">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#F2E3CF] text-[#9B6A2D]">
              <Icon name="upload" />
            </div>
            <div className="text-base font-semibold text-[#4A3A2A]">拖拽文件到这里，或点击上传入口</div>
            <div className="mt-1 text-sm">单个 PDF 文件不超过 50MB</div>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {[
              ['file', '自动识别成绩', '提取成绩信息'],
              ['calendar', '支持多页成绩册', '批量校对更高效'],
              ['trophy', '补充赛事数据库', '完善历史赛事数据'],
            ].map(([icon, title, desc]) => (
              <div key={title} className="rounded-lg border border-[#E8D9C4] bg-[#FFF9F0] px-4 py-3">
                <div className="mb-2 text-[#A06D2C]"><Icon name={icon as 'file' | 'calendar' | 'trophy'} /></div>
                <div className="text-sm font-semibold text-[#4A3A2A]">{title}</div>
                <div className="mt-1 text-xs text-[#9B8A76]">{desc}</div>
              </div>
            ))}
          </div>
        </div>

        <aside className="border-t border-[#E8D9C4] bg-[#FFF8ED] p-7 lg:border-l lg:border-t-0">
          <div className="rounded-xl border border-[#E2D0B6] bg-white/78 p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
            <div className="mb-5 flex items-center gap-3">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#C9AA77] text-white"><Icon name="help" /></span>
              <h3 className="text-xl font-bold text-[#3A2B20]">为什么要上传？</h3>
            </div>
            <div className="space-y-5">
              {[
                ['补全缺失赛事成绩', '完整历史赛事档案'],
                ['帮助更多运动员被检索到', '让优秀成绩被更多人看到'],
                ['让俱乐部数据库更完整', '为训练与赛事管理提供数据支持'],
              ].map(([title, desc]) => (
                <div key={title} className="flex gap-3">
                  <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#F2E3CF] text-[#8B5A2B]"><Icon name="check" /></span>
                  <div>
                    <div className="font-semibold text-[#4A3A2A]">{title}</div>
                    <div className="mt-1 text-sm text-[#9B8A76]">{desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
      <div className="flex flex-col gap-3 border-t border-[#E8D9C4] bg-white/70 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
        <button type="button" onClick={onClear} className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-[#DCCBB4] bg-white px-5 text-sm font-semibold text-[#6B3E1E] transition hover:bg-[#F8EFE4]">
          <Icon name="rotate" />返回全部成绩
        </button>
        <button type="button" onClick={onRefilter} className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-[#DCCBB4] bg-white px-5 text-sm font-semibold text-[#6B3E1E] transition hover:bg-[#F8EFE4]">
          <Icon name="search" />重新筛选
        </button>
      </div>
    </div>
  );
}

function ResultsContent() {
  const searchParams = useSearchParams();
  const { token, loading } = useUser();
  const filtersPanelRef = useRef<HTMLDivElement>(null);
  const [items, setItems] = useState<ResultRow[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState({ resultCount: 0, athleteCount: 0, eventCount: 0 });
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [jumpPage, setJumpPage] = useState('1');
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState('');
  const [previewLocked, setPreviewLocked] = useState(false);
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
    queueMicrotask(() => {
      setFilters((prev) => prev.athlete_id === athleteId ? prev : {
        ...prev,
        athlete_id: athleteId,
        athlete_label: prev.athlete_label || `运动员 #${athleteId}`,
      });
    });
  }, [searchParams]);

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
    if (loading) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setFetching(true);
      setError('');
      fetch(`/api/results?${query}`, token ? { headers: { Authorization: `Bearer ${token}` } } : undefined)
        .then(async (res) => {
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || '成绩查询失败');
          if (cancelled) return;
          setItems(data.items || []);
          setPreviewLocked(Boolean(data.preview_locked));
          setTotal(Number(data.total || 0));
          setStats({
            resultCount: Number(data.stats?.resultCount || data.total || 0),
            athleteCount: Number(data.stats?.athleteCount || 0),
            eventCount: Number(data.stats?.eventCount || 0),
          });
          setTotalPages(Math.max(1, Number(data.totalPages || 1)));
        })
        .catch((err) => {
          if (!cancelled) {
            setPreviewLocked(false);
            setError(err instanceof Error ? err.message : '成绩查询失败');
          }
        })
        .finally(() => {
          if (!cancelled) setFetching(false);
        });
    });
    return () => {
      cancelled = true;
    };
  }, [loading, token, query]);

  useEffect(() => {
    queueMicrotask(() => setJumpPage(String(page)));
  }, [page]);

  function updateFilter(valueKey: keyof typeof filters, labelKey: keyof typeof filters, value: string, label: string) {
    setFilters((prev) => ({ ...prev, [valueKey]: value, [labelKey]: label }));
    setPage(1);
  }

  function updateEventFilter(value: string, label: string) {
    setFilters((prev) => ({
      ...prev,
      event_id: value,
      event_label: label,
      discipline: '',
      discipline_label: '',
      gender: '',
      gender_label: '',
    }));
    setPage(1);
  }

  function applyQuick(type: 'discipline' | 'gender' | 'rank', value: string, label: string) {
    if (type === 'discipline') updateFilter('discipline', 'discipline_label', value, label);
    if (type === 'gender') updateFilter('gender', 'gender_label', value, label);
    if (type === 'rank') updateFilter('rank_max', 'rank_label', value, label);
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

  const uploadParams = new URLSearchParams();
  if (filters.event_label.trim()) uploadParams.set('event_name', filters.event_label.trim());
  const uploadQuery = uploadParams.toString();
  const uploadHref = `/events/upload-results${uploadQuery ? `?${uploadQuery}` : ''}`;
  const showUploadGuide = !fetching && !error && items.length === 0;

  if (loading) {
    return <div className="min-h-[60vh] px-6 py-20 text-center text-[#7B6D5E]">正在检查登录状态...</div>;
  }

  return (
    <main className="min-h-screen bg-[#FBF7F1] text-[#2D261F]">
      <section className="relative overflow-hidden border-b border-[#E9DDCD] bg-[#211B15] text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_24%_42%,rgba(211,142,57,0.22),transparent_28%),linear-gradient(90deg,rgba(23,18,13,0.96),rgba(38,30,22,0.86)_52%,rgba(38,30,22,0.42))]" />
        <div className="absolute right-0 top-0 hidden h-full w-[38%] opacity-45 md:block">
          <div className="h-full w-full bg-[linear-gradient(115deg,transparent_0%,rgba(251,247,241,0.08)_38%,rgba(251,247,241,0.0)_39%),radial-gradient(circle_at_76%_40%,rgba(214,161,87,0.35),transparent_34%)]" />
        </div>
        <div className="relative mx-auto flex max-w-7xl flex-col gap-8 px-4 py-12 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div className="max-w-3xl">
            <p className="mb-3 text-xs uppercase tracking-[0.32em] text-[#D8AE69]">Race Intelligence</p>
            <h1 className="text-4xl font-bold tracking-tight md:text-6xl">桨板成绩查询</h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-[#E5D8C6]">记录你的每一次成长与进步</p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {([
              ['成绩数', stats.resultCount, 'timer'],
              ['参赛运动员数', stats.athleteCount, 'user'],
              ['比赛数', stats.eventCount, 'trophy'],
            ] as const).map(([label, value, icon]) => (
              <div key={String(label)} className="min-w-[128px] rounded-md border border-[#8C704E] bg-black/18 px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur">
                <div className="mb-3 flex items-center gap-2 text-xs text-[#D7B77F]"><Icon name={icon} />{label}</div>
                <div className="text-3xl font-bold">{value}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div ref={filtersPanelRef} className="mb-5 border border-[#E2D4C0] bg-white/88 p-5 shadow-[0_18px_42px_rgba(91,68,43,0.08)] backdrop-blur">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <SearchSelect label="运动员" type="athlete" value={filters.athlete_id} display={filters.athlete_label} icon="user" onChange={(v, l) => updateFilter('athlete_id', 'athlete_label', v, l)} />
            <SearchSelect label="赛事" type="event" value={filters.event_id} display={filters.event_label} icon="trophy" onChange={updateEventFilter} />
            <SearchSelect
              label="项目"
              type="discipline"
              value={filters.discipline}
              display={filters.discipline_label}
              optionParams={{ event_id: filters.event_id, gender: filters.gender }}
              onChange={(v, l) => updateFilter('discipline', 'discipline_label', v, l)}
            />
            <SearchSelect
              label="性别组"
              type="gender"
              value={filters.gender}
              display={filters.gender_label}
              optionParams={{ event_id: filters.event_id, discipline: filters.discipline }}
              onChange={(v, l) => updateFilter('gender', 'gender_label', v, l)}
            />
            <SearchSelect label="年份" type="year" value={filters.year} display={filters.year_label} icon="calendar" onChange={(v, l) => updateFilter('year', 'year_label', v, l)} />
            <SearchSelect label="名次" value={filters.rank_max} display={filters.rank_label} staticOptions={rankOptions} onChange={(v, l) => updateFilter('rank_max', 'rank_label', v, l)} />
            <SearchSelect label="星级" type="star_level" value={filters.star_level} display={filters.star_label} icon="star" onChange={(v, l) => updateFilter('star_level', 'star_label', v, l)} />
            <div className="flex items-end justify-end gap-3 md:col-span-2 xl:col-span-3">
              <button type="button" onClick={() => setPage(1)} className="inline-flex h-12 items-center gap-2 rounded-md bg-[#6B3E1E] px-8 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(107,62,30,0.24)] transition hover:bg-[#4F2D16]">
                <Icon name="search" />查询
              </button>
              <button type="button" onClick={clearFilters} className="inline-flex h-12 items-center gap-2 rounded-md border border-[#CDBAA4] bg-white px-5 text-sm font-semibold text-[#6B3E1E] transition hover:bg-[#F8EFE4]">
                <Icon name="rotate" />清空筛选
              </button>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
            <span className="mr-1 text-[#7B6D5E]">快捷筛选:</span>
            {([
              ['rank', '10', '前十名'],
              ['discipline', '7公里', '7公里'],
              ['discipline', '200米', '200米'],
              ['gender', '男子精英组', '男子精英组'],
              ['gender', '女子公开组', '女子公开组'],
            ] as const).map(([type, value, label]) => (
              <button key={`${type}-${value}`} type="button" onClick={() => applyQuick(type, value, label)} className="rounded-full border border-[#E4D6C3] bg-white px-4 py-1.5 text-[#6B3E1E] transition hover:border-[#C28C4F] hover:bg-[#FFF4E6]">
                {label}
              </button>
            ))}
          </div>
          <div className="mt-4 text-sm text-[#8A7B6B]">每页 {pageSize} 条，当前筛选命中 {total} 条</div>
        </div>

        {error && <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        {previewLocked && (
          <div className="mb-4 flex flex-col gap-3 rounded-md border border-[#DFC7A7] bg-[#FFF8EA] px-4 py-3 text-sm text-[#6B4A24] sm:flex-row sm:items-center sm:justify-between">
            <span>未登录用户可预览前 3 条成绩。登录后可查看完整成绩，并使用更多筛选与导出能力。</span>
            <Link href={`/login?redirect=${encodeURIComponent('/results')}`} className="inline-flex shrink-0 rounded-md bg-[#6B3E1E] px-4 py-2 text-sm font-semibold text-white no-underline">
              登录查看全部
            </Link>
          </div>
        )}

        {showUploadGuide ? (
          <NoResultsUploadGuide
            uploadHref={uploadHref}
            eventName={filters.event_label.trim()}
            onClear={clearFilters}
            onRefilter={() => filtersPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
          />
        ) : (
          <div className="overflow-hidden border border-[#E2D4C0] bg-white shadow-[0_18px_42px_rgba(91,68,43,0.08)]">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1320px] text-sm">
                <thead className="border-b border-[#E8DCCA] bg-[#F4EDDF] text-left text-xs font-semibold uppercase tracking-wide text-[#746556]">
                  <tr>
                    <th className="px-4 py-4 text-center">名次</th>
                    <th className="px-4 py-4">运动员</th>
                    <th className="px-4 py-4">组别</th>
                    <th className="px-4 py-4">项目</th>
                    <th className="px-4 py-4 text-right">成绩</th>
                    <th className="px-4 py-4 text-right">与上一名差距</th>
                    <th className="px-4 py-4 text-right">平均配速</th>
                    <th className="px-4 py-4">赛事</th>
                    <th className="px-4 py-4">队伍</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((row) => {
                    const members = parseMembers(row.team_members);
                    return (
                      <tr key={row.result_id} className="border-b border-[#EFE5D8] transition hover:bg-[#FFF8EE]">
                        <td className="px-4 py-3 text-center"><RankBadge rank={row.rank_position} /></td>
                        <td className="px-4 py-3 font-semibold text-[#3A2B20]">
                          <AthleteCell row={row} members={members} />
                        </td>
                        <td className="px-4 py-3 text-[#5B5148]">{row.gender_group || '-'}</td>
                        <td className="px-4 py-3 text-[#5B5148]">
                          <div className="font-medium text-[#3A2B20]">{row.discipline || '-'}</div>
                          <div className="text-xs text-[#A09284]">{[row.board_class, row.round_label].filter(Boolean).join(' · ') || '-'}</div>
                        </td>
                        <td className="px-4 py-3 text-right text-base font-bold text-[#634325]">
                          <span className="inline-flex items-center justify-end gap-1.5"><Icon name="timer" /><ResultStatusBadge finishTime={row.finish_time} statusCode={row.result_status_code} statusNote={row.result_status_note} /></span>
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-[#6F6255]">{row.gap_display || '-'}</td>
                        <td className="px-4 py-3 text-right font-semibold text-[#6F6255]">{row.is_long_distance ? (row.pace_display || '-') : '-'}</td>
                        <td className="px-4 py-3">
                          <Link href={`/events/${row.event_id}`} className="font-semibold text-[#6B3E1E] hover:text-[#3B2110]">{row.event_name}</Link>
                          <div className="mt-1 text-xs text-[#A09284]">{[row.province, row.city].filter(Boolean).join(' · ')} {row.start_date?.slice(0, 10)}</div>
                        </td>
                        <td className="px-4 py-3 text-[#5B5148]">{row.team_name || '个人'}</td>
                      </tr>
                    );
                  })}
                  {previewLocked && total > items.length && [0, 1, 2].map((item) => (
                    <tr key={`locked-${item}`} className="border-b border-[#EFE5D8] bg-[#FFF9EF]">
                      <td className="px-4 py-4 text-center"><span className="inline-flex h-8 w-8 rounded-full bg-[#E6D8C4] blur-[2px]" /></td>
                      <td className="px-4 py-4">
                        <div className="h-4 w-28 rounded bg-[#D8C7AF] blur-[2px]" />
                        <div className="mt-2 h-3 w-20 rounded bg-[#E7DAC9] blur-[2px]" />
                      </td>
                      <td className="px-4 py-4"><div className="h-4 w-24 rounded bg-[#E7DAC9] blur-[2px]" /></td>
                      <td className="px-4 py-4"><div className="h-4 w-20 rounded bg-[#E7DAC9] blur-[2px]" /></td>
                      <td className="px-4 py-4 text-right"><div className="ml-auto h-4 w-24 rounded bg-[#D8C7AF] blur-[2px]" /></td>
                      <td className="px-4 py-4 text-right"><div className="ml-auto h-4 w-20 rounded bg-[#E7DAC9] blur-[2px]" /></td>
                      <td className="px-4 py-4 text-right"><div className="ml-auto h-4 w-16 rounded bg-[#E7DAC9] blur-[2px]" /></td>
                      <td className="px-4 py-4" colSpan={2}>
                        <Link href={`/login?redirect=${encodeURIComponent('/results')}`} className="inline-flex rounded-md bg-[#6B3E1E] px-3 py-1.5 text-xs font-semibold text-white no-underline">
                          登录查看隐藏成绩
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {fetching && <div className="border-t border-[#EEE4D8] px-4 py-4 text-center text-sm text-[#9B8A76]">加载中...</div>}
          </div>
        )}

        {!showUploadGuide && <div className="mt-5 flex flex-col gap-3 border border-[#E2D4C0] bg-white px-4 py-3 text-sm text-[#746556] sm:flex-row sm:items-center sm:justify-between">
          <span>共 {total} 条记录，第 {page} / {totalPages} 页</span>
          <div className="flex flex-wrap items-center gap-2">
            <button disabled={page <= 1} onClick={() => setPage((v) => Math.max(1, v - 1))} className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-[#D8CDBE] bg-white disabled:opacity-40">‹</button>
            {pageItems(page, totalPages).map((item, index) => item === 'gap' ? (
              <span key={`gap-${index}`} className="px-2 text-[#A09284]">...</span>
            ) : (
              <button key={item} onClick={() => setPage(item)} className={`h-10 min-w-10 rounded-md border px-3 ${item === page ? 'border-[#6B3E1E] bg-[#6B3E1E] text-white' : 'border-[#D8CDBE] bg-white hover:bg-[#F8EFE4]'}`}>{item}</button>
            ))}
            <button disabled={page >= totalPages} onClick={() => setPage((v) => Math.min(totalPages, v + 1))} className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-[#D8CDBE] bg-white disabled:opacity-40">›</button>
            <input aria-label="跳转页码" value={jumpPage} onChange={(e) => setJumpPage(e.target.value.replace(/[^\d]/g, ''))} onKeyDown={(e) => { if (e.key === 'Enter') jumpToPage(); }} className="h-10 w-20 rounded-md border border-[#D8CDBE] bg-white px-3 text-center outline-none focus:border-[#8B5A2B]" />
            <button onClick={jumpToPage} className="h-10 rounded-md border border-[#D8CDBE] bg-white px-3 hover:bg-[#F8EFE4]">跳转</button>
            <span className="rounded-md border border-[#D8CDBE] bg-white px-3 py-2">{pageSize} 条/页</span>
          </div>
        </div>}
      </section>
    </main>
  );
}

export default function ResultsPage() {
  return (
    <Suspense fallback={<div className="min-h-[60vh] px-6 py-20 text-center text-[#7B6D5E]">正在加载成绩查询...</div>}>
      <ResultsContent />
    </Suspense>
  );
}
