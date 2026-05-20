import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { requireUser } from '@/lib/user-auth';
import { localResultSourceCondition } from '@/lib/result-source-scope';
import { resultDefaultOrderBy } from '@/lib/result-ordering';
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
    const athleteId = searchParams.get('athlete_id');
    const year = searchParams.get('year');
    const star = searchParams.get('star_level')?.trim();
    const rankMax = searchParams.get('rank_max');
    const timeMax = searchParams.get('time_max');
    const page = Math.max(1, Number(searchParams.get('page') || 1));
    const pageSize = Math.min(100, Math.max(10, Number(searchParams.get('pageSize') || 30)));
    const offset = (page - 1) * pageSize;

    const conditions = [
      "e.status = 'published'",
      "e.event_status = 'completed'",
      'er.source_id IS NOT NULL',
      localResultSourceCondition,
      "er.review_status <> 'pending'",
    ];
    const params: (string | number)[] = [];

    if (search) {
      conditions.push(`(
        er.athlete_name_snapshot LIKE ? OR a.name LIKE ? OR er.team_name LIKE ? OR e.name LIKE ?
        OR EXISTS (SELECT 1 FROM sup_event_result_members erm_s WHERE erm_s.result_id = er.result_id AND erm_s.member_name LIKE ?)
      )`);
      const like = `%${search}%`;
      params.push(like, like, like, like, like);
    }
    if (gender) { conditions.push('er.gender_group LIKE ?'); params.push(`%${gender}%`); }
    if (discipline) { conditions.push('er.discipline LIKE ?'); params.push(`%${discipline}%`); }
    if (eventId) { conditions.push('er.event_id = ?'); params.push(Number(eventId)); }
    if (athleteId) {
      conditions.push('(er.athlete_id = ? OR EXISTS (SELECT 1 FROM sup_event_result_members erm_a WHERE erm_a.result_id = er.result_id AND erm_a.athlete_id = ?))');
      params.push(Number(athleteId), Number(athleteId));
    }
    if (year) { conditions.push('YEAR(e.start_date) = ?'); params.push(Number(year)); }
    if (star) { conditions.push('e.star_level = ?'); params.push(star); }
    if (rankMax) { conditions.push('er.rank_position <= ?'); params.push(Number(rankMax)); }
    if (timeMax) { conditions.push('er.time_seconds <= ?'); params.push(Number(timeMax)); }

    const where = `WHERE ${conditions.join(' AND ')}`;
    const [countRows] = await pool.execute<RowDataPacket[]>(
      `SELECT
         COUNT(*) AS total,
         COUNT(DISTINCT er.event_id) AS event_count,
         COUNT(DISTINCT COALESCE(er.athlete_id, er.athlete_name_snapshot)) AS athlete_count
       FROM sup_event_results er
       INNER JOIN sup_events e ON e.event_id = er.event_id
       INNER JOIN sup_event_result_sources src ON src.source_id = er.source_id
       LEFT JOIN sup_athletes a ON a.athlete_id = er.athlete_id
       ${where}`,
      params
    );

    const [items] = await pool.execute<RowDataPacket[]>(
      `SELECT
         er.result_id, er.event_id, er.athlete_id, er.athlete_name_snapshot, er.bib_number,
         er.gender_group, er.discipline, er.board_class, er.round_label, er.rank_position,
         er.result_label, er.finish_time, er.result_status_code, er.result_status_note, er.time_seconds, er.points, er.team_name,
         er.source_title, er.source_url, er.source_locator, er.review_status,
         e.name AS event_name, e.start_date, e.city, e.province, e.star_level, e.score_coefficient,
         a.name AS athlete_name, a.photo AS athlete_photo,
         src.source_url AS source_file_url, src.file_name AS source_file_name, src.file_type AS source_file_type,
         (
           SELECT JSON_ARRAYAGG(JSON_OBJECT('athlete_id', erm.athlete_id, 'name', erm.member_name, 'member_order', erm.member_order))
           FROM sup_event_result_members erm
           WHERE erm.result_id = er.result_id
           ORDER BY erm.member_order ASC
         ) AS team_members
       FROM sup_event_results er
       INNER JOIN sup_events e ON e.event_id = er.event_id
       LEFT JOIN sup_athletes a ON a.athlete_id = er.athlete_id
       INNER JOIN sup_event_result_sources src ON src.source_id = er.source_id
       ${where}
       ORDER BY ${resultDefaultOrderBy({ includeEventDate: true })}
       LIMIT ${pageSize} OFFSET ${offset}`,
      params
    );

    const [facets] = await pool.execute<RowDataPacket[]>(
      `SELECT
         (SELECT JSON_ARRAYAGG(discipline) FROM (
            SELECT DISTINCT er.discipline
            FROM sup_event_results er
            INNER JOIN sup_event_result_sources src ON src.source_id = er.source_id
            WHERE er.discipline IS NOT NULL AND er.discipline <> ''
              AND ${localResultSourceCondition}
            ORDER BY er.discipline LIMIT 80
          ) d) AS disciplines,
         (SELECT JSON_ARRAYAGG(gender_group) FROM (
            SELECT DISTINCT er.gender_group
            FROM sup_event_results er
            INNER JOIN sup_event_result_sources src ON src.source_id = er.source_id
            WHERE er.gender_group IS NOT NULL AND er.gender_group <> ''
              AND ${localResultSourceCondition}
            ORDER BY er.gender_group LIMIT 60
          ) g) AS genders,
         (SELECT JSON_ARRAYAGG(event_year) FROM (
            SELECT DISTINCT YEAR(e.start_date) AS event_year
            FROM sup_events e
            INNER JOIN sup_event_results er ON er.event_id = e.event_id
            INNER JOIN sup_event_result_sources src ON src.source_id = er.source_id
            WHERE e.start_date IS NOT NULL
              AND ${localResultSourceCondition}
            ORDER BY event_year DESC LIMIT 40
          ) y) AS years`
    );

    const total = Number(countRows[0]?.total || 0);
    return NextResponse.json({
      items,
      total,
      stats: {
        resultCount: total,
        athleteCount: Number(countRows[0]?.athlete_count || 0),
        eventCount: Number(countRows[0]?.event_count || 0),
      },
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
