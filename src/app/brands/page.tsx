import pool from '@/lib/db';
import type { RowDataPacket } from 'mysql2';
import BrandsLibraryClient, { type BrandLibraryItem } from '@/components/BrandsLibraryClient';

export const dynamic = 'force-dynamic';

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
  product_count: number;
  product_types: string | null;
  min_price: number | null;
  max_price: number | null;
}

async function getBrands() {
  try {
    const [brands] = await pool.execute<BrandRow[]>(
      `SELECT
         b.brand_id, b.slug, b.name, b.name_en, b.logo, b.country, b.website, b.description, b.tier,
         COUNT(DISTINCT p.product_id) AS product_count,
         GROUP_CONCAT(DISTINCT p.type ORDER BY p.type SEPARATOR ',') AS product_types,
         MIN(p.price_min) AS min_price,
         MAX(COALESCE(p.price_max, p.price_min)) AS max_price
       FROM sup_brands b
       LEFT JOIN sup_products p ON b.brand_id = p.brand_id AND p.status = 'published'
       WHERE b.status = 'published'
       GROUP BY b.brand_id
       ORDER BY product_count DESC, b.name ASC`
    );

    return brands.map((brand) => ({
      brand_id: Number(brand.brand_id),
      slug: brand.slug,
      name: brand.name,
      name_en: brand.name_en,
      logo: brand.logo,
      country: brand.country,
      website: brand.website,
      description: brand.description,
      tier: brand.tier,
      product_count: Number(brand.product_count || 0),
      product_types: brand.product_types ? brand.product_types.split(',').filter(Boolean) : [],
      min_price: brand.min_price === null ? null : Number(brand.min_price),
      max_price: brand.max_price === null ? null : Number(brand.max_price),
    })) satisfies BrandLibraryItem[];
  } catch (error) {
    console.error('获取品牌列表失败:', error);
    return [];
  }
}

export default async function BrandsPage({
  searchParams,
}: {
  searchParams: Promise<{ tier?: string; country?: string }>;
}) {
  const [{ tier, country }, brands] = await Promise.all([searchParams, getBrands()]);

  return (
    <BrandsLibraryClient
      brands={brands}
      initialTier={tier || ''}
      initialCountry={country === 'all' ? '' : (country || '')}
    />
  );
}
