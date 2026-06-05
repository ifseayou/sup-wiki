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
      `SELECT
         l.*,
         a.name AS athlete_name,
         COALESCE(name_disambig.same_name_count, 1) AS same_name_count,
         COALESCE(name_disambig.same_name_index, 1) AS same_name_index,
         CASE
           WHEN COALESCE(name_disambig.same_name_count, 1) > 1
             THEN CONCAT(a.name, '-', name_disambig.same_name_index)
           ELSE a.name
         END AS athlete_admin_display_name
       FROM sup_athlete_identity_links l
       LEFT JOIN sup_athletes a ON a.athlete_id = l.athlete_id
       LEFT JOIN (
         SELECT
           athlete_id,
           COUNT(*) OVER (PARTITION BY LOWER(REPLACE(TRIM(name), ' ', ''))) AS same_name_count,
           ROW_NUMBER() OVER (
             PARTITION BY LOWER(REPLACE(TRIM(name), ' ', ''))
             ORDER BY CASE status WHEN 'published' THEN 0 WHEN 'draft' THEN 1 ELSE 2 END, athlete_id ASC
           ) AS same_name_index
         FROM sup_athletes
         WHERE name IS NOT NULL AND TRIM(name) <> ''
       ) name_disambig ON name_disambig.athlete_id = a.athlete_id
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
