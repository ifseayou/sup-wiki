import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { withAdmin } from '@/lib/admin';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import { normalizeEventResultsInput, parseSourceLinksInput, replaceEventResults } from '@/lib/event-results';

export const GET = withAdmin(async (request: NextRequest, _ctx) => {
  try {
    const url = new URL(request.url);
    const id = Number(url.pathname.split('/').at(-1));
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ error: '无效赛事 ID' }, { status: 400 });
    }
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT
         e.*,
         COALESCE(r.results_count, 0) AS results_count,
         COALESCE(r.linked_athletes_count, 0) AS linked_athletes_count
       FROM sup_events e
       LEFT JOIN (
         SELECT event_id, COUNT(*) AS results_count, COUNT(DISTINCT athlete_id) AS linked_athletes_count
         FROM sup_event_results
         GROUP BY event_id
       ) r ON r.event_id = e.event_id
       WHERE e.event_id = ?`,
      [id]
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: '赛事不存在' }, { status: 404 });
    }

    return NextResponse.json(rows[0]);
  } catch (error) {
    console.error('获取赛事详情失败:', error);
    return NextResponse.json({ error: '获取赛事详情失败' }, { status: 500 });
  }
});

export const PUT = withAdmin(async (request: NextRequest, _ctx) => {
  try {
    const url = new URL(request.url);
    const id = Number(url.pathname.split('/').at(-1));
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ error: '无效赛事 ID' }, { status: 400 });
    }
    const body = await request.json();

    const {
      name, name_en, slug, event_type, location, province, city, venue,
      start_date, end_date, registration_deadline, organizer, description, requirements,
      website, registration_url, contact_info, images, schedule, disciplines,
      price_range, max_participants, status, event_status, star_level, score_coefficient,
      source_scope, result_status, result_source_note, result_source_links, results
    } = body;
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      const [result] = await connection.execute<ResultSetHeader>(
        `UPDATE sup_events SET
          name = COALESCE(?, name),
          name_en = ?,
          slug = COALESCE(?, slug),
          event_type = COALESCE(?, event_type),
          location = ?,
          province = ?,
          city = ?,
          venue = ?,
          start_date = ?,
          end_date = ?,
          registration_deadline = ?,
          organizer = ?,
          description = ?,
          requirements = ?,
          website = ?,
          registration_url = ?,
          contact_info = ?,
          images = ?,
          schedule = ?,
          disciplines = ?,
          price_range = ?,
          max_participants = ?,
          star_level = ?,
          score_coefficient = ?,
          source_scope = ?,
          result_status = COALESCE(?, result_status),
          result_source_note = ?,
          result_source_links = ?,
          result_last_verified_at = CASE WHEN ? IS NULL OR ? = 'none' THEN result_last_verified_at ELSE CURRENT_TIMESTAMP END,
          status = COALESCE(?, status),
          event_status = COALESCE(?, event_status)
         WHERE event_id = ?`,
        [
          name || null, name_en !== undefined ? name_en : undefined,
          slug || null, event_type || null,
          location !== undefined ? location : undefined,
          province !== undefined ? province : undefined,
          city !== undefined ? city : undefined,
          venue !== undefined ? venue : undefined,
          start_date !== undefined ? start_date : undefined,
          end_date !== undefined ? end_date : undefined,
          registration_deadline !== undefined ? registration_deadline : undefined,
          organizer !== undefined ? organizer : undefined,
          description !== undefined ? description : undefined,
          requirements !== undefined ? requirements : undefined,
          website !== undefined ? website : undefined,
          registration_url !== undefined ? registration_url : undefined,
          contact_info !== undefined ? contact_info : undefined,
          images !== undefined ? JSON.stringify(images) : undefined,
          schedule !== undefined ? JSON.stringify(schedule) : undefined,
          disciplines !== undefined ? JSON.stringify(disciplines) : undefined,
          price_range !== undefined ? price_range : undefined,
          max_participants !== undefined ? max_participants : undefined,
          star_level !== undefined ? star_level || null : undefined,
          score_coefficient !== undefined ? score_coefficient || null : undefined,
          source_scope !== undefined ? source_scope || null : undefined,
          result_status || null,
          result_source_note !== undefined ? result_source_note : undefined,
          result_source_links !== undefined ? JSON.stringify(parseSourceLinksInput(result_source_links)) : undefined,
          result_status || null,
          result_status || null,
          status || null, event_status || null,
          id,
        ]
      );

      if (result.affectedRows === 0) {
        await connection.rollback();
        return NextResponse.json({ error: '赛事不存在' }, { status: 404 });
      }

      if (results !== undefined) {
        await replaceEventResults(connection, id, normalizeEventResultsInput(results));
      }

      await connection.commit();
      return NextResponse.json({ success: true });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('更新赛事失败:', error);
    return NextResponse.json({ error: '更新赛事失败' }, { status: 500 });
  }
});

export const DELETE = withAdmin(async (request: NextRequest, _ctx) => {
  try {
    const url = new URL(request.url);
    const id = Number(url.pathname.split('/').at(-1));
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ error: '无效赛事 ID' }, { status: 400 });
    }

    const [result] = await pool.execute<ResultSetHeader>(
      'DELETE FROM sup_events WHERE event_id = ?',
      [id]
    );

    if (result.affectedRows === 0) {
      return NextResponse.json({ error: '赛事不存在' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('删除赛事失败:', error);
    return NextResponse.json({ error: '删除赛事失败' }, { status: 500 });
  }
});
