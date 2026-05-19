import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { requireUser } from '@/lib/user-auth';
import type { RowDataPacket } from 'mysql2';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireUser(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT
         er.result_id, er.event_id, er.athlete_id, er.athlete_name_snapshot, er.bib_number,
         er.gender_group, er.discipline, er.board_class, er.round_label, er.rank_position,
         er.result_label, er.finish_time, er.time_seconds, er.points, er.team_name,
         er.source_title, er.source_url, er.source_locator, er.source_note,
         a.name AS athlete_name,
         src.source_url AS source_file_url,
         src.file_name AS source_file_name
       FROM sup_event_results er
       LEFT JOIN sup_athletes a ON a.athlete_id = er.athlete_id
       INNER JOIN sup_event_result_sources src ON src.source_id = er.source_id
       INNER JOIN sup_events e ON e.event_id = er.event_id
       WHERE er.event_id = ? AND e.status = 'published'
         AND er.review_status <> 'pending'
         AND (src.parser_name IN ('parse-race-results.py', 'local-race-results-import') OR src.original_path LIKE '%/桨板赛事/%')
       ORDER BY er.gender_group ASC, er.discipline ASC, er.round_label ASC, er.rank_position ASC`,
      [id]
    );

    return NextResponse.json({ items: rows });
  } catch (error) {
    console.error('获取赛事成绩失败:', error);
    return NextResponse.json({ error: '获取赛事成绩失败' }, { status: 500 });
  }
}
