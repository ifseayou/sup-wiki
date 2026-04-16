import Link from 'next/link';
import { Suspense } from 'react';
import pool from '@/lib/db';
import type { RowDataPacket } from 'mysql2';
import FilterBar from '@/components/FilterBar';

interface BrandRow extends RowDataPacket {
  brand_id: number;
  slug: string;
  name: string;
  name_en: string | null;
  logo: string | null;
  country: string | null;
  website: string | null;
  tier: string;
  product_count: number;
}

async function getBrands(tier?: string, country?: string) {
  try {
    const conditions: string[] = ["b.status = 'published'"];
    const params: string[] = [];

    if (tier) { conditions.push('b.tier = ?'); params.push(tier); }
    if (country) { conditions.push('b.country = ?'); params.push(country); }

    const where = `WHERE ${conditions.join(' AND ')}`;

    const [brands] = await pool.execute<BrandRow[]>(
      `SELECT b.*, COUNT(p.product_id) as product_count
       FROM sup_brands b
       LEFT JOIN sup_products p ON b.brand_id = p.brand_id AND p.status = 'published'
       ${where}
       GROUP BY b.brand_id
       ORDER BY b.name ASC`,
      params
    );
    return brands;
  } catch (error) {
    console.error('获取品牌列表失败:', error);
    return [];
  }
}

const filters = [
  {
    key: 'country',
    placeholder: '全部国家',
    options: [
      { label: '全部国家', value: 'all' },
      { label: '中国', value: '中国' },
      { label: '英国', value: '英国' },
      { label: '美国', value: '美国' },
      { label: '泰国', value: '泰国' },
      { label: '德国', value: '德国' },
      { label: '香港', value: '香港' },
    ],
  },
];

export default async function BrandsPage({
  searchParams,
}: {
  searchParams: Promise<{ tier?: string; country?: string }>;
}) {
  const { tier, country: rawCountry } = await searchParams;
  // 默认展示中国品牌；选 'all' 时展示全部
  const country = rawCountry === 'all' ? undefined : (rawCountry ?? '中国');
  const brands = await getBrands(tier, country);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-brown-800 mb-2">品牌库</h1>
        <p className="text-warm-gray-500">收录国内外主流桨板品牌，了解品牌故事和定位</p>
      </div>

      <Suspense>
        <FilterBar filters={filters} />
      </Suspense>

      {brands.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {brands.map((brand) => (
            <div key={brand.brand_id} className="relative group">
              <Link
                href={`/brands/${brand.slug}`}
                className="block bg-cream-50 rounded-xl shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden border border-cream-200 hover:border-brown-500"
              >
                <div className="h-32 bg-cream-100 flex items-center justify-center p-4">
                  {brand.logo ? (
                    <img src={brand.logo} alt={brand.name} className="max-h-full max-w-full object-contain" />
                  ) : (
                    <span className="text-3xl text-cream-300 font-display">{brand.name.slice(0, 2)}</span>
                  )}
                </div>
                <div className="p-4">
                  <h3 className="text-lg font-semibold text-brown-800 group-hover:text-brown-500 transition-colors">
                    {brand.name}
                  </h3>
                  {brand.name_en && brand.name_en !== brand.name && (
                    <p className="text-sm text-warm-gray-400">{brand.name_en}</p>
                  )}
                  <div className="mt-3 flex items-center justify-end">
                    <span className="text-sm text-warm-gray-400">{brand.product_count} 款产品</span>
                  </div>
                  {brand.country && (
                    <div className="mt-2 text-sm text-warm-gray-400">{brand.country}</div>
                  )}
                  {brand.website && (
                    <div className="mt-2 h-5" />
                  )}
                </div>
              </Link>
              {brand.website && (
                <a
                  href={brand.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="absolute bottom-4 left-4 flex items-center gap-1.5 text-xs text-warm-gray-400 hover:text-brown-500 transition-colors z-10"
                >
                  <svg width="11" height="11" viewBox="0 0 14 14" fill="none" className="shrink-0">
                    <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.3"/>
                    <path d="M7 1C7 1 4.5 4 4.5 7s2.5 6 2.5 6M7 1c0 0 2.5 3 2.5 6S7 13 7 13M1 7h12" stroke="currentColor" strokeWidth="1.3"/>
                  </svg>
                  <span className="truncate max-w-[140px]">{brand.website.replace(/^https?:\/\//, '')}</span>
                  <svg width="9" height="9" viewBox="0 0 10 10" fill="none" className="shrink-0 opacity-50">
                    <path d="M2 8L8 2M4 2h4v4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                  </svg>
                </a>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-16">
          <p className="text-warm-gray-500">暂无符合条件的品牌</p>
        </div>
      )}
    </div>
  );
}
