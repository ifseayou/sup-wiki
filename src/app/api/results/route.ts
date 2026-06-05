import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { applyPublicPreview, resolveResultAccess } from '@/lib/result-access';
import { localResultSourceCondition } from '@/lib/result-source-scope';
import { resultDefaultOrderBy } from '@/lib/result-ordering';
import { getResultPaceDisplay, isNormalResultFinish, toResultNumber } from '@/lib/result-pace';
import { writeSearchLog } from '@/lib/search-log';
import { filterAndMaskRaceResults, getViewerOwnedAthleteIds } from '@/lib/result-privacy';
import { getNationalityAliases } from '@/lib/nationality';
import type { RowDataPacket } from 'mysql2';

type ResultItemRow = RowDataPacket & {
  result_id: number;
  event_id: number;
  discipline: string | null;
  gender_group: string | null;
  round_label: string | null;
  rank_position: number | null;
  time_seconds: number | string | null;
  finish_time: string | null;
  result_status_code: string | null;
};

type PreviousCandidateRow = RowDataPacket & {
  result_id: number;
  event_id: number;
  discipline: string | null;
  gender_group: string | null;
  round_label: string | null;
  rank_position: number | null;
  time_seconds: number | string | null;
};

function groupKey(row: Pick<ResultItemRow, 'event_id' | 'discipline' | 'gender_group' | 'round_label'>) {
  return [
    row.event_id,
    row.discipline || '',
    row.gender_group || '',
    row.round_label || '',
  ].join('\u0001');
}

function trimDecimals(value: string) {
  return value.replace(/(\.\d*?[1-9])0+$/, '$1').replace(/\.0+$/, '');
}

function formatDuration(seconds: number, includeSign = false) {
  if (!Number.isFinite(seconds) || seconds < 0) return '-';
  const sign = includeSign ? '+' : '';
  const totalMs = Math.round(seconds * 1000);
  const hours = Math.floor(totalMs / 3600000);
  const minutes = Math.floor((totalMs % 3600000) / 60000);
  const secs = Math.floor((totalMs % 60000) / 1000);
  const ms = totalMs % 1000;
  const secondText = trimDecimals(`${String(secs).padStart(2, '0')}.${String(ms).padStart(3, '0')}`);
  if (hours > 0) return `${sign}${hours}:${String(minutes).padStart(2, '0')}:${secondText}`;
  return `${sign}${String(minutes).padStart(2, '0')}:${secondText}`;
}

// facets（项目/性别/年份的去重集合）与请求过滤条件无关，对所有请求恒定，
// 进程内缓存，避免每次首屏都对远程 MySQL 跑 3 个 DISTINCT 子查询。
let facetsCache: { value: RowDataPacket; at: number } | null = null;
const FACETS_TTL_MS = 5 * 60 * 1000;
async function loadResultFacets(): Promise<RowDataPacket> {
  if (facetsCache && Date.now() - facetsCache.at < FACETS_TTL_MS) return facetsCache.value;
  const [facets] = await pool.execute<RowDataPacket[]>(
    `SELECT
       (SELECT JSON_ARRAYAGG(discipline) FROM (
          SELECT DISTINCT er.discipline
          FROM sup_event_results er
          INNER JOIN sup_event_result_sources src ON src.source_id = er.source_id
          WHERE er.discipline IS NOT NULL AND er.discipline <> ''
            AND ${localResultSourceCondition}
          ORDER BY er.discipline LIMIT 80
        ) d) AS disciplines,
       (SELECT JSON_ARRAYAGG(gender_group) FROM (
          SELECT DISTINCT er.gender_group
          FROM sup_event_results er
          INNER JOIN sup_event_result_sources src ON src.source_id = er.source_id
          WHERE er.gender_group IS NOT NULL AND er.gender_group <> ''
            AND ${localResultSourceCondition}
          ORDER BY er.gender_group LIMIT 60
        ) g) AS genders,
       (SELECT JSON_ARRAYAGG(event_year) FROM (
          SELECT DISTINCT YEAR(e.start_date) AS event_year
          FROM sup_events e
          INNER JOIN sup_event_results er ON er.event_id = e.event_id
          INNER JOIN sup_event_result_sources src ON src.source_id = er.source_id
          WHERE e.start_date IS NOT NULL
            AND ${localResultSourceCondition}
          ORDER BY event_year DESC LIMIT 40
        ) y) AS years`
  );
  const value = (facets[0] || {}) as RowDataPacket;
  facetsCache = { value, at: Date.now() };
  return value;
}

