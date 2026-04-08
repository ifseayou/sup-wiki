import { notFound } from 'next/navigation';
import Link from 'next/link';
import pool from '@/lib/db';
import type { RowDataPacket } from 'mysql2';
import WechatContactCard from '@/components/shop/WechatContactCard';
import ShopImageGallery from '@/components/shop/ShopImageGallery';

interface ShopItemRow extends RowDataPacket {
  shop_item_id: number;
  category: string;
  board_type: string | null;
  brand_id: number | null;
  name: string;
  slug: string;
  subtitle: string | null;
  description: string | null;
  highlights: unknown;
  market_price: number | null;
  discount_price: number | null;
  stock_status: string;
  images: unknown;
  videos: unknown;
  spec: unknown;
  brand_name: string | null;
  brand_slug: string | null;
}

interface ShopRow extends RowDataPacket {
  shop_item_id: number;
  name: string;
  images: unknown;
  discount_price: number | null;
  market_price: number | null;
  category: string;
}

function parseJson(v: unknown): unknown[] {
  if (Array.isArray(v)) return v;
  if (v) return JSON.parse(String(v));
  return [];
}
function parseJsonObj(v: unknown): Record<string, string | number> {
  if (v && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, string | number>;
  if (v) return JSON.parse(String(v));
  return {};
}

const categoryLabels: Record<string, string> = {
  board: '桨板', paddle: '桨', life_jacket: '救生衣', accessory: '周边配件',
};
const boardTypeLabels: Record<string, string> = {
  race: '竞速板', allround: '全能板', touring: '巡游板', yoga: '瑜伽板', inflatable: '充气板',
};
const stockLabels: Record<string, { label: string; bg: string; color: string }> = {
  in_stock: { label: '现货', bg: '#F0FFF4', color: '#276749' },
  low_stock: { label: '库存紧张', bg: '#FFFBEB', color: '#B7791F' },
  pre_order: { label: '可预定', bg: '#EBF8FF', color: '#2B6CB0' },
  sold_out: { label: '暂时售罄', bg: '#FFF5F5', color: '#9B2C2C' },
};

async function getItem(id: string) {
  try {
    const isNumeric = /^\d+$/.test(id);
    const cond = isNumeric ? 's.shop_item_id = ?' : 's.slug = ?';
    const [rows] = await pool.execute<ShopItemRow[]>(
      `SELECT s.*, b.name as brand_name, b.slug as brand_slug
       FROM sup_shop_items s
       LEFT JOIN sup_brands b ON s.brand_id = b.brand_id
       WHERE ${cond} AND s.status = 'published'`,
      [isNumeric ? Number(id) : id]
    );
    return rows[0] || null;
  } catch { return null; }
}

async function getRelatedItems(brandId: number | null, currentId: number) {
  if (!brandId) return [];
  try {
    const [rows] = await pool.execute<ShopRow[]>(
      `SELECT shop_item_id, name, images, discount_price, market_price, category
       FROM sup_shop_items
       WHERE brand_id = ? AND shop_item_id != ? AND status = 'published'
       ORDER BY sort_order DESC LIMIT 4`,
      [brandId, currentId]
    );
    return rows;
  } catch { return []; }
}

export default async function ShopItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const item = await getItem(id);
  if (!item) notFound();

  const [relatedItems] = await Promise.all([
    getRelatedItems(item.brand_id, item.shop_item_id),
  ]);

  const images = parseJson(item.images) as string[];
  const videos = parseJson(item.videos) as Array<{ title: string; url: string; cover?: string }>;
  const highlights = parseJson(item.highlights) as string[];
  const spec = parseJsonObj(item.spec);
  const stock = stockLabels[item.stock_status] || { label: item.stock_status, bg: '#F5F5F5', color: '#666' };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* 面包屑 */}
      <nav style={{ fontSize: 13, color: '#A08060', marginBottom: 28, display: 'flex', gap: 6, alignItems: 'center' }}>
        <Link href="/" style={{ color: '#A08060', textDecoration: 'none' }}>首页</Link>
        <span>›</span>
        <Link href="/shop" style={{ color: '#A08060', textDecoration: 'none' }}>商城</Link>
        <span>›</span>
        <span style={{ color: '#655D56' }}>{item.name}</span>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        {/* 左列：图片 + 视频 */}
        <div>
          <ShopImageGallery images={images} name={item.name} />

          {/* 视频区 */}
          {videos.length > 0 && (
            <div style={{ marginTop: 32 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, color: '#655D56', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 12 }}>
                产品视频
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {videos.map((v, i) => (
                  <a
                    key={i}
                    href={v.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '12px 16px',
                      background: '#FAF7F2',
                      border: '1px solid #EDE5D8',
                      borderRadius: 10,
                      textDecoration: 'none',
                      color: '#2E2118',
                      transition: 'border-color 0.2s',
                    }}
                  >
                    <span style={{ fontSize: 20 }}>▶</span>
                    <span style={{ fontSize: 14 }}>{v.title || `视频 ${i + 1}`}</span>
                    <span style={{ marginLeft: 'auto', fontSize: 11, color: '#A08060' }}>↗</span>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 右列：信息 + 购买 */}
        <div>
          {/* 品牌 + 分类标签 */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
            {item.brand_name && (
              <Link href={`/brands/${item.brand_slug}`} style={{
                fontSize: 12, color: '#7A6145', background: '#F0E8DB',
                padding: '3px 10px', borderRadius: 4, textDecoration: 'none',
              }}>
                {item.brand_name}
              </Link>
            )}
            <span style={{ fontSize: 12, color: '#655D56', background: '#EDE5D8', padding: '3px 10px', borderRadius: 4 }}>
              {categoryLabels[item.category] || item.category}
            </span>
            {item.board_type && (
              <span style={{ fontSize: 12, color: '#655D56', background: '#EDE5D8', padding: '3px 10px', borderRadius: 4 }}>
                {boardTypeLabels[item.board_type] || item.board_type}
              </span>
            )}
          </div>

          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(24px, 4vw, 36px)', fontWeight: 400, color: '#2E2118', lineHeight: 1.2, marginBottom: 8 }}>
            {item.name}
          </h1>
          {item.subtitle && (
            <p style={{ fontSize: 15, color: '#8B7355', marginBottom: 20, lineHeight: 1.6 }}>{item.subtitle}</p>
          )}

          {/* 价格区 */}
          <div style={{ padding: '20px 0', borderTop: '1px solid #EDE5D8', borderBottom: '1px solid #EDE5D8', marginBottom: 24 }}>
            {item.discount_price ? (
              <div>
                <div style={{ fontSize: 11, color: '#A08060', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>到手价</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: 40, fontWeight: 400, color: '#C0392B', lineHeight: 1 }}>
                    ¥{item.discount_price.toLocaleString()}
                  </span>
                  {item.market_price && item.market_price !== item.discount_price && (
                    <div>
                      <div style={{ fontSize: 10, color: '#A09080', textTransform: 'uppercase', letterSpacing: '0.06em' }}>市场价</div>
                      <span style={{ fontSize: 16, color: '#A09080', textDecoration: 'line-through' }}>
                        ¥{item.market_price.toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ) : item.market_price ? (
              <div>
                <div style={{ fontSize: 11, color: '#A08060', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>价格</div>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: 40, fontWeight: 400, color: '#2E2118' }}>
                  ¥{item.market_price.toLocaleString()}
                </span>
              </div>
            ) : (
              <span style={{ fontSize: 18, color: '#8B7355' }}>价格面议</span>
            )}

            {/* 库存状态 */}
            <div style={{ marginTop: 12 }}>
              <span style={{
                fontSize: 12, fontWeight: 600,
                color: stock.color, background: stock.bg,
                padding: '4px 10px', borderRadius: 6,
              }}>
                {stock.label}
              </span>
            </div>
          </div>

          {/* 卖点列表 */}
          {highlights.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <h3 style={{ fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#A08060', marginBottom: 10 }}>产品亮点</h3>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {highlights.map((h, i) => (
                  <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 14, color: '#655D56' }}>
                    <span style={{ color: '#A08060', flexShrink: 0, marginTop: 2 }}>✦</span>
                    {h}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* 规格参数 */}
          {Object.keys(spec).length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <h3 style={{ fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#A08060', marginBottom: 10 }}>规格参数</h3>
              <div style={{ background: '#FAF7F2', border: '1px solid #EDE5D8', borderRadius: 8, overflow: 'hidden' }}>
                {Object.entries(spec).map(([k, v], i) => (
                  <div key={k} style={{
                    display: 'flex',
                    padding: '8px 16px',
                    borderBottom: i < Object.keys(spec).length - 1 ? '1px solid #EDE5D8' : 'none',
                    fontSize: 13,
                  }}>
                    <span style={{ color: '#8B7355', minWidth: 100 }}>{k}</span>
                    <span style={{ color: '#2E2118' }}>{String(v)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 微信咨询购买卡片 */}
          <WechatContactCard />

          {/* 详细描述 */}
          {item.description && (
            <div style={{ marginTop: 32 }}>
              <h3 style={{ fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#A08060', marginBottom: 12 }}>产品详情</h3>
              <div style={{
                fontSize: 14, color: '#655D56', lineHeight: 1.9,
                whiteSpace: 'pre-wrap',
              }}>
                {item.description}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 同品牌其他商品 */}
      {relatedItems.length > 0 && (
        <section style={{ marginTop: 64, paddingTop: 40, borderTop: '1px solid #EDE5D8' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 400, color: '#2E2118', marginBottom: 24 }}>
            同品牌商品
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {relatedItems.map((r) => {
              const imgs = Array.isArray(r.images) ? r.images : (r.images ? JSON.parse(String(r.images)) : []);
              return (
                <Link key={r.shop_item_id} href={`/shop/${r.shop_item_id}`} style={{ textDecoration: 'none' }}>
                  <div style={{ background: '#FAF7F2', border: '1px solid #EDE5D8', borderRadius: 10, overflow: 'hidden' }}>
                    <div style={{ height: 120, background: '#F0E8DB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {imgs.length > 0 ? (
                        <img src={imgs[0]} alt={r.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <span style={{ fontSize: 28, opacity: 0.3 }}>🏄</span>
                      )}
                    </div>
                    <div style={{ padding: '10px 12px' }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: '#2E2118', lineHeight: 1.4 }}>{r.name}</div>
                      <div style={{ marginTop: 4, fontSize: 13, color: r.discount_price ? '#C0392B' : '#8B7355', fontWeight: 600 }}>
                        {r.discount_price ? `¥${r.discount_price.toLocaleString()}` : r.market_price ? `¥${r.market_price.toLocaleString()}` : '面议'}
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
