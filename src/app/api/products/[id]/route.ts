/**
 * 产品详情 API
 * GET /api/products/[id] - 获取产品详情
 */
import { NextRequest, NextResponse } from 'next/server';
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
  created_at: string;
  updated_at: string;
  brand_name: string;
  brand_slug: string;
  brand_logo: string | null;
  brand_country: string | null;
  brand_tier: string;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const productId = parseInt(id);

    if (isNaN(productId)) {
      return NextResponse.json(
        { error: '无效的产品 ID' },
        { status: 400 }
      );
    }

    // 获取产品详情（含品牌信息）
    const [products] = await pool.execute<ProductRow[]>(
      `SELECT p.*,
              b.name as brand_name,
              b.slug as brand_slug,
              b.logo as brand_logo,
              b.country as brand_country,
              b.tier as brand_tier
       FROM sup_products p
       JOIN sup_brands b ON p.brand_id = b.brand_id
       WHERE p.product_id = ? AND p.status = 'published'`,
      [productId]
    );

    if (products.length === 0) {
      return NextResponse.json(
        { error: '产品不存在' },
        { status: 404 }
      );
    }

    const product = products[0];

    // 解析 JSON 字段
    const result = {
      ...product,
      buy_links: product.buy_links ? JSON.parse(product.buy_links) : [],
      images: product.images ? JSON.parse(product.images) : [],
      brand: {
        brand_id: product.brand_id,
        name: product.brand_name,
        slug: product.brand_slug,
        logo: product.brand_logo,
        country: product.brand_country,
        tier: product.brand_tier,
      },
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error('获取产品详情失败:', error);
    return NextResponse.json(
      { error: '获取产品详情失败' },
      { status: 500 }
    );
  }
}
