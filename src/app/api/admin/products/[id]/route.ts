import { NextRequest, NextResponse } from 'next/server';
import { withAdmin } from '@/lib/admin';
import pool from '@/lib/db';
import type { ResultSetHeader } from 'mysql2';

export const PUT = withAdmin(async (request: NextRequest, _ctx) => {
  try {
    const url = new URL(request.url);
    const id = url.pathname.split('/').at(-1);
    const body = await request.json();
    const allowed = ['brand_id','model','type','length_cm','width_cm','thickness_cm','weight_kg','material','max_load_kg','suitable_for','price_min','price_max','description','status'];
    const fields: string[] = [];
    const values: (string | number | null)[] = [];
    for (const f of allowed) {
      if (body[f] !== undefined) {
        fields.push(`${f} = ?`);
        values.push(body[f]);
      }
    }
    if (body.buy_links !== undefined) { fields.push('buy_links = ?'); values.push(JSON.stringify(body.buy_links)); }
    if (body.images !== undefined) { fields.push('images = ?'); values.push(JSON.stringify(body.images)); }
    if (fields.length === 0) return NextResponse.json({ error: '没有要更新的字段' }, { status: 400 });
    values.push(Number(id));
    const [result] = await pool.execute<ResultSetHeader>(`UPDATE sup_products SET ${fields.join(', ')} WHERE product_id = ?`, values);
    if (result.affectedRows === 0) return NextResponse.json({ error: '产品不存在' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('更新产品失败:', error);
    return NextResponse.json({ error: '更新产品失败' }, { status: 500 });
  }
});

export const DELETE = withAdmin(async (request: NextRequest, _ctx) => {
  try {
    const url = new URL(request.url);
    const id = url.pathname.split('/').at(-1);
    const [result] = await pool.execute<ResultSetHeader>('DELETE FROM sup_products WHERE product_id = ?', [Number(id)]);
    if (result.affectedRows === 0) return NextResponse.json({ error: '产品不存在' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('删除产品失败:', error);
    return NextResponse.json({ error: '删除产品失败' }, { status: 500 });
  }
});
