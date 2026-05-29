import { NextResponse } from 'next/server';
import { withAdmin } from '@/lib/admin';
import pool from '@/lib/db';
import type { RowDataPacket } from 'mysql2';

async function ensureFeedbackTable() {
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS sup_mini_feedback (
      feedback_id BIGINT NOT NULL AUTO_INCREMENT,
      user_id BIGINT NULL,
      nickname VARCHAR(120) NULL,
      bug_text TEXT NULL,
      feature_text TEXT NULL,
      rating TINYINT NULL,
      willing_to_share TINYINT NULL,
      image_urls JSON NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'new',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (feedback_id),
      KEY idx_user_created (user_id, created_at),
      KEY idx_status_created (status, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
}

function parseImages(value: unknown) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(String(value));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export const GET = withAdmin(async request => {
  await ensureFeedbackTable();
  const url = new URL(request.url);
  const status = url.searchParams.get('status') || '';
  const params: string[] = [];
  const where = status ? 'WHERE f.status = ?' : '';
  if (status) params.push(status);
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT f.*, u.nickname AS user_nickname, u.avatar_url
     FROM sup_mini_feedback f
     LEFT JOIN sup_users u ON u.user_id = f.user_id
     ${where}
     ORDER BY f.created_at DESC
     LIMIT 200`,
    params
  );
  return NextResponse.json({
    items: rows.map(row => ({
      id: row.feedback_id,
      user_id: row.user_id,
      nickname: row.nickname || row.user_nickname || '',
      avatar_url: row.avatar_url || '',
      bug_text: row.bug_text || '',
      feature_text: row.feature_text || '',
      rating: Number(row.rating || 0),
      willing_to_share: Number(row.willing_to_share || 0) === 1,
      image_urls: parseImages(row.image_urls),
      status: row.status || 'new',
      created_at: row.created_at,
      updated_at: row.updated_at,
    })),
  });
});
