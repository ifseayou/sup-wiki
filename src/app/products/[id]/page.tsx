import Link from 'next/link';
import { notFound } from 'next/navigation';
import pool from '@/lib/db';
import type { RowDataPacket } from 'mysql2';

interface ProductRow extends RowDataPacket {
  product_id: number;
  brand_id: number;
  model: string;
  type: string;
  length_cm: number | null;
  width_cm: number | null;
  thickness_cm: number | null;
  weight_kg: number | null;
  material: string | null;
  max_load_kg: number | null;
  suitable_for: string;
  price_min: number | null;
  price_max: number | null;
  buy_links: string | null;
  images: string | null;
  description: string | null;
  brand_name: string;
  brand_slug: string;
  brand_logo: string | null;
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
  beginner: '新手入门',
  intermediate: '进阶玩家',
  advanced: '高级玩家',
};

async function getProduct(id: number) {
  try {
    const [products] = await pool.execute<ProductRow[]>(
      `SELECT p.*, b.name as brand_name, b.slug as brand_slug, b.logo as brand_logo
       FROM sup_products p
       JOIN sup_brands b ON p.brand_id = b.brand_id
       WHERE p.product_id = ?`,
      [id]
    );
    if (products.length === 0) return null;
    return products[0];
  } catch (error) {
    console.error('获取产品详情失败:', error);
    return null;
  }
}

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const productId = parseInt(id);

  if (isNaN(productId)) {
    notFound();
  }

  const product = await getProduct(productId);

  if (!product) {
    notFound();
  }

  const images = product.images ? JSON.parse(product.images) : [];
  const buyLinks = product.buy_links ? JSON.parse(product.buy_links) : [];

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
            <Link href="/products" className="text-gray-500 hover:text-gray-700">产品</Link>
          </li>
          <li className="text-gray-400">/</li>
          <li className="text-gray-900">{product.model}</li>
        </ol>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        {/* Images */}
        <div>
          <div className="bg-gray-100 rounded-2xl aspect-square flex items-center justify-center overflow-hidden">
            {images.length > 0 ? (
              <img
                src={images[0]}
                alt={product.model}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-8xl text-gray-300">🏄</span>
            )}
          </div>
          {images.length > 1 && (
            <div className="mt-4 grid grid-cols-4 gap-2">
              {images.slice(1, 5).map((img: string, idx: number) => (
                <div key={idx} className="aspect-square bg-gray-100 rounded-lg overflow-hidden">
                  <img src={img} alt="" className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Info */}
        <div>
          {/* Brand */}
          <Link
            href={`/brands/${product.brand_slug}`}
            className="inline-flex items-center gap-2 text-gray-600 hover:text-blue-600 mb-2"
          >
            {product.brand_logo && (
              <img src={product.brand_logo} alt="" className="w-6 h-6 object-contain" />
            )}
            {product.brand_name}
          </Link>

          {/* Model */}
          <h1 className="text-3xl font-bold text-gray-900 mb-4">{product.model}</h1>

          {/* Tags */}
          <div className="flex flex-wrap gap-2 mb-6">
            <span className="px-3 py-1 bg-cyan-100 text-cyan-800 rounded-full text-sm">
              {typeLabels[product.type] || product.type}
            </span>
            <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-sm">
              {suitableLabels[product.suitable_for] || product.suitable_for}
            </span>
          </div>

          {/* Price */}
          {product.price_min && (
            <div className="mb-6">
              <span className="text-3xl font-bold text-orange-600">
                ¥{product.price_min.toLocaleString()}
              </span>
              {product.price_max && product.price_max !== product.price_min && (
                <span className="text-xl text-gray-500">
                  {' '}- ¥{product.price_max.toLocaleString()}
                </span>
              )}
            </div>
          )}

          {/* Specs */}
          <div className="bg-gray-50 rounded-xl p-6 mb-6">
            <h3 className="font-semibold text-gray-900 mb-4">规格参数</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              {product.length_cm && (
                <div>
                  <span className="text-gray-500">长度</span>
                  <span className="ml-2 text-gray-900">{product.length_cm} cm</span>
                </div>
              )}
              {product.width_cm && (
                <div>
                  <span className="text-gray-500">宽度</span>
                  <span className="ml-2 text-gray-900">{product.width_cm} cm</span>
                </div>
              )}
              {product.thickness_cm && (
                <div>
                  <span className="text-gray-500">厚度</span>
                  <span className="ml-2 text-gray-900">{product.thickness_cm} cm</span>
                </div>
              )}
              {product.weight_kg && (
                <div>
                  <span className="text-gray-500">重量</span>
                  <span className="ml-2 text-gray-900">{product.weight_kg} kg</span>
                </div>
              )}
              {product.max_load_kg && (
                <div>
                  <span className="text-gray-500">承重</span>
                  <span className="ml-2 text-gray-900">{product.max_load_kg} kg</span>
                </div>
              )}
              {product.material && (
                <div className="col-span-2">
                  <span className="text-gray-500">材质</span>
                  <span className="ml-2 text-gray-900">{product.material}</span>
                </div>
              )}
            </div>
          </div>

          {/* Buy Links */}
          {buyLinks.length > 0 && (
            <div className="mb-6">
              <h3 className="font-semibold text-gray-900 mb-3">购买渠道</h3>
              <div className="flex flex-wrap gap-3">
                {buyLinks.map((link: { platform: string; url: string }, idx: number) => (
                  <a
                    key={idx}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 bg-white border border-gray-200 rounded-lg hover:border-blue-500 hover:text-blue-600 transition-colors"
                  >
                    {link.platform}
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Description */}
          {product.description && (
            <div>
              <h3 className="font-semibold text-gray-900 mb-3">产品介绍</h3>
              <p className="text-gray-700 leading-relaxed">{product.description}</p>
            </div>
          )}
        </div>
      </div>

      {/* Contribute Button */}
      <div className="fixed bottom-8 right-8">
        <Link
          href={`/contribute?type=product&entity_id=${product.product_id}`}
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
