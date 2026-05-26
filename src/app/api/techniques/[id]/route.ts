import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { parseJsonArray } from '@/lib/course-utils';
import type { RowDataPacket } from 'mysql2';

export async function GET(request: NextRequest) {
  try {
    const id = Number(new URL(request.url).pathname.split('/').at(-1));
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ error: '无效技术动作 ID' }, { status: 400 });
    }

    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT technique_id, source_code, name, cover_image, images, stage, stage_label,
              level, category, points, key_points, common_errors, sort_order, updated_at
       FROM sup_techniques
       WHERE technique_id = ? AND status = 'published'
       LIMIT 1`,
      [id]
    );
    if (rows.length === 0) return NextResponse.json({ error: '技术动作不存在' }, { status: 404 });

    const [courseRows] = await pool.execute<RowDataPacket[]>(
      `SELECT c.course_id, c.slug, c.title, c.subtitle, c.cover_image, c.price_display, c.duration_minutes,
              c.venue, c.course_type, ct.sort_order
       FROM sup_course_techniques ct
       INNER JOIN sup_courses c ON c.course_id = ct.course_id AND c.status = 'published'
       WHERE ct.technique_id = ?
       ORDER BY ct.sort_order ASC, c.sort_order ASC, c.course_id ASC`,
      [id]
    );

    const item = {
      ...rows[0],
      images: parseJsonArray(rows[0].images).filter((url): url is string => typeof url === 'string' && url.length > 0),
      courses: courseRows,
    };

    return NextResponse.json({ item });
  } catch (error) {
    console.error('获取技术动作详情失败:', error);
    return NextResponse.json({ error: '获取技术动作详情失败' }, { status: 500 });
  }
}
