import Link from 'next/link';
import pool from '@/lib/db';
import type { RowDataPacket } from 'mysql2';
import { getEventStarBadgeStyle } from '@/lib/event-stars';

interface EventRow extends RowDataPacket {
  event_id: number;
  name: string;
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
  disciplines: string | null;
  images: string | null;
  price_range: string | null;
  event_status: string;
  star_level: string | null;
  score_coefficient: string | null;
  result_status: string | null;
  results_count: number;
}

type EventWithDisciplines = Omit<EventRow, 'disciplines' | 'images'> & {
  disciplines: string[];
  images: string[];
};

interface EventStats extends RowDataPacket {
  total: number;
  active: number;
  completed: number;
}

const DEFAULT_PAGE_SIZE = 6;

const eventTypeLabels: Record<string, string> = {
  race: '竞速赛',
  festival: '嘉年华',
  training: '训练营',
  exhibition: '展览赛',
};

const eventStatusLabels: Record<string, { label: string; dot: string; chip: string }> = {
  upcoming: { label: '即将开始', dot: 'bg-amber-500', chip: 'bg-[#FFF7E8] text-[#9A6A22] border-[#E9D1A7]' },
  ongoing: { label: '进行中', dot: 'bg-[#6E8567]', chip: 'bg-[#ECF0E8] text-[#4F6B48] border-[#D4DFC9]' },
  completed: { label: '已结束', dot: 'bg-stone-400', chip: 'bg-white/90 text-[#655D56] border-white/70' },
  cancelled: { label: '已取消', dot: 'bg-red-400', chip: 'bg-red-50 text-red-700 border-red-100' },
};

const quickFilters = [
  { label: '国赛', search: '中国' },
  { label: '省赛', search: '省' },
  { label: '俱乐部赛', search: '俱乐部' },
  { label: '技术赛', search: '技术' },
  { label: '长距离', search: '长距离' },
];

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function parseJsonArray(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string' && item.trim().length > 0) : [];
  } catch {
    return [];
  }
}

function normalizePage(value?: string) {
  const page = Number(value || '1');
  return Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
}

function normalizePageSize(value?: string) {
  const size = Number(value || DEFAULT_PAGE_SIZE);
  return [6, 12, 24].includes(size) ? size : DEFAULT_PAGE_SIZE;
}

function buildHref(
  current: Record<string, string | undefined>,
  next: Record<string, string | number | undefined | null>,
) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(current)) {
    if (value) params.set(key, value);
  }
  for (const [key, value] of Object.entries(next)) {
    if (value === undefined || value === null || value === '') params.delete(key);
    else params.set(key, String(value));
  }
  const query = params.toString();
  return query ? `/events?${query}` : '/events';
}

function buildEventWhere(event_type?: string, event_status?: string, province?: string, year?: string, search?: string) {
  const conditions: string[] = ["sup_events.status = 'published'"];
  const params: (string | number)[] = [];

  if (event_type) {
    conditions.push('sup_events.event_type = ?');
    params.push(event_type);
  }
  if (event_status) {
    conditions.push('sup_events.event_status = ?');
    params.push(event_status);
  }
  if (province) {
    conditions.push('sup_events.province = ?');
    params.push(province);
  }
  if (year) {
    conditions.push('YEAR(sup_events.start_date) = ?');
    params.push(Number(year));
  }
  if (search) {
    conditions.push('(sup_events.name LIKE ? OR sup_events.city LIKE ? OR sup_events.province LIKE ? OR sup_events.venue LIKE ?)');
    params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
  }

  return { where: `WHERE ${conditions.join(' AND ')}`, params };
}

async function getEvents(event_type?: string, event_status?: string, province?: string, year?: string, search?: string) {
  try {
    const { where, params } = buildEventWhere(event_type, event_status, province, year, search);
    const [events] = await pool.execute<EventRow[]>(
      `SELECT sup_events.event_id, name, slug, event_type, location, province, city, venue,
              start_date, end_date, registration_deadline, organizer, description, disciplines,
              images, price_range, event_status, star_level, score_coefficient, result_status,
              COALESCE(r.results_count, 0) AS results_count
       FROM sup_events
       LEFT JOIN (
         SELECT event_id, COUNT(*) AS results_count
         FROM sup_event_results
         GROUP BY event_id
       ) r ON r.event_id = sup_events.event_id
       ${where}
       ORDER BY
         CASE event_status WHEN 'ongoing' THEN 0 WHEN 'upcoming' THEN 1 WHEN 'completed' THEN 2 ELSE 3 END,
         start_date DESC`,
      params
    );

    return events.map((event) => ({
      ...event,
      disciplines: parseJsonArray(event.disciplines),
      images: parseJsonArray(event.images),
    }));
  } catch (error) {
    console.error('获取赛事列表失败:', error);
    return [];
  }
}

