import { NextRequest, NextResponse } from 'next/server';
import { withAdmin } from '@/lib/admin';
import pool from '@/lib/db';
import type { ResultSetHeader } from 'mysql2';

export const PUT = withAdmin(async (request: NextRequest, _ctx) => {
  try {
    const url = new URL(request.url);
    const id = url.pathname.split('/').at(-1);
    const body = await request.json();

    const allowed = ['slug', 'name', 'name_en', 'logo', 'country', 'website', 'description', 'tier', 'status'];
    const fields: string[] = [];
    const values: (string | number | null)[] = [];

    for (const field of allowed) {
      if (body[field] !== undefined) {
        fields.push(`${field} = ?`);
        values.push(body[field]);
      }
    }
    if (fields.length === 0) return NextResponse.json({ error: '没有要更新的字段' }, { status: 400 });
    values.push(Number(id));

    const [result] = await pool.execute<ResultSetHeader>(
      `UPDATE sup_brands SET ${fields.join(', ')} WHERE brand_id = ?`, values
    );
    if (result.affectedRows === 0) return NextResponse.json({ error: '品牌不存在' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('更新品牌失败:', error);
    return NextResponse.json({ error: '更新品牌失败' }, { status: 500 });
  }
});

export const DELETE = withAdmin(async (request: NextRequest, _ctx) => {
  try {
    const url = new URL(request.url);
    const id = url.pathname.split('/').at(-1);
    const [result] = await pool.execute<ResultSetHeader>('DELETE FROM sup_brands WHERE brand_id = ?', [Number(id)]);
    if (result.affectedRows === 0) return NextResponse.json({ error: '品牌不存在' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('删除品牌失败:', error);
    return NextResponse.json({ error: '删除品牌失败' }, { status: 500 });
  }
});