async function loadPreviousTimes(items: ResultItemRow[]) {
  const normalItems = items.filter((item) => (
    item.result_id &&
    item.event_id &&
    Number(item.rank_position || 0) < 9000 &&
    toResultNumber(item.time_seconds) !== null &&
    isNormalResultFinish(item)
  ));
  if (normalItems.length === 0) return new Map<number, number>();

  const keyRows = Array.from(new Map(normalItems.map((item) => [groupKey(item), item])).values());
  const groupConditions = keyRows.map(() => '(er.event_id = ? AND er.discipline <=> ? AND er.gender_group <=> ? AND er.round_label <=> ?)');
  const groupParams = keyRows.flatMap((item) => [
    Number(item.event_id),
    item.discipline,
    item.gender_group,
    item.round_label,
  ]);

  const [rows] = await pool.execute<PreviousCandidateRow[]>(
    `SELECT er.result_id, er.event_id, er.discipline, er.gender_group, er.round_label, er.rank_position, er.time_seconds
     FROM sup_event_results er
     INNER JOIN sup_event_result_sources src ON src.source_id = er.source_id
     WHERE er.source_id IS NOT NULL
       AND ${localResultSourceCondition}
       AND er.review_status = 'confirmed'
       AND er.is_verified = 1
       AND er.rank_position < 9000
       AND er.time_seconds IS NOT NULL
       AND (er.result_status_code IS NULL OR er.result_status_code = '')
       AND (${groupConditions.join(' OR ')})
     ORDER BY er.event_id ASC, er.discipline ASC, er.gender_group ASC, er.round_label ASC, er.rank_position ASC, er.result_id ASC`,
    groupParams
  );

  const previousByGroup = new Map<string, number>();
  const previousByResult = new Map<number, number>();
  for (const row of rows) {
    const key = groupKey(row);
    const currentTime = toResultNumber(row.time_seconds);
    const previousTime = previousByGroup.get(key);
    if (previousTime !== undefined) previousByResult.set(Number(row.result_id), previousTime);
    if (currentTime !== null) previousByGroup.set(key, currentTime);
  }
  return previousByResult;
}

