import { NextRequest, NextResponse } from 'next/server';
import { withAdmin } from '@/lib/admin';
import pool from '@/lib/db';
import { ANNUAL_POINTS_GROUPS, syncAnnualPoints2025 } from '@/lib/annual-points';
import type { RowDataPacket } from 'mysql2';

export const GET = withAdmin(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, Number(searchParams.get('page') || 1));
    const pageSize = Math.min(100, Math.max(10, Number(searchParams.get('pageSize') || 30)));
    const offset = (page - 1) * pageSize;
    const groupCode = searchParams.get('group_code') || '';
    const matchStatus = searchParams.get('match_status') || '';
    const search = searchParams.get('search') || '';

    const conditions: string[] = ['s.year = 2025'];
    const params: (string | number)[] = [];
    if (groupCode) {
      conditions.push('s.group_code = ?');
      params.push(groupCode);
    }
    if (matchStatus) {
      conditions.push('s.match_status = ?');
      params.push(matchStatus);
    }
    if (search) {
      conditions.push('(s.athlete_name_snapshot LIKE ? OR a.name LIKE ? OR s.source_record_id LIKE ?)');
      const like = `%${search}%`;
      params.push(like, like, like);
    }
    const where = `WHERE ${conditions.join(' AND ')}`;

    const [sourceRows] = await pool.execute<RowDataPacket[]>(
      `SELECT *
       FROM sup_annual_point_sources
       WHERE source_key = 'jinshuju-2025-sup-race-points'
       LIMIT 1`
    );

    const [countRows] = await pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) AS total
       FROM sup_annual_point_standings s
       LEFT JOIN sup_athletes a ON a.athlete_id = s.athlete_id
       ${where}`,
      params
    );

    const [items] = await pool.execute<RowDataPacket[]>(
      `SELECT s.*, a.name AS athlete_name, a.status AS athlete_status
       FROM sup_annual_point_standings s
       LEFT JOIN sup_athletes a ON a.athlete_id = s.athlete_id
       ${where}
       ORDER BY s.group_name ASC, COALESCE(s.rank_position, 999999) ASC, s.total_points DESC, s.standing_id ASC
       LIMIT ${pageSize} OFFSET ${offset}`,
      params
    );

    const [groupRows] = await pool.execute<RowDataPacket[]>(
      `SELECT group_code, group_name, COUNT(*) AS total, MIN(rank_position) AS best_rank, MAX(total_points) AS top_points
       FROM sup_annual_point_standings
       WHERE year = 2025
       GROUP BY group_code, group_name
       ORDER BY group_name ASC`
    );

    const [matchRows] = await pool.execute<RowDataPacket[]>(
      `SELECT match_status, COUNT(*) AS total
       FROM sup_annual_point_standings
       WHERE year = 2025
       GROUP BY match_status`
    );

    const total = Number(countRows[0]?.total || 0);
    return NextResponse.json({
      source: sourceRows[0] || null,
      groups: ANNUAL_POINTS_GROUPS,
      groupStats: groupRows,
      matchStats: matchRows,
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    console.error('获取年度积分失败:', error);
    return NextResponse.json({ error: '获取年度积分失败' }, { status: 500 });
  }
});

export const POST = withAdmin(async (request: NextRequest) => {
  try {
    const body = await request.json().catch(() => ({}));
    const result = await syncAnnualPoints2025({
      groupCode: body.group_code || undefined,
      limit: Number(body.limit || 0) || undefined,
      pageSize: Number(body.page_size || 100) || undefined,
      dryRun: Boolean(body.dry_run),
    });
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('同步年度积分失败:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : '同步年度积分失败' }, { status: 500 });
  }
});
