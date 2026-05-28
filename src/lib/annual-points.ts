import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import pool from './db';

export const ANNUAL_POINTS_2025_SOURCE = {
  sourceKey: 'jinshuju-2025-sup-race-points',
  year: 2025,
  title: '桨板竞速2025年度积分',
  sourceUrl: 'https://jsj.top/f/J9j65S/s/CgPeBv',
  formToken: 'J9j65S',
  openSearchId: 'CgPeBv',
  parserName: 'sync-annual-points-2025',
};

export const ANNUAL_POINTS_GROUPS = [
  { code: 'TcSz', label: '女子U9组' },
  { code: 'Hn6i', label: '男子U9组' },
  { code: 'd0Bv', label: '女子U12组' },
  { code: 'xjpA', label: '男子U12组' },
  { code: '7H7Q', label: '女子U15组' },
  { code: '2O7f', label: '男子U15组' },
  { code: 'IFbB', label: '女子U18组' },
  { code: 'bIMw', label: '男子U18组' },
  { code: 'y8OL', label: '女子高校组' },
  { code: 'vzFt', label: '男子高校组' },
  { code: 'JwSa', label: '女子卡胡纳组' },
  { code: 'RyFK', label: '男子卡胡纳组' },
  { code: 'XYw3', label: '女子大师组' },
  { code: '9HhG', label: '男子大师组' },
  { code: 't0iq', label: '女子公开组' },
  { code: 'amGW', label: '男子公开组' },
];

const OPEN_SEARCH_QUERY = `query publishedOpenSearchEntries(
  $formToken: ID!
  $openSearchId: ID
  $openResultId: ID
  $forceProtected: Boolean
  $first: Int
  $after: String
  $sortColumns: [SortColumnAttributes!]
  $queries: [JSON!]
  $scopeConditions: [ScopeConditionAttributes!]
) {
  publishedOpenSearchEntries(
    formId: $formToken
    openSearchId: $openSearchId
    openResultId: $openResultId
    first: $first
    after: $after
    sortColumns: $sortColumns
    fieldFilter: $queries
    scopeConditions: $scopeConditions
  ) {
    nodes {
      id
      token
      fieldValues(openResultId: $openResultId, openSearchId: $openSearchId, forceProtected: $forceProtected)
    }
    pageInfo {
      endCursor
      hasNextPage
    }
    totalCount
  }
}`;

interface JinshujuNode {
  id: string;
  token: string | null;
  fieldValues: Record<string, string | number | null>;
}

interface NormalizedStanding {
  sourceRecordId: string;
  sourceToken: string | null;
  groupCode: string;
  groupName: string;
  rankPosition: number | null;
  athleteName: string;
  totalPoints: number | null;
  endurancePoints: number | null;
  sprintPoints: number | null;
  technicalPoints: number | null;
  baseDetailText: string;
  adjustmentDetailText: string;
  rawJson: Record<string, unknown>;
}

interface MatchResult {
  athleteId: number | null;
  identityLinkId: number | null;
  matchStatus: 'unmatched' | 'candidate' | 'confirmed' | 'conflict';
  matchConfidence: number;
}

export interface AnnualPointsSyncOptions {
  groupCode?: string;
  limit?: number;
  pageSize?: number;
  dryRun?: boolean;
}

export interface AnnualPointsSyncResult {
  dryRun: boolean;
  groups: Array<{ code: string; label: string; fetched: number; totalCount: number }>;
  fetched: number;
  imported: number;
  sourceId?: number;
  sample: NormalizedStanding[];
}

function normalizeName(name: string) {
  return String(name || '').replace(/\s+/g, '').toLowerCase();
}

function parseNumber(value: unknown) {
  const raw = String(value ?? '').trim();
  if (!raw || raw === '-') return null;
  const next = Number(raw);
  return Number.isFinite(next) ? next : null;
}

function parseRank(value: unknown) {
  const parsed = parseNumber(value);
  return parsed == null ? null : Math.trunc(parsed);
}

function pointValue(value: unknown) {
  const parsed = parseNumber(value);
  return parsed == null ? null : Number(parsed.toFixed(3));
}

function normalizeStanding(node: JinshujuNode, group: { code: string; label: string }): NormalizedStanding {
  const values = node.fieldValues || {};
  return {
    sourceRecordId: String(node.id),
    sourceToken: node.token || null,
    groupCode: group.code,
    groupName: group.label,
    rankPosition: parseRank(values.field_2),
    athleteName: String(values.field_3 || '').trim(),
    totalPoints: pointValue(values.field_8),
    endurancePoints: pointValue(values.field_7),
    sprintPoints: pointValue(values.field_5),
    technicalPoints: pointValue(values.field_6),
    baseDetailText: String(values.field_9 || '').trim(),
    adjustmentDetailText: String(values.field_10 || '').trim(),
    rawJson: values,
  };
}

