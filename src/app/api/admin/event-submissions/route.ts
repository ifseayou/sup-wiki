import { NextRequest, NextResponse } from 'next/server';
import { withAdmin } from '@/lib/admin';
import pool from '@/lib/db';
import type { RowDataPacket } from 'mysql2';

function parseJson(value: unknown, fallback: unknown) {
  if (value == null) return fallback;
  if (typeof value === 'object') return value;
  try { return JSON.parse(String(value)); } catch { return fallback; }
}

export const GET = withAdmin(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('review_status')?.trim();
    const pageSize = Math.min(100, Math.max(1, Number(searchParams.get('pageSize')) || 20));
    const page = Math.max(1, Number(searchParams.get('page')) || 1);
    const offset = (page - 1) * pageSize;
    const conditions: string[] = [];
    const params: (string | number)[] = [];
    if (status && status !== 'all') { conditions.push('s.review_status = ?'); params.push(status); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const [countRows] = await pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) AS total FROM sup_event_submissions s ${where}`,
      params
    );
    const total = Number((countRows[0] as { total?: number })?.total || 0);
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT s.submission_id, s.user_id, s.submission_type, s.source, s.image_urls, s.link_url, s.user_note, s.source_text,
              s.extracted_json, s.extract_status, s.extract_error, s.review_status, s.event_id, s.admin_note,
              s.created_at, s.updated_at, u.nickname, w.publish_time
       FROM sup_event_submissions s
       LEFT JOIN sup_users u ON u.user_id = s.user_id
       LEFT JOIN sup_wechat_articles w ON w.submission_id = s.submission_id
       ${where}
       ORDER BY COALESCE(w.publish_time, s.created_at) DESC LIMIT ${pageSize} OFFSET ${offset}`,
      params
    );
    const items = rows.map((r) => ({
      submission_id: r.submission_id,
      user_id: r.user_id,
      nickname: r.nickname || '',
      submission_type: r.submission_type,
      source: r.source || 'manual',
      image_urls: parseJson(r.image_urls, []),
      link_url: r.link_url || '',
      user_note: r.user_note || '',
      source_text: r.source_text || '',
      extracted_json: parseJson(r.extracted_json, null),
      extract_status: r.extract_status,
      extract_error: r.extract_error || '',
      review_status: r.review_status,
      event_id: r.event_id || null,
      admin_note: r.admin_note || '',
      created_at: r.created_at,
      updated_at: r.updated_at,
      publish_time: r.publish_time || null,
    }));
    return NextResponse.json({ items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) });
  } catch (error) {
    console.error('赛事提报列表失败:', error);
    return NextResponse.json({ error: '加载失败' }, { status: 500 });
  }
});
