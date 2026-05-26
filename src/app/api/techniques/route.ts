import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { parseJsonArray } from '@/lib/course-utils';
import type { RowDataPacket } from 'mysql2';

function normalizeTechnique(row: RowDataPacket) {
  const images = parseJsonArray(row.images).filter((item): item is string => typeof item === 'string' && item.length > 0);
  return {
    ...row,
    images,
    image_count: images.length,
    related_courses_count: Number(row.related_courses_count || 0),
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search')?.trim();
    const stage = searchParams.get('stage');
    const level = searchParams.get('level');
    const category = searchParams.get('category');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const pageSize = Math.min(60, Math.max(1, parseInt(searchParams.get('pageSize') || '24', 10)));
    const offset = (page - 1) * pageSize;

    const conditions = ["t.status = 'published'"];
    const params: (string | number)[] = [];
    if (stage) {
      conditions.push('t.stage = ?');
      params.push(Number(stage));
    }
    if (level) {
      conditions.push('t.level = ?');
      params.push(level);
    }
    if (category) {
      conditions.push('t.category = ?');
      params.push(category);
    }
    if (search) {
      conditions.push('(t.name LIKE ? OR t.source_code LIKE ? OR t.stage_label LIKE ? OR t.key_points LIKE ?)');
      const like = `%${search}%`;
      params.push(like, like, like, like);
    }
    const where = `WHERE ${conditions.join(' AND ')}`;

    const [countRows] = await pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) AS total FROM sup_techniques t ${where}`,
      params
    );
    const total = Number(countRows[0]?.total || 0);

    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT
         t.technique_id, t.source_code, t.name, t.cover_image, t.images, t.stage,
         t.stage_label, t.level, t.category, t.points, t.key_points, t.common_errors,
         t.sort_order, t.updated_at,
         COUNT(DISTINCT ct.course_id) AS related_courses_count
       FROM sup_techniques t
       LEFT JOIN sup_course_techniques ct ON ct.technique_id = t.technique_id
       ${where}
       GROUP BY t.technique_id
       ORDER BY t.stage ASC, t.sort_order ASC, t.technique_id ASC
       LIMIT ${pageSize} OFFSET ${offset}`,
      params
    );

    const [facetRows] = await pool.execute<RowDataPacket[]>(
      `SELECT stage, stage_label, level, category, COUNT(*) AS count
       FROM sup_techniques
       WHERE status = 'published'
       GROUP BY stage, stage_label, level, category
       ORDER BY stage ASC, category ASC`
    );

    return NextResponse.json({
      items: rows.map(normalizeTechnique),
      facets: facetRows,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    console.error('获取技术动作列表失败:', error);
    return NextResponse.json({ error: '获取技术动作列表失败' }, { status: 500 });
  }
}
