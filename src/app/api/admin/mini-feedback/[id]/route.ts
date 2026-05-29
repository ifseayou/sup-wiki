import { NextResponse } from 'next/server';
import { withAdmin } from '@/lib/admin';
import pool from '@/lib/db';

const STATUS = new Set(['new', 'reviewing', 'resolved', 'ignored']);

export const PATCH = withAdmin(async request => {
  const id = Number(request.nextUrl.pathname.split('/').pop());
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: '无效反馈 ID' }, { status: 400 });
  }
  const body = await request.json().catch(() => ({}));
  const status = String(body.status || '');
  if (!STATUS.has(status)) {
    return NextResponse.json({ error: '无效状态' }, { status: 400 });
  }
  await pool.execute('UPDATE sup_mini_feedback SET status = ? WHERE feedback_id = ?', [status, id]);
  return NextResponse.json({ success: true });
});
