import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import type { RowDataPacket } from 'mysql2';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category') || 'event_guide';

    const [articles] = await pool.execute<RowDataPacket[]>(
      `SELECT article_id, title, slug, category, summary, content, sort_order
       FROM sup_articles
       WHERE status = 'published' AND category = ?
       ORDER BY sort_order ASC, article_id ASC`,
      [category]
    );
    return NextResponse.json({ items: articles });
  } catch (error) {
    console.error('获取文章失败:', error);
    return NextResponse.json({ error: '获取文章失败' }, { status: 500 });
  }
}
