import { NextRequest, NextResponse } from 'next/server';
import { withAdmin } from '@/lib/admin';
import pool from '@/lib/db';
import type { ResultSetHeader } from 'mysql2';

export const PATCH = withAdmin(async (request: NextRequest, _ctx) => {
  try {
    const id = Number(new URL(request.url).pathname.split('/').at(-1));
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ error: '无效来源 ID' }, { status: 400 });
    }
    const body = await request.json();
    const allowed = ['event_id', 'source_url', 'parser_status', 'parser_note', 'reviewed_rows', 'imported_rows'];
    const sets: string[] = [];
    const values: (string | number | null)[] = [];
    for (const key of allowed) {
      if (body[key] !== undefined) {
        sets.push(`${key} = ?`);
        values.push(body[key] === '' ? null : body[key]);
      }
    }
    if (!sets.length) return NextResponse.json({ error: '没有可更新字段' }, { status: 400 });
    values.push(id);
    const [result] = await pool.execute<ResultSetHeader>(
      `UPDATE sup_event_result_sources SET ${sets.join(', ')} WHERE source_id = ?`,
      values
    );
    if (result.affectedRows === 0) return NextResponse.json({ error: '来源不存在' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('更新成绩来源失败:', error);
    return NextResponse.json({ error: '更新成绩来源失败' }, { status: 500 });
  }
});
