import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { withAdmin } from '@/lib/admin';
import type { RowDataPacket } from 'mysql2';

export const GET = withAdmin(async (request: NextRequest) => {
  try {
    const status = request.nextUrl.searchParams.get('status') || 'unmatched';
    const search = request.nextUrl.searchParams.get('search')?.trim() || '';
    const conditions = ["(? = 'all' OR a.match_status = ?)"];
    const params: (string | number)[] = [status, status];
    if (search) {
      conditions.push('(a.team_name_raw LIKE ? OR c.name LIKE ?)');
      const like = `%${search}%`;
      params.push(like, like);
    }

    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT a.*, c.name AS club_name, c.slug AS club_slug
       FROM sup_club_team_aliases a
       LEFT JOIN sup_clubs c ON c.club_id = a.club_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY FIELD(a.match_status, 'unmatched', 'candidate', 'confirmed', 'ignored', 'rejected'), a.result_count DESC, a.updated_at DESC
       LIMIT 300`,
      params
    );
    return NextResponse.json({ items: rows });
  } catch (error) {
    console.error('获取队伍别名列表失败:', error);
    return NextResponse.json({ error: '获取队伍别名列表失败' }, { status: 500 });
  }
});
