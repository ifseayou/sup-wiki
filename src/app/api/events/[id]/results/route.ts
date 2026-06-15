import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { applyPublicPreview, resolveResultAccess } from '@/lib/result-access';
import { localResultSourceCondition } from '@/lib/result-source-scope';
import { resultDefaultOrderBy } from '@/lib/result-ordering';
import { getResultPaceDisplay } from '@/lib/result-pace';
import { filterAndMaskRaceResults, getViewerOwnedAthleteIds, maskAthleteIdentityRows } from '@/lib/result-privacy';
import type { RowDataPacket } from 'mysql2';

const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 50;
const NON_FINISH_CODES = new Set(['DNS', 'DNF', 'DQ', 'DSQ', 'DNQ', 'OTL']);

function readPageParams(request: NextRequest) {
  const page = Math.max(1, Number(request.nextUrl.searchParams.get('page') || 1));
  const requestedPageSize = Number(request.nextUrl.searchParams.get('pageSize') || DEFAULT_PAGE_SIZE);
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(10, Number.isFinite(requestedPageSize) ? requestedPageSize : DEFAULT_PAGE_SIZE));
  return { page, pageSize, offset: (page - 1) * pageSize };
}

function normalizeFilter(value: string | null) {
  const text = value?.trim();
  return text || null;
}

