import { NextRequest, NextResponse } from 'next/server';
import { withAdmin } from '@/lib/admin';
import pool from '@/lib/db';
import type { RowDataPacket } from 'mysql2';

async function ensureSearchLogTable() {
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

function parseDetail(value: unknown) {
  if (!value) return {};
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(String(value));
  } catch {
    return {};
  }
}

export const GET = withAdmin(async (request: NextRequest) => {
  try {
    await ensureSearchLogTable();
    const url = new URL(request.url);
    const keyword = url.searchParams.get('keyword')?.trim() || '';
    const user = url.searchParams.get('user')?.trim() || '';
    const entry = url.searchParams.get('entry')?.trim() || '';
    const start = url.searchParams.get('start')?.trim() || '';
    const end = url.searchParams.get('end')?.trim() || '';
    const page = Math.max(1, Number(url.searchParams.get('page') || 1));
    const pageSize = Math.min(100, Math.max(10, Number(url.searchParams.get('pageSize') || 30)));
    const offset = (page - 1) * pageSize;

    const conditions: string[] = [];
    const params: (string | number)[] = [];
    if (keyword) {
      conditions.push('l.keyword LIKE ?');
      params.push(`%${keyword}%`);
    }
    if (user) {
      conditions.push('(l.nickname LIKE ? OR CAST(l.user_id AS CHAR) = ?)');
      params.push(`%${user}%`, user);
    }
    if (entry) {
      conditions.push('l.entry = ?');
      params.push(entry);
    }
    if (start) {
      conditions.push('l.created_at >= ?');
      params.push(`${start} 00:00:00`);
    }
    if (end) {
      conditions.push('l.created_at <= ?');
      params.push(`${end} 23:59:59`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [countRows] = await pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) AS total FROM sup_search_logs l ${where}`,
      params
    );
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT l.*, u.nickname AS user_nickname
       FROM sup_search_logs l
       LEFT JOIN sup_users u ON u.user_id = l.user_id
       ${where}
       ORDER BY l.created_at DESC
       LIMIT ${pageSize} OFFSET ${offset}`,
      params
    );

    return NextResponse.json({
      items: rows.map(row => ({
        id: row.log_id,
        user_id: row.user_id,
        nickname: row.nickname || row.user_nickname || '',
        entry: row.entry || '',
        keyword: row.keyword || '',
        detail: parseDetail(row.detail),
        result_count: Number(row.result_count || 0),
        duration_ms: row.duration_ms === null ? null : Number(row.duration_ms),
        ip: row.ip || '',
        user_agent: row.user_agent || '',
        created_at: row.created_at,
      })),
      total: Number(countRows[0]?.total || 0),
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(Number(countRows[0]?.total || 0) / pageSize)),
    });
  } catch (error) {
    console.error('获取搜索日志失败:', error);
    return NextResponse.json({ error: '获取搜索日志失败' }, { status: 500 });
  }
});
