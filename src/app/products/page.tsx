import Link from 'next/link';
import { Suspense } from 'react';
import pool from '@/lib/db';
import type { RowDataPacket } from 'mysql2';
import FilterBar from '@/components/FilterBar';

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

async function getProducts(type?: string, suitable_for?: string, sort?: string) {
  try {
    const conditions: string[] = ["p.status = 'published'"];
    const params: (string | number)[] = [];

    if (type) { conditions.push('p.type = ?'); params.push(type); }
    if (suitable_for) { conditions.push('p.suitable_for = ?'); params.push(suitable_for); }

    const where = `WHERE ${conditions.join(' AND ')}`;

    let orderBy = 'p.created_at DESC';
    if (sort === 'price_asc') orderBy = 'p.price_min ASC';
    if (sort === 'price_desc') orderBy = 'p.price_min DESC';

    const [products] = await pool.execute<ProductRow[]>(
      `SELECT p.*, b.name as brand_name, b.slug as brand_slug
       FROM sup_products p
       JOIN sup_brands b ON p.brand_id = b.brand_id AND b.status = 'published'
       ${where}
       ORDER BY ${orderBy}`,
      params
    );
    return products;
  } catch (error) {
    console.error('获取产品列表失败:', error);
    return [];
  }
}

const filters = [
  {
    key: 'type',
    placeholder: '全部类型',
    options: [
      { label: '充气板', value: 'inflatable' },
      { label: '硬板', value: 'hardboard' },
      { label: '竞速板', value: 'race' },
      { label: '全能板', value: 'allround' },
      { label: '瑜伽板', value: 'yoga' },
      { label: '巡游板', value: 'touring' },
    ],
  },
  {
    key: 'suitable_for',
    placeholder: '适合人群',
    options: [
      { label: '新手', value: 'beginner' },
      { label: '进阶', value: 'intermediate' },
      { label: '高级', value: 'advanced' },
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

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; suitable_for?: string; sort?: string }>;
}) {
  const { type, suitable_for, sort } = await searchParams;
  const products = await getProducts(type, suitable_for, sort);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-brown-800 mb-2">产品库</h1>
        <p className="text-warm-gray-500">详细产品参数、价格对比，找到最适合你的板子</p>
      </div>

      <Suspense>
        <FilterBar filters={filters} />
      </Suspense>

      {products.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {products.map((product) => {
            const images = Array.isArray(product.images)
              ? product.images
              : (Array.isArray(product.images) ? product.images : (product.images ? JSON.parse(product.images) : []));
            return (
              <Link
                key={product.product_id}
                href={`/products/${product.product_id}`}
                className="bg-cream-50 rounded-xl shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden border border-cream-200 group"
              >
                <div className="h-48 bg-cream-100 flex items-center justify-center">
                  {images.length > 0 ? (
                    <img src={images[0]} alt={product.model} className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-4xl text-cream-300">—</span>
                  )}
                </div>
                <div className="p-4">
                  <span className="text-sm text-warm-gray-400">{product.brand_name}</span>
                  <h3 className="text-lg font-semibold text-brown-800 group-hover:text-brown-500 transition-colors mt-1">
                    {product.model}
                  </h3>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="text-xs px-2 py-1 bg-cream-200 text-brown-600 rounded">
                      {typeLabels[product.type] || product.type}
                    </span>
                    <span className="text-xs px-2 py-1 bg-cream-200 text-warm-gray-500 rounded">
                      {suitableLabels[product.suitable_for] || product.suitable_for}
                    </span>
                  </div>
                  {product.price_min && (
                    <div className="mt-3 text-brown-500 font-semibold">
                      ¥{product.price_min.toLocaleString()}
                      {product.price_max && product.price_max !== product.price_min && (
                        <span className="text-sm font-normal text-warm-gray-400">
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
          <p className="text-warm-gray-500">暂无符合条件的产品</p>
        </div>
      )}
    </div>
  );
}
