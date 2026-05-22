import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { withAdmin } from '@/lib/admin';
import type { RowDataPacket } from 'mysql2';

export const GET = withAdmin(async (request: NextRequest) => {
  try {
    const search = request.nextUrl.searchParams.get('search')?.trim() || '';
    const conditions: string[] = [];
    const params: (string | number)[] = [];
    if (search) {
      conditions.push('(u.nickname LIKE ? OR u.email LIKE ?)');
      const like = `%${search}%`;
      params.push(like, like);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT
         u.user_id, u.nickname, u.email, u.openid, u.user_level, u.status,
         u.daily_result_query_limit, u.admin_note, u.created_at, u.updated_at, u.last_login_at,
         COALESCE(today.query_count, 0) AS today_result_queries,
         COUNT(DISTINCT owner.athlete_id) AS owned_athlete_count,
         COUNT(DISTINCT claim.claim_id) AS claim_count
       FROM sup_users u
       LEFT JOIN sup_user_result_query_usage today ON today.user_id = u.user_id AND today.usage_date = CURDATE()
       LEFT JOIN sup_athlete_profile_owners owner ON owner.user_id = u.user_id AND owner.status = 'active'
       LEFT JOIN sup_athlete_profile_claims claim ON claim.user_id = u.user_id
       ${where}
       GROUP BY u.user_id, today.query_count
       ORDER BY u.created_at DESC
       LIMIT 200`,
      params
    );
    return NextResponse.json({ items: rows });
  } catch (error) {
    console.error('获取用户列表失败:', error);
    return NextResponse.json({ error: '获取用户列表失败' }, { status: 500 });
  }
});
