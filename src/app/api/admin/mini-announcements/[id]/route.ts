import { NextResponse } from 'next/server';
import { withAdmin } from '@/lib/admin';
import pool from '@/lib/db';

function getId(request: Request) {
  return Number(new URL(request.url).pathname.split('/').pop());
}

export const PATCH = withAdmin(async request => {
  const id = getId(request);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: '无效公告 ID' }, { status: 400 });
  const body = await request.json().catch(() => ({}));
  const title = String(body.title || '').trim().slice(0, 160);
  const ticker = String(body.ticker || title).trim().slice(0, 220);
  const detail = String(body.detail || '').trim();
  const status = body.status === 'published' ? 'published' : (body.status === 'disabled' ? 'disabled' : 'draft');
  const sortOrder = Number(body.sort_order || 0);
  if (!title) return NextResponse.json({ error: '请填写公告标题' }, { status: 400 });
  if (status === 'published') {
    await pool.execute("UPDATE sup_mini_announcements SET status = 'disabled' WHERE status = 'published' AND announcement_id <> ?", [id]);
  }
  await pool.execute(
    `UPDATE sup_mini_announcements
     SET title = ?, ticker = ?, detail = ?, status = ?, sort_order = ?,
         published_at = CASE WHEN ? = 'published' AND published_at IS NULL THEN NOW() ELSE published_at END
     WHERE announcement_id = ?`,
    [title, ticker, detail, status, sortOrder, status, id]
  );
  return NextResponse.json({ success: true });
});

export const DELETE = withAdmin(async request => {
  const id = getId(request);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: '无效公告 ID' }, { status: 400 });
  await pool.execute('DELETE FROM sup_mini_announcements WHERE announcement_id = ?', [id]);
  return NextResponse.json({ success: true });
});