function isNonFinishResult(row: RowDataPacket) {
  const status = String(row.result_status_code || row.finish_time || '').trim().toUpperCase();
  return NON_FINISH_CODES.has(status);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const eventId = Number(id);
    if (!Number.isInteger(eventId) || eventId <= 0) {
      return NextResponse.json({ error: '无效赛事 ID' }, { status: 400 });
    }

    const section = request.nextUrl.searchParams.get('section') || 'modules';
    const access = await resolveResultAccess(request, { consume: section !== 'modules' });
    if (section !== 'modules' && access.authenticated && access.remaining === 0 && access.previewLimit === 0) {
      return NextResponse.json({ error: '今日成绩查询次数已用完，请明天再试', access }, { status: 429 });
    }

    if (section === 'modules') {
      const [resultModules] = await pool.execute<RowDataPacket[]>(
        `SELECT
           er.discipline,
           er.gender_group,
           er.board_class,
           COUNT(*) AS total,
           COUNT(DISTINCT er.round_label) AS round_count,
           MIN(er.rank_position) AS best_rank
         FROM sup_event_results er
         INNER JOIN sup_event_result_sources src ON src.source_id = er.source_id
         INNER JOIN sup_events e ON e.event_id = er.event_id
         WHERE er.event_id = ? AND e.status = 'published'
           AND er.review_status = 'confirmed'
           AND er.is_verified = 1
           AND ${localResultSourceCondition}
         GROUP BY er.discipline, er.gender_group, er.board_class
         ORDER BY total DESC, er.discipline ASC, er.gender_group ASC, er.board_class ASC`,
        [eventId]
      );

      const [pointModules] = await pool.execute<RowDataPacket[]>(
        `SELECT
           ps.group_name,
           COUNT(*) AS total,
           MIN(ps.rank_position) AS best_rank
         FROM sup_event_point_standings ps
         INNER JOIN sup_events e ON e.event_id = ps.event_id
         WHERE ps.event_id = ? AND e.status = 'published'
         GROUP BY ps.group_name
         ORDER BY
           FIELD(ps.group_name, '公开男子组', '公开女子组', '大师男子组', '大师女子组', '卡胡纳男子组', '卡胡纳女子组', '高校男子组', '高校女子组', 'U15男子组', 'U15女子组', 'U12男子组', 'U12女子组', 'U9男子组', 'U9女子组'),
           ps.group_name ASC`,
        [eventId]
      );

      return NextResponse.json({
        section,
        result_modules: resultModules,
        point_modules: pointModules,
        stats: {
          resultCount: resultModules.reduce((sum, row) => sum + Number(row.total || 0), 0),
          resultModuleCount: resultModules.length,
          pointStandingCount: pointModules.reduce((sum, row) => sum + Number(row.total || 0), 0),
          pointModuleCount: pointModules.length,
        },
      });
    }

    if (section === 'results') {
      const discipline = normalizeFilter(request.nextUrl.searchParams.get('discipline'));
      const genderGroup = normalizeFilter(request.nextUrl.searchParams.get('gender_group'));
      const boardClass = normalizeFilter(request.nextUrl.searchParams.get('board_class'));
      if (!discipline || !genderGroup) {
        return NextResponse.json({ error: '缺少项目或组别参数' }, { status: 400 });
      }

      const { page, pageSize, offset } = readPageParams(request);
      const queryPageSize = access.authenticated ? pageSize : 3;
      const queryOffset = access.authenticated ? offset : 0;
      const commonParams = [eventId, discipline, genderGroup, boardClass];
      const [countRows] = await pool.execute<RowDataPacket[]>(
        `SELECT COUNT(*) AS total
         FROM sup_event_results er
         INNER JOIN sup_event_result_sources src ON src.source_id = er.source_id
         INNER JOIN sup_events e ON e.event_id = er.event_id
         WHERE er.event_id = ? AND er.discipline = ? AND er.gender_group = ? AND (er.board_class <=> ?)
           AND e.status = 'published'
           AND er.review_status = 'confirmed'
           AND er.is_verified = 1
           AND ${localResultSourceCondition}`,
        commonParams
      );

      const [rows] = await pool.execute<RowDataPacket[]>(
        `SELECT
           er.result_id, er.event_id, er.athlete_id, er.athlete_name_snapshot, er.bib_number,
           er.gender_group, er.discipline, er.board_class, er.round_label, er.rank_position,
           er.result_label, er.finish_time, er.result_status_code, er.result_status_note, er.time_seconds, er.points, er.team_name, er.nationality_snapshot,
           (SELECT c.slug FROM sup_club_team_aliases ca INNER JOIN sup_clubs c ON c.club_id = ca.club_id WHERE ca.normalized_name COLLATE utf8mb4_0900_ai_ci = er.team_name_normalized AND ca.match_status = 'confirmed' AND c.status = 'published' LIMIT 1) AS team_club_slug,
           (SELECT c.name FROM sup_club_team_aliases ca INNER JOIN sup_clubs c ON c.club_id = ca.club_id WHERE ca.normalized_name COLLATE utf8mb4_0900_ai_ci = er.team_name_normalized AND ca.match_status = 'confirmed' AND c.status = 'published' LIMIT 1) AS team_club_name,
           er.source_title, er.source_url, er.source_locator, er.source_note,
           a.name AS athlete_name,
           a.photo AS athlete_photo,
           a.nationality AS athlete_nationality,
           e.name AS event_name,
           e.name_en AS event_name_en,
           e.source_scope,
           src.source_url AS source_file_url,
           src.file_name AS source_file_name,
           (
             SELECT JSON_ARRAYAGG(JSON_OBJECT('athlete_id', erm.athlete_id, 'name', erm.member_name, 'member_order', erm.member_order))
             FROM sup_event_result_members erm
             WHERE erm.result_id = er.result_id
             ORDER BY erm.member_order ASC
           ) AS team_members
         FROM sup_event_results er
         LEFT JOIN sup_athletes a ON a.athlete_id = er.athlete_id
         INNER JOIN sup_event_result_sources src ON src.source_id = er.source_id
         INNER JOIN sup_events e ON e.event_id = er.event_id
         WHERE er.event_id = ? AND er.discipline = ? AND er.gender_group = ? AND (er.board_class <=> ?)
           AND e.status = 'published'
           AND er.review_status = 'confirmed'
           AND er.is_verified = 1
           AND ${localResultSourceCondition}
         ORDER BY ${resultDefaultOrderBy()}
         LIMIT ${queryPageSize} OFFSET ${queryOffset}`,
        commonParams
      );

      const viewer = await getViewerOwnedAthleteIds(request);
      const visibleRows = await filterAndMaskRaceResults(rows, viewer);
      const total = Number(countRows[0]?.total || 0);
      const rowsWithPace = visibleRows.map((row) => {
        if (row.results_points_hidden) {
          return {
            ...row,
            rank_position: null,
            pace_display: '隐藏',
            is_long_distance: false,
          };
        }
        const pace = getResultPaceDisplay({
          discipline: row.discipline,
          gender_group: row.gender_group,
          time_seconds: row.time_seconds,
          finish_time: row.finish_time,
          result_status_code: row.result_status_code,
        });
        return {
          ...row,
          rank_position: isNonFinishResult(row) ? null : row.rank_position,
          pace_display: pace.pace_display,
          is_long_distance: pace.is_long_distance,
        };
      });
      const preview = applyPublicPreview(rowsWithPace, access);
      return NextResponse.json({
        section,
        discipline,
        gender_group: genderGroup,
        board_class: boardClass,
        items: preview.items,
        total,
        page: access.authenticated ? page : 1,
        pageSize,
        totalPages: access.authenticated ? Math.ceil(total / pageSize) : 1,
        access,
        preview_locked: preview.previewLocked,
        preview_limit: access.previewLimit,
      });
    }

    if (section === 'points') {
      const groupName = normalizeFilter(request.nextUrl.searchParams.get('group_name'));
      if (!groupName) return NextResponse.json({ error: '缺少积分榜分组参数' }, { status: 400 });

      const { page, pageSize, offset } = readPageParams(request);
      const queryPageSize = access.authenticated ? pageSize : 3;
      const queryOffset = access.authenticated ? offset : 0;
      const [countRows] = await pool.execute<RowDataPacket[]>(
        `SELECT COUNT(*) AS total
         FROM sup_event_point_standings ps
         INNER JOIN sup_events e ON e.event_id = ps.event_id
         WHERE ps.event_id = ? AND ps.group_name = ? AND e.status = 'published'`,
        [eventId, groupName]
      );

      const [rawPointRows] = await pool.execute<RowDataPacket[]>(
        `SELECT
           ps.standing_id, ps.event_id, ps.source_id, ps.group_name, ps.rank_position, ps.status_rank,
           ps.bib_number, ps.athlete_id, ps.athlete_name_snapshot, ps.team_name,
           ps.endurance_rank, ps.endurance_points, ps.sprint_rank, ps.sprint_points, ps.total_points,
           ps.source_locator,
           a.name AS athlete_name,
           a.photo AS athlete_photo,
           a.nationality AS athlete_nationality,
           e.source_scope,
           src.source_url AS source_file_url,
           src.file_name AS source_file_name
         FROM sup_event_point_standings ps
         LEFT JOIN sup_athletes a ON a.athlete_id = ps.athlete_id
         LEFT JOIN sup_event_result_sources src ON src.source_id = ps.source_id
         INNER JOIN sup_events e ON e.event_id = ps.event_id
         WHERE ps.event_id = ? AND ps.group_name = ? AND e.status = 'published'
         ORDER BY
           CASE WHEN ps.rank_position IS NULL THEN 1 ELSE 0 END,
           ps.rank_position ASC,
           ps.standing_id ASC
         LIMIT ${queryPageSize} OFFSET ${queryOffset}`,
        [eventId, groupName]
      );

      const total = Number(countRows[0]?.total || 0);
      const viewer = await getViewerOwnedAthleteIds(request);
      const pointRows = await maskAthleteIdentityRows(rawPointRows, viewer);
      const preview = applyPublicPreview(pointRows, access);
      return NextResponse.json({
        section,
        group_name: groupName,
        items: preview.items,
        total,
        page: access.authenticated ? page : 1,
        pageSize,
        totalPages: access.authenticated ? Math.ceil(total / pageSize) : 1,
        access,
        preview_locked: preview.previewLocked,
        preview_limit: access.previewLimit,
      });
    }

    if (section !== 'all') {
      return NextResponse.json({ error: '无效成绩查询模块' }, { status: 400 });
    }

    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT
         er.result_id, er.event_id, er.athlete_id, er.athlete_name_snapshot, er.bib_number,
         er.gender_group, er.discipline, er.board_class, er.round_label, er.rank_position,
         er.result_label, er.finish_time, er.result_status_code, er.result_status_note, er.time_seconds, er.points, er.team_name, er.nationality_snapshot,
         (SELECT c.slug FROM sup_club_team_aliases ca INNER JOIN sup_clubs c ON c.club_id = ca.club_id WHERE ca.normalized_name COLLATE utf8mb4_0900_ai_ci = er.team_name_normalized AND ca.match_status = 'confirmed' AND c.status = 'published' LIMIT 1) AS team_club_slug,
         (SELECT c.name FROM sup_club_team_aliases ca INNER JOIN sup_clubs c ON c.club_id = ca.club_id WHERE ca.normalized_name COLLATE utf8mb4_0900_ai_ci = er.team_name_normalized AND ca.match_status = 'confirmed' AND c.status = 'published' LIMIT 1) AS team_club_name,
           er.source_title, er.source_url, er.source_locator, er.source_note,
           a.name AS athlete_name,
           a.photo AS athlete_photo,
           a.nationality AS athlete_nationality,
           e.name AS event_name,
           e.name_en AS event_name_en,
           e.source_scope,
           src.source_url AS source_file_url,
         src.file_name AS source_file_name,
         (
           SELECT JSON_ARRAYAGG(JSON_OBJECT('athlete_id', erm.athlete_id, 'name', erm.member_name, 'member_order', erm.member_order))
           FROM sup_event_result_members erm
           WHERE erm.result_id = er.result_id
         ) AS team_members
       FROM sup_event_results er
       LEFT JOIN sup_athletes a ON a.athlete_id = er.athlete_id
       INNER JOIN sup_event_result_sources src ON src.source_id = er.source_id
       INNER JOIN sup_events e ON e.event_id = er.event_id
       WHERE er.event_id = ? AND e.status = 'published'
         AND er.review_status = 'confirmed'
         AND er.is_verified = 1
         AND ${localResultSourceCondition}
       ORDER BY ${resultDefaultOrderBy()}`,
      [eventId]
    );

    const [rawPointRows] = await pool.execute<RowDataPacket[]>(
      `SELECT
         ps.standing_id, ps.event_id, ps.source_id, ps.group_name, ps.rank_position, ps.status_rank,
         ps.bib_number, ps.athlete_id, ps.athlete_name_snapshot, ps.team_name,
         ps.endurance_rank, ps.endurance_points, ps.sprint_rank, ps.sprint_points, ps.total_points,
         ps.source_locator,
         a.name AS athlete_name,
         a.photo AS athlete_photo,
         a.nationality AS athlete_nationality,
         e.source_scope,
         src.source_url AS source_file_url,
         src.file_name AS source_file_name
       FROM sup_event_point_standings ps
       LEFT JOIN sup_athletes a ON a.athlete_id = ps.athlete_id
       LEFT JOIN sup_event_result_sources src ON src.source_id = ps.source_id
       INNER JOIN sup_events e ON e.event_id = ps.event_id
       WHERE ps.event_id = ? AND e.status = 'published'
       ORDER BY
         FIELD(ps.group_name, '公开男子组', '公开女子组', '大师男子组', '大师女子组', '卡胡纳男子组', '卡胡纳女子组', '高校男子组', '高校女子组', 'U15男子组', 'U15女子组', 'U12男子组', 'U12女子组', 'U9男子组', 'U9女子组'),
         CASE WHEN ps.rank_position IS NULL THEN 1 ELSE 0 END,
         ps.rank_position ASC,
         ps.standing_id ASC`,
      [eventId]
    );

    const viewer = await getViewerOwnedAthleteIds(request);
    const visibleRows = await filterAndMaskRaceResults(rows, viewer);
    const pointRows = await maskAthleteIdentityRows(rawPointRows, viewer);
    const rowsWithPace = visibleRows.map((row) => {
      if (row.results_points_hidden) {
        return {
          ...row,
          pace_display: '隐藏',
          is_long_distance: false,
        };
      }
      const pace = getResultPaceDisplay({
        discipline: row.discipline,
        gender_group: row.gender_group,
        time_seconds: row.time_seconds,
        finish_time: row.finish_time,
        result_status_code: row.result_status_code,
      });
      return {
        ...row,
        pace_display: pace.pace_display,
        is_long_distance: pace.is_long_distance,
      };
    });
    const resultPreview = applyPublicPreview(rowsWithPace, access);
    const pointPreview = applyPublicPreview(pointRows, access);
    return NextResponse.json({
      section,
      items: resultPreview.items,
      point_standings: pointPreview.items,
      access,
      preview_locked: resultPreview.previewLocked || pointPreview.previewLocked,
      preview_limit: access.previewLimit,
    });
  } catch (error) {
    console.error('获取赛事成绩失败:', error);
    return NextResponse.json({ error: '获取赛事成绩失败' }, { status: 500 });
  }
}
