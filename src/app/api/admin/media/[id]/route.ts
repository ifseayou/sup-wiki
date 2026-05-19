import { NextRequest, NextResponse } from 'next/server';
import { withAdmin } from '@/lib/admin';
import pool from '@/lib/db';
import type { ResultSetHeader } from 'mysql2';

export const PUT = withAdmin(async (request: NextRequest) => {
  try {
    const id = Number(new URL(request.url).pathname.split('/').at(-1));
    const body = await request.json();
    const allowed = ['folder', 'filename', 'alt_text', 'source_context', 'status'];
    const fields: string[] = [];
    const values: (string | number | null)[] = [];
    for (const field of allowed) {
      if (body[field] !== undefined) {
        fields.push(`${field} = ?`);
        values.push(body[field] === '' ? null : body[field]);
      }
    }
    if (fields.length === 0) return NextResponse.json({ error: '没有要更新的字段' }, { status: 400 });
    values.push(id);
    const [result] = await pool.execute<ResultSetHeader>(
      `UPDATE sup_media_assets SET ${fields.join(', ')} WHERE asset_id = ?`,
      values
    );
    if (result.affectedRows === 0) return NextResponse.json({ error: '图片记录不存在' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('更新图片记录失败:', error);
    return NextResponse.json({ error: '更新图片记录失败' }, { status: 500 });
  }
});

export const DELETE = withAdmin(async (request: NextRequest) => {
  try {
    const id = Number(new URL(request.url).pathname.split('/').at(-1));
    const [result] = await pool.execute<ResultSetHeader>(
      `UPDATE sup_media_assets SET status = 'hidden' WHERE asset_id = ?`,
      [id]
    );
    if (result.affectedRows === 0) return NextResponse.json({ error: '图片记录不存在' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('隐藏图片记录失败:', error);
    return NextResponse.json({ error: '隐藏图片记录失败' }, { status: 500 });
  }
});
