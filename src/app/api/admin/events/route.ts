import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { withAdmin } from '@/lib/admin';
import type { RowDataPacket, ResultSetHeader } from 'mysql2';
import { normalizeEventResultsInput, parseSourceLinksInput, replaceEventResults } from '@/lib/event-results';

function dateValue(value: unknown) {
  if (value === undefined || value === '') return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : trimmed;
}

interface EventRow extends RowDataPacket {
  event_id: number;
  name: string;
  slug: string;
  event_type: string;
  province: string | null;
  city: string | null;
  start_date: string | null;
  end_date: string | null;
  organizer: string | null;
  status: string;
  event_status: string;
  star_level: string | null;
  score_coefficient: string | null;
  source_scope: string | null;
  result_status: string | null;
  result_source_note: string | null;
  result_source_links: string | null;
  result_last_verified_at: string | null;
  results_count: number;
  linked_athletes_count: number;
  created_at: Date;
  updated_at: Date;
}

export const GET = withAdmin(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const event_type = searchParams.get('event_type');
    const event_status = searchParams.get('event_status');
    const search = searchParams.get('search');
    const star_level = searchParams.get('star_level');
    const result_status = searchParams.get('result_status');
    const year = searchParams.get('year');
    const sortBy = searchParams.get('sortBy') || '';
    const sortOrderInput = (searchParams.get('sortOrder') || 'desc').toLowerCase();
    const rawPage = parseInt(searchParams.get('page') || '1');
    const rawPageSize = parseInt(searchParams.get('pageSize') || '20');
    const page = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1;
    const pageSize = Number.isInteger(rawPageSize) && rawPageSize > 0 ? Math.min(rawPageSize, 100) : 20;
    const offset = (page - 1) * pageSize;

    const conditions: string[] = [];
    const params: (string | number)[] = [];

    if (status) { conditions.push('e.status = ?'); params.push(status); }
    if (event_type) { conditions.push('e.event_type = ?'); params.push(event_type); }
    if (event_status) { conditions.push('e.event_status = ?'); params.push(event_status); }
    if (star_level) { conditions.push('e.star_level = ?'); params.push(star_level); }
    if (result_status) { conditions.push('e.result_status = ?'); params.push(result_status); }
    if (year) { conditions.push('YEAR(e.start_date) = ?'); params.push(Number(year)); }
    if (search) {
      conditions.push('(e.name LIKE ? OR e.organizer LIKE ? OR e.city LIKE ?)');
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const sortableColumns: Record<string, string> = {
      results_count: 'results_count',
      linked_athletes_count: 'linked_athletes_count',
      start_date: 'e.start_date',
      created_at: 'e.created_at',
    };
    const sortColumn = sortableColumns[sortBy] || 'e.start_date';
    const sortOrder = sortOrderInput === 'asc' ? 'ASC' : 'DESC';
    const orderBy = sortBy
      ? `${sortColumn} ${sortOrder}, e.start_date DESC, e.created_at DESC`
      : 'e.start_date DESC, e.created_at DESC';

    const [countRows] = await pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) as total FROM sup_events e ${where}`, params
    );
    const total = (countRows[0] as { total: number }).total;

    const [events] = await pool.execute<EventRow[]>(
      `SELECT
         e.*,
         COALESCE(r.results_count, 0) AS results_count,
         COALESCE(r.linked_athletes_count, 0) AS linked_athletes_count
       FROM sup_events e
       LEFT JOIN (
         SELECT
           event_id,
           COUNT(*) AS results_count,
           COUNT(DISTINCT athlete_id) AS linked_athletes_count
         FROM sup_event_results
         GROUP BY event_id
       ) r ON r.event_id = e.event_id
       ${where}
       ORDER BY ${orderBy}
       LIMIT ${pageSize} OFFSET ${offset}`,
      params
    );

    return NextResponse.json({ items: events, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
  } catch (error) {
    console.error('获取赛事列表失败:', error);
    return NextResponse.json({ error: '获取赛事列表失败' }, { status: 500 });
  }
});

export const PATCH = withAdmin(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const action = String(body.action || '');
    const ids = Array.isArray(body.ids)
      ? body.ids.map((id: unknown) => Number(id)).filter((id: number) => Number.isInteger(id) && id > 0)
      : [];

    if (!['publish', 'draft', 'delete'].includes(action)) {
      return NextResponse.json({ error: '无效批量操作' }, { status: 400 });
    }
    if (ids.length === 0) {
      return NextResponse.json({ error: '请选择要操作的赛事' }, { status: 400 });
    }
    if (ids.length > 200) {
      return NextResponse.json({ error: '单次最多批量处理 200 条赛事' }, { status: 400 });
    }

    const placeholders = ids.map(() => '?').join(',');
    if (action === 'publish' || action === 'draft') {
      const nextStatus = action === 'publish' ? 'published' : 'draft';
      const [result] = await pool.execute<ResultSetHeader>(
        `UPDATE sup_events SET status = ? WHERE event_id IN (${placeholders})`,
        [nextStatus, ...ids]
      );
      return NextResponse.json({ success: true, affectedRows: result.affectedRows });
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      await connection.execute(
        `UPDATE sup_event_result_sources SET event_id = NULL WHERE event_id IN (${placeholders})`,
        ids
      );
      const [result] = await connection.execute<ResultSetHeader>(
        `DELETE FROM sup_events WHERE event_id IN (${placeholders})`,
        ids
      );
      await connection.commit();
      return NextResponse.json({ success: true, affectedRows: result.affectedRows });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('批量操作赛事失败:', error);
    return NextResponse.json({ error: '批量操作赛事失败' }, { status: 500 });
  }
});

export const POST = withAdmin(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const {
      name, name_en, slug, event_type, location, province, city, venue,
      start_date, end_date, registration_deadline, organizer, description, requirements,
      website, registration_url, contact_info, images, schedule, disciplines,
      price_range, max_participants, status = 'draft', event_status = 'upcoming',
      star_level, score_coefficient, source_scope, result_status = 'none',
      result_source_note, result_source_links, results,
    } = body;

    if (!name || !slug) {
      return NextResponse.json({ error: '赛事名称和 slug 为必填项' }, { status: 400 });
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      const [result] = await connection.execute<ResultSetHeader>(
        `INSERT INTO sup_events (name, name_en, slug, event_type, location, province, city, venue,
          start_date, end_date, registration_deadline, organizer, description, requirements,
          website, registration_url, contact_info, images, schedule, disciplines,
          price_range, max_participants, star_level, score_coefficient, source_scope,
          result_status, result_source_note, result_source_links, result_last_verified_at,
          status, event_status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          name, name_en || null, slug, event_type || 'race',
          location || null, province || null, city || null, venue || null,
          dateValue(start_date), dateValue(end_date), dateValue(registration_deadline),
          organizer || null, description || null, requirements || null,
          website || null, registration_url || null, contact_info || null,
          images ? JSON.stringify(images) : null,
          schedule ? JSON.stringify(schedule) : null,
          disciplines ? JSON.stringify(disciplines) : null,
          price_range || null, max_participants || null,
          star_level || null,
          score_coefficient || null,
          source_scope || null,
          result_status,
          result_source_note || null,
          JSON.stringify(parseSourceLinksInput(result_source_links)),
          result_status && result_status !== 'none' ? new Date() : null,
          status,
          event_status,
        ]
      );

      const eventId = Number(result.insertId);
      const normalizedResults = normalizeEventResultsInput(results);
      if (normalizedResults.length > 0) {
        await replaceEventResults(connection, eventId, normalizedResults);
      }

      await connection.commit();
      return NextResponse.json({ success: true, event_id: eventId }, { status: 201 });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('创建赛事失败:', error);
    return NextResponse.json({ error: '创建赛事失败' }, { status: 500 });
  }
});
