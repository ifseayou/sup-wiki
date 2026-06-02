'use client';

import Link from 'next/link';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useUser } from '@/components/UserContext';
import ResultStatusBadge from '@/components/ResultStatusBadge';
import Tooltip from '@/components/Tooltip';
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
  finish_time: string | null;
  result_status_code: string | null;
  result_status_note: string | null;
  team_name: string | null;
  team_club_slug?: string | null;
  team_club_name?: string | null;
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
  score_locked?: boolean;
  privacy_actions?: string[];
  athlete_is_claimed?: boolean;
}

interface FilterOption {
  value: string;
  label: string;
  meta?: string | null;
}

interface AnnualPointRow {
  standing_id: number;
  year: number;
  group_code?: string | null;
  group_name?: string | null;
  rank_position: number | null;
  athlete_id?: number | null;
  athlete_name_snapshot?: string | null;
  athlete_name?: string | null;
  athlete_photo?: string | null;
  team_name?: string | null;
  club_id?: number | null;
  club_name_snapshot?: string | null;
  club_name?: string | null;
  club_slug?: string | null;
  club_status?: string | null;
  total_points: number | string | null;
  endurance_points?: number | string | null;
  sprint_points?: number | string | null;
  technical_points?: number | string | null;
  point_scope?: string | null;
  source_title?: string | null;
  source_url?: string | null;
}

interface AnnualPointGroup {
  group_code: string | null;
  group_name: string;
  total: number | string;
}

