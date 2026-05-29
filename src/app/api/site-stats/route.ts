import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { localResultSourceCondition } from '@/lib/result-source-scope';
import type { RowDataPacket } from 'mysql2';

export async function GET() {
  try {
    const [resultRows] = await pool.execute<RowDataPacket[]>(
      `SELECT
         COUNT(*) AS result_count,
         COUNT(DISTINCT COALESCE(CAST(er.athlete_id AS CHAR), er.athlete_name_snapshot)) AS result_athlete_count,
         COUNT(DISTINCT er.event_id) AS event_count
       FROM sup_event_results er
       INNER JOIN sup_events e ON e.event_id = er.event_id
       INNER JOIN sup_event_result_sources src ON src.source_id = er.source_id
       WHERE e.status = 'published'
         AND e.event_status = 'completed'
         AND er.source_id IS NOT NULL
         AND ${localResultSourceCondition}
         AND er.review_status = 'confirmed'
         AND er.is_verified = 1`
    );

    const [pointRows] = await pool.execute<RowDataPacket[]>(
      `SELECT
         (SELECT COUNT(*) FROM sup_annual_point_standings)
           + (SELECT COUNT(*) FROM sup_annual_club_point_standings) AS point_count,
         (SELECT COUNT(DISTINCT COALESCE(CAST(athlete_id AS CHAR), athlete_name_snapshot))
          FROM sup_annual_point_standings) AS point_athlete_count`
    );

    return NextResponse.json({
      resultCount: Number(resultRows[0]?.result_count || 0),
      pointCount: Number(pointRows[0]?.point_count || 0),
      resultAthleteCount: Number(resultRows[0]?.result_athlete_count || 0),
      pointAthleteCount: Number(pointRows[0]?.point_athlete_count || 0),
      eventCount: Number(resultRows[0]?.event_count || 0),
    });
  } catch (error) {
    console.error('获取全站统计失败:', error);
    return NextResponse.json({ error: '获取全站统计失败' }, { status: 500 });
  }
}