function parseSegmentPoints(text: string) {
  const pick = (label: string) => {
    const match = text.match(new RegExp(`${label}：\\s*([\\d.]+)`));
    return match ? pointValue(match[1]) : null;
  };
  return {
    endurancePoints: pick('耐力赛'),
    sprintPoints: pick('冲刺赛'),
    technicalPoints: pick('技术赛'),
  };
}

function parseBreakdowns(standing: NormalizedStanding) {
  const rows: Array<{
    detailType: 'base' | 'adjustment';
    eventName: string | null;
    starLevel: number | null;
    endurancePoints: number | null;
    sprintPoints: number | null;
    technicalPoints: number | null;
    rawText: string;
  }> = [];

  for (const line of standing.baseDetailText.split(/\n+/).map((item) => item.trim()).filter(Boolean)) {
    const starMatch = line.match(/(✮+)/);
    const starLevel = starMatch ? starMatch[1].length : null;
    const eventName = starMatch ? line.slice(0, starMatch.index).trim() : line.split(/\s+耐力赛：/)[0]?.trim() || null;
    rows.push({ detailType: 'base', eventName, starLevel, rawText: line, ...parseSegmentPoints(line) });
  }

  for (const line of standing.adjustmentDetailText.split(/\n+/).map((item) => item.trim()).filter(Boolean)) {
    rows.push({ detailType: 'adjustment', eventName: null, starLevel: null, rawText: line, ...parseSegmentPoints(line) });
  }

  return rows;
}

async function fetchGroupPage(groupCode: string, first: number, after?: string | null) {
  const response = await fetch('https://jsj.top/graphql', {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      referer: ANNUAL_POINTS_2025_SOURCE.sourceUrl,
    },
    body: JSON.stringify({
      operationName: 'publishedOpenSearchEntries',
      variables: {
        formToken: ANNUAL_POINTS_2025_SOURCE.formToken,
        openSearchId: ANNUAL_POINTS_2025_SOURCE.openSearchId,
        openResultId: null,
        forceProtected: false,
        first,
        after: after || null,
        queries: [{ field_14: groupCode }],
      },
      query: OPEN_SEARCH_QUERY,
    }),
  });

  if (!response.ok) throw new Error(`金数据接口请求失败：HTTP ${response.status}`);
  const payload = await response.json();
  if (payload.errors?.length) throw new Error(payload.errors.map((item: { message?: string }) => item.message).filter(Boolean).join('；') || '金数据接口返回错误');
  const data = payload.data?.publishedOpenSearchEntries;
  if (!data) throw new Error('金数据接口返回结构异常');
  return {
    nodes: (data.nodes || []) as JinshujuNode[],
    endCursor: data.pageInfo?.endCursor as string | null,
    hasNextPage: Boolean(data.pageInfo?.hasNextPage),
    totalCount: Number(data.totalCount || 0),
  };
}

async function fetchGroupStandings(group: { code: string; label: string }, pageSize: number, limit: number) {
  const output: NormalizedStanding[] = [];
  let after: string | null = null;
  let totalCount = 0;
  do {
    const remaining = limit > 0 ? limit - output.length : pageSize;
    if (limit > 0 && remaining <= 0) break;
    const page = await fetchGroupPage(group.code, Math.min(pageSize, remaining || pageSize), after);
    totalCount = page.totalCount;
    output.push(...page.nodes.map((node) => normalizeStanding(node, group)).filter((item) => item.athleteName));
    after = page.endCursor;
    if (!page.hasNextPage) break;
  } while (true);
  return { standings: output, totalCount };
}

async function ensureSource(connection: PoolConnection) {
  await connection.execute<ResultSetHeader>(
    `INSERT INTO sup_annual_point_sources
      (source_key, year, title, source_url, form_token, open_search_id, parser_name, sync_status, raw_config)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'syncing', ?)
     ON DUPLICATE KEY UPDATE
      title = VALUES(title),
      source_url = VALUES(source_url),
      form_token = VALUES(form_token),
      open_search_id = VALUES(open_search_id),
      parser_name = VALUES(parser_name),
      sync_status = 'syncing',
      error_message = NULL,
      raw_config = VALUES(raw_config),
      source_id = LAST_INSERT_ID(source_id)`,
    [
      ANNUAL_POINTS_2025_SOURCE.sourceKey,
      ANNUAL_POINTS_2025_SOURCE.year,
      ANNUAL_POINTS_2025_SOURCE.title,
      ANNUAL_POINTS_2025_SOURCE.sourceUrl,
      ANNUAL_POINTS_2025_SOURCE.formToken,
      ANNUAL_POINTS_2025_SOURCE.openSearchId,
      ANNUAL_POINTS_2025_SOURCE.parserName,
      JSON.stringify({ groups: ANNUAL_POINTS_GROUPS }),
    ]
  );
  const [rows] = await connection.execute<RowDataPacket[]>('SELECT LAST_INSERT_ID() AS source_id');
  return Number(rows[0]?.source_id);
}

