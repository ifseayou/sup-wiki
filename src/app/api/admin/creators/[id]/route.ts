import { NextRequest, NextResponse } from 'next/server';
import { withAdmin } from '@/lib/admin';
import pool from '@/lib/db';
import type { ResultSetHeader } from 'mysql2';

export const PUT = withAdmin(async (request: NextRequest, _ctx) => {
  try {
    const url = new URL(request.url);
    const id = url.pathname.split('/').at(-1);
    const body = await request.json();
    const allowed = ['nickname','avatar','bio','platform','follower_tier','content_style','profile_url','status'];
    const fields: string[] = [];
    const values: (string | number | null)[] = [];
    for (const f of allowed) {
      if (body[f] !== undefined) { fields.push(`${f} = ?`); values.push(body[f]); }
    }
    if (fields.length === 0) return NextResponse.json({ error: '没有要更新的字段' }, { status: 400 });
    values.push(Number(id));
    const [result] = await pool.execute<ResultSetHeader>(`UPDATE sup_creators SET ${fields.join(', ')} WHERE creator_id = ?`, values);
    if (result.affectedRows === 0) return NextResponse.json({ error: '博主不存在' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('更新博主失败:', error);
    return NextResponse.json({ error: '更新博主失败' }, { status: 500 });
  }
});

export const DELETE = withAdmin(async (request: NextRequest, _ctx) => {
  try {
    const url = new URL(request.url);
    const id = url.pathname.split('/').at(-1);
    const [result] = await pool.execute<ResultSetHeader>('DELETE FROM sup_creators WHERE creator_id = ?', [Number(id)]);
    if (result.affectedRows === 0) return NextResponse.json({ error: '博主不存在' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('删除博主失败:', error);
    return NextResponse.json({ error: '删除博主失败' }, { status: 500 });
  }
});
