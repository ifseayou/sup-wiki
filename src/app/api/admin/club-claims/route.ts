import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { withAdmin } from '@/lib/admin';
import type { RowDataPacket } from 'mysql2';

export const GET = withAdmin(async (request: NextRequest) => {
  try {
    const status = request.nextUrl.searchParams.get('status') || 'pending';
    const search = request.nextUrl.searchParams.get('search')?.trim() || '';
    const conditions = ["(? = 'all' OR cc.status = ?)"];
    const params: (string | number)[] = [status, status];

    if (search) {
      conditions.push('(cc.submitted_club_name LIKE ? OR cc.contact_info LIKE ? OR u.nickname LIKE ? OR u.email LIKE ? OR a.team_name_raw LIKE ?)');
      const like = `%${search}%`;
      params.push(like, like, like, like, like);
    }

    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT
         cc.*,
         u.nickname, u.email,
         c.name AS target_club_name, c.slug AS target_club_slug,
         created.name AS created_club_name, created.slug AS created_club_slug,
         a.team_name_raw, a.normalized_name, a.result_count, a.event_count, a.athlete_count, a.match_status AS alias_status
       FROM sup_club_claims cc
       INNER JOIN sup_users u ON u.user_id = cc.user_id
       LEFT JOIN sup_clubs c ON c.club_id = cc.club_id
       LEFT JOIN sup_clubs created ON created.club_id = cc.created_club_id
       LEFT JOIN sup_club_team_aliases a ON a.alias_id = cc.alias_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY FIELD(cc.status, 'pending', 'reviewing', 'approved', 'rejected'), cc.created_at DESC
       LIMIT 200`,
      params
    );
    return NextResponse.json({ items: rows });
  } catch (error) {
    console.error('获取俱乐部认领审核列表失败:', error);
    return NextResponse.json({ error: '获取俱乐部认领审核列表失败' }, { status: 500 });
  }
});
