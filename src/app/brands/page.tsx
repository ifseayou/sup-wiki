import Link from 'next/link';
import pool from '@/lib/db';
import type { RowDataPacket } from 'mysql2';

interface BrandRow extends RowDataPacket {
  brand_id: number;
  slug: string;
  name: string;
  name_en: string | null;
  logo: string | null;
  country: string | null;
  tier: string;
  product_count: number;
}

const tierLabels: Record<string, string> = {
  entry: '入门级',
  intermediate: '进阶级',
  pro: '专业级',
};

const tierColors: Record<string, string> = {
  entry: 'bg-green-100 text-green-800',
  intermediate: 'bg-blue-100 text-blue-800',
  pro: 'bg-purple-100 text-purple-800',
};

async function getBrands() {
  try {
    const [brands] = await pool.execute<BrandRow[]>(
      `SELECT b.*, COUNT(p.product_id) as product_count
       FROM sup_brands b
       LEFT JOIN sup_products p ON b.brand_id = p.brand_id
       GROUP BY b.brand_id
       ORDER BY b.name ASC`
    );
    return brands;
  } catch (error) {
    console.error('获取品牌列表失败:', error);
    return [];
  }
}

export default async function BrandsPage() {
  const brands = await getBrands();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">品牌库</h1>
        <p className="text-gray-600">收录国内外主流桨板品牌，了解品牌故事和定位</p>
      </div>

      {/* Filters */}
      <div className="mb-8 flex flex-wrap gap-4">
        <select className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
          <option value="">全部定位</option>
          <option value="entry">入门级</option>
          <option value="intermediate">进阶级</option>
          <option value="pro">专业级</option>
        </select>
        <select className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
          <option value="">全部国家</option>
          <option value="中国">中国</option>
          <option value="英国">英国</option>
          <option value="美国">美国</option>
          <option value="德国">德国</option>
        </select>
      </div>

      {/* Brands Grid */}
      {brands.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {brands.map((brand) => (
            <Link
              key={brand.brand_id}
              href={`/brands/${brand.slug}`}
              className="group bg-white rounded-xl shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden border border-gray-100"
            >
              {/* Logo Area */}
              <div className="h-32 bg-gray-50 flex items-center justify-center p-4">
                {brand.logo ? (
                  <img
                    src={brand.logo}
                    alt={brand.name}
                    className="max-h-full max-w-full object-contain"
                  />
                ) : (
                  <span className="text-4xl text-gray-300">🏷️</span>
                )}
              </div>

              {/* Info */}
              <div className="p-4">
                <h3 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                  {brand.name}
                </h3>
                {brand.name_en && (
                  <p className="text-sm text-gray-500">{brand.name_en}</p>
                )}

                <div className="mt-3 flex items-center justify-between">
                  <span className={`text-xs px-2 py-1 rounded-full ${tierColors[brand.tier]}`}>
                    {tierLabels[brand.tier]}
                  </span>
                  <span className="text-sm text-gray-500">
                    {brand.product_count} 款产品
                  </span>
                </div>

                {brand.country && (
                  <div className="mt-2 text-sm text-gray-500">
                    📍 {brand.country}
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="text-center py-16">
          <span className="text-6xl mb-4 block">🏷️</span>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">暂无品牌数据</h3>
          <p className="text-gray-600 mb-4">成为第一个贡献品牌信息的人吧！</p>
          <Link
            href="/contribute"
            className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            贡献内容
          </Link>
        </div>
      )}
    </div>
  );
}
