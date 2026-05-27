import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { withAdmin } from '@/lib/admin';
import type { RowDataPacket } from 'mysql2';

export const GET = withAdmin(async (request: NextRequest) => {
  try {
    const status = request.nextUrl.searchParams.get('status') || 'pending';
    const search = request.nextUrl.searchParams.get('search')?.trim() || '';
    const conditions = ["(? = 'all' OR c.status = ?)"];
    const params: (string | number)[] = [status, status];

    if (search) {
      conditions.push('(a.name LIKE ? OR u.nickname LIKE ? OR u.email LIKE ?)');
      const like = `%${search}%`;
      params.push(like, like, like);
    }

    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT
         c.*,
         COALESCE(
           NULLIF(c.submitted_hometown_province, ''),
           CASE WHEN JSON_VALID(c.submitted_profile_json) THEN JSON_UNQUOTE(JSON_EXTRACT(c.submitted_profile_json, '$.hometown.province')) ELSE NULL END
         ) AS submitted_hometown_province,
         COALESCE(
           NULLIF(c.submitted_hometown_city, ''),
           CASE WHEN JSON_VALID(c.submitted_profile_json) THEN JSON_UNQUOTE(JSON_EXTRACT(c.submitted_profile_json, '$.hometown.city')) ELSE NULL END
         ) AS submitted_hometown_city,
         u.nickname, u.email, u.user_level, u.status AS user_status,
         a.name AS current_name, a.photo AS current_photo, a.province AS current_province,
         a.city AS current_city, a.bio AS current_bio,
         er.bib_number AS verified_bib_number, er.discipline, er.gender_group, er.rank_position, er.finish_time,
         e.name AS event_name, e.start_date, e.province AS event_province, e.city AS event_city
       FROM sup_athlete_profile_claims c
       INNER JOIN sup_users u ON u.user_id = c.user_id
       INNER JOIN sup_athletes a ON a.athlete_id = c.athlete_id
       LEFT JOIN sup_event_results er ON er.result_id = c.result_id
       LEFT JOIN sup_events e ON e.event_id = er.event_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY FIELD(c.status, 'pending', 'approved', 'rejected'), c.created_at DESC
       LIMIT 200`,
      params
    );

    return NextResponse.json({ items: rows });
  } catch (error) {
    console.error('获取运动员资料审批列表失败:', error);
    return NextResponse.json({ error: '获取运动员资料审批列表失败' }, { status: 500 });
  }
});
