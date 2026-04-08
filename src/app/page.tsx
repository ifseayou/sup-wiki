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

interface ShopPreviewRow extends RowDataPacket {
  shop_item_id: number;
  name: string;
  subtitle: string | null;
  discount_price: number | null;
  market_price: number | null;
  images: unknown;
  category: string;
  brand_name: string | null;
}

async function getFeaturedShopItems() {
  try {
    const [rows] = await pool.execute<ShopPreviewRow[]>(
      `SELECT s.shop_item_id, s.name, s.subtitle, s.discount_price, s.market_price, s.images, s.category,
              b.name as brand_name
       FROM sup_shop_items s
       LEFT JOIN sup_brands b ON s.brand_id = b.brand_id
       WHERE s.status = 'published'
       ORDER BY s.sort_order DESC, s.created_at DESC
       LIMIT 6`
    );
    return rows;
  } catch {
    return [];
  }
}

async function getUpcomingEvents() {
  try {
    const [rows] = await pool.execute<EventPreviewRow[]>(
      `SELECT event_id, name, province, city, start_date, event_type, event_status
       FROM sup_events
       WHERE status = 'published' AND event_status IN ('upcoming', 'ongoing')
       ORDER BY start_date ASC
       LIMIT 4`
    );
    return rows;
  } catch {
    return [];
  }
}

const sections = [
  { href: '/brands',   label: '品牌',  en: 'Brands',    desc: '国内外主流桨板品牌' },
  { href: '/products', label: '产品',  en: 'Products',  desc: '详细参数与价格对比' },
  { href: '/athletes', label: '运动员', en: 'Athletes',  desc: 'ICF 排名与运动档案' },
  { href: '/creators', label: '博主',  en: 'Creators',  desc: '桨板内容创作者' },
  { href: '/events',   label: '赛事',  en: 'Events',    desc: '国内桨板赛事日历' },
  { href: '/shop',     label: '商城',  en: 'Shop',      desc: '官方代理 严选好物' },
];

const typeMap: Record<string, string> = {
  race: '竞速', festival: '嘉年华', training: '训练营', exhibition: '展览',
};