// 当页结果的「所属俱乐部」一次性批量查询回填，替代主列表里逐行 2 个关联子查询
// （30 行 × 2 次 = 60 次查询，是 filesort 之外的主要额外开销）。两列同为
// utf8mb4_0900_ai_ci，无需显式 COLLATE，可命中 normalized_name 唯一索引。
async function attachTeamClubs(rows: Array<Record<string, unknown>>) {
  const names = Array.from(new Set(
    rows.map(r => String(r.team_name_normalized || '').trim()).filter(Boolean)
  ));
  if (!names.length) {
    for (const r of rows) { r.team_club_slug = null; r.team_club_name = null; }
    return;
  }
  const placeholders = names.map(() => '?').join(',');
  const [aliasRows] = await pool.execute<RowDataPacket[]>(
    `SELECT ca.normalized_name, c.slug, c.name
     FROM sup_club_team_aliases ca
     INNER JOIN sup_clubs c ON c.club_id = ca.club_id
     WHERE ca.match_status = 'confirmed' AND c.status = 'published'
       AND ca.normalized_name IN (${placeholders})`,
    names
  );
  const clubByName = new Map<string, { slug: string; name: string }>();
  for (const row of aliasRows) {
    const key = String(row.normalized_name || '');
    if (!clubByName.has(key)) clubByName.set(key, { slug: row.slug, name: row.name });
  }
  for (const r of rows) {
    const key = String(r.team_name_normalized || '').trim();
    const club = key ? clubByName.get(key) : undefined;
    r.team_club_slug = club ? club.slug : null;
    r.team_club_name = club ? club.name : null;
  }
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
    const search = searchParams.get('search')?.trim();
    const gender = searchParams.get('gender')?.trim();
    const discipline = searchParams.get('discipline')?.trim();
    const eventId = searchParams.get('event_id');
    const athleteId = searchParams.get('athlete_id');
    const year = searchParams.get('year');
    const star = searchParams.get('star_level')?.trim();
    const nationality = searchParams.get('nationality')?.trim();
    const rankMax = searchParams.get('rank_max');
    const timeMax = searchParams.get('time_max');
    const page = Math.max(1, Number(searchParams.get('page') || 1));
    const pageSize = Math.min(100, Math.max(10, Number(searchParams.get('pageSize') || 30)));
    const offset = (page - 1) * pageSize;
    const queryPageSize = access.authenticated ? pageSize : 3;
    const queryOffset = access.authenticated ? offset : 0;

    const conditions = [
      "e.status = 'published'",
      "e.event_status = 'completed'",
      'er.source_id IS NOT NULL',
      localResultSourceCondition,
      "er.review_status = 'confirmed'",
      'er.is_verified = 1',
    ];
    const params: (string | number)[] = [];

    if (search) {
      conditions.push(`(
        er.athlete_name_snapshot LIKE ? OR a.name LIKE ? OR er.team_name LIKE ? OR e.name LIKE ?
        OR EXISTS (SELECT 1 FROM sup_event_result_members erm_s WHERE erm_s.result_id = er.result_id AND erm_s.member_name LIKE ?)
      )`);
      const like = `%${search}%`;
      params.push(like, like, like, like, like);
    }
    if (gender) { conditions.push('er.gender_group LIKE ?'); params.push(`%${gender}%`); }
    if (discipline) { conditions.push('er.discipline LIKE ?'); params.push(`%${discipline}%`); }
    if (eventId) { conditions.push('er.event_id = ?'); params.push(Number(eventId)); }
    if (athleteId) {
      conditions.push('(er.athlete_id = ? OR EXISTS (SELECT 1 FROM sup_event_result_members erm_a WHERE erm_a.result_id = er.result_id AND erm_a.athlete_id = ?))');
      params.push(Number(athleteId), Number(athleteId));
    }
    if (year) { conditions.push('YEAR(e.start_date) = ?'); params.push(Number(year)); }
    if (star) { conditions.push('e.star_level = ?'); params.push(star); }
    if (nationality) {
      const aliases = getNationalityAliases(nationality);
      if (aliases.length) {
        const placeholders = aliases.map(() => '?').join(',');
        conditions.push(`(a.nationality IN (${placeholders}) OR er.nationality_snapshot IN (${placeholders}))`);
        params.push(...aliases, ...aliases);
      }
    }
    if (rankMax) { conditions.push('er.rank_position <= ?'); params.push(Number(rankMax)); }
    if (timeMax) { conditions.push('er.time_seconds <= ?'); params.push(Number(timeMax)); }

    const where = `WHERE ${conditions.join(' AND ')}`;
    // count / 主列表 / 观看者 / facets 互不依赖，并行执行，减少对远程 MySQL 的串行往返。
    const [countResult, itemsResult, viewer, facetsRow] = await Promise.all([
      pool.execute<RowDataPacket[]>(
        `SELECT
           COUNT(*) AS total,
           COUNT(DISTINCT er.event_id) AS event_count,
           COUNT(DISTINCT COALESCE(er.athlete_id, er.athlete_name_snapshot)) AS athlete_count
         FROM sup_event_results er
         INNER JOIN sup_events e ON e.event_id = er.event_id
         INNER JOIN sup_event_result_sources src ON src.source_id = er.source_id
         LEFT JOIN sup_athletes a ON a.athlete_id = er.athlete_id
         ${where}`,
        params
      ),
      pool.execute<ResultItemRow[]>(
        `SELECT
         er.result_id, er.event_id, er.athlete_id, er.athlete_name_snapshot, er.bib_number,
         er.gender_group, er.discipline, er.board_class, er.round_label, er.rank_position,
         er.result_label, er.finish_time, er.result_status_code, er.result_status_note, er.time_seconds, er.points, er.team_name, er.team_name_normalized, er.nationality_snapshot,
         er.source_title, er.source_url, er.source_locator, er.review_status,
         e.name AS event_name, e.name_en AS event_name_en, e.start_date, e.city, e.province, e.star_level, e.score_coefficient, e.source_scope,
         a.name AS athlete_name, a.photo AS athlete_photo, a.nationality AS athlete_nationality,
         src.source_url AS source_file_url, src.file_name AS source_file_name, src.file_type AS source_file_type,
         (
           SELECT JSON_ARRAYAGG(JSON_OBJECT('athlete_id', erm.athlete_id, 'name', erm.member_name, 'member_order', erm.member_order))
           FROM sup_event_result_members erm
           WHERE erm.result_id = er.result_id
           ORDER BY erm.member_order ASC
         ) AS team_members
       FROM sup_event_results er
       INNER JOIN sup_events e ON e.event_id = er.event_id
       LEFT JOIN sup_athletes a ON a.athlete_id = er.athlete_id
       INNER JOIN sup_event_result_sources src ON src.source_id = er.source_id
       ${where}
       ORDER BY ${resultDefaultOrderBy({ includeEventDate: true })}
       LIMIT ${queryPageSize} OFFSET ${queryOffset}`,
        params
      ),
      getViewerOwnedAthleteIds(request),
      loadResultFacets(),
    ]);
    const countRows = countResult[0];
    const items = itemsResult[0];

    // mask 与 previousTimes 互不依赖（previousTimes 只用分组/时间字段，不受身份脱敏影响），并行执行省一个远程 RTT 阶段。
    const [maskedItems, previousTimes] = await Promise.all([
      filterAndMaskRaceResults(items as unknown as Array<Record<string, unknown>>, viewer),
      loadPreviousTimes(items),
    ]);
    const visibleItems = maskedItems as unknown as ResultItemRow[];
    // 当页所属俱乐部批量回填（替代主列表逐行子查询）。
    await attachTeamClubs(visibleItems as unknown as Array<Record<string, unknown>>);
    const enrichedItems = visibleItems.map((item) => {
      if (item.results_points_hidden) {
        return {
          ...item,
          distance_km: null,
          is_long_distance: false,
          gap_seconds: null,
          gap_display: '隐藏',
          pace_seconds_per_km: null,
          pace_display: '隐藏',
        };
      }
      const timeSeconds = toResultNumber(item.time_seconds);
      const previousTime = previousTimes.get(Number(item.result_id));
      const gapSeconds = timeSeconds !== null && previousTime !== undefined
        ? Math.max(0, timeSeconds - previousTime)
        : null;
      const pace = getResultPaceDisplay(item);

      return {
        ...item,
        distance_km: pace.distance_km,
        is_long_distance: pace.is_long_distance,
        gap_seconds: gapSeconds,
        gap_display: gapSeconds === null ? '-' : formatDuration(gapSeconds, true),
        pace_seconds_per_km: pace.pace_seconds_per_km,
        pace_display: pace.pace_display,
      };
    });

    const total = Number(countRows[0]?.total || 0);
    const shouldMaskAthleteScores = !access.authenticated && Boolean(athleteId);
    const responseItems = shouldMaskAthleteScores
      ? enrichedItems.map((item) => ({
          ...item,
          finish_time: null,
          result_status_code: null,
          result_status_note: null,
          gap_seconds: null,
          gap_display: '-',
          pace_seconds_per_km: null,
          pace_display: '-',
          score_locked: true,
        }))
      : enrichedItems;
    const preview = applyPublicPreview(responseItems, access);

    // 搜索日志写库不阻塞响应（远程 MySQL 往返，仅审计用途）。
    void writeSearchLog(request, {
      entry: 'race_results',
      keyword: search || '',
      resultCount: total,
      durationMs: Date.now() - startedAt,
      detail: {
        path: request.nextUrl.pathname,
        query: Object.fromEntries(request.nextUrl.searchParams.entries()),
      },
    }).catch(() => {});

    return NextResponse.json({
      items: preview.items,
      total,
      stats: {
        resultCount: total,
        athleteCount: Number(countRows[0]?.athlete_count || 0),
        eventCount: Number(countRows[0]?.event_count || 0),
      },
      page: access.authenticated ? page : 1,
      pageSize,
      totalPages: access.authenticated ? Math.ceil(total / pageSize) : 1,
      facets: facetsRow || {},
      access,
      preview_locked: preview.previewLocked,
      preview_limit: access.previewLimit,
      score_locked: shouldMaskAthleteScores,
    });
  } catch (error) {
    console.error('查询成绩失败:', error);
    return NextResponse.json({ error: '查询成绩失败' }, { status: 500 });
  }
}
