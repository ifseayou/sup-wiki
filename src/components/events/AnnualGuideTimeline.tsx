'use client';

import Link from 'next/link';
import { useState } from 'react';
import { GUIDE_EVENT_META, type GuideTimelineEvent } from '@/lib/event-guide';

function formatShortDate(dateStr: string | null): string {
  if (!dateStr) return '待定';
  const d = new Date(dateStr);
  return `${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

function formatMonth(dateStr: string | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  return months[d.getMonth()];
}

function formatLongDate(start: string | null, end: string | null): string {
  if (!start) return '日期待定';
  const s = new Date(start);
  const startText = `${s.getFullYear()}.${String(s.getMonth() + 1).padStart(2, '0')}.${String(s.getDate()).padStart(2, '0')}`;
  if (!end || end === start) return startText;
  const e = new Date(end);
  return `${startText} — ${e.getFullYear()}.${String(e.getMonth() + 1).padStart(2, '0')}.${String(e.getDate()).padStart(2, '0')}`;
}

function buildSummary(event: GuideTimelineEvent): string {
  const pieces = [event.city, event.province].filter(Boolean);
  if (event.disciplines.length > 0) {
    pieces.push(event.disciplines.slice(0, 2).join(' / '));
  }
  return pieces.join(' · ');
}

export default function AnnualGuideTimeline({ events }: { events: GuideTimelineEvent[] }) {
  return (
    <section
      className="relative overflow-hidden rounded-3xl border border-[#E6D8C6] px-5 py-8 shadow-[0_30px_90px_rgba(122,97,69,0.08)] sm:px-7 lg:px-10 lg:py-10"
      style={{
        background: 'linear-gradient(170deg, #fdfaf5 0%, #f3ebe0 40%, #eee5d8 70%, #f7f0e6 100%)',
      }}
    >
      {/* 背景装饰 */}
      <div className="pointer-events-none absolute inset-0 opacity-40" style={{
        backgroundImage: 'radial-gradient(circle at 20% 10%, rgba(196,168,130,0.15) 0%, transparent 40%), radial-gradient(circle at 80% 90%, rgba(122,97,69,0.1) 0%, transparent 35%)',
      }} />

      {/* 标题区 */}
      <div className="relative mb-10 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#E7D7C0] bg-[#FFFAF1] px-3 py-1 text-[11px] font-medium uppercase tracking-[0.24em] text-[#8D755B]">
            2025 Annual Guide
          </div>
          <h2 className="font-[var(--font-display)] text-3xl leading-none text-[#2E2118] sm:text-[2.7rem]">
            2025 年全年赛事导览图
          </h2>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-[#685647] sm:text-[15px]">
            一条时间线，串联全年核心赛事。悬浮卡片查看赛事简介，点击进入详情页。
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3 text-center text-xs text-[#7E6650]">
          <LegendBadge label="5星" value="国际 / 顶级联赛" />
          <LegendBadge label="4.5星" value="国家级核心赛事" />
          <LegendBadge label="4星" value="国家级高规格公开赛" />
        </div>
      </div>

      {/* 时间线主体 */}
      <div className="relative">
        {events.map((event, index) => (
          <TimelineNode
            key={event.event_id}
            event={event}
            index={index}
            isLast={index === events.length - 1}
          />
        ))}
      </div>

      {/* 底部说明 */}
      <div className="relative mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-[#E8DDCF] pt-4 text-xs leading-6 text-[#8D775F]">
        <p>导览图仅收录本站已建档的 2025 年国内 4 星及以上赛事</p>
        <span className="uppercase tracking-[0.24em] text-[#B1967A]">Guide Map View</span>
      </div>
    </section>
  );
}

/* ── 时间线节点 ─────────────────────────────────────────── */

function TimelineNode({ event, index, isLast }: {
  event: GuideTimelineEvent;
  index: number;
  isLast: boolean;
}) {
  const meta = GUIDE_EVENT_META[event.slug];
  const isLeft = index % 2 === 0;
  const month = formatMonth(event.start_date);
  const prevMonth = index > 0 ? '' : ''; // 不再需要

  return (
    <div className="relative flex" style={{ minHeight: isLast ? 60 : 120 }}>
      {/* ── 桌面端：左右交替 ── */}

      {/* 左侧内容区（桌面） */}
      <div className="hidden w-[calc(50%-28px)] lg:flex justify-end pr-8">
        {isLeft && <GlassCard event={event} meta={meta} align="right" />}
      </div>

      {/* 中间时间线 */}
      <div className="relative flex flex-col items-center" style={{ width: 56 }}>
        {/* 月份标签 */}
        {month && (
          <div className="absolute -top-1 left-1/2 -translate-x-1/2 -translate-y-full pb-1">
            <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#A08060]">
              {month}
            </span>
          </div>
        )}

        {/* 圆点 */}
        <div
          className="relative z-10 flex h-[18px] w-[18px] items-center justify-center rounded-full border-[2.5px] border-white"
          style={{
            backgroundColor: meta.mobileAccent,
            boxShadow: `0 0 0 3px ${meta.mobileAccent}30, 0 4px 12px ${meta.mobileAccent}25`,
          }}
        >
          <div className="h-[5px] w-[5px] rounded-full bg-white/80" />
        </div>

        {/* 虚线 */}
        {!isLast && (
          <div
            className="w-0 flex-1"
            style={{
              borderLeft: '2px dashed rgba(180, 160, 130, 0.35)',
              minHeight: 80,
            }}
          />
        )}
      </div>

      {/* 右侧内容区（桌面） */}
      <div className="hidden w-[calc(50%-28px)] lg:flex justify-start pl-8">
        {!isLeft && <GlassCard event={event} meta={meta} align="left" />}
      </div>

      {/* ── 移动端：全部在右侧 ── */}
      <div className="flex-1 pl-4 pb-8 lg:hidden">
        <GlassCard event={event} meta={meta} align="left" />
      </div>
    </div>
  );
}

/* ── 玻璃雨滴卡片 ─────────────────────────────────────── */

function GlassCard({ event, meta, align }: {
  event: GuideTimelineEvent;
  meta: (typeof GUIDE_EVENT_META)[string];
  align: 'left' | 'right';
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <Link
      href={`/events/${event.event_id}`}
      className="group relative block w-full max-w-[340px]"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ textAlign: align === 'right' ? 'right' : 'left' }}
    >
      {/* 卡片主体 */}
      <div
        className="relative overflow-hidden rounded-[20px] p-[1px] transition-all duration-300"
        style={{
          background: hovered
            ? 'linear-gradient(135deg, rgba(255,255,255,0.7), rgba(196,168,130,0.3))'
            : 'linear-gradient(135deg, rgba(255,255,255,0.5), rgba(237,229,216,0.4))',
        }}
      >
        <div
          className="relative rounded-[19px] px-5 py-4 transition-all duration-300"
          style={{
            background: hovered
              ? 'rgba(255, 255, 255, 0.55)'
              : 'rgba(255, 255, 255, 0.35)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            boxShadow: hovered
              ? '0 12px 40px rgba(122, 97, 69, 0.12), inset 0 1px 0 rgba(255,255,255,0.7), inset 0 -1px 0 rgba(255,255,255,0.2)'
              : '0 8px 28px rgba(122, 97, 69, 0.06), inset 0 1px 0 rgba(255,255,255,0.6), inset 0 -1px 0 rgba(255,255,255,0.15)',
          }}
        >
          {/* 雨滴光泽效果 */}
          <div
            className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full opacity-40 transition-opacity duration-300 group-hover:opacity-60"
            style={{
              background: 'radial-gradient(circle, rgba(255,255,255,0.8) 0%, transparent 70%)',
            }}
          />
          <div
            className="pointer-events-none absolute -bottom-4 -left-4 h-16 w-16 rounded-full opacity-20"
            style={{
              background: 'radial-gradient(circle, rgba(255,255,255,0.6) 0%, transparent 70%)',
            }}
          />

          {/* 日期 + 星级 */}
          <div className="relative flex items-center justify-between gap-3">
            <span className="text-[11px] font-medium uppercase tracking-[0.2em] text-[#9A8267]">
              {formatShortDate(event.start_date)}
              {event.end_date && event.end_date !== event.start_date && ` — ${formatShortDate(event.end_date)}`}
            </span>
            <span
              className="shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold"
              style={{
                background: 'rgba(255, 244, 222, 0.7)',
                color: '#9A6E35',
                border: '1px solid rgba(231, 208, 170, 0.5)',
                backdropFilter: 'blur(8px)',
              }}
            >
              {meta.stars}
            </span>
          </div>

          {/* 赛事名称 */}
          <h3 className="relative mt-2.5 text-[15px] font-semibold leading-snug text-[#2E2118] transition-colors duration-200 group-hover:text-[#7A6145]">
            {event.name}
          </h3>

          {/* 地点摘要 */}
          <div className="relative mt-2 text-[12px] leading-5 text-[#8A745E]">
            {buildSummary(event)}
          </div>

          {/* 展开的详情（hover） */}
          <div
            className="relative overflow-hidden transition-all duration-300"
            style={{
              maxHeight: hovered ? 120 : 0,
              opacity: hovered ? 1 : 0,
              marginTop: hovered ? 10 : 0,
            }}
          >
            <div
              className="rounded-xl px-3 py-2.5 text-[12px] leading-[1.7] text-[#5C4938]"
              style={{
                background: 'rgba(255, 255, 255, 0.3)',
                border: '1px solid rgba(255, 255, 255, 0.4)',
              }}
            >
              {meta.note}
            </div>
            <div className="mt-3 text-[11px] font-medium uppercase tracking-[0.16em] text-[#A08060] transition-colors group-hover:text-[#7A6145]">
              查看详情 →
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

/* ── 图例 ─────────────────────────────────────────────── */

function LegendBadge({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="rounded-2xl px-4 py-3"
      style={{
        background: 'rgba(255, 255, 255, 0.35)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: '1px solid rgba(255, 255, 255, 0.45)',
        boxShadow: '0 4px 16px rgba(122, 97, 69, 0.05), inset 0 1px 0 rgba(255,255,255,0.5)',
      }}
    >
      <div className="text-[11px] uppercase tracking-[0.18em] text-[#A28666]">{label}</div>
      <div className="mt-1 text-[12px] font-medium text-[#5C4938]">{value}</div>
    </div>
  );
}
