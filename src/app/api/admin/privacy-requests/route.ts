import { NextRequest, NextResponse } from 'next/server';
import { withAdmin } from '@/lib/admin';
import pool from '@/lib/db';
import type { RowDataPacket } from 'mysql2';

async function ensurePrivacyTables() {
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS sup_privacy_requests (
      request_id BIGINT NOT NULL AUTO_INCREMENT,
      user_id BIGINT NULL,
      nickname VARCHAR(120) NULL,
      request_type VARCHAR(48) NOT NULL,
      target_type VARCHAR(32) NOT NULL,
      target_id BIGINT NULL,
      athlete_id BIGINT NULL,
      result_id BIGINT NULL,
      event_id BIGINT NULL,
      description TEXT NULL,
      contact TEXT NULL,
      proof_images JSON NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'pending',
      handler_user_id BIGINT NULL,
      handler_name VARCHAR(120) NULL,
      handler_note TEXT NULL,
      handled_at DATETIME NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (request_id),
      KEY idx_status_created (status, created_at),
      KEY idx_target (target_type, target_id),
      KEY idx_athlete (athlete_id),
      KEY idx_result (result_id),
      KEY idx_user_created (user_id, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS sup_privacy_request_logs (
      log_id BIGINT NOT NULL AUTO_INCREMENT,
      request_id BIGINT NOT NULL,
      action VARCHAR(64) NOT NULL,
      actor_user_id BIGINT NULL,
      actor_name VARCHAR(120) NULL,
      note TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (log_id),
      KEY idx_request_created (request_id, created_at)
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

export const GET = withAdmin(async (request: NextRequest) => {
  await ensurePrivacyTables();
  const url = new URL(request.url);
  const status = url.searchParams.get('status') || '';
  const params: string[] = [];
  const where = status ? 'WHERE pr.status = ?' : '';
  if (status) params.push(status);
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT pr.*,
            u.nickname AS user_nickname,
            a.name AS athlete_name,
            e.name AS event_name,
            er.athlete_name_snapshot AS result_athlete_name
     FROM sup_privacy_requests pr
     LEFT JOIN sup_users u ON u.user_id = pr.user_id
     LEFT JOIN sup_athletes a ON a.athlete_id = pr.athlete_id
     LEFT JOIN sup_events e ON e.event_id = pr.event_id
     LEFT JOIN sup_event_results er ON er.result_id = pr.result_id
     ${where}
     ORDER BY pr.created_at DESC
     LIMIT 300`,
    params
  );
  return NextResponse.json({
    items: rows.map(row => ({
      id: row.request_id,
      request_id: row.request_id,
      user_id: row.user_id,
      nickname: row.nickname || row.user_nickname || '',
      request_type: row.request_type,
      target_type: row.target_type,
      target_id: row.target_id,
      athlete_id: row.athlete_id,
      result_id: row.result_id,
      event_id: row.event_id,
      athlete_name: row.athlete_name || row.result_athlete_name || '',
      event_name: row.event_name || '',
      description: row.description || '',
      contact: row.contact || '',
      proof_images: parseImages(row.proof_images),
      status: row.status || 'pending',
      handler_name: row.handler_name || '',
      handler_note: row.handler_note || '',
      handled_at: row.handled_at,
      created_at: row.created_at,
    })),
  });
});
