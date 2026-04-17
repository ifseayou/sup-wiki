/**
 * 产品列表 API
 * GET /api/products - 获取产品列表（支持分页、筛选）
 */
import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import type { RowDataPacket } from 'mysql2';
import type { Product, ProductType, SuitableFor, PaginatedResponse } from '@/types';

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
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');
    const brand_id = searchParams.get('brand_id');
    const type = searchParams.get('type') as ProductType | null;
    const suitable_for = searchParams.get('suitable_for') as SuitableFor | null;
    const price_min = searchParams.get('price_min');
    const price_max = searchParams.get('price_max');
    const search = searchParams.get('search');
    const sort = searchParams.get('sort') || 'newest'; // newest, price_asc, price_desc

    const offset = (page - 1) * pageSize;
    const conditions: string[] = ['p.status = "published"'];
    const params: (string | number)[] = [];

    if (brand_id) {
      conditions.push('p.brand_id = ?');
      params.push(parseInt(brand_id));
    }

    if (type) {
      conditions.push('p.type = ?');
      params.push(type);
    }

    if (suitable_for) {
      conditions.push('p.suitable_for = ?');
      params.push(suitable_for);
    }

    if (price_min) {
      conditions.push('p.price_min >= ?');
      params.push(parseInt(price_min));
    }

    if (price_max) {
      conditions.push('p.price_max <= ?');
      params.push(parseInt(price_max));
    }

    if (search) {
      conditions.push('(p.model LIKE ? OR b.name LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // 排序
    let orderBy = 'p.created_at DESC';
    if (sort === 'price_asc') {
      orderBy = 'p.price_min ASC';
    } else if (sort === 'price_desc') {
      orderBy = 'p.price_min DESC';
    }

    // 获取总数
    const [countResult] = await pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) as total
       FROM sup_products p
       JOIN sup_brands b ON p.brand_id = b.brand_id
       ${whereClause}`,
      params
    );
    const total = countResult[0].total;

    // 获取产品列表（含品牌信息）
    const [products] = await pool.execute<ProductRow[]>(
      `SELECT p.*, b.name as brand_name, b.slug as brand_slug, b.logo as brand_logo
       FROM sup_products p
       JOIN sup_brands b ON p.brand_id = b.brand_id
       ${whereClause}
       ORDER BY ${orderBy}
       LIMIT ${pageSize} OFFSET ${offset}`,
      params
    );

    const parseArr = (v: unknown) => Array.isArray(v) ? v : (v ? JSON.parse(String(v)) : []);
    const parsedProducts = products.map((p) => ({
      ...p,
      buy_links: parseArr(p.buy_links),
      images: parseArr(p.images),
      brand: {
        brand_id: p.brand_id,
        name: p.brand_name,
        slug: p.brand_slug,
        logo: p.brand_logo,
      },
    }));

    const response: PaginatedResponse<Product> = {
      items: parsedProducts as unknown as Product[],
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('获取产品列表失败:', error);
    return NextResponse.json(
      { error: '获取产品列表失败' },
      { status: 500 }
    );
  }
}
