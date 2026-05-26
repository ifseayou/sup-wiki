import { NextRequest, NextResponse } from 'next/server';
import { withAdmin } from '@/lib/admin';
import pool from '@/lib/db';
import type { RowDataPacket } from 'mysql2';

export const GET = withAdmin(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const search = searchParams.get('search')?.trim();
    const page = Math.max(1, Number(searchParams.get('page') || 1));
    const pageSize = Math.min(100, Math.max(10, Number(searchParams.get('pageSize') || 30)));
    const offset = (page - 1) * pageSize;
    const conditions: string[] = [];
    const params: (string | number)[] = [];

    if (status) {
      conditions.push('s.status = ?');
      params.push(status);
    }
    if (search) {
      conditions.push('(s.event_name LIKE ? OR s.location LIKE ? OR s.original_filename LIKE ? OR u.nickname LIKE ? OR u.email LIKE ?)');
      const like = `%${search}%`;
      params.push(like, like, like, like, like);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [countRows] = await pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) AS total
       FROM sup_event_result_submissions s
       INNER JOIN sup_users u ON u.user_id = s.user_id
       ${where}`,
      params
    );
    const [items] = await pool.execute<RowDataPacket[]>(
      `SELECT
         s.*,
         COALESCE(s.batch_id, CONCAT('legacy-', s.submission_id)) AS batch_id,
         COALESCE(s.batch_file_index, 1) AS batch_file_index,
         COALESCE(s.batch_total, 1) AS batch_total,
         COALESCE(s.batch_label, s.event_name) AS batch_label,
         u.nickname, u.email, e.name AS matched_event_name
       FROM sup_event_result_submissions s
       INNER JOIN sup_users u ON u.user_id = s.user_id
       LEFT JOIN sup_events e ON e.event_id = s.event_id
       ${where}
       ORDER BY s.created_at DESC, s.submission_id DESC
       LIMIT ${pageSize} OFFSET ${offset}`,
      params
    );

    const total = Number(countRows[0]?.total || 0);
    return NextResponse.json({ items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
  } catch (error) {
    console.error('获取成绩册提交失败:', error);
    return NextResponse.json({ error: '获取成绩册提交失败' }, { status: 500 });
  }
});
