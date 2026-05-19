import { NextRequest, NextResponse } from 'next/server';
import { withAdmin } from '@/lib/admin';
import pool from '@/lib/db';
import { appendEventResults, normalizeEventResultsInput } from '@/lib/event-results';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';

function slugify(input: string, fallback: string) {
  const ascii = input
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .toLowerCase();
  return ascii || fallback;
}

export const POST = withAdmin(async (request: NextRequest) => {
  const connection = await pool.getConnection();
  try {
    const body = await request.json();
    const eventInput = body.event || {};
    const sourceInput = body.source || {};
    const results = normalizeEventResultsInput(body.results || []);
    if (!eventInput.event_id && !eventInput.name) {
      return NextResponse.json({ error: '缺少赛事信息' }, { status: 400 });
    }
    if (!sourceInput.file_name) {
      return NextResponse.json({ error: '缺少来源文件名' }, { status: 400 });
    }

    await connection.beginTransaction();
    let eventId = Number(eventInput.event_id || 0);
    if (!eventId) {
      const slugBase = slugify(String(eventInput.name), `race-${Date.now()}`);
      const [existing] = await connection.execute<RowDataPacket[]>('SELECT event_id FROM sup_events WHERE slug = ? LIMIT 1', [slugBase]);
      if (existing.length) {
        eventId = Number(existing[0].event_id);
      } else {
        const [insertEvent] = await connection.execute<ResultSetHeader>(
          `INSERT INTO sup_events
            (name, slug, event_type, province, city, venue, start_date, end_date, description,
             star_level, score_coefficient, source_scope, result_status, result_source_note,
             result_last_verified_at, status, event_status)
           VALUES (?, ?, 'race', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), 'published', 'completed')`,
          [
            eventInput.name,
            slugBase,
            eventInput.province || null,
            eventInput.city || null,
            eventInput.venue || null,
            eventInput.start_date || null,
            eventInput.end_date || eventInput.start_date || null,
            eventInput.description || null,
            eventInput.star_level || null,
            eventInput.score_coefficient || null,
            eventInput.source_scope || '成绩册导入',
            results.length ? 'extended_complete' : 'partial',
            sourceInput.file_name,
          ]
        );
        eventId = Number(insertEvent.insertId);
      }
    }

    const [sourceResult] = await connection.execute<ResultSetHeader>(
      `INSERT INTO sup_event_result_sources
        (event_id, original_path, file_name, file_type, source_url, parser_name, parser_status, parser_note, extracted_rows, imported_rows, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        eventId,
        sourceInput.original_path || null,
        sourceInput.file_name,
        sourceInput.file_type || 'unknown',
        sourceInput.source_url || null,
        sourceInput.parser_name || 'race-result-import',
        results.length ? 'imported' : (sourceInput.parser_status || 'pending_review'),
        sourceInput.parser_note || null,
        Number(sourceInput.extracted_rows || results.length || 0),
        results.length,
        sourceInput.metadata ? JSON.stringify(sourceInput.metadata) : null,
      ]
    );
    const sourceId = Number(sourceResult.insertId || sourceInput.source_id || 0) || null;
    const hydratedResults = results.map((item) => ({
      ...item,
      source_id: item.source_id || sourceId,
      source_title: item.source_title || sourceInput.file_name,
      source_url: item.source_url || sourceInput.source_url || null,
      review_status: item.review_status || 'confirmed',
    }));

    if (hydratedResults.length) {
      await appendEventResults(connection, eventId, hydratedResults);
      await connection.execute(
        `UPDATE sup_events
         SET result_status = 'extended_complete', result_source_note = COALESCE(result_source_note, ?), result_last_verified_at = NOW()
         WHERE event_id = ?`,
        [sourceInput.file_name, eventId]
      );
    }

    await connection.commit();
    return NextResponse.json({ success: true, event_id: eventId, source_id: sourceId, imported: hydratedResults.length });
  } catch (error) {
    await connection.rollback();
    console.error('导入成绩失败:', error);
    return NextResponse.json({ error: '导入成绩失败' }, { status: 500 });
  } finally {
    connection.release();
  }
});
