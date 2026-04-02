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
    if (status) { conditions.push('b.status = ?'); params.push(status); }
    if (search) { conditions.push('(b.name LIKE ? OR b.name_en LIKE ?)'); params.push(`%${search}%`, `%${search}%`); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [countRows] = await pool.execute<RowDataPacket[]>(`SELECT COUNT(*) as total FROM sup_brands b ${where}`, params);
    const total = (countRows[0] as { total: number }).total;

    const [brands] = await pool.execute<RowDataPacket[]>(
      `SELECT b.*, COUNT(p.product_id) as product_count FROM sup_brands b LEFT JOIN sup_products p ON b.brand_id = p.brand_id ${where} GROUP BY b.brand_id ORDER BY b.updated_at DESC LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    );
    return NextResponse.json({ items: brands, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
  } catch (error) {
    console.error('获取品牌列表失败:', error);
    return NextResponse.json({ error: '获取品牌列表失败' }, { status: 500 });
  }
});

export const POST = withAdmin(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const { slug, name, name_en, logo, country, website, description, tier, status = 'draft' } = body;
    if (!slug || !name) return NextResponse.json({ error: '缺少必填字段: slug, name' }, { status: 400 });

    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO sup_brands (slug, name, name_en, logo, country, website, description, tier, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [slug, name, name_en || null, logo || null, country || null, website || null, description || null, tier || 'entry', status]
    );
    return NextResponse.json({ success: true, brand_id: result.insertId }, { status: 201 });
  } catch (error) {
    console.error('创建品牌失败:', error);
    return NextResponse.json({ error: '创建品牌失败' }, { status: 500 });
  }
});
