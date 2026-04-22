import { NextRequest, NextResponse } from 'next/server';
import type { RowDataPacket } from 'mysql2';
import pool from '@/lib/db';
import { withAdmin } from '@/lib/admin';
import { normalizeEventResultsInput, replaceEventResults } from '@/lib/event-results';

interface EventResultRow extends RowDataPacket {
  result_id: number;
  event_id: number;
  athlete_id: number | null;
  athlete_name_snapshot: string;
  gender_group: string;
  discipline: string;
  round_label: string | null;
  rank_position: number;
  result_label: string | null;
  finish_time: string;
  time_seconds: number | null;
  team_name: string | null;
  nationality_snapshot: string | null;
  source_type: string | null;
  source_title: string | null;
  source_url: string | null;
  source_note: string | null;
  is_verified: number;
  athlete_name: string | null;
}

export const GET = withAdmin(async (request: NextRequest, _ctx) => {
  try {
    const url = new URL(request.url);
    const id = Number(url.pathname.split('/').at(-2));
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ error: '无效赛事 ID' }, { status: 400 });
    }

    const [results] = await pool.execute<EventResultRow[]>(
      `SELECT
         er.*,
         a.name AS athlete_name
       FROM sup_event_results er
       LEFT JOIN sup_athletes a ON a.athlete_id = er.athlete_id
       WHERE er.event_id = ?
       ORDER BY er.gender_group ASC, er.discipline ASC, er.round_label ASC, er.rank_position ASC`,
      [id]
    );

    return NextResponse.json({
      items: results.map((row) => ({
        ...row,
        is_verified: Boolean(row.is_verified),
      })),
    });
  } catch (error) {
    console.error('获取赛事成绩失败:', error);
    return NextResponse.json({ error: '获取赛事成绩失败' }, { status: 500 });
  }
});

export const POST = withAdmin(async (request: NextRequest, _ctx) => {
  try {
    const url = new URL(request.url);
    const id = Number(url.pathname.split('/').at(-2));
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ error: '无效赛事 ID' }, { status: 400 });
    }
    const body = await request.json();
    const results = normalizeEventResultsInput(body.results);

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      await replaceEventResults(connection, id, results);
      await connection.execute(
        `UPDATE sup_events
         SET result_status = ?,
             result_last_verified_at = CASE WHEN ? = 'none' THEN result_last_verified_at ELSE CURRENT_TIMESTAMP END
         WHERE event_id = ?`,
        [body.result_status || null, body.result_status || null, id]
      );
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('保存赛事成绩失败:', error);
    return NextResponse.json({ error: '保存赛事成绩失败' }, { status: 500 });
  }
});
