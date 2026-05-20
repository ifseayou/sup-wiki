import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { requireUser } from '@/lib/user-auth';
import { localResultSourceCondition } from '@/lib/result-source-scope';
import { resultDefaultOrderBy } from '@/lib/result-ordering';
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
         er.result_label, er.finish_time, er.result_status_code, er.result_status_note, er.time_seconds, er.points, er.team_name,
         er.source_title, er.source_url, er.source_locator, er.source_note,
         a.name AS athlete_name,
         a.photo AS athlete_photo,
         src.source_url AS source_file_url,
         src.file_name AS source_file_name,
         (
           SELECT JSON_ARRAYAGG(JSON_OBJECT('athlete_id', erm.athlete_id, 'name', erm.member_name, 'member_order', erm.member_order))
           FROM sup_event_result_members erm
           WHERE erm.result_id = er.result_id
         ) AS team_members
       FROM sup_event_results er
       LEFT JOIN sup_athletes a ON a.athlete_id = er.athlete_id
       INNER JOIN sup_event_result_sources src ON src.source_id = er.source_id
       INNER JOIN sup_events e ON e.event_id = er.event_id
       WHERE er.event_id = ? AND e.status = 'published'
         AND er.review_status <> 'pending'
         AND ${localResultSourceCondition}
       ORDER BY ${resultDefaultOrderBy()}`,
      [id]
    );

    const [pointRows] = await pool.execute<RowDataPacket[]>(
      `SELECT
         ps.standing_id, ps.event_id, ps.source_id, ps.group_name, ps.rank_position, ps.status_rank,
         ps.bib_number, ps.athlete_id, ps.athlete_name_snapshot, ps.team_name,
         ps.endurance_rank, ps.endurance_points, ps.sprint_rank, ps.sprint_points, ps.total_points,
         ps.source_locator,
         a.name AS athlete_name,
         a.photo AS athlete_photo,
         src.source_url AS source_file_url,
         src.file_name AS source_file_name
       FROM sup_event_point_standings ps
       LEFT JOIN sup_athletes a ON a.athlete_id = ps.athlete_id
       LEFT JOIN sup_event_result_sources src ON src.source_id = ps.source_id
       INNER JOIN sup_events e ON e.event_id = ps.event_id
       WHERE ps.event_id = ? AND e.status = 'published'
       ORDER BY
         FIELD(ps.group_name, '公开男子组', '公开女子组', '大师男子组', '大师女子组', '卡胡纳男子组', '卡胡纳女子组', '高校男子组', '高校女子组', 'U15男子组', 'U15女子组', 'U12男子组', 'U12女子组', 'U9男子组', 'U9女子组'),
         CASE WHEN ps.rank_position IS NULL THEN 1 ELSE 0 END,
         ps.rank_position ASC,
         ps.standing_id ASC`,
      [id]
    );

    return NextResponse.json({ items: rows, point_standings: pointRows });
  } catch (error) {
    console.error('获取赛事成绩失败:', error);
    return NextResponse.json({ error: '获取赛事成绩失败' }, { status: 500 });
  }
}
