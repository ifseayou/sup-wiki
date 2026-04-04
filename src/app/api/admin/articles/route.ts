import { NextRequest, NextResponse } from 'next/server';
import { withAdmin } from '@/lib/admin';
import pool from '@/lib/db';
import type { RowDataPacket, ResultSetHeader } from 'mysql2';

export const GET = withAdmin(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');
    const offset = (page - 1) * pageSize;

    const conditions: string[] = [];
    const params: (string | number)[] = [];
    if (status) { conditions.push('status = ?'); params.push(status); }
    if (search) { conditions.push('title LIKE ?'); params.push(`%${search}%`); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [countRows] = await pool.execute<RowDataPacket[]>(`SELECT COUNT(*) as total FROM sup_articles ${where}`, params);
    const total = (countRows[0] as { total: number }).total;

    const [articles] = await pool.execute<RowDataPacket[]>(
      `SELECT * FROM sup_articles ${where} ORDER BY CASE status WHEN 'published' THEN 0 ELSE 1 END, sort_order ASC, article_id ASC LIMIT ${pageSize} OFFSET ${offset}`,
      params
    );
    return NextResponse.json({ items: articles, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
  } catch (error) {
    console.error('获取文章列表失败:', error);
    return NextResponse.json({ error: '获取文章列表失败' }, { status: 500 });
  }
});

export const POST = withAdmin(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const { title, slug, category = 'event_guide', summary, content, sort_order = 0, status = 'draft' } = body;
    if (!title) return NextResponse.json({ error: '缺少必填字段: title' }, { status: 400 });
    if (!slug) return NextResponse.json({ error: '缺少必填字段: slug' }, { status: 400 });

    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO sup_articles (title, slug, category, summary, content, sort_order, status) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [title, slug, category, summary || null, content || null, sort_order, status]
    );
    return NextResponse.json({ success: true, article_id: result.insertId }, { status: 201 });
  } catch (error) {
    console.error('创建文章失败:', error);
    return NextResponse.json({ error: '创建文章失败' }, { status: 500 });
  }
});
