import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { applyPublicPreview, resolveResultAccess } from '@/lib/result-access';
import { writeSearchLog } from '@/lib/search-log';
import { getViewerOwnedAthleteIds, maskAthleteIdentityRows } from '@/lib/result-privacy';
import { getNationalityAliases, normalizeNationality } from '@/lib/nationality';
import type { RowDataPacket } from 'mysql2';

type PointType = 'athlete' | 'club';
type PointScope = 'domestic' | 'international' | 'all';

function normalizeType(value: string | null): PointType {
  return value === 'club' ? 'club' : 'athlete';
}

function normalizeRankMax(value: string | null) {
  const rank = Number(value || 0);
  return Number.isFinite(rank) && rank > 0 ? rank : null;
}

function normalizePointScope(value: string | null): PointScope {
  if (value === 'international') return 'international';
  if (value === 'all') return 'all';
  return 'domestic';
}

// 年份列表与请求过滤无关、变动极少，进程内缓存，省一次对远程 MySQL 的串行往返。
const yearsCache: Record<PointType, { value: RowDataPacket[]; at: number } | null> = { athlete: null, club: null };
const YEARS_TTL_MS = 5 * 60 * 1000;
async function loadYears(type: PointType): Promise<RowDataPacket[]> {
  const cached = yearsCache[type];
  if (cached && Date.now() - cached.at < YEARS_TTL_MS) return cached.value;
  const [rows] = await pool.execute<RowDataPacket[]>(
    type === 'club'
      ? `SELECT year, COUNT(*) AS total FROM sup_annual_club_point_standings GROUP BY year ORDER BY year DESC`
      : `SELECT year, COUNT(*) AS total FROM sup_annual_point_standings GROUP BY year ORDER BY year DESC`,
    []
  );
  yearsCache[type] = { value: rows, at: Date.now() };
  return rows;
}

