import { NextRequest, NextResponse } from 'next/server';
import { withAdmin } from '@/lib/admin';
import pool from '@/lib/db';
import { getTechniqueIdsFromRows, normalizeTechniqueIds, parseJsonArray } from '@/lib/course-utils';
import type { PoolConnection, RowDataPacket, ResultSetHeader } from 'mysql2/promise';

async function syncCourseTechniques(connection: PoolConnection, courseId: number, techniqueIds: number[]) {
  await connection.execute('DELETE FROM sup_course_techniques WHERE course_id = ?', [courseId]);
  for (let index = 0; index < techniqueIds.length; index += 1) {
    await connection.execute(
      'INSERT INTO sup_course_techniques (course_id, technique_id, sort_order) VALUES (?, ?, ?)',
      [courseId, techniqueIds[index], index + 1]
    );
  }
}

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
    if (status) { conditions.push('c.status = ?'); params.push(status); }
    if (search) {
      conditions.push('(c.title LIKE ? OR c.subtitle LIKE ? OR c.summary LIKE ?)');
      const like = `%${search}%`;
      params.push(like, like, like);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [countRows] = await pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) as total FROM sup_courses c ${where}`,
      params
    );
    const total = Number(countRows[0]?.total || 0);

    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT c.*, COUNT(ct.technique_id) AS techniques_count
       FROM sup_courses c
       LEFT JOIN sup_course_techniques ct ON ct.course_id = c.course_id
       ${where}
       GROUP BY c.course_id
       ORDER BY CASE c.status WHEN 'published' THEN 0 ELSE 1 END, c.sort_order ASC, c.course_id ASC
       LIMIT ${pageSize} OFFSET ${offset}`,
      params
    );

    const courseIds = rows.map((row) => Number(row.course_id));
    let relations: RowDataPacket[] = [];
    if (courseIds.length > 0) {
      const [relationRows] = await pool.query<RowDataPacket[]>(
        `SELECT course_id, technique_id
         FROM sup_course_techniques
         WHERE course_id IN (${courseIds.map(() => '?').join(',')})
         ORDER BY sort_order ASC`,
        courseIds
      );
      relations = relationRows;
    }

    const items = rows.map((row) => ({
      ...row,
      price_options: parseJsonArray(row.price_options),
      images: parseJsonArray(row.images),
      technique_ids: getTechniqueIdsFromRows(relations.filter((relation) => Number(relation.course_id) === Number(row.course_id))),
    }));

    return NextResponse.json({ items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
  } catch (error) {
    console.error('获取课程列表失败:', error);
    return NextResponse.json({ error: '获取课程列表失败' }, { status: 500 });
  }
});

export const POST = withAdmin(async (request: NextRequest) => {
  const connection = await pool.getConnection();
  try {
    const body = await request.json();
    const {
      slug, title, subtitle, summary, description,
      cover_image, images,
      venue = '中流击水桨板俱乐部（余杭塘河-梦想小镇段）',
      schedule_note = '课程时间和教练自行约定',
      equipment_note, board_note, duration_minutes, price_display, price_options,
      sort_order = 0, status = 'draft',
    } = body;
    if (!slug || !title) return NextResponse.json({ error: '缺少必填字段: slug, title' }, { status: 400 });

    const techniqueIds = normalizeTechniqueIds(body.technique_ids);
    await connection.beginTransaction();
    const [result] = await connection.execute<ResultSetHeader>(
      `INSERT INTO sup_courses
        (slug, title, subtitle, summary, description, cover_image, images, venue, schedule_note, equipment_note, board_note,
         duration_minutes, price_display, price_options, sort_order, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        slug,
        title,
        subtitle || null,
        summary || null,
        description || null,
        cover_image || null,
        images ? JSON.stringify(images) : null,
        venue || null,
        schedule_note || null,
        equipment_note || null,
        board_note || null,
        duration_minutes ? Number(duration_minutes) : null,
        price_display || null,
        price_options ? JSON.stringify(price_options) : null,
        Number(sort_order) || 0,
        status,
      ]
    );
    await syncCourseTechniques(connection, result.insertId, techniqueIds);
    await connection.commit();
    return NextResponse.json({ success: true, course_id: result.insertId }, { status: 201 });
  } catch (error) {
    await connection.rollback();
    console.error('创建课程失败:', error);
    return NextResponse.json({ error: '创建课程失败' }, { status: 500 });
  } finally {
    connection.release();
  }
});
