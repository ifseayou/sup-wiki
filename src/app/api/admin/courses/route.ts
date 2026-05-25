import { NextRequest, NextResponse } from 'next/server';
import { withAdmin } from '@/lib/admin';
import pool from '@/lib/db';
import { getTechniqueIdsFromRows, normalizeTechniqueIds, parseJsonArray, parseJsonObject } from '@/lib/course-utils';
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

const jsonArrayFields = [
  'images',
  'price_options',
  'audience_tags',
  'target_audience',
  'consultation_required',
  'learning_outcomes',
  'includes',
  'excludes',
  'bring_items',
  'safety_notes',
  'class_flow',
  'faq',
];

const jsonObjectFields = ['coach_profile'];

function normalizeCourseRow(row: RowDataPacket, relations: RowDataPacket[] = []) {
  return {
    ...row,
    ...Object.fromEntries(jsonArrayFields.map((field) => [field, parseJsonArray(row[field])])),
    ...Object.fromEntries(jsonObjectFields.map((field) => [field, parseJsonObject(row[field])])),
    technique_ids: getTechniqueIdsFromRows(relations.filter((relation) => Number(relation.course_id) === Number(row.course_id))),
  };
}

function jsonValue(value: unknown, fallback: unknown[] | Record<string, unknown>) {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  if (Array.isArray(value) || typeof value === 'object') return JSON.stringify(value);
  try {
    JSON.parse(String(value));
    return String(value);
  } catch {
    return JSON.stringify(fallback);
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

    const items = rows.map((row) => normalizeCourseRow(row, relations));

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
      course_type = 'custom', positioning, audience_tags, target_audience, consultation_required,
      learning_outcomes, capacity_note, age_note, includes, excludes, bring_items,
      safety_notes, class_flow, change_policy, coach_profile, faq, enrollment_note,
      wechat_id = 'i_add_u', cta_text = '微信咨询课程',
      sort_order = 0, status = 'draft',
    } = body;
    if (!slug || !title) return NextResponse.json({ error: '缺少必填字段: slug, title' }, { status: 400 });

    const techniqueIds = normalizeTechniqueIds(body.technique_ids);
    await connection.beginTransaction();
    const [result] = await connection.execute<ResultSetHeader>(
      `INSERT INTO sup_courses
        (slug, title, subtitle, summary, description, cover_image, images, venue, schedule_note, equipment_note, board_note,
         course_type, positioning, audience_tags, target_audience, consultation_required, learning_outcomes, capacity_note, age_note,
         includes, excludes, bring_items, safety_notes, class_flow, change_policy, coach_profile, faq, enrollment_note, wechat_id, cta_text,
         duration_minutes, price_display, price_options, sort_order, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        slug,
        title,
        subtitle || null,
        summary || null,
        description || null,
        cover_image || null,
        jsonValue(images, []),
        venue || null,
        schedule_note || null,
        equipment_note || null,
        board_note || null,
        course_type || 'custom',
        positioning || null,
        jsonValue(audience_tags, []),
        jsonValue(target_audience, []),
        jsonValue(consultation_required, []),
        jsonValue(learning_outcomes, []),
        capacity_note || null,
        age_note || null,
        jsonValue(includes, []),
        jsonValue(excludes, []),
        jsonValue(bring_items, []),
        jsonValue(safety_notes, []),
        jsonValue(class_flow, []),
        change_policy || null,
        jsonValue(coach_profile, {}),
        jsonValue(faq, []),
        enrollment_note || null,
        wechat_id || 'i_add_u',
        cta_text || '微信咨询课程',
        duration_minutes ? Number(duration_minutes) : null,
        price_display || null,
        jsonValue(price_options, []),
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
