import Link from 'next/link';
import pool from '@/lib/db';
import type { RowDataPacket } from 'mysql2';

interface ProductRow extends RowDataPacket {
  product_id: number;
  brand_id: number;
  model: string;
  type: string;
  suitable_for: string;
  price_min: number | null;
  price_max: number | null;
  images: string | null;
  brand_name: string;
  brand_slug: string;
}

const typeLabels: Record<string, string> = {
  inflatable: '充气板',
  hardboard: '硬板',
  race: '竞速板',
  allround: '全能板',
  yoga: '瑜伽板',
  touring: '巡游板',
};

const suitableLabels: Record<string, string> = {
  beginner: '新手',
  intermediate: '进阶',
  advanced: '高级',
};

async function getProducts() {
  try {
    const [products] = await pool.execute<ProductRow[]>(
      `SELECT p.*, b.name as brand_name, b.slug as brand_slug
       FROM sup_products p
       JOIN sup_brands b ON p.brand_id = b.brand_id
       ORDER BY p.created_at DESC`
    );
    return products;
  } catch (error) {
    console.error('获取产品列表失败:', error);
    return [];
  }
}

export default async function ProductsPage() {
  const products = await getProducts();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">产品库</h1>
        <p className="text-gray-600">详细产品参数、价格对比，找到最适合你的板子</p>
      </div>

      {/* Filters */}
      <div className="mb-8 flex flex-wrap gap-4">
        <select className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
          <option value="">全部类型</option>
          <option value="inflatable">充气板</option>
          <option value="hardboard">硬板</option>
          <option value="race">竞速板</option>
          <option value="allround">全能板</option>
          <option value="yoga">瑜伽板</option>
          <option value="touring">巡游板</option>
        </select>
        <select className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
          <option value="">适合人群</option>
          <option value="beginner">新手</option>
          <option value="intermediate">进阶</option>
          <option value="advanced">高级</option>
        </select>
        <select className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
          <option value="">价格排序</option>
          <option value="price_asc">价格从低到高</option>
          <option value="price_desc">价格从高到低</option>
        </select>
      </div>

      {/* Products Grid */}
      {products.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {products.map((product) => {
            const images = product.images ? JSON.parse(product.images) : [];
            return (
              <Link
                key={product.product_id}
                href={`/products/${product.product_id}`}
                className="bg-white rounded-xl shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden border border-gray-100 group"
              >
                {/* Image */}
                <div className="h-48 bg-gray-50 flex items-center justify-center">
                  {images.length > 0 ? (
                    <img
                      src={images[0]}
                      alt={product.model}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-4xl text-gray-300">🏄</span>
                  )}
                </div>

                {/* Info */}
                <div className="p-4">
                  <Link
                    href={`/brands/${product.brand_slug}`}
                    className="text-sm text-gray-500 hover:text-blue-600"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {product.brand_name}
                  </Link>
                  <h3 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600 transition-colors mt-1">
                    {product.model}
                  </h3>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="text-xs px-2 py-1 bg-cyan-100 text-cyan-800 rounded">
                      {typeLabels[product.type] || product.type}
                    </span>
                    <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded">
                      {suitableLabels[product.suitable_for] || product.suitable_for}
                    </span>
                  </div>

                  {product.price_min && (
                    <div className="mt-3 text-orange-600 font-semibold">
                      ¥{product.price_min.toLocaleString()}
                      {product.price_max && product.price_max !== product.price_min && (
                        <span className="text-sm font-normal text-gray-500">
                          {' '}- ¥{product.price_max.toLocaleString()}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-16">
          <span className="text-6xl mb-4 block">🏄</span>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">暂无产品数据</h3>
          <p className="text-gray-600 mb-4">成为第一个贡献产品信息的人吧！</p>
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
