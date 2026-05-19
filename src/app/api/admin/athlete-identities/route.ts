import { NextRequest, NextResponse } from 'next/server';
import { withAdmin } from '@/lib/admin';
import pool from '@/lib/db';
import type { RowDataPacket } from 'mysql2';

export const GET = withAdmin(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'pending';
    const search = searchParams.get('search');
    const conditions = ['l.status = ?'];
    const params: (string | number)[] = [status];
    if (search) {
      conditions.push('(l.display_name LIKE ? OR l.team_hint LIKE ? OR a.name LIKE ?)');
      const like = `%${search}%`;
      params.push(like, like, like);
    }
    const [items] = await pool.execute<RowDataPacket[]>(
      `SELECT l.*, a.name AS athlete_name
       FROM sup_athlete_identity_links l
       LEFT JOIN sup_athletes a ON a.athlete_id = l.athlete_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY l.updated_at DESC
       LIMIT 100`,
      params
    );
    return NextResponse.json({ items });
  } catch (error) {
    console.error('获取运动员身份候选失败:', error);
    return NextResponse.json({ error: '获取运动员身份候选失败' }, { status: 500 });
  }
});
