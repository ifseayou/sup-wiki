import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { withAdmin } from '@/lib/admin';
import type { RowDataPacket } from 'mysql2';

export const GET = withAdmin(async (request: NextRequest) => {
  try {
    const search = request.nextUrl.searchParams.get('search')?.trim() || '';
    const page = Math.max(1, Number(request.nextUrl.searchParams.get('page') || 1) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(request.nextUrl.searchParams.get('pageSize') || 20) || 20));
    const offset = (page - 1) * pageSize;
    const conditions: string[] = [];
    const params: (string | number)[] = [];
    if (search) {
      conditions.push(`(
        u.nickname LIKE ?
        OR u.email LIKE ?
        OR CAST(u.user_id AS CHAR) = ?
        OR EXISTS (
          SELECT 1
          FROM sup_athlete_profile_owners so
          INNER JOIN sup_athletes sa ON sa.athlete_id = so.athlete_id
          WHERE so.user_id = u.user_id
            AND so.status = 'active'
            AND (sa.name LIKE ? OR sa.name_en LIKE ? OR CAST(sa.athlete_id AS CHAR) = ?)
        )
      )`);
      const like = `%${search}%`;
      params.push(like, like, search, like, like, search);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [countRows] = await pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) AS total FROM sup_users u ${where}`,
      params
    );
    const total = Number(countRows[0]?.total || 0);

    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT
         u.user_id, u.nickname, u.email, u.openid, u.user_level, u.status,
         u.daily_result_query_limit, u.admin_note, u.created_at, u.updated_at, u.last_login_at,
         COALESCE(today.query_count, 0) AS today_result_queries,
         COUNT(DISTINCT owner.athlete_id) AS owned_athlete_count,
         COUNT(DISTINCT claim.claim_id) AS claim_count,
         GROUP_CONCAT(
           DISTINCT CASE
             WHEN owner.athlete_id IS NULL THEN NULL
             ELSE CONCAT_WS(
               '\t',
               owner.athlete_id,
               REPLACE(COALESCE(athlete.name, ''), '\t', ' '),
               REPLACE(COALESCE(athlete.name_en, ''), '\t', ' '),
               owner.role,
               owner.status,
               COALESCE(DATE_FORMAT(owner.verified_at, '%Y-%m-%d %H:%i:%s'), '')
             )
           END
           ORDER BY athlete.name ASC, owner.athlete_id ASC
           SEPARATOR '\n'
         ) AS owned_athletes_raw
       FROM sup_users u
       LEFT JOIN sup_user_result_query_usage today ON today.user_id = u.user_id AND today.usage_date = DATE(CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '+08:00'))
       LEFT JOIN sup_athlete_profile_owners owner ON owner.user_id = u.user_id AND owner.status = 'active'
       LEFT JOIN sup_athletes athlete ON athlete.athlete_id = owner.athlete_id
       LEFT JOIN sup_athlete_profile_claims claim ON claim.user_id = u.user_id
       ${where}
       GROUP BY u.user_id, today.query_count
       ORDER BY u.created_at DESC
       LIMIT ${pageSize} OFFSET ${offset}`,
      params
    );
    const items = rows.map((row) => {
      const raw = String(row.owned_athletes_raw || '');
      const owned_athletes = raw
        ? raw.split('\n').map((line) => {
          const [athleteId, name, nameEn, role, status, verifiedAt] = line.split('\t');
          return {
            athlete_id: Number(athleteId),
            name,
            name_en: nameEn || null,
            role,
            status,
            verified_at: verifiedAt || null,
          };
        }).filter((item) => Number.isInteger(item.athlete_id) && item.athlete_id > 0)
        : [];
      const { owned_athletes_raw: _raw, ...rest } = row;
      return { ...rest, owned_athletes };
    });
    return NextResponse.json({ items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) });
  } catch (error) {
    console.error('获取用户列表失败:', error);
    return NextResponse.json({ error: '获取用户列表失败' }, { status: 500 });
  }
});