async function getEventStats(): Promise<EventStats> {
  try {
    const [rows] = await pool.execute<EventStats[]>(
      `SELECT
         COUNT(*) AS total,
         SUM(CASE WHEN event_status IN ('ongoing', 'upcoming') THEN 1 ELSE 0 END) AS active,
         SUM(CASE WHEN event_status = 'completed' THEN 1 ELSE 0 END) AS completed
       FROM sup_events
       WHERE status = 'published'`
    );
    return rows[0] || { total: 0, active: 0, completed: 0 } as EventStats;
  } catch {
    return { total: 0, active: 0, completed: 0 } as EventStats;
  }
}

async function getEventYears(): Promise<string[]> {
  try {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT DISTINCT YEAR(start_date) AS year
       FROM sup_events
       WHERE status = 'published' AND start_date IS NOT NULL
       ORDER BY year DESC`
    );
    return rows.map((row) => String(row.year)).filter(Boolean);
  } catch {
    return [];
  }
}

async function getEventProvinces(): Promise<string[]> {
  try {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT DISTINCT province
       FROM sup_events
       WHERE status = 'published' AND province IS NOT NULL AND province <> ''
       ORDER BY province ASC`
    );
    return rows.map((row) => row.province as string).filter(Boolean);
  } catch {
    return [];
  }
}

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<{
    event_type?: string;
    event_status?: string;
    province?: string;
    year?: string;
    search?: string;
    page?: string;
    page_size?: string;
  }>;
}) {
  const params = await searchParams;
  const { event_type, event_status, province, year } = params;
  const search = params.search?.trim();
  const page = normalizePage(params.page);
  const pageSize = normalizePageSize(params.page_size);

  const [events, stats, years, provinces] = await Promise.all([
    getEvents(event_type, event_status, province, year, search),
    getEventStats(),
    getEventYears(),
    getEventProvinces(),
  ]);

  const currentParams = { event_type, event_status, province, year, search, page_size: String(pageSize) };
  const activeEvents = events.filter((event) => event.event_status === 'upcoming' || event.event_status === 'ongoing');
  const completedEvents = events.filter((event) => event.event_status === 'completed');
  const visibleEvents = event_status === 'upcoming' || event_status === 'ongoing'
    ? activeEvents
    : event_status && event_status !== 'completed'
      ? events
      : completedEvents;
  const visibleTitle = event_status === 'upcoming'
    ? '即将开始赛事'
    : event_status === 'ongoing'
      ? '进行中赛事'
      : event_status && event_status !== 'completed'
        ? '筛选结果'
        : '已结束赛事';
  const pageCount = Math.max(1, Math.ceil(visibleEvents.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pagedEvents = visibleEvents.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const uploadHref = '/events/upload-results';

  return (
    <main className="min-h-screen bg-[#F7F1E8] text-[#2E2118]">
      <section className="relative overflow-hidden border-b border-[#E8DDCE] bg-[#F7F1E8]">
        <div
          className="absolute inset-0 opacity-70"
          style={{
            background:
              'radial-gradient(circle at 70% 35%, rgba(212, 184, 138, 0.32), transparent 34%), linear-gradient(105deg, rgba(250,247,242,0.96) 0%, rgba(250,247,242,0.82) 42%, rgba(238,224,204,0.56) 100%)',
          }}
        />
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#F7F1E8] to-transparent" />
        <div className="pointer-events-none absolute left-[48%] top-8 hidden h-52 w-80 opacity-30 md:block">
          <div className="absolute bottom-8 left-10 h-1 w-64 rounded-full bg-[#B99159]" />
          <div className="absolute bottom-9 left-28 h-40 w-14 rounded-full bg-[#8E6C48]/35 blur-[1px]" />
          <div className="absolute bottom-44 left-36 h-8 w-8 rounded-full bg-[#8E6C48]/35" />
          <div className="absolute bottom-28 left-16 h-36 w-1 rotate-[-22deg] rounded-full bg-[#8E6C48]/50" />
        </div>

        <div className="relative mx-auto max-w-[1440px] px-4 py-10 sm:px-6 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-[1fr_520px] lg:items-center">
            <div>
              <h1 className="font-[var(--font-display)] text-5xl font-semibold leading-none tracking-[0.02em] text-[#2E2118] sm:text-6xl">
                国内赛事
              </h1>
              <div className="mt-4 h-px w-12 bg-[#B58A48]" />
              <p className="mt-4 max-w-2xl text-base text-[#655D56] sm:text-lg">
                掌握国内 SUP 桨板赛事动态，报名参与或关注精彩比赛
              </p>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <StatCard icon="trophy" label="赛事总数" value={Number(stats.total || 0)} />
              <StatCard icon="play" label="进行中" value={Number(stats.active || 0)} tone="sage" />
              <StatCard icon="check" label="已结束" value={Number(stats.completed || 0)} tone="stone" />
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-[1440px] px-4 py-8 sm:px-6 lg:px-8">
        <Link
          href="/learn/docs/event-guide"
          className="mb-5 flex flex-col gap-3 rounded-md border border-[#E2D4C0] bg-white/86 p-5 text-[#2E2118] no-underline shadow-[0_14px_34px_rgba(88,63,36,0.08)] transition hover:border-[#B58A48] hover:bg-white sm:flex-row sm:items-center sm:justify-between"
        >
          <span>
            <span className="block text-xs font-semibold uppercase tracking-[0.18em] text-[#A08060]">赛事指南</span>
            <span className="mt-1 block text-lg font-semibold">赛事体系与竞赛规则</span>
          </span>
          <span className="text-sm font-semibold text-[#7A5530]">查看中国赛事体系 / 国际赛事体系 / 2026 版规则 →</span>
        </Link>

        <section className="sticky top-[56px] z-20 mb-7 border border-[#E2D4C0] bg-white/92 p-5 shadow-[0_18px_42px_rgba(91,68,43,0.08)] backdrop-blur">
          <form action="/events" className="grid gap-4 md:grid-cols-2 xl:grid-cols-[minmax(260px,1.15fr)_120px_repeat(4,minmax(150px,0.7fr))_auto]">
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8A8078]">
                <SearchIcon />
              </span>
              <input
                name="search"
                defaultValue={search || ''}
                placeholder="搜索赛事名称"
                className="h-12 w-full rounded-md border border-[#E3D5C2] bg-white/85 pl-11 pr-4 text-sm text-[#3D3328] outline-none transition placeholder:text-[#B5AA9C] focus:border-[#8B5A2B] focus:ring-2 focus:ring-[#D79E49]/20"
                type="search"
              />
            </div>
            <button className="h-12 rounded-md bg-[#6B3E1E] px-5 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(107,62,30,0.24)] transition hover:bg-[#4F2D16]" type="submit">
              搜索
            </button>
            <EventSelect name="event_type" value={event_type} options={[
              ['race', '全部类型', '竞速赛'],
              ['festival', '全部类型', '嘉年华'],
              ['training', '全部类型', '训练营'],
              ['exhibition', '全部类型', '展览赛'],
            ]} placeholder="全部类型" />
            <EventSelect name="event_status" value={event_status} options={[
              ['upcoming', '全部状态', '即将开始'],
              ['ongoing', '全部状态', '进行中'],
              ['completed', '全部状态', '已结束'],
            ]} placeholder="全部状态" />
            <EventSelect name="year" value={year} options={years.map((item) => [item, '全部年份', `${item} 年`])} placeholder="全部年份" />
            <EventSelect name="province" value={province} options={provinces.map((item) => [item, '全部省份', item])} placeholder="全部省份" />
            <input type="hidden" name="page_size" value={pageSize} />
            <Link
              href={uploadHref}
              className="inline-flex h-12 items-center justify-center whitespace-nowrap rounded-md border border-[#CDBAA4] bg-white px-4 text-sm font-semibold text-[#6B3E1E] no-underline transition hover:bg-[#F8EFE4]"
            >
              上传赛事成绩册
            </Link>
          </form>
          <div className="mt-3 flex flex-wrap gap-2">
            {quickFilters.map((item) => {
              const active = search === item.search;
              return (
                <Link
                  key={item.label}
                  href={buildHref(currentParams, { search: active ? null : item.search, page: 1 })}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium no-underline transition ${
                    active ? 'bg-[#B58A48] text-white' : 'bg-[#F4EBDD] text-[#7A6145] hover:bg-[#E9D8BF]'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
            {(event_type || event_status || province || year || search) && (
              <Link href="/events" className="rounded-lg px-3 py-1.5 text-xs font-medium text-[#A08060] no-underline hover:text-[#2E2118]">
                清除筛选
              </Link>
            )}
          </div>
        </section>

        {activeEvents.length > 0 && !event_status && (
          <section className="mb-8">
            <SectionTitle dot="bg-[#6E8567]" title="即将举办 / 进行中" />
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
              {activeEvents.slice(0, 3).map((event) => (
                <EventCard key={event.event_id} event={event} highlighted />
              ))}
            </div>
          </section>
        )}

        {pagedEvents.length > 0 ? (
          <section className="mb-8">
            <SectionTitle dot="bg-[#B58A48]" title={visibleTitle} />
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
              {pagedEvents.map((event) => (
                <EventCard key={event.event_id} event={event} />
              ))}
            </div>
          </section>
        ) : (
          <div className="rounded-2xl border border-[#E3D6C6] bg-white/76 px-6 py-16 text-center shadow-[0_16px_40px_rgba(88,63,36,0.08)]">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#F2E3CF] text-[#8A612F]">
              <UploadIcon />
            </div>
            <h2 className="mt-5 text-xl font-semibold text-[#2E2118]">没有找到对应赛事</h2>
            <p className="mx-auto mt-2 max-w-xl text-sm leading-7 text-[#75695F]">
              如果你手上有这场比赛的官方 PDF 成绩册，可以先提交给我们，管理员会复核后决定是否整理入库。
            </p>
            <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href={uploadHref}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#8A612F] px-5 text-sm font-semibold text-white no-underline shadow-[0_8px_18px_rgba(138,97,47,0.22)] transition hover:bg-[#704D25]"
              >
                <UploadIcon />上传赛事成绩册
              </Link>
              <Link href="/events" className="inline-flex h-11 items-center justify-center rounded-xl border border-[#E3D6C6] bg-white px-5 text-sm font-semibold text-[#7A5530] no-underline transition hover:bg-[#F5E9D8]">
                返回全部赛事
              </Link>
            </div>
          </div>
        )}

        {visibleEvents.length > pageSize && (
          <Pagination
            currentPage={currentPage}
            pageCount={pageCount}
            pageSize={pageSize}
            currentParams={currentParams}
          />
        )}
      </div>
    </main>
  );
}

function EventSelect({
  name,
  value,
  placeholder,
  options,
}: {
  name: string;
  value?: string;
  placeholder: string;
  options: string[][];
}) {
  return (
    <select
      name={name}
      defaultValue={value || ''}
      className="h-12 w-full rounded-md border border-[#E3D5C2] bg-white/85 px-3 text-sm text-[#3D3328] outline-none transition focus:border-[#8B5A2B] focus:ring-2 focus:ring-[#D79E49]/20"
    >
      <option value="">{placeholder}</option>
      {options.map(([optionValue, , label]) => (
        <option key={optionValue} value={optionValue}>{label}</option>
      ))}
    </select>
  );
}

function StatCard({ icon, label, value, tone = 'gold' }: {
  icon: 'trophy' | 'play' | 'check';
  label: string;
  value: number;
  tone?: 'gold' | 'sage' | 'stone';
}) {
  const toneClass = tone === 'sage' ? 'bg-[#E8EEE3] text-[#63785D]' : tone === 'stone' ? 'bg-[#ECEAE6] text-[#655D56]' : 'bg-[#F5E8D0] text-[#B58A48]';
  return (
    <div className="rounded-2xl border border-white/80 bg-white/76 p-5 shadow-[0_18px_40px_rgba(88,63,36,0.10)] backdrop-blur">
      <div className="flex items-center gap-4">
        <div className={`flex h-14 w-14 items-center justify-center rounded-full ${toneClass}`}>
          {icon === 'trophy' && <TrophyIcon />}
          {icon === 'play' && <PlayIcon />}
          {icon === 'check' && <CheckIcon />}
        </div>
        <div>
          <div className="text-sm text-[#655D56]">{label}</div>
          <div className="font-[var(--font-display)] text-4xl font-semibold leading-none text-[#2E2118]">{value}</div>
          <div className="mt-1 h-px w-5 bg-[#B58A48]" />
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ dot, title }: { dot: string; title: string }) {
  return (
    <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold text-[#2E2118]">
      <span className={`inline-block h-3 w-3 rounded-full ${dot} shadow-[0_0_0_4px_rgba(181,138,72,0.15)]`} />
      {title}
    </h2>
  );
}

function EventCard({ event, highlighted = false }: {
  event: EventWithDisciplines;
  highlighted?: boolean;
}) {
  const statusInfo = eventStatusLabels[event.event_status] || eventStatusLabels.completed;
  const typeLabel = eventTypeLabels[event.event_type] || event.event_type;
  const image = event.images[0];
  const needsResultBook = event.event_status === 'completed' && (event.results_count === 0 || event.result_status === 'none' || !event.result_status);
  const fallback = highlighted
    ? 'linear-gradient(120deg, rgba(117,148,156,0.72), rgba(242,218,172,0.72)), radial-gradient(circle at 78% 30%, rgba(255,255,255,0.72), transparent 28%)'
    : 'linear-gradient(120deg, rgba(137,160,150,0.62), rgba(210,182,139,0.66)), radial-gradient(circle at 70% 24%, rgba(255,255,255,0.64), transparent 28%)';

  return (
    <Link
      href={`/events/${event.event_id}${needsResultBook ? '#result-book-submit' : ''}`}
      className="group block overflow-hidden rounded-xl border border-[#E0D8CC] bg-white/82 no-underline shadow-[0_14px_34px_rgba(88,63,36,0.08)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_18px_42px_rgba(88,63,36,0.14)]"
    >
      <div
        className="relative h-[84px] overflow-hidden"
        style={{
          backgroundImage: image ? `linear-gradient(90deg, rgba(54,42,30,0.2), rgba(255,255,255,0.2)), url(${image})` : fallback,
          backgroundPosition: 'center',
          backgroundSize: 'cover',
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-[#2E2118]/10" />
        <div className="absolute left-4 top-4 flex flex-wrap gap-2">
          <span className={`rounded-full border px-3 py-1 text-xs font-medium ${statusInfo.chip}`}>{statusInfo.label}</span>
          {event.star_level && (
            <span className={`rounded-full border px-3 py-1 text-xs font-medium ${getEventStarBadgeStyle(event.star_level)}`}>
              {event.star_level}
              {event.score_coefficient ? ` / ${event.score_coefficient}` : ''}
            </span>
          )}
          <span className="rounded-full border border-[#EAD8B9] bg-[#FFF7E8] px-3 py-1 text-xs font-medium text-[#8A612F]">
            {typeLabel}
          </span>
        </div>
      </div>
      <div className="p-5">
        <h3 className="min-h-[48px] text-lg font-semibold leading-snug text-[#2E2118] transition-colors group-hover:text-[#8A612F]">
          {event.name}
        </h3>
        <div className="mt-3 space-y-1.5 text-sm text-[#655D56]">
          {event.start_date && (
            <div className="flex items-center gap-2">
              <CalendarIcon />
              <span>{formatDate(event.start_date)}{event.end_date && event.end_date !== event.start_date ? ` 至 ${formatDate(event.end_date)}` : ''}</span>
            </div>
          )}
          {(event.city || event.province) && (
            <div className="flex items-center gap-2">
              <PinIcon />
              <span>{[event.city, event.province].filter(Boolean).join('，')}</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <DocumentIcon />
            <span>已录成绩 {event.results_count} 条</span>
          </div>
        </div>
        {needsResultBook && (
          <div className="mt-4 rounded-xl border border-dashed border-[#C99A57] bg-[#FFF8EA] px-4 py-3 text-sm text-[#765125]">
            <div className="flex items-center justify-between gap-3">
              <span className="font-semibold">缺成绩册，欢迎提交 PDF</span>
              <span className="shrink-0 text-xs font-semibold text-[#9B6B32]">待补录</span>
            </div>
          </div>
        )}
        <div className="mt-4 flex justify-end text-sm font-semibold text-[#8A612F]">
          {needsResultBook ? (
            <span
              className="inline-flex items-center rounded-full bg-[#8A612F] px-3 py-1 text-xs font-semibold text-white shadow-[0_8px_16px_rgba(138,97,47,0.20)]"
            >
              查看详情 / 上传成绩册
            </span>
          ) : (
            <>查看详情 <span className="ml-2 transition group-hover:translate-x-1">›</span></>
          )}
        </div>
      </div>
    </Link>
  );
}

function Pagination({ currentPage, pageCount, pageSize, currentParams }: {
  currentPage: number;
  pageCount: number;
  pageSize: number;
  currentParams: Record<string, string | undefined>;
}) {
  const pages = Array.from(new Set([1, currentPage - 1, currentPage, currentPage + 1, pageCount]))
    .filter((page) => page >= 1 && page <= pageCount)
    .sort((a, b) => a - b);
  return (
    <div className="mb-8 flex flex-wrap items-center justify-center gap-4">
      <Link
        href={buildHref(currentParams, { page: Math.max(1, currentPage - 1), page_size: pageSize })}
        className="flex h-11 w-11 items-center justify-center rounded-full border border-[#E0D8CC] bg-white/82 text-xl text-[#655D56] no-underline transition hover:border-[#B58A48]"
      >
        ‹
      </Link>
      <div className="flex items-center gap-2">
        {pages.map((page, index) => {
          const previous = pages[index - 1];
          return (
            <span key={page} className="flex items-center gap-2">
              {previous && page - previous > 1 && <span className="px-3 text-[#655D56]">...</span>}
              <Link
                href={buildHref(currentParams, { page, page_size: pageSize })}
                className={`flex h-11 w-11 items-center justify-center rounded-full text-sm font-semibold no-underline transition ${
                  page === currentPage ? 'bg-[#B58A48] text-white shadow-[0_10px_22px_rgba(181,138,72,0.26)]' : 'text-[#655D56] hover:bg-white/82'
                }`}
              >
                {page}
              </Link>
            </span>
          );
        })}
      </div>
      <Link
        href={buildHref(currentParams, { page: Math.min(pageCount, currentPage + 1), page_size: pageSize })}
        className="flex h-11 w-11 items-center justify-center rounded-full border border-[#E0D8CC] bg-white/82 text-xl text-[#655D56] no-underline transition hover:border-[#B58A48]"
      >
        ›
      </Link>
      <form action="/events" className="ml-2 flex h-11 items-center gap-2 rounded-xl border border-[#E0D8CC] bg-white/82 px-4 text-sm text-[#655D56]">
        {Object.entries(currentParams).map(([key, value]) => (
          key !== 'page_size' && value ? <input key={key} type="hidden" name={key} value={value} /> : null
        ))}
        <input type="hidden" name="page" value="1" />
        <span>每页</span>
        <select name="page_size" defaultValue={pageSize} className="bg-transparent outline-none">
          <option value="6">6 条</option>
          <option value="12">12 条</option>
          <option value="24">24 条</option>
        </select>
        <button type="submit" className="text-xs font-semibold text-[#8A612F]">应用</button>
      </form>
    </div>
  );
}

function SearchIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m21 21-4.3-4.3m1.3-5.2a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>;
}

function TrophyIcon() {
  return <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M8 4h8v3.5a4 4 0 0 1-8 0V4Z" stroke="currentColor" strokeWidth="1.7" /><path d="M8 6H5.5a2.5 2.5 0 0 0 0 5H8M16 6h2.5a2.5 2.5 0 0 1 0 5H16M12 12v4M9 20h6M10 16h4v4h-4v-4Z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function PlayIcon() {
  return <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.7" /><path d="m10 8 6 4-6 4V8Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" /></svg>;
}

function CheckIcon() {
  return <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.7" /><path d="m8 12 2.6 2.6L16.5 9" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function CalendarIcon() {
  return <svg className="h-4 w-4 shrink-0 text-[#8A8078]" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M7 3v3M17 3v3M4.5 9h15M6 5h12a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>;
}

function PinIcon() {
  return <svg className="h-4 w-4 shrink-0 text-[#8A8078]" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11Z" stroke="currentColor" strokeWidth="1.7" /><circle cx="12" cy="10" r="2.3" stroke="currentColor" strokeWidth="1.7" /></svg>;
}

function DocumentIcon() {
  return <svg className="h-4 w-4 shrink-0 text-[#8A8078]" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M7 3h7l4 4v14H7V3Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" /><path d="M14 3v5h5M9.5 13h5M9.5 17h4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>;
}

function UploadIcon() {
  return <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 16V5m0 0L8 9m4-4 4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /><path d="M5 15v3a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>;
}