export default async function Home() {
  const [events, shopItems] = await Promise.all([getUpcomingEvents(), getFeaturedShopItems()]);

  return (
    <div>
      {/* ── Hero ── */}
      <section style={{ borderBottom: '1px solid #EDE5D8', padding: '72px 0 64px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px' }}>

          <p style={{ fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#A08060', marginBottom: 24, fontFamily: 'var(--font-sans)' }}>
            Stand Up Paddleboard Encyclopedia
          </p>

          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(52px, 8vw, 96px)',
            fontWeight: 300,
            lineHeight: 1.0,
            letterSpacing: '-0.02em',
            color: '#2E2118',
            margin: '0 0 32px',
            maxWidth: 820,
          }}>
            桨板运动的<br />
            <em style={{ fontStyle: 'italic', fontWeight: 400 }}>权威百科</em>
          </h1>

          <div style={{ width: 48, height: 1, background: '#A08060', marginBottom: 28 }} />

          <p style={{ fontSize: 15, color: '#655D56', lineHeight: 1.8, maxWidth: 520, marginBottom: 40 }}>
            收录国内外桨板品牌、产品规格、职业运动员档案、内容创作者与赛事信息。
            为桨板爱好者提供可信赖的参考资料。
          </p>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0 28px' }}>
            {sections.map(s => (
              <Link key={s.href} href={s.href} className="hero-link">{s.label}</Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── Content index ── */}
      <section style={{ borderBottom: '1px solid #EDE5D8' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px' }}>
          {sections.map((s, i) => (
            <Link key={s.href} href={s.href} className="index-row">
              <span className="index-num">{String(i + 1).padStart(2, '0')}</span>
              <span className="index-title">{s.label}</span>
              <span className="index-en">{s.en}</span>
              <span className="index-desc">{s.desc}</span>
              <span className="index-arrow">→</span>
            </Link>
          ))}
        </div>
      </section>

      {/* ── Upcoming Events ── */}
      {events.length > 0 && (
        <section style={{ padding: '60px 0', borderBottom: '1px solid #EDE5D8' }}>
          <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px' }}>

            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 40 }}>
              <div>
                <p style={{ fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#A08060', marginBottom: 8 }}>
                  Upcoming
                </p>
                <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 400, color: '#2E2118', margin: 0, lineHeight: 1 }}>
                  近期赛事
                </h2>
              </div>
              <Link href="/events" className="hero-link">全部赛事</Link>
            </div>

            <div>
              {events.map(event => {
                const date = event.start_date ? new Date(event.start_date) : null;
                return (
                  <Link key={event.event_id} href={`/events/${event.event_id}`} className="event-row">
                    <div>
                      {date ? (
                        <>
                          <div style={{ fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 300, color: '#C0B4A4', lineHeight: 1 }}>
                            {String(date.getMonth() + 1).padStart(2, '0')}/{String(date.getDate()).padStart(2, '0')}
                          </div>
                          <div style={{ fontSize: 11, color: '#C0B4A4', marginTop: 2 }}>{date.getFullYear()}</div>
                        </>
                      ) : (
                        <span style={{ fontSize: 12, color: '#C0B4A4' }}>日期待定</span>
                      )}
                    </div>
                    <div>
                      <div className="event-title">{event.name}</div>
                      <div style={{ fontSize: 12, color: '#A08060' }}>
                        {typeMap[event.event_type] || event.event_type}
                        {(event.city || event.province) && ` · ${event.city || event.province}`}
                      </div>
                    </div>
                    <div>
                      {event.event_status === 'ongoing' ? (
                        <span style={{ fontSize: 11, letterSpacing: '0.06em', color: '#6E8567', background: '#ECF0E8', padding: '3px 8px', borderRadius: 2 }}>
                          进行中
                        </span>
                      ) : (
                        <span style={{ fontSize: 11, color: '#C0B4A4', letterSpacing: '0.04em' }}>报名中</span>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ── Featured Shop Items ── */}
      {shopItems.length > 0 && (
        <section style={{ padding: '60px 0', borderBottom: '1px solid #EDE5D8' }}>
          <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 40 }}>
              <div>
                <p style={{ fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#A08060', marginBottom: 8 }}>
                  Official Store
                </p>
                <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 400, color: '#2E2118', margin: 0, lineHeight: 1 }}>
                  严选好物
                </h2>
              </div>
              <Link href="/shop" className="hero-link">全部商品</Link>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 20 }}>
              {shopItems.map(item => {
                const imgs = Array.isArray(item.images) ? item.images : (item.images ? JSON.parse(String(item.images)) : []);
                return (
                  <Link key={item.shop_item_id} href={`/shop/${item.shop_item_id}`} style={{ textDecoration: 'none' }}>
                    <div style={{ background: '#FAF7F2', border: '1px solid #EDE5D8', borderRadius: 10, overflow: 'hidden', transition: 'box-shadow 0.2s' }}>
                      <div style={{ height: 160, background: '#F0E8DB', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                        {imgs.length > 0 ? (
                          <img src={imgs[0]} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <span style={{ fontSize: 36, opacity: 0.3 }}>🏄</span>
                        )}
                      </div>
                      <div style={{ padding: '12px 14px' }}>
                        {item.brand_name && <div style={{ fontSize: 11, color: '#A08060', marginBottom: 2 }}>{item.brand_name}</div>}
                        <div style={{ fontSize: 13, fontWeight: 500, color: '#2E2118', lineHeight: 1.4, marginBottom: 6, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const }}>
                          {item.name}
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: item.discount_price ? '#C0392B' : '#655D56' }}>
                          {item.discount_price ? `¥${item.discount_price.toLocaleString()}` : item.market_price ? `¥${item.market_price.toLocaleString()}` : '面议'}
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ── Stats ── */}
      <section style={{ padding: '64px 0' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '0 1px', background: '#EDE5D8', border: '1px solid #EDE5D8' }}>
            {[
              { num: '15+', label: '品牌', en: 'Brands' },
              { num: '50+', label: '产品', en: 'Products' },
              { num: '20+', label: '运动员', en: 'Athletes' },
              { num: '20+', label: '博主', en: 'Creators' },
              { num: '10+', label: '赛事', en: 'Events' },
              { num: shopItems.length > 0 ? `${shopItems.length}+` : '∞', label: '在售', en: 'Shop' },
            ].map(s => (
              <div key={s.label} style={{ background: '#FAF7F2', padding: '32px 20px', textAlign: 'center' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 48, fontWeight: 300, color: '#2E2118', lineHeight: 1, letterSpacing: '-0.02em', marginBottom: 8 }}>
                  {s.num}
                </div>
                <div style={{ fontSize: 13, color: '#655D56', marginBottom: 3 }}>{s.label}</div>
                <div style={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#C0B4A4' }}>{s.en}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
