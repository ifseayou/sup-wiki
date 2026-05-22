import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { requireUser } from '@/lib/user-auth';
import { localResultSourceCondition } from '@/lib/result-source-scope';
import { resultDefaultOrderBy } from '@/lib/result-ordering';
import type { RowDataPacket } from 'mysql2';

function bibPrefix(value: unknown) {
  const text = String(value || '').trim();
  return text ? text.slice(0, 2) : '';
}

export async function GET(request: NextRequest) {
  const user = requireUser(request);
  if (user instanceof NextResponse) return user;

  try {
    const athleteId = Number(request.nextUrl.searchParams.get('athlete_id'));
    if (!Number.isInteger(athleteId) || athleteId <= 0) {
      return NextResponse.json({ error: '无效运动员 ID' }, { status: 400 });
    }

    const [athletes] = await pool.execute<RowDataPacket[]>(
      `SELECT athlete_id, name, photo, province, city, bio
       FROM sup_athletes
       WHERE athlete_id = ?
       LIMIT 1`,
      [athleteId]
    );
    if (!athletes.length) return NextResponse.json({ error: '运动员不存在' }, { status: 404 });

    const [results] = await pool.execute<RowDataPacket[]>(
      `SELECT
         er.result_id, er.bib_number, er.gender_group, er.discipline, er.rank_position, er.finish_time,
         e.name AS event_name, e.start_date, e.province, e.city
       FROM sup_event_results er
       INNER JOIN sup_events e ON e.event_id = er.event_id
       INNER JOIN sup_event_result_sources src ON src.source_id = er.source_id
       WHERE er.athlete_id = ?
         AND e.status = 'published'
         AND e.event_status = 'completed'
         AND er.review_status = 'confirmed'
         AND er.is_verified = 1
         AND er.source_id IS NOT NULL
         AND ${localResultSourceCondition}
       ORDER BY COALESCE(e.start_date, '1900-01-01') DESC, ${resultDefaultOrderBy()}
       LIMIT 3`,
      [athleteId]
    );

    return NextResponse.json({
      athlete: athletes[0],
      recent_results: results.map((row) => ({
        ...row,
        bib_prefix: bibPrefix(row.bib_number),
        bib_number: undefined,
      })),
    });
  } catch (error) {
    console.error('获取运动员认领选项失败:', error);
    return NextResponse.json({ error: '获取运动员认领选项失败' }, { status: 500 });
  }
}
