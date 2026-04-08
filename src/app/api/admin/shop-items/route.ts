import { NextRequest, NextResponse } from 'next/server';
import { withAdmin } from '@/lib/admin';
import pool from '@/lib/db';
import type { RowDataPacket, ResultSetHeader } from 'mysql2';

export const GET = withAdmin(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');
    const offset = (page - 1) * pageSize;

    const conditions: string[] = [];
    const params: (string | number)[] = [];
    if (status) { conditions.push('s.status = ?'); params.push(status); }
    if (search) { conditions.push('(s.name LIKE ? OR s.subtitle LIKE ?)'); params.push(`%${search}%`, `%${search}%`); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [countRows] = await pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) as total FROM sup_shop_items s ${where}`, params
    );
    const total = (countRows[0] as { total: number }).total;

    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT s.*, b.name as brand_name
       FROM sup_shop_items s
       LEFT JOIN sup_brands b ON s.brand_id = b.brand_id
       ${where}
       ORDER BY CASE s.status WHEN 'published' THEN 0 ELSE 1 END, s.sort_order DESC, s.updated_at DESC LIMIT ${pageSize} OFFSET ${offset}`,
      params
    );

    return NextResponse.json({ items: rows, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
  } catch (error) {
    console.error('获取商城商品列表失败:', error);
    return NextResponse.json({ error: '获取商城商品列表失败' }, { status: 500 });
  }
});

export const POST = withAdmin(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const {
      category, board_type, brand_id, product_id, name, slug,
      subtitle, description, highlights, cost_price, market_price, discount_price,
      stock_status = 'in_stock', images, videos, spec, status = 'draft', sort_order = 0,
    } = body;

    if (!category || !name || !slug) {
      return NextResponse.json({ error: '缺少必填字段: category, name, slug' }, { status: 400 });
    }

    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO sup_shop_items
        (category, board_type, brand_id, product_id, name, slug, subtitle, description,
         highlights, cost_price, market_price, discount_price, stock_status, images, videos, spec, status, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        category,
        board_type || null,
        brand_id || null,
        product_id || null,
        name,
        slug,
        subtitle || null,
        description || null,
        highlights ? JSON.stringify(highlights) : null,
        cost_price || null,
        market_price || null,
        discount_price || null,
        stock_status,
        images ? JSON.stringify(images) : null,
        videos ? JSON.stringify(videos) : null,
        spec ? JSON.stringify(spec) : null,
        status,
        sort_order,
      ]
    );

    return NextResponse.json({ success: true, shop_item_id: result.insertId }, { status: 201 });
  } catch (error) {
    console.error('创建商城商品失败:', error);
    return NextResponse.json({ error: '创建商城商品失败' }, { status: 500 });
  }
});
