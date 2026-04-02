import { NextRequest, NextResponse } from 'next/server';
import { withAdmin } from '@/lib/admin';
import pool from '@/lib/db';
import type { ResultSetHeader } from 'mysql2';

export const PUT = withAdmin(async (request: NextRequest, _ctx) => {
  try {
    const url = new URL(request.url);
    const id = url.pathname.split('/').at(-1);
    const body = await request.json();
    const allowed = ['name','name_en','nationality','photo','bio','discipline','icf_ranking','status'];
    const fields: string[] = [];
    const values: (string | number | null)[] = [];
    for (const f of allowed) {
      if (body[f] !== undefined) { fields.push(`${f} = ?`); values.push(body[f]); }
    }
    if (body.achievements !== undefined) { fields.push('achievements = ?'); values.push(JSON.stringify(body.achievements)); }
    if (body.social_links !== undefined) { fields.push('social_links = ?'); values.push(JSON.stringify(body.social_links)); }
    if (fields.length === 0) return NextResponse.json({ error: '没有要更新的字段' }, { status: 400 });
    values.push(Number(id));
    const [result] = await pool.execute<ResultSetHeader>(`UPDATE sup_athletes SET ${fields.join(', ')} WHERE athlete_id = ?`, values);
    if (result.affectedRows === 0) return NextResponse.json({ error: '运动员不存在' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('更新运动员失败:', error);
    return NextResponse.json({ error: '更新运动员失败' }, { status: 500 });
  }
});

export const DELETE = withAdmin(async (request: NextRequest, _ctx) => {
  try {
    const url = new URL(request.url);
    const id = url.pathname.split('/').at(-1);
    const [result] = await pool.execute<ResultSetHeader>('DELETE FROM sup_athletes WHERE athlete_id = ?', [Number(id)]);
    if (result.affectedRows === 0) return NextResponse.json({ error: '运动员不存在' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('删除运动员失败:', error);
    return NextResponse.json({ error: '删除运动员失败' }, { status: 500 });
  }
});