async function resolveAthleteMatch(connection: PoolConnection, standing: NormalizedStanding): Promise<MatchResult> {
  const normalized = normalizeName(standing.athleteName);
  const [confirmedLinks] = await connection.execute<RowDataPacket[]>(
    `SELECT link_id, athlete_id, confidence
     FROM sup_athlete_identity_links
     WHERE normalized_name = ? AND status = 'confirmed' AND athlete_id IS NOT NULL
     ORDER BY confidence DESC, link_id ASC
     LIMIT 1`,
    [normalized]
  );
  if (confirmedLinks.length) {
    return {
      athleteId: Number(confirmedLinks[0].athlete_id),
      identityLinkId: Number(confirmedLinks[0].link_id),
      matchStatus: 'confirmed',
      matchConfidence: Number(confirmedLinks[0].confidence || 0.95),
    };
  }

  const [athleteRows] = await connection.execute<RowDataPacket[]>(
    `SELECT athlete_id
     FROM sup_athletes
     WHERE name = ?
     ORDER BY CASE status WHEN 'published' THEN 0 WHEN 'draft' THEN 1 ELSE 2 END, athlete_id ASC
     LIMIT 5`,
    [standing.athleteName]
  );

  if (athleteRows.length === 1) {
    const athleteId = Number(athleteRows[0].athlete_id);
    await connection.execute(
      `INSERT IGNORE INTO sup_athlete_identity_links
        (athlete_id, normalized_name, display_name, gender_hint, team_hint, nationality_hint, confidence, status, note)
       VALUES (?, ?, ?, ?, NULL, '中国', 0.850, 'pending', '2025年度积分同步生成的待确认候选')`,
      [athleteId, normalized, standing.athleteName, standing.groupName]
    );
    const [linkRows] = await connection.execute<RowDataPacket[]>(
      `SELECT link_id
       FROM sup_athlete_identity_links
       WHERE normalized_name = ? AND display_name = ? AND gender_hint = ? AND athlete_id = ?
       ORDER BY link_id DESC
       LIMIT 1`,
      [normalized, standing.athleteName, standing.groupName, athleteId]
    );
    return {
      athleteId,
      identityLinkId: linkRows.length ? Number(linkRows[0].link_id) : null,
      matchStatus: 'candidate',
      matchConfidence: 0.85,
    };
  }

  if (athleteRows.length > 1) {
    return { athleteId: null, identityLinkId: null, matchStatus: 'conflict', matchConfidence: 0.45 };
  }

  return { athleteId: null, identityLinkId: null, matchStatus: 'unmatched', matchConfidence: 0.3 };
}

