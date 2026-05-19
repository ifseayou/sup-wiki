import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { requireUser } from '@/lib/user-auth';
import type { RowDataPacket } from 'mysql2';

export async function GET(request: NextRequest) {
  const auth = requireUser(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search')?.trim();
    const gender = searchParams.get('gender')?.trim();
    const discipline = searchParams.get('discipline')?.trim();
    const eventId = searchParams.get('event_id');
    const year = searchParams.get('year');
    const star = searchParams.get('star_level')?.trim();
    const rankMax = searchParams.get('rank_max');
    const timeMax = searchParams.get('time_max');
    const page = Math.max(1, Number(searchParams.get('page') || 1));
    const pageSize = Math.min(100, Math.max(10, Number(searchParams.get('pageSize') || 30)));
    const offset = (page - 1) * pageSize;

    const conditions = ["e.status = 'published'", "e.event_status = 'completed'"];
    const params: (string | number)[] = [];

    if (search) {
      conditions.push('(er.athlete_name_snapshot LIKE ? OR a.name LIKE ? OR er.team_name LIKE ? OR e.name LIKE ?)');
      const like = `%${search}%`;
      params.push(like, like, like, like);
    }
    if (gender) { conditions.push('er.gender_group LIKE ?'); params.push(`%${gender}%`); }
    if (discipline) { conditions.push('er.discipline LIKE ?'); params.push(`%${discipline}%`); }
    if (eventId) { conditions.push('er.event_id = ?'); params.push(Number(eventId)); }
    if (year) { conditions.push('YEAR(e.start_date) = ?'); params.push(Number(year)); }
    if (star) { conditions.push('e.star_level = ?'); params.push(star); }
    if (rankMax) { conditions.push('er.rank_position <= ?'); params.push(Number(rankMax)); }
    if (timeMax) { conditions.push('er.time_seconds <= ?'); params.push(Number(timeMax)); }

    const where = `WHERE ${conditions.join(' AND ')}`;
    const [countRows] = await pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) AS total
       FROM sup_event_results er
       INNER JOIN sup_events e ON e.event_id = er.event_id
       LEFT JOIN sup_athletes a ON a.athlete_id = er.athlete_id
       ${where}`,
      params
    );

    const [items] = await pool.execute<RowDataPacket[]>(
      `SELECT
         er.result_id, er.event_id, er.athlete_id, er.athlete_name_snapshot, er.bib_number,
         er.gender_group, er.discipline, er.board_class, er.round_label, er.rank_position,
         er.result_label, er.finish_time, er.time_seconds, er.points, er.team_name,
         er.source_title, er.source_url, er.source_locator, er.review_status,
         e.name AS event_name, e.start_date, e.city, e.province, e.star_level, e.score_coefficient,
         a.name AS athlete_name, a.photo AS athlete_photo,
         src.source_url AS source_file_url, src.file_name AS source_file_name, src.file_type AS source_file_type
       FROM sup_event_results er
       INNER JOIN sup_events e ON e.event_id = er.event_id
       LEFT JOIN sup_athletes a ON a.athlete_id = er.athlete_id
       LEFT JOIN sup_event_result_sources src ON src.source_id = er.source_id
       ${where}
       ORDER BY e.start_date DESC, er.discipline ASC, er.gender_group ASC, er.rank_position ASC
       LIMIT ${pageSize} OFFSET ${offset}`,
      params
    );

    const [facets] = await pool.execute<RowDataPacket[]>(
      `SELECT
         (SELECT JSON_ARRAYAGG(discipline) FROM (SELECT DISTINCT discipline FROM sup_event_results WHERE discipline IS NOT NULL AND discipline <> '' ORDER BY discipline LIMIT 80) d) AS disciplines,
         (SELECT JSON_ARRAYAGG(gender_group) FROM (SELECT DISTINCT gender_group FROM sup_event_results WHERE gender_group IS NOT NULL AND gender_group <> '' ORDER BY gender_group LIMIT 60) g) AS genders,
         (SELECT JSON_ARRAYAGG(YEAR(start_date)) FROM (SELECT DISTINCT start_date FROM sup_events WHERE start_date IS NOT NULL ORDER BY start_date DESC LIMIT 40) y) AS years`
    );

    const total = Number(countRows[0]?.total || 0);
    return NextResponse.json({
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
      facets: facets[0] || {},
    });
  } catch (error) {
    console.error('查询成绩失败:', error);
    return NextResponse.json({ error: '查询成绩失败' }, { status: 500 });
  }
}
