import { NextRequest, NextResponse } from 'next/server';
import { withAdmin } from '@/lib/admin';
import pool from '@/lib/db';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';

export const GET = withAdmin(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const eventId = searchParams.get('event_id');
    const search = searchParams.get('search');
    const page = Math.max(1, Number(searchParams.get('page') || 1));
    const pageSize = Math.min(100, Math.max(10, Number(searchParams.get('pageSize') || 30)));
    const offset = (page - 1) * pageSize;
    const conditions: string[] = [];
    const params: (string | number)[] = [];

    if (status) { conditions.push('src.parser_status = ?'); params.push(status); }
    if (eventId) { conditions.push('src.event_id = ?'); params.push(Number(eventId)); }
    if (search) {
      conditions.push('(src.file_name LIKE ? OR e.name LIKE ? OR src.parser_note LIKE ?)');
      const like = `%${search}%`;
      params.push(like, like, like);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [countRows] = await pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) AS total FROM sup_event_result_sources src LEFT JOIN sup_events e ON e.event_id = src.event_id ${where}`,
      params
    );
    const [items] = await pool.execute<RowDataPacket[]>(
      `SELECT src.*, e.name AS event_name, e.start_date
       FROM sup_event_result_sources src
       LEFT JOIN sup_events e ON e.event_id = src.event_id
       ${where}
       ORDER BY src.updated_at DESC, src.source_id DESC
       LIMIT ${pageSize} OFFSET ${offset}`,
      params
    );
    const total = Number(countRows[0]?.total || 0);
    return NextResponse.json({ items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
  } catch (error) {
    console.error('获取成绩来源失败:', error);
    return NextResponse.json({ error: '获取成绩来源失败' }, { status: 500 });
  }
});

export const POST = withAdmin(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const { event_id, file_name, file_type = 'unknown', original_path, source_url, parser_name, parser_status = 'pending_review', parser_note, extracted_rows = 0, metadata } = body;
    if (!file_name) return NextResponse.json({ error: '缺少 file_name' }, { status: 400 });

    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO sup_event_result_sources
        (event_id, original_path, file_name, file_type, source_url, parser_name, parser_status, parser_note, extracted_rows, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        event_id || null,
        original_path || null,
        file_name,
        file_type,
        source_url || null,
        parser_name || null,
        parser_status,
        parser_note || null,
        Number(extracted_rows) || 0,
        metadata ? JSON.stringify(metadata) : null,
      ]
    );

    return NextResponse.json({ success: true, source_id: result.insertId }, { status: 201 });
  } catch (error) {
    console.error('创建成绩来源失败:', error);
    return NextResponse.json({ error: '创建成绩来源失败' }, { status: 500 });
  }
});