async function upsertStanding(connection: PoolConnection, sourceId: number, standing: NormalizedStanding) {
  const match = await resolveAthleteMatch(connection, standing);
  await connection.execute<ResultSetHeader>(
    `INSERT INTO sup_annual_point_standings
      (source_id, year, group_code, group_name, rank_position, athlete_id, athlete_name_snapshot,
       total_points, endurance_points, sprint_points, technical_points, base_detail_text, adjustment_detail_text,
       source_record_id, source_token, raw_json, identity_link_id, match_status, match_confidence)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       group_code = VALUES(group_code),
       group_name = VALUES(group_name),
       rank_position = VALUES(rank_position),
       athlete_id = VALUES(athlete_id),
       athlete_name_snapshot = VALUES(athlete_name_snapshot),
       total_points = VALUES(total_points),
       endurance_points = VALUES(endurance_points),
       sprint_points = VALUES(sprint_points),
       technical_points = VALUES(technical_points),
       base_detail_text = VALUES(base_detail_text),
       adjustment_detail_text = VALUES(adjustment_detail_text),
       source_token = VALUES(source_token),
       raw_json = VALUES(raw_json),
       identity_link_id = VALUES(identity_link_id),
       match_status = VALUES(match_status),
       match_confidence = VALUES(match_confidence),
       standing_id = LAST_INSERT_ID(standing_id)`,
    [
      sourceId,
      ANNUAL_POINTS_2025_SOURCE.year,
      standing.groupCode,
      standing.groupName,
      standing.rankPosition,
      match.athleteId,
      standing.athleteName,
      standing.totalPoints,
      standing.endurancePoints,
      standing.sprintPoints,
      standing.technicalPoints,
      standing.baseDetailText || null,
      standing.adjustmentDetailText || null,
      standing.sourceRecordId,
      standing.sourceToken,
      JSON.stringify(standing.rawJson),
      match.identityLinkId,
      match.matchStatus,
      match.matchConfidence,
    ]
  );
  const [rows] = await connection.execute<RowDataPacket[]>('SELECT LAST_INSERT_ID() AS standing_id');
  const standingId = Number(rows[0]?.standing_id);
  await connection.execute('DELETE FROM sup_annual_point_breakdowns WHERE standing_id = ?', [standingId]);
  for (const row of parseBreakdowns(standing)) {
    await connection.execute(
      `INSERT INTO sup_annual_point_breakdowns
        (standing_id, detail_type, event_name, star_level, endurance_points, sprint_points, technical_points, raw_text)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [standingId, row.detailType, row.eventName, row.starLevel, row.endurancePoints, row.sprintPoints, row.technicalPoints, row.rawText]
    );
  }
}

export async function syncAnnualPoints2025(options: AnnualPointsSyncOptions = {}): Promise<AnnualPointsSyncResult> {
  const pageSize = Math.min(100, Math.max(10, Number(options.pageSize || 100)));
  const limit = Math.max(0, Number(options.limit || 0));
  const groups = options.groupCode
    ? ANNUAL_POINTS_GROUPS.filter((group) => group.code === options.groupCode)
    : ANNUAL_POINTS_GROUPS;
  if (!groups.length) throw new Error(`未知组别编码：${options.groupCode}`);

  const result: AnnualPointsSyncResult = { dryRun: Boolean(options.dryRun), groups: [], fetched: 0, imported: 0, sample: [] };
  const fetchedByGroup: Array<{ group: { code: string; label: string }; standings: NormalizedStanding[]; totalCount: number }> = [];

  for (const group of groups) {
    const groupLimit = limit > 0 && groups.length === 1 ? limit : 0;
    const fetched = await fetchGroupStandings(group, pageSize, groupLimit);
    fetchedByGroup.push({ group, ...fetched });
    result.groups.push({ code: group.code, label: group.label, fetched: fetched.standings.length, totalCount: fetched.totalCount });
    result.fetched += fetched.standings.length;
    result.sample.push(...fetched.standings.slice(0, Math.max(0, 10 - result.sample.length)));
  }

  if (options.dryRun) return result;

  const connection = await pool.getConnection();
  let sourceId: number | null = null;
  try {
    sourceId = await ensureSource(connection);
    result.sourceId = sourceId;
    for (const groupRows of fetchedByGroup) {
      for (const standing of groupRows.standings) {
        await upsertStanding(connection, sourceId, standing);
        result.imported += 1;
      }
    }

    const [sourceRows] = await connection.execute<RowDataPacket[]>(
      'SELECT group_counts FROM sup_annual_point_sources WHERE source_id = ?',
      [sourceId]
    );
    const existingCounts = typeof sourceRows[0]?.group_counts === 'string'
      ? JSON.parse(sourceRows[0].group_counts)
      : (sourceRows[0]?.group_counts || {});
    const groupCounts = { ...(existingCounts || {}) };
    for (const item of result.groups) groupCounts[item.code] = { label: item.label, totalCount: item.totalCount, fetched: item.fetched };

    await connection.execute(
      `UPDATE sup_annual_point_sources
       SET sync_status = 'imported',
           total_records = (SELECT COUNT(*) FROM sup_annual_point_standings WHERE source_id = ?),
           imported_records = ?,
           group_counts = ?,
           error_message = NULL,
           last_synced_at = CURRENT_TIMESTAMP
       WHERE source_id = ?`,
      [sourceId, result.imported, JSON.stringify(groupCounts), sourceId]
    );
    return result;
  } catch (error) {
    if (sourceId) {
      await connection.execute(
        `UPDATE sup_annual_point_sources
         SET sync_status = 'failed', error_message = ?, last_synced_at = CURRENT_TIMESTAMP
         WHERE source_id = ?`,
        [error instanceof Error ? error.message : String(error), sourceId]
      );
    }
    throw error;
  } finally {
    connection.release();
  }
}
