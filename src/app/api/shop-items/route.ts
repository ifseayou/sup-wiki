import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import type { RowDataPacket } from 'mysql2';

function parseJson(v: unknown): unknown[] {
  if (Array.isArray(v)) return v;
  if (v) return JSON.parse(String(v));
  return [];
}

function parseJsonObj(v: unknown): Record<string, unknown> {
  if (v && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, unknown>;
  if (v) return JSON.parse(String(v));
  return {};
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const board_type = searchParams.get('board_type');
    const brand_id = searchParams.get('brand_id');
    const search = searchParams.get('search');
    const sort = searchParams.get('sort') || 'sort_order';
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');
    const offset = (page - 1) * pageSize;

    const conditions: string[] = ["s.status = 'published'"];
    const params: (string | number)[] = [];

    if (category) { conditions.push('s.category = ?'); params.push(category); }
    if (board_type) { conditions.push('s.board_type = ?'); params.push(board_type); }
    if (brand_id) { conditions.push('s.brand_id = ?'); params.push(Number(brand_id)); }
    if (search) { conditions.push('(s.name LIKE ? OR s.subtitle LIKE ?)'); params.push(`%${search}%`, `%${search}%`); }

    const where = `WHERE ${conditions.join(' AND ')}`;
    const orderBy = sort === 'price_asc' ? 's.discount_price ASC' : sort === 'price_desc' ? 's.discount_price DESC' : 's.sort_order DESC, s.created_at DESC';

    const [countRows] = await pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) as total FROM sup_shop_items s ${where}`, params
    );
    const total = (countRows[0] as { total: number }).total;

    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT s.*, b.name as brand_name, b.slug as brand_slug
       FROM sup_shop_items s
       LEFT JOIN sup_brands b ON s.brand_id = b.brand_id
       ${where}
       ORDER BY ${orderBy} LIMIT ${pageSize} OFFSET ${offset}`,
      params
    );

    const items = (rows as RowDataPacket[]).map(r => ({
      ...r,
      images: parseJson(r.images),
      variants: parseJson(r.variants),
      videos: parseJson(r.videos),
      highlights: parseJson(r.highlights),
      spec: parseJsonObj(r.spec),
    }));

    return NextResponse.json({ items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
  } catch (error) {
    console.error('获取商城商品列表失败:', error);
    return NextResponse.json({ error: '获取商城商品列表失败' }, { status: 500 });
  }
}
