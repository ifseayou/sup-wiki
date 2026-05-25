import { NextRequest, NextResponse } from 'next/server';
import { withAdmin } from '@/lib/admin';
import pool from '@/lib/db';
import { normalizeTechniqueIds } from '@/lib/course-utils';
import type { PoolConnection, ResultSetHeader } from 'mysql2/promise';

async function syncCourseTechniques(connection: PoolConnection, courseId: number, techniqueIds: number[]) {
  await connection.execute('DELETE FROM sup_course_techniques WHERE course_id = ?', [courseId]);
  for (let index = 0; index < techniqueIds.length; index += 1) {
    await connection.execute(
      'INSERT INTO sup_course_techniques (course_id, technique_id, sort_order) VALUES (?, ?, ?)',
      [courseId, techniqueIds[index], index + 1]
    );
  }
}

const jsonArrayFields = new Set([
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
]);

const jsonObjectFields = new Set(['coach_profile']);

function jsonValue(value: unknown, fallback: unknown[] | Record<string, unknown>) {
  if (value === null || value === '') return null;
  if (Array.isArray(value) || typeof value === 'object') return JSON.stringify(value);
  try {
    JSON.parse(String(value));
    return String(value);
  } catch {
    return JSON.stringify(fallback);
  }
}

export const PUT = withAdmin(async (request: NextRequest) => {
  const connection = await pool.getConnection();
  try {
    const id = Number(new URL(request.url).pathname.split('/').at(-1));
    const body = await request.json();
    const allowed = [
      'slug', 'title', 'subtitle', 'summary', 'description', 'venue', 'schedule_note',
      'cover_image', 'images', 'equipment_note', 'board_note', 'duration_minutes', 'price_display', 'price_options',
      'course_type', 'positioning', 'audience_tags', 'target_audience', 'consultation_required', 'learning_outcomes',
      'capacity_note', 'age_note', 'includes', 'excludes', 'bring_items', 'safety_notes', 'class_flow',
      'change_policy', 'coach_profile', 'faq', 'enrollment_note', 'wechat_id', 'cta_text',
      'sort_order', 'status',
    ];
    const fields: string[] = [];
    const values: (string | number | null)[] = [];
    for (const field of allowed) {
      if (body[field] !== undefined) {
        fields.push(`${field} = ?`);
        if (jsonArrayFields.has(field)) {
          values.push(jsonValue(body[field], []) as string | null);
        } else if (jsonObjectFields.has(field)) {
          values.push(jsonValue(body[field], {}) as string | null);
        } else {
          values.push(body[field] === '' ? null : body[field]);
        }
      }
    }
    const techniqueIds = body.technique_ids !== undefined ? normalizeTechniqueIds(body.technique_ids) : null;
    if (fields.length === 0 && techniqueIds === null) {
      return NextResponse.json({ error: '没有要更新的字段' }, { status: 400 });
    }

    await connection.beginTransaction();
    if (fields.length > 0) {
      values.push(id);
      const [result] = await connection.execute<ResultSetHeader>(
        `UPDATE sup_courses SET ${fields.join(', ')} WHERE course_id = ?`,
        values
      );
      if (result.affectedRows === 0) {
        await connection.rollback();
        return NextResponse.json({ error: '课程不存在' }, { status: 404 });
      }
    }
    if (techniqueIds !== null) {
      await syncCourseTechniques(connection, id, techniqueIds);
    }
    await connection.commit();
    return NextResponse.json({ success: true });
  } catch (error) {
    await connection.rollback();
    console.error('更新课程失败:', error);
    return NextResponse.json({ error: '更新课程失败' }, { status: 500 });
  } finally {
    connection.release();
  }
});

export const DELETE = withAdmin(async (request: NextRequest) => {
  try {
    const id = Number(new URL(request.url).pathname.split('/').at(-1));
    const [result] = await pool.execute<ResultSetHeader>(
      'DELETE FROM sup_courses WHERE course_id = ?',
      [id]
    );
    if (result.affectedRows === 0) return NextResponse.json({ error: '课程不存在' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('删除课程失败:', error);
    return NextResponse.json({ error: '删除课程失败' }, { status: 500 });
  }
});
