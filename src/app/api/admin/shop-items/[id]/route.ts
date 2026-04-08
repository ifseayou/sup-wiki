import { NextRequest, NextResponse } from 'next/server';
import { withAdmin } from '@/lib/admin';
import pool from '@/lib/db';
import type { ResultSetHeader } from 'mysql2';

export const PUT = withAdmin(async (request: NextRequest, _ctx) => {
  try {
    const url = new URL(request.url);
    const id = url.pathname.split('/').at(-1);
    const body = await request.json();

    const allowed = ['category', 'board_type', 'brand_id', 'product_id', 'name', 'slug', 'subtitle', 'description', 'cost_price', 'market_price', 'discount_price', 'stock_status', 'status', 'sort_order'];
    const jsonFields = ['highlights', 'images', 'videos', 'spec'];

    const fields: string[] = [];
    const values: (string | number | null)[] = [];

    for (const f of allowed) {
      if (body[f] !== undefined) {
        fields.push(`${f} = ?`);
        values.push(body[f] === '' ? null : body[f]);
      }
    }
    for (const f of jsonFields) {
      if (body[f] !== undefined) {
        fields.push(`${f} = ?`);
        values.push(body[f] !== null ? JSON.stringify(body[f]) : null);
      }
    }

    if (fields.length === 0) return NextResponse.json({ error: '没有要更新的字段' }, { status: 400 });
    values.push(Number(id));

    const [result] = await pool.execute<ResultSetHeader>(
      `UPDATE sup_shop_items SET ${fields.join(', ')} WHERE shop_item_id = ?`,
      values
    );

    if (result.affectedRows === 0) return NextResponse.json({ error: '商品不存在' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('更新商城商品失败:', error);
    return NextResponse.json({ error: '更新商城商品失败' }, { status: 500 });
  }
});

export const DELETE = withAdmin(async (request: NextRequest, _ctx) => {
  try {
    const url = new URL(request.url);
    const id = url.pathname.split('/').at(-1);
    const [result] = await pool.execute<ResultSetHeader>(
      'DELETE FROM sup_shop_items WHERE shop_item_id = ?',
      [Number(id)]
    );
    if (result.affectedRows === 0) return NextResponse.json({ error: '商品不存在' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('删除商城商品失败:', error);
    return NextResponse.json({ error: '删除商城商品失败' }, { status: 500 });
  }
});
