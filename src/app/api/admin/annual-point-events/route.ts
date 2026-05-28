import { NextRequest, NextResponse } from 'next/server';
import { withAdmin } from '@/lib/admin';
import pool from '@/lib/db';
import { analyzeAnnualPointEvents, normalizeCandidateEvents } from '@/lib/annual-point-events';
import type { RowDataPacket } from 'mysql2/promise';

const STATUS_VALUES = new Set(['unmatched', 'candidate', 'confirmed', 'ignored']);

function idValue(value: unknown) {
  const id = Number(value || 0);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export const GET = withAdmin(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, Number(searchParams.get('page') || 1));
    const pageSize = Math.min(100, Math.max(10, Number(searchParams.get('pageSize') || 30)));
    const offset = (page - 1) * pageSize;
    const status = searchParams.get('status') || '';
    const gap = searchParams.get('gap') || '';
    const search = searchParams.get('search') || '';

    const conditions: string[] = [];
    const params: (string | number)[] = [];
    if (status && STATUS_VALUES.has(status)) {
      conditions.push('m.match_status = ?');
      params.push(status);
    }
    if (search) {
      conditions.push('(m.point_event_name LIKE ? OR e.name LIKE ? OR CAST(m.mapping_id AS CHAR) = ?)');
      params.push(`%${search}%`, `%${search}%`, search);
    }
    if (gap === 'missing_event') {
      conditions.push("m.match_status = 'unmatched'");
    } else if (gap === 'needs_confirm') {
      conditions.push("m.match_status = 'candidate'");
    } else if (gap === 'missing_results') {
      conditions.push("m.match_status = 'confirmed' AND COALESCE(r.results_count, 0) = 0");
    } else if (gap === 'partial_results') {
      conditions.push("m.match_status = 'confirmed' AND COALESCE(r.results_count, 0) > 0 AND COALESCE(e.result_status, 'none') <> 'extended_complete'");
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [countRows] = await pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) AS total
       FROM sup_annual_point_event_mappings m
       LEFT JOIN sup_events e ON e.event_id = m.matched_event_id
       LEFT JOIN (
         SELECT event_id, COUNT(*) AS results_count
         FROM sup_event_results
         GROUP BY event_id
       ) r ON r.event_id = e.event_id
       ${where}`,
      params
    );

    const [items] = await pool.execute<RowDataPacket[]>(
      `SELECT
         m.*,
         e.name AS matched_event_name,
         e.start_date AS matched_event_start_date,
         e.city AS matched_event_city,
         e.province AS matched_event_province,
         e.result_status AS matched_event_result_status,
         COALESCE(r.results_count, 0) AS matched_event_results_count
       FROM sup_annual_point_event_mappings m
       LEFT JOIN sup_events e ON e.event_id = m.matched_event_id
       LEFT JOIN (
         SELECT event_id, COUNT(*) AS results_count
         FROM sup_event_results
         GROUP BY event_id
       ) r ON r.event_id = e.event_id
       ${where}
       ORDER BY
         CASE m.match_status WHEN 'unmatched' THEN 0 WHEN 'candidate' THEN 1 WHEN 'confirmed' THEN 2 ELSE 3 END,
         COALESCE(m.star_level, 0) DESC,
         m.athlete_count DESC,
         m.total_point_sum DESC
       LIMIT ${pageSize} OFFSET ${offset}`,
      params
    );

    const [stats] = await pool.execute<RowDataPacket[]>(
      `SELECT
         COUNT(*) AS total,
         SUM(match_status = 'unmatched') AS unmatched,
         SUM(match_status = 'candidate') AS candidate,
         SUM(match_status = 'confirmed') AS confirmed,
         SUM(match_status = 'ignored') AS ignored,
         SUM(match_status = 'confirmed' AND COALESCE(r.results_count, 0) = 0) AS missing_results,
         SUM(match_status = 'confirmed' AND COALESCE(r.results_count, 0) > 0 AND COALESCE(e.result_status, 'none') <> 'extended_complete') AS partial_results
       FROM sup_annual_point_event_mappings m
       LEFT JOIN sup_events e ON e.event_id = m.matched_event_id
       LEFT JOIN (
         SELECT event_id, COUNT(*) AS results_count
         FROM sup_event_results
         GROUP BY event_id
       ) r ON r.event_id = e.event_id`
    );

    return NextResponse.json({
      items: items.map((item) => ({ ...item, candidate_events: normalizeCandidateEvents(item.candidate_events) })),
      stats: stats[0] || null,
      total: Number(countRows[0]?.total || 0),
      page,
      pageSize,
      totalPages: Math.ceil(Number(countRows[0]?.total || 0) / pageSize),
    });
  } catch (error) {
    console.error('获取积分赛事雷达失败:', error);
    return NextResponse.json({ error: '获取积分赛事雷达失败' }, { status: 500 });
  }
});

export const POST = withAdmin(async (request: NextRequest) => {
  const connection = await pool.getConnection();
  try {
    const body = await request.json().catch(() => ({}));
    const action = String(body.action || 'analyze');

    if (action === 'analyze') {
      const result = await analyzeAnnualPointEvents(connection);
      return NextResponse.json({ success: true, ...result });
    }

    const mappingId = idValue(body.mapping_id);
    if (!mappingId) return NextResponse.json({ error: '缺少映射 ID' }, { status: 400 });

    if (action === 'confirm') {
      const eventId = idValue(body.event_id);
      if (!eventId) return NextResponse.json({ error: '缺少赛事 ID' }, { status: 400 });
      const [events] = await connection.execute<RowDataPacket[]>('SELECT event_id FROM sup_events WHERE event_id = ? LIMIT 1', [eventId]);
      if (!events.length) return NextResponse.json({ error: '赛事不存在' }, { status: 404 });
      await connection.execute(
        `UPDATE sup_annual_point_event_mappings
         SET matched_event_id = ?, match_status = 'confirmed', match_confidence = GREATEST(match_confidence, 0.900),
             match_reason = '管理员确认绑定', admin_note = ?, updated_at = CURRENT_TIMESTAMP
         WHERE mapping_id = ?`,
        [eventId, String(body.admin_note || '').trim() || null, mappingId]
      );
      return NextResponse.json({ success: true });
    }

    if (action === 'ignore') {
      await connection.execute(
        `UPDATE sup_annual_point_event_mappings
         SET match_status = 'ignored', admin_note = ?, updated_at = CURRENT_TIMESTAMP
         WHERE mapping_id = ?`,
        [String(body.admin_note || '').trim() || '管理员忽略', mappingId]
      );
      return NextResponse.json({ success: true });
    }

    if (action === 'reset') {
      await connection.execute(
        `UPDATE sup_annual_point_event_mappings
         SET match_status = 'unmatched', matched_event_id = NULL, match_confidence = 0, match_reason = NULL, admin_note = ?, updated_at = CURRENT_TIMESTAMP
         WHERE mapping_id = ?`,
        [String(body.admin_note || '').trim() || null, mappingId]
      );
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: '无效操作' }, { status: 400 });
  } catch (error) {
    console.error('处理积分赛事雷达失败:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : '处理积分赛事雷达失败' }, { status: 500 });
  } finally {
    connection.release();
  }
});
