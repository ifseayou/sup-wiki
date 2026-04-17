'use client';

import Link from 'next/link';
import { useState } from 'react';
import { GUIDE_EVENT_META, type GuideTimelineEvent } from '@/lib/event-guide';

function formatShortDate(dateStr: string | null): string {
  if (!dateStr) return '待定';
  const d = new Date(dateStr);
  return `${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
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
  if (event.disciplines.length > 0) pieces.push(event.disciplines.slice(0, 2).join(' / '));
  return pieces.join(' · ');
}

/* ════════════════════════════════════════════════════════════
   主组件
   ════════════════════════════════════════════════════════════ */

export default function AnnualGuideTimeline({ events }: { events: GuideTimelineEvent[] }) {
  const topEvents = events.filter(e => GUIDE_EVENT_META[e.slug]?.lane === 'top');
  const midEvents = events.filter(e => GUIDE_EVENT_META[e.slug]?.lane === 'middle');
  const btmEvents = events.filter(e => GUIDE_EVENT_META[e.slug]?.lane === 'bottom');
  const [activeSlug, setActiveSlug] = useState<string | null>(null);

  return (
    <section
      className="relative overflow-hidden rounded-[34px] border border-[#E6D8C6] px-5 py-8 shadow-[0_30px_90px_rgba(122,97,69,0.08)] sm:px-7 lg:px-10 lg:py-10"
      style={{ background: 'linear-gradient(170deg, #fffdf8 0%, #f5ede2 50%, #f0e8dc 100%)' }}
    >
      {/* 背景光晕 */}
      <div className="pointer-events-none absolute inset-0" style={{
        backgroundImage: 'radial-gradient(circle at 15% 20%, rgba(196,168,130,0.12) 0%, transparent 40%), radial-gradient(circle at 85% 80%, rgba(122,97,69,0.08) 0%, transparent 35%)',
      }} />

      {/* 标题 */}
      <div className="relative mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#E7D7C0] bg-[#FFFAF1] px-3 py-1 text-[11px] font-medium uppercase tracking-[0.24em] text-[#8D755B]">
            2025 Annual Guide
          </div>
          <h2 className="font-[var(--font-display)] text-3xl leading-none text-[#2E2118] sm:text-[2.7rem]">
            2025 年全年赛事导览图
          </h2>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-[#685647] sm:text-[15px]">
            一条蛇形航线，串联全年核心赛事。桌面端悬浮节点查看详情，移动端点按展开。
          </p>
        </div>
        <div className="grid grid-cols-3 gap-3 text-center text-xs text-[#7E6650]">
          <LegendBadge label="5星" value="国际 / 顶级联赛" />
          <LegendBadge label="4.5星" value="国家级核心赛事" />
          <LegendBadge label="4星" value="国家级高规格公开赛" />
        </div>
      </div>

      {/* ── 桌面端：蛇形三行航线 ── */}
      <div className="relative hidden lg:block">
        <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 1200 420" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <defs>
            <linearGradient id="snake-grad" x1="0" y1="0" x2="1200" y2="420" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#C4A882" />
              <stop offset="50%" stopColor="#D2A45F" />
              <stop offset="100%" stopColor="#7A6145" />
            </linearGradient>
          </defs>
          {/* 第一行：左上角下来 → 向右 */}
          <path d="M80 20 L80 70 Q80 90 100 90 L1080 90 Q1120 90 1120 130 L1120 170" stroke="url(#snake-grad)" strokeWidth="3" strokeDasharray="8 6" strokeLinecap="round" fill="none" opacity="0.5" />
          {/* 第二行：右端 → 向左弯曲 */}
          <path d="M1120 170 Q1120 210 1080 210 L120 230 Q80 235 80 275 L80 310" stroke="url(#snake-grad)" strokeWidth="3" strokeDasharray="8 6" strokeLinecap="round" fill="none" opacity="0.5" />
          {/* 第三行：左端 → 向右 */}
          <path d="M80 310 Q80 340 110 340 L1100 350" stroke="url(#snake-grad)" strokeWidth="3" strokeDasharray="8 6" strokeLinecap="round" fill="none" opacity="0.5" />
        </svg>

        {/* 第一行节点 */}
        <div className="relative h-[130px]">
          <div className="absolute left-6 top-2 text-[10px] font-semibold uppercase tracking-[0.3em] text-[#A18467]">MAY — JUL</div>
          {topEvents.map(e => <DesktopNode key={e.event_id} event={e} rowTop={50} />)}
        </div>

        {/* 第二行节点 */}
        <div className="relative h-[140px]">
          <div className="absolute right-6 top-2 text-[10px] font-semibold uppercase tracking-[0.3em] text-[#A18467]">JUL — SEP</div>
          {midEvents.map(e => <DesktopNode key={e.event_id} event={e} rowTop={60} />)}
        </div>

        {/* 第三行节点 */}
        <div className="relative h-[130px]">
          <div className="absolute left-6 top-2 text-[10px] font-semibold uppercase tracking-[0.3em] text-[#A18467]">OCT — NOV</div>
          {btmEvents.map(e => <DesktopNode key={e.event_id} event={e} rowTop={50} />)}
        </div>
      </div>

      {/* ── 移动端：手风琴列表 ── */}
      <div className="relative space-y-3 lg:hidden">
        {events.map((event, index) => {
          const meta = GUIDE_EVENT_META[event.slug];
          const isOpen = activeSlug === event.slug;
          return (
            <div key={event.event_id} className="relative">
              {/* 虚线连接 */}
              {index > 0 && (
                <div className="absolute -top-3 left-[18px] h-3 w-0" style={{ borderLeft: '2px dashed rgba(180,160,130,0.35)' }} />
              )}
              <div className="flex gap-4">
                {/* 圆点 */}
                <div className="relative flex flex-col items-center pt-4">
                  <div
                    className="z-10 h-[14px] w-[14px] rounded-full border-2 border-white"
                    style={{ backgroundColor: meta.mobileAccent, boxShadow: `0 0 0 3px ${meta.mobileAccent}25` }}
                  />
                  {index < events.length - 1 && (
                    <div className="w-0 flex-1 mt-1" style={{ borderLeft: '2px dashed rgba(180,160,130,0.3)', minHeight: 20 }} />
                  )}
                </div>
                {/* 卡片 */}
                <button
                  type="button"
                  onClick={() => setActiveSlug(isOpen ? null : event.slug)}
                  className="flex-1 text-left"
                >
                  <GlassCardMobile event={event} meta={meta} isOpen={isOpen} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* 底部 */}
      <div className="relative mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-[#E8DDCF] pt-4 text-xs leading-6 text-[#8D775F]">
        <p>导览图仅收录本站已建档的 2025 年国内 4 星及以上赛事</p>
        <span className="uppercase tracking-[0.24em] text-[#B1967A]">Guide Map View</span>
      </div>
    </section>
  );
}

/* ════════════════════════════════════════════════════════════
   桌面端节点（hover 浮层）
   ════════════════════════════════════════════════════════════ */

function DesktopNode({ event, rowTop }: { event: GuideTimelineEvent; rowTop: number }) {
  const meta = GUIDE_EVENT_META[event.slug];
  const popUp = meta.popupDirection === 'up';

  return (
    <Link
      href={`/events/${event.event_id}`}
      className="group absolute block -translate-x-1/2 z-10 hover:z-[110]"
      style={{ left: meta.desktopLeft, top: rowTop }}
    >
      {/* 默认态：日期 + 圆点 + 城市 + 星级 */}
      <div className="flex min-w-[100px] flex-col items-center text-center">
        <div className="mb-1.5 text-[10px] font-medium uppercase tracking-[0.2em] text-[#9A8267]">
          {formatShortDate(event.start_date)}
        </div>
        <div className="flex items-center gap-2 rounded-full px-3 py-2 transition-all duration-200 group-hover:-translate-y-0.5"
          style={{
            background: 'rgba(255,255,255,0.4)',
            backdropFilter: 'blur(14px)',
            WebkitBackdropFilter: 'blur(14px)',
            border: '1px solid rgba(255,255,255,0.5)',
            boxShadow: '0 6px 20px rgba(122,97,69,0.07), inset 0 1px 0 rgba(255,255,255,0.6)',
          }}
        >
          <span
            className="inline-flex h-3 w-3 rounded-full border-2 border-white"
            style={{ backgroundColor: meta.mobileAccent, boxShadow: `0 0 0 2px ${meta.mobileAccent}22` }}
          />
          <span className="text-sm font-medium text-[#453326]">{event.city || event.province || '赛事'}</span>
          <span className="rounded-full px-2 py-0.5 text-[10px] font-bold"
            style={{ background: 'rgba(255,244,222,0.65)', color: '#9A6E35', border: '1px solid rgba(231,208,170,0.4)' }}
          >{meta.stars}</span>
        </div>
      </div>

      {/* Hover 浮层：玻璃雨滴卡片 */}
      <div
        className={`pointer-events-none absolute left-1/2 z-[100] w-[260px] -translate-x-1/2 rounded-[20px] p-[1px] opacity-0 transition-all duration-250 group-hover:pointer-events-auto group-hover:opacity-100 ${
          popUp ? 'bottom-[72px]' : 'top-[72px]'
        }`}
        style={{
          background: 'linear-gradient(135deg, rgba(255,255,255,0.6), rgba(220,200,170,0.25))',
        }}
      >
        <div
          className="relative overflow-hidden rounded-[19px] px-5 py-4"
          style={{
            background: 'rgba(255, 255, 255, 0.48)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            boxShadow: '0 16px 48px rgba(122,97,69,0.14), inset 0 1px 0 rgba(255,255,255,0.7), inset 0 -1px 0 rgba(255,255,255,0.2)',
          }}
        >
          {/* 雨滴光泽 */}
          <div className="pointer-events-none absolute -right-4 -top-4 h-20 w-20 rounded-full opacity-50"
            style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.8) 0%, transparent 70%)' }}
          />
          <div className="pointer-events-none absolute -bottom-3 -left-3 h-12 w-12 rounded-full opacity-25"
            style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.6) 0%, transparent 70%)' }}
          />

          {/* 箭头 */}
          <div className={`absolute left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 ${
            popUp ? '-bottom-[6px] border-b border-r border-white/40' : '-top-[6px] border-l border-t border-white/40'
          }`} style={{ background: 'rgba(255,255,255,0.45)', backdropFilter: 'blur(24px)' }} />

          <div className="relative">
            <div className="text-[11px] uppercase tracking-[0.2em] text-[#9A8267]">{formatLongDate(event.start_date, event.end_date)}</div>
            <h3 className="mt-2 text-[17px] font-semibold leading-6 text-[#2E2118]">{event.name}</h3>
            <p className="mt-2 text-[12px] leading-[1.7] text-[#6B5848]">{meta.note}</p>
            <div className="mt-2 text-[11px] text-[#8A745E]">{buildSummary(event)}</div>
            <div className="mt-3 inline-flex rounded-full px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.16em] text-[#7A6145]"
              style={{ background: 'rgba(255,255,255,0.35)', border: '1px solid rgba(215,192,161,0.4)' }}
            >进入详情</div>
          </div>
        </div>
      </div>
    </Link>
  );
}

/* ════════════════════════════════════════════════════════════
   移动端玻璃卡片
   ════════════════════════════════════════════════════════════ */

function GlassCardMobile({ event, meta, isOpen }: {
  event: GuideTimelineEvent;
  meta: (typeof GUIDE_EVENT_META)[string];
  isOpen: boolean;
}) {
  return (
    <div className="rounded-[18px] p-[1px] transition-all duration-200"
      style={{ background: isOpen
        ? 'linear-gradient(135deg, rgba(255,255,255,0.65), rgba(196,168,130,0.3))'
        : 'linear-gradient(135deg, rgba(255,255,255,0.45), rgba(237,229,216,0.3))',
      }}
    >
      <div className="rounded-[17px] px-4 py-3"
        style={{
          background: isOpen ? 'rgba(255,255,255,0.52)' : 'rgba(255,255,255,0.32)',
          backdropFilter: 'blur(18px)',
          WebkitBackdropFilter: 'blur(18px)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.55), 0 6px 20px rgba(122,97,69,0.06)',
        }}
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#9A8267]">{formatShortDate(event.start_date)}</div>
            <div className="mt-1 text-[14px] font-medium text-[#3F2E22]">{event.city || event.province}</div>
          </div>
          <span className="shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold"
            style={{ background: 'rgba(255,244,222,0.6)', color: '#9A6E35', border: '1px solid rgba(231,208,170,0.4)' }}
          >{meta.stars}</span>
        </div>

        {isOpen && (
          <div className="mt-3 border-t border-white/30 pt-3">
            <h3 className="text-[15px] font-semibold text-[#2E2118]">{event.name}</h3>
            <p className="mt-2 text-[12px] leading-[1.7] text-[#6B5848]">{meta.note}</p>
            <div className="mt-2 text-[11px] text-[#8A745E]">{buildSummary(event)}</div>
            <Link href={`/events/${event.event_id}`}
              className="mt-3 inline-flex rounded-full px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.16em] text-[#7A6145]"
              style={{ background: 'rgba(255,255,255,0.35)', border: '1px solid rgba(215,192,161,0.4)' }}
            >进入详情</Link>
          </div>
        )}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   图例
   ════════════════════════════════════════════════════════════ */

function LegendBadge({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl px-4 py-3"
      style={{
        background: 'rgba(255,255,255,0.35)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: '1px solid rgba(255,255,255,0.45)',
        boxShadow: '0 4px 16px rgba(122,97,69,0.05), inset 0 1px 0 rgba(255,255,255,0.5)',
      }}
    >
      <div className="text-[11px] uppercase tracking-[0.18em] text-[#A28666]">{label}</div>
      <div className="mt-1 text-[12px] font-medium text-[#5C4938]">{value}</div>
    </div>
  );
}