interface AnnualPointYear {
  year: number;
  total: number | string;
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

const pointRankOptions = [
  { value: '', label: '全部排名' },
  { value: '10', label: '前 10' },
  { value: '30', label: '前 30' },
  { value: '100', label: '前 100' },
];

const pageSize = 20;

const resultParamKeys = ['athlete_id', 'event_id', 'gender', 'discipline', 'year', 'rank_max', 'star_level'];

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

function TeamNameValue({ row }: { row: Pick<ResultRow, 'team_name' | 'team_club_slug' | 'team_club_name'> }) {
  const name = row.team_name || '个人';
  if (row.team_club_slug) {
    return <Link href={`/clubs/${row.team_club_slug}`} className="font-semibold text-[#6B3E1E] hover:text-[#3B2110]">{row.team_club_name || name}</Link>;
  }
  if (name !== '个人') {
    return <Link href={`/clubs/claim?team_name=${encodeURIComponent(name)}`} className="text-[#5B5148] underline decoration-[#D8C8B6] underline-offset-4 hover:text-[#6B3E1E]">{name}</Link>;
  }
  return <>{name}</>;
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
  disabled = false,
}: {
  label: string;
  type?: string;
  value: string;
  display: string;
  onChange: (value: string, display: string) => void;
  staticOptions?: FilterOption[];
  optionParams?: Record<string, string>;
  icon?: 'search' | 'user' | 'trophy' | 'calendar' | 'star';
  disabled?: boolean;
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
    if (staticOptions) setOptions(staticOptions);
  }, [staticOptions]);

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
          className="h-12 w-full rounded-md border border-[#E3D5C2] bg-white/85 px-3 pr-9 text-sm text-[#3D3328] outline-none transition placeholder:text-[#B5AA9C] focus:border-[#8B5A2B] focus:ring-2 focus:ring-[#D79E49]/20 disabled:bg-[#F4EDE4] disabled:text-[#A69B8F]"
          placeholder={type ? `请输入${label}` : label}
          value={text}
          disabled={disabled}
          readOnly={Boolean(staticOptions)}
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            const next = event.target.value;
            setText(next);
            setOpen(true);
            if (!next && value) onChange('', '');
          }}
        />
      </div>
      {open && !disabled && (
        <div className="absolute left-0 right-0 z-30 mt-2 max-h-72 overflow-auto rounded-md border border-[#DCCBB4] bg-[#FFFDF9] shadow-[0_18px_50px_rgba(54,38,24,0.16)]">
          {options.map((option) => (
            <button
              type="button"
              key={`${option.value}-${option.label}`}
              className={`flex w-full items-center justify-between gap-3 border-b border-[#F0E6D9] px-3 py-2.5 text-left text-sm last:border-b-0 hover:bg-[#F8EFE2] ${option.value === value ? 'bg-[#F0E4D3]' : ''}`}
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
  if (!row.athlete_id || name === '隐藏') return body;
  return <Link href={`/athletes/${row.athlete_id}`} className="block no-underline">{body}</Link>;
}

function privacyActionHref(row: ResultRow, action: string) {
  if (action === 'claim' && row.athlete_id) return `/athletes/${row.athlete_id}/claim`;
  const params = new URLSearchParams({
    request_type: action,
    target_type: 'result',
    target_id: String(row.result_id),
    result_id: String(row.result_id),
    event_id: String(row.event_id),
    title: row.event_name || row.athlete_name || row.athlete_name_snapshot || '赛事成绩',
  });
  if (row.athlete_id) params.set('athlete_id', String(row.athlete_id));
  return `/privacy-request?${params.toString()}`;
}

function PrivacyActions({ row }: { row: ResultRow }) {
  const actions = Array.isArray(row.privacy_actions) ? row.privacy_actions : [];
  if (!actions.length) return <span className="text-xs text-[#B0A090]">-</span>;
  const labels: Record<string, string> = { claim: '认领', correction: '更正', anonymize_name: '匿名' };
  return (
    <div className="flex flex-wrap gap-1.5">
      {actions.map((action) => (
        <Link key={action} href={privacyActionHref(row, action)} className="rounded-full border border-[#E2D4C0] bg-white px-2.5 py-1 text-xs font-semibold text-[#7A5530] no-underline hover:bg-[#FFF8ED]">
          {labels[action] || action}
        </Link>
      ))}
    </div>
  );
}

function AnnualAthleteCell({ row }: { row: AnnualPointRow }) {
  const name = row.athlete_name || row.athlete_name_snapshot || '-';
  const avatar = row.athlete_photo ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={row.athlete_photo} alt={name} className="h-full w-full object-cover" loading="lazy" />
  ) : (
    <span className="text-sm font-black text-[#7A4B22]">{name.slice(0, 1)}</span>
  );
  const body = (
    <span className="flex min-w-0 items-center gap-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#E1D2BF] bg-[#F6EBDD] shadow-[0_5px_12px_rgba(86,63,38,0.12)]">
        {avatar}
      </span>
      <span className="block truncate text-base font-bold text-[#3A2B20]">{name}</span>
    </span>
  );
  if (!row.athlete_id || name === '隐藏') return body;
  return <Link href={`/athletes/${row.athlete_id}`} className="block no-underline">{body}</Link>;
}

function LockedScoreValue({ align = 'right' }: { align?: 'right' | 'left' }) {
  return (
    <span className={`inline-flex items-center gap-2 rounded-full border border-[#E1D0B8] bg-[#FFF8ED] px-3 py-1.5 text-xs font-semibold text-[#8A6A45] ${align === 'right' ? 'justify-end' : ''}`}>
      <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-[#D8C2A2] text-[10px] text-white">锁</span>
      登录后查看
    </span>
  );
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
            <span>上传后进入管理员复核流程</span>
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
            <div className="text-base font-semibold text-[#4A3A2A]">点击上传入口提交成绩册</div>
            <div className="mt-1 text-sm">仅支持 PDF，单个文件不超过 20MB</div>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {[
              ['file', '提交官方 PDF', '保留原始成绩来源'],
              ['calendar', '管理员复核', '确认赛事和项目数据'],
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

function formatPoint(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === '') return '-';
  const num = Number(value);
  if (!Number.isFinite(num)) return String(value);
  return num.toLocaleString('zh-CN', { maximumFractionDigits: 2 });
}

function AnnualPointsPanel({ token, loading }: { token: string | null; loading: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [type, setType] = useState<'athlete' | 'club'>(searchParams.get('point_type') === 'club' ? 'club' : 'athlete');
  const [pointScope, setPointScope] = useState<'domestic' | 'international' | 'all'>(
    searchParams.get('point_scope') === 'international' ? 'international' : searchParams.get('point_scope') === 'all' ? 'all' : 'domestic'
  );
  const [year, setYear] = useState(searchParams.get('point_year') || '');
  const [groupCode, setGroupCode] = useState(searchParams.get('point_group_code') || '');
  const [search, setSearch] = useState(searchParams.get('point_search') || searchParams.get('athlete') || '');
  const [rankMax, setRankMax] = useState(searchParams.get('point_rank_max') || '');
  const [page, setPage] = useState(1);
  const [jumpPage, setJumpPage] = useState('1');
  const [items, setItems] = useState<AnnualPointRow[]>([]);
  const [years, setYears] = useState<AnnualPointYear[]>([]);
  const [groups, setGroups] = useState<AnnualPointGroup[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState('');
  const [previewLocked, setPreviewLocked] = useState(false);
  const typeOptions = useMemo<FilterOption[]>(() => [
    { value: 'athlete', label: '运动员积分' },
    { value: 'club', label: '俱乐部积分' },
  ], []);
  const scopeOptions = useMemo<FilterOption[]>(() => [
    { value: 'domestic', label: '国内积分' },
    { value: 'international', label: '国际积分' },
    { value: 'all', label: '全部来源' },
  ], []);
  const yearOptions = useMemo<FilterOption[]>(() => (
    years.length
      ? years.map((item) => ({ value: String(item.year), label: `${item.year} 年`, meta: `${item.total} 条` }))
      : [{ value: '', label: '暂无年份' }]
  ), [years]);
  const groupOptions = useMemo<FilterOption[]>(() => (
    type === 'club'
      ? [{ value: '', label: '俱乐部积分无组别' }]
      : [
          { value: '', label: '全部组别' },
          ...groups
            .filter((group) => group.group_code)
            .map((group) => ({ value: group.group_code || '', label: group.group_name, meta: `${group.total} 人` })),
        ]
  ), [groups, type]);
  const typeDisplay = typeOptions.find((option) => option.value === type)?.label || '运动员积分';
  const scopeDisplay = scopeOptions.find((option) => option.value === pointScope)?.label || '国内积分';
  const yearDisplay = yearOptions.find((option) => option.value === year)?.label || (year ? `${year} 年` : '');
  const groupDisplay = groupOptions.find((option) => option.value === groupCode)?.label || (groupCode ? '已选组别' : '');
  const rankDisplay = pointRankOptions.find((option) => option.value === rankMax)?.label || '全部排名';

  function syncPointUrl(next: Partial<{ type: 'athlete' | 'club'; pointScope: 'domestic' | 'international' | 'all'; year: string; groupCode: string; search: string; rankMax: string }>) {
    const nextType = next.type ?? type;
    const nextPointScope = next.pointScope ?? pointScope;
    const nextYear = next.year ?? year;
    const nextGroupCode = next.groupCode ?? groupCode;
    const nextSearch = next.search ?? search;
    const nextRankMax = next.rankMax ?? rankMax;
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', 'points');
    params.set('point_type', nextType);
    if (nextType === 'athlete') params.set('point_scope', nextPointScope); else params.delete('point_scope');
    if (nextYear) params.set('point_year', nextYear); else params.delete('point_year');
    if (nextType === 'athlete' && nextGroupCode) params.set('point_group_code', nextGroupCode); else params.delete('point_group_code');
    if (nextSearch.trim()) params.set('point_search', nextSearch.trim()); else params.delete('point_search');
    if (nextRankMax) params.set('point_rank_max', nextRankMax); else params.delete('point_rank_max');
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  const query = useMemo(() => {
    const params = new URLSearchParams({ type, page: String(page), pageSize: String(pageSize) });
    if (type === 'athlete') params.set('point_scope', pointScope);
    if (year) params.set('year', year);
    if (type === 'athlete' && groupCode) params.set('group_code', groupCode);
    if (search.trim()) params.set('search', search.trim());
    if (rankMax) params.set('rank_max', rankMax);
    return params.toString();
  }, [groupCode, page, pageSize, pointScope, rankMax, search, type, year]);

  useEffect(() => {
    if (loading) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setFetching(true);
      setError('');
      fetch(`/api/annual-points?${query}`, token ? { headers: { Authorization: `Bearer ${token}` } } : undefined)
        .then(async (res) => {
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || '年度积分查询失败');
          if (cancelled) return;
          setItems(data.items || []);
          setYears(data.years || []);
          setGroups(data.groups || []);
          setTotal(Number(data.total || 0));
          setTotalPages(Math.max(1, Number(data.totalPages || 1)));
          setPreviewLocked(Boolean(data.preview_locked));
          if (!year && data.year) {
            const nextYear = String(data.year);
            setYear(nextYear);
            syncPointUrl({ year: nextYear });
          }
        })
        .catch((err) => {
          if (!cancelled) {
            setItems([]);
            setPreviewLocked(false);
            setError(err instanceof Error ? err.message : '年度积分查询失败');
          }
        })
        .finally(() => {
          if (!cancelled) setFetching(false);
        });
    });
    return () => {
      cancelled = true;
    };
  }, [loading, query, token, year]);

  useEffect(() => {
    queueMicrotask(() => setJumpPage(String(page)));
  }, [page]);

  function resetAnd(run?: () => void) {
    if (run) run();
    setPage(1);
  }

  function jumpToPointPage() {
    const next = Math.min(totalPages, Math.max(1, Number(jumpPage) || 1));
    setPage(next);
  }

  return (
    <div className="space-y-5">
      <div className="sticky top-[56px] z-20 border border-[#E2D4C0] bg-white/92 p-5 shadow-[0_18px_42px_rgba(91,68,43,0.08)] backdrop-blur">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_1.2fr_1fr_1fr_auto]">
          <SearchSelect label="榜单类型" value={type} display={typeDisplay} staticOptions={typeOptions} onChange={(value) => resetAnd(() => { const nextType = value === 'club' ? 'club' : 'athlete'; setType(nextType); setYear(''); setGroupCode(''); syncPointUrl({ type: nextType, year: '', groupCode: '' }); })} icon="star" />
          <SearchSelect label="积分范围" value={pointScope} display={scopeDisplay} staticOptions={scopeOptions} disabled={type === 'club'} onChange={(value) => resetAnd(() => { const nextScope = value === 'international' ? 'international' : value === 'all' ? 'all' : 'domestic'; setPointScope(nextScope); setYear(''); setGroupCode(''); syncPointUrl({ pointScope: nextScope, year: '', groupCode: '' }); })} icon="star" />
          <SearchSelect label="年份" value={year} display={yearDisplay} staticOptions={yearOptions} onChange={(value) => resetAnd(() => { setYear(value); setGroupCode(''); syncPointUrl({ year: value, groupCode: '' }); })} icon="calendar" />
          <SearchSelect label="年度组别" value={groupCode} display={groupDisplay} staticOptions={groupOptions} disabled={type === 'club'} onChange={(value) => resetAnd(() => { setGroupCode(value); syncPointUrl({ groupCode: value }); })} icon="user" />
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-[#5F4D3A]">搜索</label>
            <input value={search} onChange={(event) => resetAnd(() => { setSearch(event.target.value); syncPointUrl({ search: event.target.value }); })} placeholder={type === 'club' ? '俱乐部名' : '运动员 / 队伍'} className="h-12 w-full rounded-md border border-[#E3D5C2] bg-white/85 px-3 text-sm text-[#3D3328] outline-none placeholder:text-[#B5AA9C] focus:border-[#8B5A2B]" />
          </div>
          <SearchSelect label="排名" value={rankMax} display={rankDisplay} staticOptions={pointRankOptions} onChange={(value) => resetAnd(() => { setRankMax(value); syncPointUrl({ rankMax: value }); })} icon="trophy" />
          <div className="flex items-end">
            <button type="button" onClick={() => { setSearch(''); setGroupCode(''); setRankMax(''); setPage(1); syncPointUrl({ search: '', groupCode: '', rankMax: '' }); }} className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-md border border-[#CDBAA4] bg-white px-5 text-sm font-semibold text-[#6B3E1E] transition hover:bg-[#F8EFE4]">
              <Icon name="rotate" />重置
            </button>
          </div>
        </div>
        <div className="mt-4 text-sm text-[#8A7B6B]">当前筛选命中 {total} 条年度积分</div>
      </div>

      {error && <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {previewLocked && (
        <div className="flex flex-col gap-3 rounded-md border border-[#DFC7A7] bg-[#FFF8EA] px-4 py-3 text-sm text-[#6B4A24] sm:flex-row sm:items-center sm:justify-between">
          <span>未登录用户可预览前 3 条年度积分。登录后可查看完整榜单与分页。</span>
          <Link href={`/login?redirect=${encodeURIComponent('/results?tab=points')}`} className="inline-flex shrink-0 rounded-md bg-[#6B3E1E] px-4 py-2 text-sm font-semibold text-white no-underline">
            登录查看全部
          </Link>
        </div>
      )}

      <div className="overflow-hidden border border-[#E2D4C0] bg-white shadow-[0_18px_42px_rgba(91,68,43,0.08)]">
        <div className="overflow-x-auto">
          {type === 'club' ? (
            <table className="w-full min-w-[840px] text-sm">
              <thead className="border-b border-[#E8DCCA] bg-[#F4EDDF] text-left text-xs font-semibold uppercase tracking-wide text-[#746556]">
                <tr><th className="px-4 py-4 text-center">排名</th><th className="px-4 py-4">俱乐部</th><th className="px-4 py-4 text-right">总积分</th><th className="px-4 py-4">来源</th></tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={row.standing_id} className="border-b border-[#EFE5D8] transition hover:bg-[#FFF8EE]">
                    <td className="px-4 py-3 text-center"><RankBadge rank={Number(row.rank_position || 0)} /></td>
                    <td className="px-4 py-3 text-base font-bold text-[#3A2B20]">
                      {row.club_slug && row.club_status === 'published' ? (
                        <Link href={`/clubs/${row.club_slug}`} className="text-[#3A2B20] no-underline hover:text-[#6B3E1E]">
                          {row.club_name || row.club_name_snapshot || '-'}
                        </Link>
                      ) : (
                        row.club_name || row.club_name_snapshot || '-'
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-base font-bold text-[#634325]">{formatPoint(row.total_points)}</td>
                    <td className="px-4 py-3 text-[#6F6255]">{row.source_url ? <a href={row.source_url} target="_blank" rel="noopener noreferrer" className="font-semibold text-[#6B3E1E] hover:text-[#3B2110]">{row.source_title || '原文来源'}</a> : (row.source_title || '-')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="w-full min-w-[1180px] text-sm">
              <thead className="border-b border-[#E8DCCA] bg-[#F4EDDF] text-left text-xs font-semibold uppercase tracking-wide text-[#746556]">
                <tr>
                  <th className="px-4 py-4 text-center">排名</th><th className="px-4 py-4">运动员</th><th className="px-4 py-4">组别</th><th className="px-4 py-4">队伍</th>
                  <th className="px-4 py-4 text-right">总积分</th><th className="px-4 py-4 text-right">耐力</th><th className="px-4 py-4 text-right">竞速</th><th className="px-4 py-4 text-right">技巧</th><th className="px-4 py-4">来源</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => {
                  return (
                    <tr key={row.standing_id} className="border-b border-[#EFE5D8] transition hover:bg-[#FFF8EE]">
                      <td className="px-4 py-3 text-center"><RankBadge rank={Number(row.rank_position || 0)} /></td>
                      <td className="px-4 py-3 font-semibold text-[#3A2B20]"><AnnualAthleteCell row={row} /></td>
                      <td className="px-4 py-3 text-[#5B5148]">{row.group_name || '-'}</td>
                      <td className="px-4 py-3 text-[#5B5148]">{row.team_name || '个人'}</td>
                      <td className="px-4 py-3 text-right text-base font-bold text-[#634325]">{formatPoint(row.total_points)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-[#6F6255]">{formatPoint(row.endurance_points)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-[#6F6255]">{formatPoint(row.sprint_points)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-[#6F6255]">{formatPoint(row.technical_points)}</td>
                      <td className="px-4 py-3 text-[#6F6255]">{row.source_url ? <a href={row.source_url} target="_blank" rel="noopener noreferrer" className="font-semibold text-[#6B3E1E] hover:text-[#3B2110]">{row.source_title || '原文来源'}</a> : (row.source_title || '-')}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          {!items.length && !fetching && <div className="px-4 py-12 text-center text-sm text-[#9B8A76]">当前年份或筛选条件下暂无年度积分数据</div>}
        </div>
        {fetching && <div className="border-t border-[#EEE4D8] px-4 py-4 text-center text-sm text-[#9B8A76]">加载中...</div>}
      </div>

      <div className="flex flex-col gap-3 border border-[#E2D4C0] bg-white px-4 py-3 text-sm text-[#746556] sm:flex-row sm:items-center sm:justify-between">
        <span>共 {total} 条记录，第 {page} / {totalPages} 页</span>
        <div className="flex flex-wrap items-center gap-2">
          <button disabled={page <= 1 || previewLocked} onClick={() => setPage((v) => Math.max(1, v - 1))} className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-[#D8CDBE] bg-white disabled:opacity-40">‹</button>
          {pageItems(page, totalPages).map((item, index) => item === 'gap' ? (
            <span key={`point-gap-${index}`} className="px-2 text-[#A09284]">...</span>
          ) : (
            <button key={item} disabled={previewLocked} onClick={() => setPage(item)} className={`h-10 min-w-10 rounded-md border px-3 disabled:opacity-40 ${item === page ? 'border-[#6B3E1E] bg-[#6B3E1E] text-white' : 'border-[#D8CDBE] bg-white hover:bg-[#F8EFE4]'}`}>{item}</button>
          ))}
          <button disabled={page >= totalPages || previewLocked} onClick={() => setPage((v) => Math.min(totalPages, v + 1))} className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-[#D8CDBE] bg-white disabled:opacity-40">›</button>
          <input aria-label="跳转页码" disabled={previewLocked} value={jumpPage} onChange={(e) => setJumpPage(e.target.value.replace(/[^\d]/g, ''))} onKeyDown={(e) => { if (e.key === 'Enter') jumpToPointPage(); }} className="h-10 w-20 rounded-md border border-[#D8CDBE] bg-white px-3 text-center outline-none disabled:opacity-40 focus:border-[#8B5A2B]" />
          <button disabled={previewLocked} onClick={jumpToPointPage} className="h-10 rounded-md border border-[#D8CDBE] bg-white px-3 hover:bg-[#F8EFE4] disabled:opacity-40">跳转</button>
        </div>
      </div>
    </div>
  );
}

function ResultsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { token, loading } = useUser();
  const activeTab = searchParams.get('tab') === 'points' ? 'points' : 'results';
  const filtersPanelRef = useRef<HTMLDivElement>(null);
  const [items, setItems] = useState<ResultRow[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState({ resultCount: 0, athleteCount: 0, eventCount: 0 });
  const [siteStats, setSiteStats] = useState({
    resultCount: 0,
    pointCount: 0,
    resultAthleteCount: 0,
    pointAthleteCount: 0,
  });
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [jumpPage, setJumpPage] = useState('1');
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState('');
  const [previewLocked, setPreviewLocked] = useState(false);
  const [filters, setFilters] = useState({
    athlete_id: searchParams.get('athlete_id') || '',
    athlete_label: '',
    event_id: searchParams.get('event_id') || '',
    event_label: '',
    gender: searchParams.get('gender') || '',
    gender_label: searchParams.get('gender') || '',
    discipline: searchParams.get('discipline') || '',
    discipline_label: searchParams.get('discipline') || '',
    year: searchParams.get('year') || '',
    year_label: searchParams.get('year') ? `${searchParams.get('year')} 年` : '',
    rank_max: searchParams.get('rank_max') || '',
    rank_label: rankOptions.find((option) => option.value === (searchParams.get('rank_max') || ''))?.label || '',
    star_level: searchParams.get('star_level') || '',
    star_label: searchParams.get('star_level') || '',
  });

  useEffect(() => {
    let cancelled = false;
    fetch('/api/site-stats')
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        setSiteStats({
          resultCount: Number(data.resultCount || 0),
          pointCount: Number(data.pointCount || 0),
          resultAthleteCount: Number(data.resultAthleteCount || 0),
          pointAthleteCount: Number(data.pointAthleteCount || 0),
        });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

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

  function buildTabHref(tab: 'results' | 'points') {
    const params = new URLSearchParams(searchParams.toString());
    if (tab === 'points') params.set('tab', 'points');
    else params.delete('tab');
    return `${pathname}${params.toString() ? `?${params.toString()}` : ''}`;
  }

  function syncResultUrl(nextFilters: typeof filters) {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('tab');
    for (const key of resultParamKeys) {
      const value = String(nextFilters[key as keyof typeof filters] || '').trim();
      if (value) params.set(key, value);
      else params.delete(key);
    }
    router.replace(`${pathname}${params.toString() ? `?${params.toString()}` : ''}`, { scroll: false });
  }

  useEffect(() => {
    if (loading) return;
    if (activeTab === 'points') {
      return;
    }
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
  }, [activeTab, loading, token, query]);

  useEffect(() => {
    queueMicrotask(() => setJumpPage(String(page)));
  }, [page]);

  function updateFilter(valueKey: keyof typeof filters, labelKey: keyof typeof filters, value: string, label: string) {
    setFilters((prev) => {
      const next = { ...prev, [valueKey]: value, [labelKey]: label };
      syncResultUrl(next);
      return next;
    });
    setPage(1);
  }

  function updateEventFilter(value: string, label: string) {
    setFilters((prev) => {
      const next = {
        ...prev,
        event_id: value,
        event_label: label,
        discipline: '',
        discipline_label: '',
        gender: '',
        gender_label: '',
      };
      syncResultUrl(next);
      return next;
    });
    setPage(1);
  }

  function applyQuick(type: 'discipline' | 'gender' | 'rank', value: string, label: string) {
    if (type === 'discipline') updateFilter('discipline', 'discipline_label', value, label);
    if (type === 'gender') updateFilter('gender', 'gender_label', value, label);
    if (type === 'rank') updateFilter('rank_max', 'rank_label', value, label);
  }

  function clearFilters() {
    const next = {
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
    };
    setFilters(next);
    syncResultUrl(next);
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
            <h1 className="text-4xl font-bold tracking-tight md:text-6xl">查成绩</h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-[#E5D8C6]">查询比赛成绩，也查看年度积分排名</p>
          </div>
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            {([
              ['成绩数', siteStats.resultCount || stats.resultCount, 'timer', '已收录并公开展示的赛事成绩记录总数。'],
              ['积分数', siteStats.pointCount, 'star', '已收录的年度积分记录总数，包含运动员积分和俱乐部积分。'],
              ['成绩运动员', siteStats.resultAthleteCount || stats.athleteCount, 'user', '在公开成绩中出现过的运动员去重数。'],
              ['积分运动员数', siteStats.pointAthleteCount, 'trophy', '在年度积分榜中出现过的运动员去重数。'],
            ] as const).map(([label, value, icon, tip]) => (
              <div key={String(label)} className="min-w-[128px] rounded-md border border-[#8C704E] bg-black/18 px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur">
                <div className="mb-3 flex items-center gap-2 text-xs text-[#D7B77F]"><Icon name={icon} /><Tooltip tip={tip} dotted={false}>{label}</Tooltip></div>
                <div className="text-3xl font-bold">{value}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-5 inline-flex rounded-md border border-[#E1D2BF] bg-white p-1 shadow-[0_12px_28px_rgba(91,68,43,0.08)]">
          <Link href={buildTabHref('results')} className={`rounded-md px-5 py-2.5 text-sm font-semibold no-underline transition ${activeTab === 'results' ? 'bg-[#6B3E1E] text-white shadow-[0_8px_18px_rgba(107,62,30,0.2)]' : 'text-[#6B3E1E] hover:bg-[#F8EFE4]'}`}>
            比赛成绩
          </Link>
          <Link href={buildTabHref('points')} className={`rounded-md px-5 py-2.5 text-sm font-semibold no-underline transition ${activeTab === 'points' ? 'bg-[#6B3E1E] text-white shadow-[0_8px_18px_rgba(107,62,30,0.2)]' : 'text-[#6B3E1E] hover:bg-[#F8EFE4]'}`}>
            年度积分
          </Link>
        </div>
        {activeTab === 'points' ? (
          <AnnualPointsPanel token={token} loading={loading} />
        ) : (
          <>
        <div ref={filtersPanelRef} className="sticky top-[56px] z-20 mb-5 border border-[#E2D4C0] bg-white/92 p-5 shadow-[0_18px_42px_rgba(91,68,43,0.08)] backdrop-blur">
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
            <span>{filters.athlete_id ? '未登录用户搜索运动员时会隐藏成绩、差距和配速。登录后可查看完整成绩。' : '未登录用户可预览前 3 条成绩。登录后可查看完整成绩，并使用更多筛选与导出能力。'}</span>
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
                    <th className="px-4 py-4">处理</th>
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
                          {row.score_locked ? (
                            <LockedScoreValue />
                          ) : (
                            <span className="inline-flex items-center justify-end gap-1.5"><Icon name="timer" /><ResultStatusBadge finishTime={row.finish_time || '-'} statusCode={row.result_status_code} statusNote={row.result_status_note} /></span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-[#6F6255]">{row.score_locked ? <LockedScoreValue /> : (row.gap_display || '-')}</td>
                        <td className="px-4 py-3 text-right font-semibold text-[#6F6255]">{row.score_locked ? <LockedScoreValue /> : (row.is_long_distance ? (row.pace_display || '-') : '-')}</td>
                        <td className="px-4 py-3">
                          <Link href={`/events/${row.event_id}`} className="font-semibold text-[#6B3E1E] hover:text-[#3B2110]">{row.event_name}</Link>
                          <div className="mt-1 text-xs text-[#A09284]">{[row.province, row.city].filter(Boolean).join(' · ')} {row.start_date?.slice(0, 10)}</div>
                        </td>
                        <td className="px-4 py-3 text-[#5B5148]"><TeamNameValue row={row} /></td>
                        <td className="px-4 py-3"><PrivacyActions row={row} /></td>
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
                      <td className="px-4 py-4" colSpan={3}>
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
          </>
        )}
      </section>
    </main>
  );
}

export default function ResultsPage() {
  return (
    <Suspense fallback={<div className="min-h-[60vh] px-6 py-20 text-center text-[#7B6D5E]">正在加载查成绩...</div>}>
      <ResultsContent />
    </Suspense>
  );
}
