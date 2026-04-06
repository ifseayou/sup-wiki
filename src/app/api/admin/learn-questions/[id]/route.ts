import { NextRequest, NextResponse } from 'next/server';
import { withAdmin } from '@/lib/admin';
import pool from '@/lib/db';
import type { ResultSetHeader } from 'mysql2';

export const PUT = withAdmin(async (request: NextRequest) => {
  try {
    const id = request.url.split('/').at(-1);
    const body = await request.json();
    const allowed = ['question', 'question_image', 'type', 'explanation', 'explanation_image', 'category', 'difficulty', 'status'];
    const fields: string[] = [];
    const values: (string | number | null)[] = [];
    for (const f of allowed) {
      if (body[f] !== undefined) { fields.push(`${f} = ?`); values.push(body[f]); }
    }
    if (body.options !== undefined) { fields.push('options = ?'); values.push(JSON.stringify(body.options)); }
    if (body.correct !== undefined) { fields.push('correct = ?'); values.push(JSON.stringify(body.correct)); }
    if (fields.length === 0) return NextResponse.json({ error: '没有要更新的字段' }, { status: 400 });
    values.push(Number(id));
    const [result] = await pool.execute<ResultSetHeader>(`UPDATE sup_quiz_questions SET ${fields.join(', ')} WHERE question_id = ?`, values);
    if (result.affectedRows === 0) return NextResponse.json({ error: '题目不存在' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('更新题目失败:', error);
    return NextResponse.json({ error: '更新题目失败' }, { status: 500 });
  }
});

export const DELETE = withAdmin(async (request: NextRequest) => {
  try {
    const id = request.url.split('/').at(-1);
    const [result] = await pool.execute<ResultSetHeader>('DELETE FROM sup_quiz_questions WHERE question_id = ?', [Number(id)]);
    if (result.affectedRows === 0) return NextResponse.json({ error: '题目不存在' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: '删除题目失败' }, { status: 500 });
  }
});
