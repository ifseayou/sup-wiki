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
    if (status) { conditions.push('p.status = ?'); params.push(status); }
    if (search) { conditions.push('(p.model LIKE ? OR b.name LIKE ?)'); params.push(`%${search}%`, `%${search}%`); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [countRows] = await pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) as total FROM sup_products p JOIN sup_brands b ON p.brand_id = b.brand_id ${where}`, params
    );
    const total = (countRows[0] as { total: number }).total;

    const [products] = await pool.execute<RowDataPacket[]>(
      `SELECT p.*, b.name as brand_name
       FROM sup_products p JOIN sup_brands b ON p.brand_id = b.brand_id ${where}
       ORDER BY CASE p.status WHEN 'published' THEN 0 ELSE 1 END, p.updated_at DESC LIMIT ${pageSize} OFFSET ${offset}`,
      params
    );
    return NextResponse.json({ items: products, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
  } catch (error) {
    console.error('获取产品列表失败:', error);
    return NextResponse.json({ error: '获取产品列表失败' }, { status: 500 });
  }
});

export const POST = withAdmin(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const { brand_id, model, type, length_cm, width_cm, thickness_cm, weight_kg, material, max_load_kg, suitable_for, price_min, price_max, buy_links, images, description, status = 'draft' } = body;
    if (!brand_id || !model) return NextResponse.json({ error: '缺少必填字段: brand_id, model' }, { status: 400 });

    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO sup_products (brand_id, model, type, length_cm, width_cm, thickness_cm, weight_kg, material, max_load_kg, suitable_for, price_min, price_max, buy_links, images, description, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [brand_id, model, type || 'allround', length_cm || null, width_cm || null, thickness_cm || null, weight_kg || null, material || null, max_load_kg || null, suitable_for || 'beginner', price_min || null, price_max || null, buy_links ? JSON.stringify(buy_links) : null, images ? JSON.stringify(images) : null, description || null, status]
    );
    return NextResponse.json({ success: true, product_id: result.insertId }, { status: 201 });
  } catch (error) {
    console.error('创建产品失败:', error);
    return NextResponse.json({ error: '创建产品失败' }, { status: 500 });
  }
});
