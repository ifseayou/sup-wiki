import { NextResponse } from 'next/server';
import { withAdmin } from '@/lib/admin';
import pool from '@/lib/db';
import type { RowDataPacket } from 'mysql2';

const ACTIONS = new Set([
  'approve_hide_athlete',
  'approve_anonymize_name',
  'approve_delete_frontend',
  'approve_correction',
  'needs_more_info',
  'reject',
  'processing',
]);

function nextStatus(action: string) {
  if (action === 'needs_more_info') return 'needs_more_info';
  if (action === 'reject') return 'rejected';
  if (action === 'processing') return 'processing';
  return 'completed';
}

function nextType(action: string, current: string) {
  if (action === 'approve_hide_athlete') return 'hide_athlete';
  if (action === 'approve_anonymize_name') return 'anonymize_name';
  if (action === 'approve_delete_frontend') return 'delete_frontend';
  if (action === 'approve_correction') return 'correction';
  return current;
}

export const PATCH = withAdmin(async request => {
  const id = Number(request.nextUrl.pathname.split('/').pop());
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: '无效隐私请求 ID' }, { status: 400 });
  }
  const body = await request.json().catch(() => ({}));
  const action = String(body.action || '');
  if (!ACTIONS.has(action)) {
    return NextResponse.json({ error: '无效处理动作' }, { status: 400 });
  }
  const note = String(body.note || '').trim().slice(0, 2000);
  const [rows] = await pool.execute<RowDataPacket[]>('SELECT * FROM sup_privacy_requests WHERE request_id = ? LIMIT 1', [id]);
  const current = rows[0];
  if (!current) return NextResponse.json({ error: '隐私请求不存在' }, { status: 404 });

  const status = nextStatus(action);
  const requestType = nextType(action, current.request_type);
  await pool.execute(
    `UPDATE sup_privacy_requests
     SET status = ?, request_type = ?, handler_name = 'admin', handler_note = ?, handled_at = NOW()
     WHERE request_id = ?`,
    [status, requestType, note || null, id]
  );
  await pool.execute(
    `INSERT INTO sup_privacy_request_logs (request_id, action, actor_name, note)
     VALUES (?, ?, 'admin', ?)`,
    [id, action, note || null]
  );
  return NextResponse.json({ success: true });
});
