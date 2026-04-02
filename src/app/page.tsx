import Link from 'next/link';
import pool from '@/lib/db';
import type { RowDataPacket } from 'mysql2';

interface EventPreviewRow extends RowDataPacket {
  event_id: number;
  name: string;
  province: string | null;
  city: string | null;
  start_date: string | null;
  event_type: string;
  event_status: string;
}

const categories = [
  {
    href: '/brands',
    icon: '🏷️',
    title: '品牌库',
    desc: '收录国内外主流桨板品牌，了解品牌故事和定位',
    bg: 'bg-cream-200',
  },
  {
    href: '/products',
    icon: '🏄',
    title: '产品库',
    desc: '详细产品参数、价格对比，找到最适合你的板子',
    bg: 'bg-sage-100',
  },
  {
    href: '/athletes',
    icon: '🏆',
    title: '运动员',
    desc: '世界顶尖桨板运动员档案，ICF 排名和荣誉成就',
    bg: 'bg-[#F5EDE4]',
  },
  {
    href: '/creators',
    icon: '📱',
    title: '博主',
    desc: '关注桨板领域的内容创作者，获取教程和测评',
    bg: 'bg-[#F5EDF2]',
  },
  {
    href: '/events',
    icon: '🗓️',
    title: '赛事',
    desc: '国内 SUP 桨板赛事日历，报名参与精彩比赛',
    bg: 'bg-[#EEF0F5]',
  },
];

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function getUpcomingEvents() {
  try {
    const [rows] = await pool.execute<EventPreviewRow[]>(
      `SELECT event_id, name, province, city, start_date, event_type, event_status
       FROM sup_events
       WHERE status = 'published' AND event_status IN ('upcoming', 'ongoing')
       ORDER BY start_date ASC
       LIMIT 3`
    );
    return rows;
  } catch {
    return [];
  }
}

export default async function Home() {
  const upcomingEvents = await getUpcomingEvents();

  return (
    <div>
      {/* Hero Section */}
      <section className="bg-cream-100 border-b border-cream-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-28">
          <div className="text-center">
            <h1 className="text-4xl md:text-6xl font-bold text-brown-800 mb-5 tracking-tight">
              SUP Wiki
            </h1>
            <p className="text-lg md:text-xl text-warm-gray-500 mb-10 max-w-2xl mx-auto">
              桨板运动资讯百科 — 品牌、产品、运动员、博主、赛事
            </p>

            {/* Category quick links */}
            <div className="flex flex-wrap justify-center gap-3">
              {categories.map(c => (
                <Link
                  key={c.href}
                  href={c.href}
                  className="px-5 py-2 rounded-full border border-cream-300 bg-cream-50 text-warm-gray-500 text-sm hover:border-brown-500 hover:text-brown-600 transition-all"
                >
                  {c.icon} {c.title}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Categories Section */}
      <section className="py-14 md:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-brown-800 text-center mb-10">
            探索内容
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-5">
            {categories.map(c => (
              <Link href={c.href} key={c.href} className="group">
                <div className="bg-cream-50 rounded-2xl border border-cream-200 hover:border-brown-500 hover:shadow-md transition-all duration-200 overflow-hidden">
                  <div className={`h-32 ${c.bg} flex items-center justify-center`}>
                    <span className="text-5xl">{c.icon}</span>
                  </div>
                  <div className="p-5">
                    <h3 className="text-base font-semibold text-brown-800 mb-1.5 group-hover:text-brown-500 transition-colors">
                      {c.title}
                    </h3>
                    <p className="text-warm-gray-400 text-xs leading-relaxed">
                      {c.desc}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Upcoming Events Preview */}
      {upcomingEvents.length > 0 && (
        <section className="py-10 bg-cream-100 border-t border-cream-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-brown-800">即将举办的赛事</h2>
              <Link href="/events" className="text-sm text-brown-500 hover:text-brown-600 transition-colors">
                查看全部 →
              </Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {upcomingEvents.map(event => (
                <Link
                  key={event.event_id}
                  href={`/events/${event.event_id}`}
                  className="bg-cream-50 border border-cream-200 rounded-xl p-4 hover:border-brown-500 hover:shadow-sm transition-all"
                >
                  <div className="text-xs text-amber-600 font-medium mb-1.5">
                    {event.event_status === 'ongoing' ? '进行中' : '即将开始'}
                  </div>
                  <div className="font-medium text-brown-800 text-sm leading-snug mb-2">{event.name}</div>
                  <div className="text-xs text-warm-gray-400">
                    {event.start_date && `📅 ${formatDate(event.start_date)}`}
                    {(event.city || event.province) && ` · 📍 ${event.city || event.province}`}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Stats Section */}
      <section className="py-14">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
            {[
              { num: '15+', label: '品牌' },
              { num: '50+', label: '产品' },
              { num: '20+', label: '运动员' },
              { num: '20+', label: '博主' },
              { num: '10+', label: '赛事' },
            ].map(s => (
              <div key={s.label} className="text-center">
                <div className="text-3xl font-bold text-brown-500 mb-1">{s.num}</div>
                <div className="text-warm-gray-500 text-sm">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
