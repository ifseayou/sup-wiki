import Link from 'next/link';
import { notFound } from 'next/navigation';
import pool from '@/lib/db';
import type { RowDataPacket } from 'mysql2';

interface BrandRow extends RowDataPacket {
  brand_id: number;
  slug: string;
  name: string;
  name_en: string | null;
  logo: string | null;
  country: string | null;
  website: string | null;
  description: string | null;
  tier: string;
}

interface ProductRow extends RowDataPacket {
  product_id: number;
  model: string;
  type: string;
  price_min: number | null;
  price_max: number | null;
  images: string | null;
}

const tierLabels: Record<string, string> = {
  entry: '入门级',
  intermediate: '进阶级',
  pro: '专业级',
};

const typeLabels: Record<string, string> = {
  inflatable: '充气板',
  hardboard: '硬板',
  race: '竞速板',
  allround: '全能板',
  yoga: '瑜伽板',
  touring: '巡游板',
};

async function getBrand(slug: string) {
  try {
    const [brands] = await pool.execute<BrandRow[]>(
      'SELECT * FROM sup_brands WHERE slug = ?',
      [slug]
    );
    if (brands.length === 0) return null;
    return brands[0];
  } catch (error) {
    console.error('获取品牌详情失败:', error);
    return null;
  }
}

async function getProducts(brandId: number) {
  try {
    const [products] = await pool.execute<ProductRow[]>(
      'SELECT * FROM sup_products WHERE brand_id = ? ORDER BY created_at DESC',
      [brandId]
    );
    return products;
  } catch (error) {
    console.error('获取产品列表失败:', error);
    return [];
  }
}

export default async function BrandDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const brand = await getBrand(slug);

  if (!brand) {
    notFound();
  }

  const products = await getProducts(brand.brand_id);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Breadcrumb */}
      <nav className="mb-8 text-sm">
        <ol className="flex items-center space-x-2">
          <li>
            <Link href="/" className="text-gray-500 hover:text-gray-700">首页</Link>
          </li>
          <li className="text-gray-400">/</li>
          <li>
            <Link href="/brands" className="text-gray-500 hover:text-gray-700">品牌</Link>
          </li>
          <li className="text-gray-400">/</li>
          <li className="text-gray-900">{brand.name}</li>
        </ol>
      </nav>

      {/* Brand Header */}
      <div className="bg-white rounded-2xl shadow-sm p-8 mb-8">
        <div className="flex flex-col md:flex-row items-start gap-8">
          {/* Logo */}
          <div className="w-full md:w-48 h-48 bg-gray-50 rounded-xl flex items-center justify-center p-4">
            {brand.logo ? (
              <img
                src={brand.logo}
                alt={brand.name}
                className="max-h-full max-w-full object-contain"
              />
            ) : (
              <span className="text-6xl text-gray-300">🏷️</span>
            )}
          </div>

          {/* Info */}
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold text-gray-900">{brand.name}</h1>
              <span className={`text-sm px-3 py-1 rounded-full ${
                brand.tier === 'pro' ? 'bg-purple-100 text-purple-800' :
                brand.tier === 'intermediate' ? 'bg-blue-100 text-blue-800' :
                'bg-green-100 text-green-800'
              }`}>
                {tierLabels[brand.tier]}
              </span>
            </div>

            {brand.name_en && (
              <p className="text-lg text-gray-500 mb-4">{brand.name_en}</p>
            )}

            <div className="flex flex-wrap gap-4 mb-4 text-sm text-gray-600">
              {brand.country && (
                <span>📍 {brand.country}</span>
              )}
              {brand.website && (
                <a
                  href={brand.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  🌐 官网
                </a>
              )}
            </div>

            {brand.description && (
              <p className="text-gray-700 leading-relaxed">{brand.description}</p>
            )}
          </div>
        </div>
      </div>

      {/* Products Section */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">
            产品 ({products.length})
          </h2>
          <Link
            href={`/contribute?type=product&brand_id=${brand.brand_id}`}
            className="text-blue-600 hover:text-blue-700 text-sm"
          >
            + 添加产品
          </Link>
        </div>

        {products.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {products.map((product) => {
              const images = product.images ? JSON.parse(product.images) : [];
              return (
                <Link
                  key={product.product_id}
                  href={`/products/${product.product_id}`}
                  className="bg-white rounded-xl shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden border border-gray-100 group"
                >
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
                  <div className="p-4">
                    <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                      {product.model}
                    </h3>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded">
                        {typeLabels[product.type] || product.type}
                      </span>
                      {product.price_min && (
                        <span className="text-sm text-orange-600 font-medium">
                          ¥{product.price_min.toLocaleString()}
                          {product.price_max && product.price_max !== product.price_min && (
                            <span> - ¥{product.price_max.toLocaleString()}</span>
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="bg-gray-50 rounded-xl p-8 text-center">
            <span className="text-4xl mb-4 block">🏄</span>
            <p className="text-gray-600">暂无产品数据</p>
            <Link
              href={`/contribute?type=product&brand_id=${brand.brand_id}`}
              className="inline-block mt-4 text-blue-600 hover:text-blue-700"
            >
              添加第一款产品
            </Link>
          </div>
        )}
      </div>

      {/* Contribute Button */}
      <div className="fixed bottom-8 right-8">
        <Link
          href={`/contribute?type=brand&entity_id=${brand.brand_id}`}
          className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          贡献修正
        </Link>
      </div>
    </div>
  );
}
