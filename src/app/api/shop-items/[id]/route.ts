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
    const id = request.url.split('/').at(-1);
    // 支持通过 shop_item_id 或 slug 查询
    const isNumeric = /^\d+$/.test(id || '');
    const condition = isNumeric ? 's.shop_item_id = ?' : 's.slug = ?';
    const param: string | number = isNumeric ? Number(id) : (id || '');

    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT s.*, b.name as brand_name, b.slug as brand_slug
       FROM sup_shop_items s
       LEFT JOIN sup_brands b ON s.brand_id = b.brand_id
       WHERE ${condition} AND s.status = 'published'`,
      [param]
    );

    if (!rows.length) return NextResponse.json({ error: '商品不存在' }, { status: 404 });

    const r = rows[0];
    const item = {
      ...r,
      images: parseJson(r.images),
      videos: parseJson(r.videos),
      highlights: parseJson(r.highlights),
      spec: parseJsonObj(r.spec),
    };

    return NextResponse.json(item);
  } catch (error) {
    console.error('获取商品详情失败:', error);
    return NextResponse.json({ error: '获取商品详情失败' }, { status: 500 });
  }
}
