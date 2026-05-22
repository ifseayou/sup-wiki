import { NextRequest, NextResponse } from 'next/server';
import { withAdmin } from '@/lib/admin';
import pool from '@/lib/db';
import type { ResultSetHeader } from 'mysql2';

const STATUSES = new Set(['pending', 'reviewing', 'imported', 'rejected']);

export const PATCH = withAdmin(async (request: NextRequest) => {
  try {
    const id = Number(new URL(request.url).pathname.split('/').at(-1));
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ error: '无效提交 ID' }, { status: 400 });
    }

    const body = await request.json();
    const sets: string[] = [];
    const values: (string | number | null)[] = [];

    if (body.status !== undefined) {
      if (!STATUSES.has(String(body.status))) return NextResponse.json({ error: '无效状态' }, { status: 400 });
      sets.push('status = ?');
      values.push(String(body.status));
    }
    if (body.admin_note !== undefined) {
      sets.push('admin_note = ?');
      values.push(String(body.admin_note || '').trim().slice(0, 1000) || null);
    }
    if (!sets.length) return NextResponse.json({ error: '没有可更新字段' }, { status: 400 });

    values.push(id);
    const [result] = await pool.execute<ResultSetHeader>(
      `UPDATE sup_event_result_submissions SET ${sets.join(', ')} WHERE submission_id = ?`,
      values
    );
    if (result.affectedRows === 0) return NextResponse.json({ error: '提交记录不存在' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('更新成绩册提交失败:', error);
    return NextResponse.json({ error: '更新成绩册提交失败' }, { status: 500 });
  }
});
