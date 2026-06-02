import { NextRequest, NextResponse } from 'next/server';
import { withAdmin } from '@/lib/admin';
import pool from '@/lib/db';
import { ANNUAL_POINTS_GROUPS, syncAnnualPoints2025 } from '@/lib/annual-points';
import type { RowDataPacket } from 'mysql2';

type PointScope = 'domestic' | 'international' | 'all';

function normalizePointScope(value: string | null): PointScope {
  if (value === 'international') return 'international';
  if (value === 'all') return 'all';
  return 'domestic';
}

export const GET = withAdmin(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, Number(searchParams.get('page') || 1));
    const pageSize = Math.min(100, Math.max(10, Number(searchParams.get('pageSize') || 30)));
    const offset = (page - 1) * pageSize;
    const year = Number(searchParams.get('year') || 2025);
    const groupCode = searchParams.get('group_code') || '';
    const matchStatus = searchParams.get('match_status') || '';
    const search = searchParams.get('search') || '';
    const pointScope = normalizePointScope(searchParams.get('point_scope'));

    const conditions: string[] = ['s.year = ?'];
    const params: (string | number)[] = [year];
    if (pointScope !== 'all') {
      conditions.push('src.point_scope = ?');
      params.push(pointScope);
    }
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
      `SELECT
         year,
         ${pointScope === 'all' ? "'all'" : 'point_scope'} AS point_scope,
         MIN(sync_status) AS sync_status,
         SUM(total_records) AS total_records,
         SUM(imported_records) AS imported_records,
         MAX(last_synced_at) AS last_synced_at,
         GROUP_CONCAT(NULLIF(error_message, '') SEPARATOR '；') AS error_message,
         COUNT(*) AS source_count
       FROM sup_annual_point_sources
       WHERE year = ?
         ${pointScope === 'all' ? '' : 'AND point_scope = ?'}
       GROUP BY year${pointScope === 'all' ? '' : ', point_scope'}`,
      pointScope === 'all' ? [year] : [year, pointScope]
    );

    const [countRows] = await pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) AS total
       FROM sup_annual_point_standings s
       INNER JOIN sup_annual_point_sources src ON src.source_id = s.source_id
       LEFT JOIN sup_athletes a ON a.athlete_id = s.athlete_id
       ${where}`,
      params
    );

    const [items] = await pool.execute<RowDataPacket[]>(
      `SELECT s.*, src.point_scope, src.title AS source_title, src.source_url, a.name AS athlete_name, a.status AS athlete_status
       FROM sup_annual_point_standings s
       INNER JOIN sup_annual_point_sources src ON src.source_id = s.source_id
       LEFT JOIN sup_athletes a ON a.athlete_id = s.athlete_id
       ${where}
       ORDER BY s.group_name ASC, COALESCE(s.rank_position, 999999) ASC, s.total_points DESC, s.standing_id ASC
       LIMIT ${pageSize} OFFSET ${offset}`,
      params
    );

    const [groupRows] = await pool.execute<RowDataPacket[]>(
      `SELECT group_code, group_name, COUNT(*) AS total, MIN(rank_position) AS best_rank, MAX(total_points) AS top_points
       FROM sup_annual_point_standings s
       INNER JOIN sup_annual_point_sources src ON src.source_id = s.source_id
       WHERE s.year = ?
         ${pointScope === 'all' ? '' : 'AND src.point_scope = ?'}
       GROUP BY group_code, group_name
       ORDER BY group_name ASC`,
      pointScope === 'all' ? [year] : [year, pointScope]
    );

    const [matchRows] = await pool.execute<RowDataPacket[]>(
      `SELECT match_status, COUNT(*) AS total
       FROM sup_annual_point_standings s
       INNER JOIN sup_annual_point_sources src ON src.source_id = s.source_id
       WHERE s.year = ?
         ${pointScope === 'all' ? '' : 'AND src.point_scope = ?'}
       GROUP BY match_status`,
      pointScope === 'all' ? [year] : [year, pointScope]
    );

    const [yearRows] = await pool.execute<RowDataPacket[]>(
      `SELECT s.year, COUNT(*) AS total
       FROM sup_annual_point_standings s
       INNER JOIN sup_annual_point_sources src ON src.source_id = s.source_id
       ${pointScope === 'all' ? '' : 'WHERE src.point_scope = ?'}
       GROUP BY s.year
       ORDER BY s.year DESC`,
      pointScope === 'all' ? [] : [pointScope]
    );

    const total = Number(countRows[0]?.total || 0);
    return NextResponse.json({
      source: sourceRows[0] || null,
      pointScope,
      years: yearRows,
      year,
      groups: groupRows.length
        ? groupRows.map((row) => ({ code: row.group_code, label: row.group_name }))
        : (year === 2025 ? ANNUAL_POINTS_GROUPS : []),
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
    const year = Number(body.year || 2025);
    if (year !== 2025) {
      return NextResponse.json({ error: '历史年度积分请使用离线归档导入脚本' }, { status: 400 });
    }
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
