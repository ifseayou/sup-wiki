import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { parseJsonArray, parseTechniqueJson } from '@/lib/course-utils';
import type { RowDataPacket } from 'mysql2';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');
    const offset = (page - 1) * pageSize;

    const conditions: string[] = ["c.status = 'published'"];
    const params: (string | number)[] = [];
    if (search) {
      conditions.push('(c.title LIKE ? OR c.subtitle LIKE ? OR c.summary LIKE ?)');
      const like = `%${search}%`;
      params.push(like, like, like);
    }
    const where = `WHERE ${conditions.join(' AND ')}`;

    const [countRows] = await pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) as total FROM sup_courses c ${where}`,
      params
    );
    const total = Number(countRows[0]?.total || 0);

    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT
         c.*,
         COALESCE(
           JSON_ARRAYAGG(
             CASE
               WHEN t.technique_id IS NULL THEN NULL
               ELSE JSON_OBJECT(
                 'technique_id', t.technique_id,
                 'source_code', t.source_code,
                 'name', t.name,
                 'cover_image', t.cover_image,
                 'images', t.images,
                 'stage', t.stage,
                 'stage_label', t.stage_label,
                 'level', t.level,
                 'category', t.category,
                 'points', t.points,
                 'key_points', t.key_points,
                 'common_errors', t.common_errors,
                 'sort_order', t.sort_order,
                 'status', t.status
               )
             END
           ),
           JSON_ARRAY()
         ) AS techniques
       FROM sup_courses c
       LEFT JOIN sup_course_techniques ct ON ct.course_id = c.course_id
       LEFT JOIN sup_techniques t ON t.technique_id = ct.technique_id AND t.status = 'published'
       ${where}
       GROUP BY c.course_id
       ORDER BY c.sort_order ASC, c.course_id ASC
       LIMIT ${pageSize} OFFSET ${offset}`,
      params
    );

    const items = rows.map((row) => ({
      ...row,
      price_options: parseJsonArray(row.price_options),
      images: parseJsonArray(row.images),
      techniques: parseTechniqueJson(row.techniques).filter(Boolean),
    }));

    return NextResponse.json({ items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
  } catch (error) {
    console.error('获取课程列表失败:', error);
    return NextResponse.json({ error: '获取课程列表失败' }, { status: 500 });
  }
}
