import { NextRequest, NextResponse } from 'next/server';
import { withAdmin } from '@/lib/admin';
import pool from '@/lib/db';
import { ensureSearchLogTable } from '@/lib/search-log';
import type { RowDataPacket } from 'mysql2';

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
      conditions.push('(l.nickname LIKE ? OR u.nickname LIKE ? OR u.email LIKE ? OR CAST(l.user_id AS CHAR) = ?)');
      params.push(`%${user}%`, `%${user}%`, `%${user}%`, user);
    }
    if (entry) {
      conditions.push('l.entry = ?');
      params.push(entry);
    }
    if (start) {
      conditions.push("DATE(CONVERT_TZ(l.created_at, '+00:00', '+08:00')) >= ?");
      params.push(start);
    }
    if (end) {
      conditions.push("DATE(CONVERT_TZ(l.created_at, '+00:00', '+08:00')) <= ?");
      params.push(end);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [countRows] = await pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) AS total
       FROM sup_search_logs l
       LEFT JOIN sup_users u ON u.user_id = l.user_id
       ${where}`,
      params
    );
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT
         l.*,
         u.nickname AS user_nickname,
         u.email AS user_email,
         DATE_FORMAT(CONVERT_TZ(l.created_at, '+00:00', '+08:00'), '%Y-%m-%d %H:%i:%s') AS created_at_display
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
        email: row.user_email || '',
        nickname: row.nickname || row.user_nickname || '',
        entry: row.entry || '',
        keyword: row.keyword || '',
        detail: parseDetail(row.detail),
        result_count: Number(row.result_count || 0),
        duration_ms: row.duration_ms === null ? null : Number(row.duration_ms),
        ip: row.ip || '',
        user_agent: row.user_agent || '',
        created_at: row.created_at,
        created_at_display: row.created_at_display || '',
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
