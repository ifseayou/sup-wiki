import { NextResponse } from 'next/server';
import { withAdmin } from '@/lib/admin';
import pool from '@/lib/db';
import type { RowDataPacket } from 'mysql2';

async function ensureAnnouncementTable() {
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS sup_mini_announcements (
      announcement_id BIGINT NOT NULL AUTO_INCREMENT,
      title VARCHAR(160) NOT NULL,
      ticker VARCHAR(220) NULL,
      detail TEXT NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'draft',
      sort_order INT NOT NULL DEFAULT 0,
      published_at DATETIME NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (announcement_id),
      KEY idx_status_sort (status, sort_order, updated_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
}

export const GET = withAdmin(async () => {
  await ensureAnnouncementTable();
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT * FROM sup_mini_announcements
     ORDER BY status = 'published' DESC, sort_order DESC, updated_at DESC
     LIMIT 100`
  );
  return NextResponse.json({
    items: rows.map(row => ({
      id: row.announcement_id,
      title: row.title || '',
      ticker: row.ticker || '',
      detail: row.detail || '',
      status: row.status || 'draft',
      sort_order: Number(row.sort_order || 0),
      published_at: row.published_at,
      created_at: row.created_at,
      updated_at: row.updated_at,
    })),
  });
});

export const POST = withAdmin(async request => {
  await ensureAnnouncementTable();
  const body = await request.json().catch(() => ({}));
  const title = String(body.title || '').trim().slice(0, 160);
  const ticker = String(body.ticker || title).trim().slice(0, 220);
  const detail = String(body.detail || '').trim();
  const status = body.status === 'published' ? 'published' : 'draft';
  const sortOrder = Number(body.sort_order || 0);
  if (!title) return NextResponse.json({ error: '请填写公告标题' }, { status: 400 });
  if (status === 'published') {
    await pool.execute("UPDATE sup_mini_announcements SET status = 'disabled' WHERE status = 'published'");
  }
  const [result] = await pool.execute(
    `INSERT INTO sup_mini_announcements (title, ticker, detail, status, sort_order, published_at)
     VALUES (?, ?, ?, ?, ?, ${status === 'published' ? 'NOW()' : 'NULL'})`,
    [title, ticker, detail, status, sortOrder]
  );
  return NextResponse.json({ success: true, id: (result as { insertId?: number }).insertId });
});
