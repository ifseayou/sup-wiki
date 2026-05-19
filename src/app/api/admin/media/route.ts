import { NextRequest, NextResponse } from 'next/server';
import { withAdmin } from '@/lib/admin';
import pool from '@/lib/db';
import type { RowDataPacket, ResultSetHeader } from 'mysql2';

export const GET = withAdmin(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'active';
    const folder = searchParams.get('folder');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '40');
    const offset = (page - 1) * pageSize;

    const conditions: string[] = [];
    const params: (string | number)[] = [];
    if (status) { conditions.push('status = ?'); params.push(status); }
    if (folder) { conditions.push('folder = ?'); params.push(folder); }
    if (search) {
      conditions.push('(filename LIKE ? OR alt_text LIKE ? OR url LIKE ?)');
      const like = `%${search}%`;
      params.push(like, like, like);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [countRows] = await pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) AS total FROM sup_media_assets ${where}`,
      params
    );
    const total = Number(countRows[0]?.total || 0);
    const [items] = await pool.execute<RowDataPacket[]>(
      `SELECT * FROM sup_media_assets ${where}
       ORDER BY created_at DESC, asset_id DESC
       LIMIT ${pageSize} OFFSET ${offset}`,
      params
    );

    return NextResponse.json({ items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
  } catch (error) {
    console.error('获取图片库失败:', error);
    return NextResponse.json({ error: '获取图片库失败' }, { status: 500 });
  }
});

export const POST = withAdmin(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const { url, folder = 'misc', filename, mime_type, size_bytes, alt_text, source_context = 'manual', status = 'active' } = body;
    if (!url) return NextResponse.json({ error: '缺少必填字段: url' }, { status: 400 });

    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO sup_media_assets (url, folder, filename, mime_type, size_bytes, alt_text, source_context, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         folder = VALUES(folder),
         filename = VALUES(filename),
         mime_type = VALUES(mime_type),
         size_bytes = VALUES(size_bytes),
         alt_text = VALUES(alt_text),
         source_context = VALUES(source_context),
         status = VALUES(status)`,
      [url, folder, filename || null, mime_type || null, size_bytes || null, alt_text || null, source_context, status]
    );
    return NextResponse.json({ success: true, asset_id: result.insertId }, { status: 201 });
  } catch (error) {
    console.error('创建图片记录失败:', error);
    return NextResponse.json({ error: '创建图片记录失败' }, { status: 500 });
  }
});
