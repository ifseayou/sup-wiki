import { NextRequest, NextResponse } from 'next/server';
import { withAdmin } from '@/lib/admin';
import pool from '@/lib/db';
import { parseJsonArray } from '@/lib/course-utils';
import type { RowDataPacket, ResultSetHeader } from 'mysql2';

export const GET = withAdmin(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const stage = searchParams.get('stage');
    const level = searchParams.get('level');
    const category = searchParams.get('category');
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');
    const offset = (page - 1) * pageSize;

    const conditions: string[] = [];
    const params: (string | number)[] = [];
    if (status) { conditions.push('status = ?'); params.push(status); }
    if (stage) { conditions.push('stage = ?'); params.push(Number(stage)); }
    if (level) { conditions.push('level = ?'); params.push(level); }
    if (category) { conditions.push('category = ?'); params.push(category); }
    if (search) {
      conditions.push('(name LIKE ? OR source_code LIKE ? OR key_points LIKE ?)');
      const like = `%${search}%`;
      params.push(like, like, like);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [countRows] = await pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) as total FROM sup_techniques ${where}`,
      params
    );
    const total = Number(countRows[0]?.total || 0);

    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT * FROM sup_techniques ${where}
       ORDER BY CASE status WHEN 'published' THEN 0 ELSE 1 END, sort_order ASC, technique_id ASC
       LIMIT ${pageSize} OFFSET ${offset}`,
      params
    );

    const items = rows.map((row) => ({
      ...row,
      images: parseJsonArray(row.images),
    }));
    return NextResponse.json({ items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
  } catch (error) {
    console.error('获取技术动作列表失败:', error);
    return NextResponse.json({ error: '获取技术动作列表失败' }, { status: 500 });
  }
});

export const POST = withAdmin(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const {
      source_code, name, stage = 1, stage_label = '跪姿基础', level = 'beginner',
      cover_image, images, category = 'general', points = 1, key_points, common_errors, sort_order = 0, status = 'draft',
    } = body;
    if (!name) return NextResponse.json({ error: '缺少必填字段: name' }, { status: 400 });

    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO sup_techniques
        (source_code, name, cover_image, images, stage, stage_label, level, category, points, key_points, common_errors, sort_order, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        source_code || null,
        name,
        cover_image || null,
        images ? JSON.stringify(images) : null,
        Number(stage) || 1,
        stage_label || '跪姿基础',
        level,
        category || 'general',
        Number(points) || 1,
        key_points || null,
        common_errors || null,
        Number(sort_order) || 0,
        status,
      ]
    );

    return NextResponse.json({ success: true, technique_id: result.insertId }, { status: 201 });
  } catch (error) {
    console.error('创建技术动作失败:', error);
    return NextResponse.json({ error: '创建技术动作失败' }, { status: 500 });
  }
});
