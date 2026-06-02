import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import pool from '@/lib/db';
import { getUserFromRequest } from '@/lib/user-auth';

async function ensureContentViewTable() {
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS sup_content_views (
      view_id BIGINT NOT NULL AUTO_INCREMENT,
      content_type VARCHAR(64) NOT NULL,
      content_id BIGINT NOT NULL,
      path VARCHAR(255) NOT NULL DEFAULT '',
      user_id BIGINT NULL,
      visitor_hash CHAR(64) NOT NULL,
      viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (view_id),
      KEY idx_content_viewed (content_type, content_id, viewed_at),
      KEY idx_content_visitor (content_type, content_id, visitor_hash)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
}

function visitorHash(request: NextRequest, userId: number | null) {
  const base = userId
    ? `user:${userId}`
    : [
        request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || '',
        request.headers.get('user-agent') || '',
      ].join('|');
  return crypto.createHash('sha256').update(base).digest('hex');
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const contentType = String(body.content_type || '').trim().slice(0, 64);
    const contentId = Number(body.content_id || 0);
    const path = String(body.path || '').trim().slice(0, 255);
    if (!contentType || !Number.isInteger(contentId) || contentId <= 0) {
      return NextResponse.json({ error: '无效浏览对象' }, { status: 400 });
    }
    if (path.startsWith('/admin')) return NextResponse.json({ success: true, skipped: true });

    await ensureContentViewTable();
    const user = getUserFromRequest(request);
    await pool.execute(
      `INSERT INTO sup_content_views (content_type, content_id, path, user_id, visitor_hash)
       VALUES (?, ?, ?, ?, ?)`,
      [contentType, contentId, path, user?.user_id || null, visitorHash(request, user?.user_id || null)]
    );
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('记录内容浏览失败:', error);
    return NextResponse.json({ error: '记录内容浏览失败' }, { status: 500 });
  }
}
