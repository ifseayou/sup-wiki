/**
 * 品牌详情 API
 * GET /api/brands/[slug] - 获取品牌详情
 */
import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import type { RowDataPacket } from 'mysql2';
import type { Brand, Product } from '@/types';

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
  created_at: string;
  updated_at: string;
}

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
  created_at: string;
  updated_at: string;
}

interface BrandDetail extends Brand {
  products: Product[];
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    // 获取品牌信息
    const [brands] = await pool.execute<BrandRow[]>(
      "SELECT * FROM sup_brands WHERE slug = ? AND status = 'published'",
      [slug]
    );

    if (brands.length === 0) {
      return NextResponse.json(
        { error: '品牌不存在' },
        { status: 404 }
      );
    }

    const brand = brands[0];

    // 获取该品牌的所有产品
    const [products] = await pool.execute<ProductRow[]>(
      `SELECT * FROM sup_products WHERE brand_id = ? AND status = 'published' ORDER BY created_at DESC`,
      [brand.brand_id]
    );

    // 解析 JSON 字段
    const parsedProducts = products.map((p) => ({
      ...p,
      buy_links: p.buy_links ? JSON.parse(p.buy_links) : [],
      images: p.images ? JSON.parse(p.images) : [],
    }));

    const result: BrandDetail = {
      ...(brand as unknown as Brand),
      products: parsedProducts as unknown as Product[],
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error('获取品牌详情失败:', error);
    return NextResponse.json(
      { error: '获取品牌详情失败' },
      { status: 500 }
    );
  }
}