export async function GET(request: NextRequest) {
  const startedAt = Date.now();
  try {
    const access = await resolveResultAccess(request);
    if (access.authenticated && access.remaining === 0 && access.previewLimit === 0) {
      return NextResponse.json({
        error: '今日成绩查询次数已用完，请明天再试',
        access,
      }, { status: 429 });
    }

    const { searchParams } = new URL(request.url);
    const type = normalizeType(searchParams.get('type'));
    const page = Math.max(1, Number(searchParams.get('page') || 1));
    const pageSize = Math.min(100, Math.max(10, Number(searchParams.get('pageSize') || 30)));
    const offset = (page - 1) * pageSize;
    const queryPageSize = access.authenticated ? pageSize : 3;
    const queryOffset = access.authenticated ? offset : 0;
    const requestedYear = Number(searchParams.get('year') || 0) || null;
    const groupCode = searchParams.get('group_code') || '';
    const search = searchParams.get('search')?.trim() || '';
    const athleteId = Number(searchParams.get('athlete_id') || 0) || null;
    const athleteName = searchParams.get('athlete_name')?.trim() || '';
    const rankMax = normalizeRankMax(searchParams.get('rank_max'));
    const pointScope = normalizePointScope(searchParams.get('point_scope'));
    const nationality = searchParams.get('nationality')?.trim() || '';

    const yearRows = await loadYears(type);
    const availableYears = new Set(yearRows.map((row) => Number(row.year)));
    const defaultYear = Number(yearRows[0]?.year || new Date().getFullYear() - 1);
    const year = requestedYear && availableYears.has(requestedYear) ? requestedYear : defaultYear;

    const conditions: string[] = ['s.year = ?'];
    const params: (string | number)[] = [year];
    if (type === 'athlete' && pointScope !== 'all') {
      conditions.push('src.point_scope = ?');
      params.push(pointScope);
    }
    if (type === 'athlete' && groupCode) {
      conditions.push('s.group_code = ?');
      params.push(groupCode);
    }
    if (type === 'athlete' && nationality) {
      const aliases = getNationalityAliases(nationality);
      if (aliases.length) {
        conditions.push(`a.nationality IN (${aliases.map(() => '?').join(',')})`);
        params.push(...aliases);
      }
    }
    if (type === 'athlete' && athleteId) {
      if (athleteName) {
        conditions.push('(s.athlete_id = ? OR s.athlete_name_snapshot = ?)');
        params.push(athleteId, athleteName);
      } else {
        conditions.push('s.athlete_id = ?');
        params.push(athleteId);
      }
    }
    if (rankMax) {
      conditions.push('s.rank_position <= ?');
      params.push(rankMax);
    }
    if (search) {
      const like = `%${search}%`;
      if (type === 'club') {
        conditions.push('(s.club_name_snapshot LIKE ? OR src.title LIKE ?)');
        params.push(like, like);
      } else {
        conditions.push('(s.athlete_name_snapshot LIKE ? OR a.name LIKE ? OR s.team_name LIKE ? OR src.title LIKE ?)');
        params.push(like, like, like, like);
      }
    }
    const where = `WHERE ${conditions.join(' AND ')}`;

    const countSql = type === 'club'
      ? `SELECT COUNT(*) AS total
         FROM sup_annual_club_point_standings s
         INNER JOIN sup_annual_point_sources src ON src.source_id = s.source_id
         ${where}`
      : `SELECT COUNT(*) AS total,
           COUNT(DISTINCT COALESCE(s.athlete_id, s.athlete_name_snapshot)) AS athlete_count,
           COUNT(DISTINCT NULLIF(s.team_name_normalized, '')) AS team_count
         FROM sup_annual_point_standings s
         INNER JOIN sup_annual_point_sources src ON src.source_id = s.source_id
         LEFT JOIN sup_athletes a ON a.athlete_id = s.athlete_id
         ${where}`;
    const itemSql = type === 'club'
      ? `SELECT
           s.standing_id, s.year, s.rank_position, s.club_id, s.club_name_snapshot,
           s.total_points, c.name AS club_name, c.slug AS club_slug, c.status AS club_status,
           src.title AS source_title, src.source_url
         FROM sup_annual_club_point_standings s
         INNER JOIN sup_annual_point_sources src ON src.source_id = s.source_id
         LEFT JOIN sup_clubs c ON c.club_id = s.club_id
         ${where}
         ORDER BY COALESCE(s.rank_position, 999999) ASC, s.total_points DESC, s.standing_id ASC
         LIMIT ${queryPageSize} OFFSET ${queryOffset}`
      : `SELECT
           s.standing_id, s.year, s.group_code, s.group_name, s.rank_position,
           s.athlete_id, s.athlete_name_snapshot, a.name AS athlete_name, a.photo AS athlete_photo, a.nationality AS athlete_nationality,
           s.team_name, s.total_points, s.endurance_points, s.sprint_points, s.technical_points,
           src.title AS source_title, src.source_url, src.point_scope
         FROM sup_annual_point_standings s
         INNER JOIN sup_annual_point_sources src ON src.source_id = s.source_id
         LEFT JOIN sup_athletes a ON a.athlete_id = s.athlete_id
         ${where}
         ORDER BY s.group_name ASC, COALESCE(s.rank_position, 999999) ASC, s.total_points DESC, s.standing_id ASC
         LIMIT ${queryPageSize} OFFSET ${queryOffset}`;

    const groupSql = type === 'club'
      ? `SELECT NULL AS group_code, '俱乐部积分' AS group_name, COUNT(*) AS total
         FROM sup_annual_club_point_standings
         WHERE year = ?`
      : `SELECT group_code, group_name, COUNT(*) AS total
         FROM sup_annual_point_standings s
         WHERE s.year = ?
         GROUP BY group_code, group_name
         ORDER BY total DESC, group_name ASC`;

    const nationalityConditions = ['s.year = ?', "a.nationality IS NOT NULL", "a.nationality <> ''"];
    const nationalityParams: (string | number)[] = [year];
    if (pointScope !== 'all') {
      nationalityConditions.push('src.point_scope = ?');
      nationalityParams.push(pointScope);
    }
    const nationalitySql = `SELECT a.nationality AS raw_nationality, COUNT(*) AS total
         FROM sup_annual_point_standings s
         INNER JOIN sup_annual_point_sources src ON src.source_id = s.source_id
         LEFT JOIN sup_athletes a ON a.athlete_id = s.athlete_id
         WHERE ${nationalityConditions.join(' AND ')}
         GROUP BY a.nationality
         ORDER BY COUNT(*) DESC, a.nationality ASC`;

    // count / 主列表 / 分组统计 / 国籍聚合 / 观看者 互不依赖，并行执行，减少对远程 MySQL 的串行往返。
    const runRows = async (sql: string, p: (string | number)[]) =>
      (await pool.execute<RowDataPacket[]>(sql, p))[0];
    const [countRows, rawItems, groupRows, nationalityRows, viewer] = await Promise.all([
      runRows(countSql, params),
      runRows(itemSql, params),
      runRows(groupSql, [year]),
      type === 'athlete' ? runRows(nationalitySql, nationalityParams) : Promise.resolve([] as RowDataPacket[]),
      type === 'athlete'
        ? getViewerOwnedAthleteIds(request)
        : Promise.resolve(undefined as Awaited<ReturnType<typeof getViewerOwnedAthleteIds>> | undefined),
    ]);
    const items = type === 'athlete' ? await maskAthleteIdentityRows(rawItems, viewer) : rawItems;

    let nationalities: Array<{ value: string; label: string; meta: string }> = [];
    if (type === 'athlete') {
      const nationalityMap = new Map<string, number>();
      for (const row of nationalityRows) {
        const normalized = normalizeNationality(row.raw_nationality);
        if (!normalized) continue;
        nationalityMap.set(normalized, (nationalityMap.get(normalized) || 0) + Number(row.total || 0));
      }
      nationalities = [...nationalityMap.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'zh-Hans-CN'))
        .map(([label, total]) => ({ value: label, label, meta: `${total} 条` }));
    }

    const total = Number(countRows[0]?.total || 0);
    const preview = applyPublicPreview(items, access);
    const searchKeyword = (search || athleteName).trim();
    if (searchKeyword) {
      // 搜索日志写库不阻塞响应（远程 MySQL 往返，仅审计用途）。
      void writeSearchLog(request, {
        entry: 'annual_points',
        keyword: searchKeyword,
        resultCount: total,
        durationMs: Date.now() - startedAt,
        detail: {
          path: request.nextUrl.pathname,
          query: Object.fromEntries(request.nextUrl.searchParams.entries()),
        },
      }).catch(() => {});
    }

    return NextResponse.json({
      type,
      pointScope: type === 'club' ? 'domestic' : pointScope,
      year,
      years: yearRows,
      groups: groupRows,
      nationalities,
      items: preview.items,
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      preview_locked: preview.previewLocked,
      access,
      stats: {
        recordCount: total,
        athleteCount: Number(countRows[0]?.athlete_count || 0),
        teamCount: Number(countRows[0]?.team_count || 0),
      },
    });
  } catch (error) {
    console.error('年度积分查询失败:', error);
    return NextResponse.json({ error: '年度积分查询失败' }, { status: 500 });
  }
}
