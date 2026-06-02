import { NextRequest } from 'next/server';
import pool from '@/lib/db';
import { getUserFromRequest } from '@/lib/user-auth';

type SearchLogEntry = 'race_results' | 'annual_points' | 'event_results' | 'sup_search';

export async function ensureSearchLogTable() {
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS sup_search_logs (
      log_id BIGINT NOT NULL AUTO_INCREMENT,
      user_id BIGINT NULL,
      nickname VARCHAR(120) NULL,
      entry VARCHAR(64) NOT NULL,
      keyword VARCHAR(255) NOT NULL DEFAULT '',
      detail JSON NULL,
      result_count INT NOT NULL DEFAULT 0,
      duration_ms INT NULL,
      ip VARCHAR(64) NULL,
      user_agent VARCHAR(500) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (log_id),
      KEY idx_entry_created (entry, created_at),
      KEY idx_keyword_created (keyword, created_at),
      KEY idx_user_created (user_id, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
}

function requestIp(request: NextRequest) {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || '';
}

export async function writeSearchLog(
  request: NextRequest,
  input: {
    entry: SearchLogEntry;
    keyword?: string | null;
    resultCount?: number;
    durationMs?: number;
    detail?: Record<string, unknown>;
  }
) {
  try {
    await ensureSearchLogTable();
    const user = getUserFromRequest(request);
    await pool.execute(
      `INSERT INTO sup_search_logs
       (user_id, nickname, entry, keyword, detail, result_count, duration_ms, ip, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        user?.user_id || null,
        user?.nickname || null,
        input.entry,
        String(input.keyword || '').slice(0, 255),
        JSON.stringify(input.detail || {}),
        Math.max(0, Number(input.resultCount || 0)),
        input.durationMs === undefined ? null : Math.max(0, Number(input.durationMs || 0)),
        requestIp(request).slice(0, 64),
        String(request.headers.get('user-agent') || '').slice(0, 500),
      ]
    );
  } catch (error) {
    console.error('写入搜索日志失败:', error);
  }
}
