import Link from 'next/link';
import { Suspense } from 'react';
import pool from '@/lib/db';
import type { RowDataPacket } from 'mysql2';
import FilterBar from '@/components/FilterBar';

interface ShopRow extends RowDataPacket {
  shop_item_id: number;
  category: string;
  board_type: string | null;
  name: string;
  slug: string;
  subtitle: string | null;
  market_price: number | null;
  discount_price: number | null;
  stock_status: string;
  images: string | null;
  brand_name: string | null;
}

const categoryLabels: Record<string, string> = {
  board: '桨板',
  paddle: '桨',
  life_jacket: '救生衣',
  accessory: '周边配件',
};

const boardTypeLabels: Record<string, string> = {
  race: '竞速板',
  allround: '全能板',
  touring: '巡游板',
  yoga: '瑜伽板',
  inflatable: '充气板',
};

const stockLabels: Record<string, { label: string; color: string }> = {
  in_stock: { label: '现货', color: '#276749' },
  low_stock: { label: '少量', color: '#B7791F' },
  pre_order: { label: '预定', color: '#2B6CB0' },
  sold_out: { label: '售罄', color: '#9B2C2C' },
};

async function getShopItems(category?: string, board_type?: string, sort?: string) {
  try {
    const conditions: string[] = ["s.status = 'published'"];
    const params: (string | number)[] = [];

    if (category) { conditions.push('s.category = ?'); params.push(category); }
    if (board_type) { conditions.push('s.board_type = ?'); params.push(board_type); }

    const where = `WHERE ${conditions.join(' AND ')}`;
    let orderBy = 's.sort_order DESC, s.created_at DESC';
    if (sort === 'price_asc') orderBy = 's.discount_price ASC, s.market_price ASC';
    if (sort === 'price_desc') orderBy = 's.discount_price DESC, s.market_price DESC';

    const [rows] = await pool.execute<ShopRow[]>(
      `SELECT s.shop_item_id, s.category, s.board_type, s.name, s.slug, s.subtitle,
              s.market_price, s.discount_price, s.stock_status, s.images,
              b.name as brand_name
       FROM sup_shop_items s
       LEFT JOIN sup_brands b ON s.brand_id = b.brand_id
       ${where}
       ORDER BY ${orderBy}`,
      params
    );
    return rows;
  } catch (error) {
    console.error('获取商城商品失败:', error);
    return [];
  }
}

const filters = [
  {
    key: 'category',
    placeholder: '全部品类',
    options: [
      { label: '桨板', value: 'board' },
      { label: '桨', value: 'paddle' },
      { label: '救生衣', value: 'life_jacket' },
      { label: '周边配件', value: 'accessory' },
    ],
  },
  {
    key: 'board_type',
    placeholder: '板型',
    options: [
      { label: '竞速板', value: 'race' },
      { label: '全能板', value: 'allround' },
      { label: '巡游板', value: 'touring' },
      { label: '瑜伽板', value: 'yoga' },
      { label: '充气板', value: 'inflatable' },
    ],
  },
  {
    key: 'sort',
    placeholder: '默认排序',
    options: [
      { label: '价格从低到高', value: 'price_asc' },
      { label: '价格从高到低', value: 'price_desc' },
    ],
  },
];

export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; board_type?: string; sort?: string }>;
}) {
  const { category, board_type, sort } = await searchParams;
  const items = await getShopItems(category, board_type, sort);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-8">
        <p style={{ fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#A08060', marginBottom: 8 }}>
          Official Store
        </p>
        <h1 className="text-3xl font-bold text-brown-800 mb-2">桨板严选商城</h1>
        <p className="text-warm-gray-500">官方代理直供，品质保障，微信咨询成交，支持全国发货</p>
      </div>

      <Suspense>
        <FilterBar filters={filters} />
      </Suspense>

      {items.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {items.map((item) => {
            const images = Array.isArray(item.images) ? item.images : (item.images ? JSON.parse(item.images) : []);
            const stock = stockLabels[item.stock_status] || { label: item.stock_status, color: '#888' };
            return (
              <Link
                key={item.shop_item_id}
                href={`/shop/${item.shop_item_id}`}
                className="bg-cream-50 rounded-xl shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden border border-cream-200 group"
              >
                <div className="h-52 bg-cream-100 flex items-center justify-center relative overflow-hidden">
                  {images.length > 0 ? (
                    <img src={images[0]} alt={item.name} className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  ) : (
                    <span style={{ fontSize: 48, opacity: 0.3 }}>🏄</span>
                  )}
                  {/* 库存状态角标 */}
                  <span style={{
                    position: 'absolute',
                    top: 10,
                    right: 10,
                    fontSize: 10,
                    color: stock.color,
                    background: 'rgba(255,255,255,0.92)',
                    padding: '2px 7px',
                    borderRadius: 4,
                    fontWeight: 600,
                    letterSpacing: '0.04em',
                    border: `1px solid ${stock.color}22`,
                  }}>
                    {stock.label}
                  </span>
                </div>
                <div className="p-4">
                  {item.brand_name && (
                    <span className="text-sm text-warm-gray-400">{item.brand_name}</span>
                  )}
                  <h3 className="text-base font-semibold text-brown-800 group-hover:text-brown-500 transition-colors mt-1 line-clamp-2">
                    {item.name}
                  </h3>
                  {item.subtitle && (
                    <p className="text-xs text-warm-gray-400 mt-1 line-clamp-1">{item.subtitle}</p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-1">
                    <span className="text-xs px-2 py-0.5 bg-cream-200 text-brown-600 rounded">
                      {categoryLabels[item.category] || item.category}
                    </span>
                    {item.board_type && (
                      <span className="text-xs px-2 py-0.5 bg-cream-100 text-warm-gray-500 rounded">
                        {boardTypeLabels[item.board_type] || item.board_type}
                      </span>
                    )}
                  </div>
                  <div className="mt-3">
                    {item.discount_price ? (
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                        <span style={{ fontSize: 18, fontWeight: 700, color: '#C0392B' }}>
                          ¥{item.discount_price.toLocaleString()}
                        </span>
                        {item.market_price && item.market_price !== item.discount_price && (
                          <span style={{ fontSize: 12, color: '#A09080', textDecoration: 'line-through' }}>
                            ¥{item.market_price.toLocaleString()}
                          </span>
                        )}
                      </div>
                    ) : item.market_price ? (
                      <span className="text-brown-500 font-semibold">
                        ¥{item.market_price.toLocaleString()}
                      </span>
                    ) : (
                      <span className="text-warm-gray-400 text-sm">价格面议</span>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-20">
          <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.3 }}>🏄</div>
          <p className="text-warm-gray-500">暂无上架商品，敬请期待</p>
        </div>
      )}
    </div>
  );
}
