import type { PoolConnection } from 'mysql2/promise';
import type { RowDataPacket } from 'mysql2';
import { getResultStatusLabel, normalizeResultStatusCode } from '@/lib/result-status';
import { normalizeClubTeamName, syncClubTeamAliasesForEvent } from '@/lib/club-team-normalization';
import { normalizeNationality } from '@/lib/nationality';
import { normalizeResultDiscipline, normalizeResultGroup } from '@/lib/result-normalization';

export interface EventSourceLink {
  title: string;
  url: string;
}

export interface EventResultInput {
  athlete_id?: number | null;
  athlete_name?: string;
  athlete_name_snapshot: string;
  bib_number?: string | null;
  gender_group?: string;
  discipline: string;
  board_class?: string | null;
  round_label?: string | null;
  rank_position: number;
  result_label?: string | null;
  finish_time: string;
  result_status_code?: string | null;
  result_status_note?: string | null;
  points?: number | null;
  team_name?: string | null;
  team_members?: string[];
  nationality_snapshot?: string | null;
  source_type?: string | null;
  source_id?: number | null;
  source_title?: string | null;
  source_locator?: string | null;
  source_url?: string | null;
  source_note?: string | null;
  parse_confidence?: number | null;
  review_status?: 'pending' | 'confirmed' | 'needs_review';
  is_verified?: boolean;
}

interface AthleteRow extends RowDataPacket {
  athlete_id: number;
}

interface AthleteRaceTimeRow extends RowDataPacket {
  discipline: string;
  round_label: string | null;
  result_label: string | null;
  finish_time: string;
  result_status_code: string | null;
  result_status_note: string | null;
  start_date: string | null;
  event_id: number;
  event_name: string;
}

export function parseJsonArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (!value) return [];
  try {
    return JSON.parse(String(value)) as T[];
  } catch {
    return [];
  }
}

export function parseSourceLinksInput(value: unknown): EventSourceLink[] {
  const items = parseJsonArray<Record<string, unknown>>(value);
  return items
    .map((item) => ({
      title: String(item.title || '').trim(),
      url: String(item.url || '').trim(),
    }))
    .filter((item) => item.title && item.url);
}

export function formatSourceLinksForTextarea(value: unknown) {
  return parseSourceLinksInput(value)
    .map((item) => `${item.title} | ${item.url}`)
    .join('\n');
}

export function parseSourceLinksTextarea(text: string) {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [title, url] = line.split('|').map((part) => part.trim());
      return {
        title: title || url || '',
        url: url || title || '',
      };
    })
    .filter((item) => item.title && item.url);
}

export function parseTeamMembersInput(value: unknown): string[] {
  if (Array.isArray(value)) {
    return [...new Set(value.map((item) => {
      if (item && typeof item === 'object') {
        const record = item as Record<string, unknown>;
        return String(record.name || record.member_name || '').trim();
      }
      return String(item || '').trim();
    }).filter(Boolean))];
  }
  const text = String(value || '').trim();
  if (text.startsWith('[')) {
    try {
      return parseTeamMembersInput(JSON.parse(text));
    } catch {
      // Fall back to delimiter parsing below.
    }
  }
  return [...new Set(text
    .split(/[\n,，、;；/]+/)
    .map((item) => item.trim())
    .filter(Boolean))];
}

export function normalizeEventResultsInput(value: unknown): EventResultInput[] {
  const items = parseJsonArray<Record<string, unknown>>(value);
  return items
    .map((item) => {
      const athleteName = String(item.athlete_name ?? item.athlete_name_snapshot ?? '').trim();
      const discipline = String(item.discipline ?? '').trim();
      const finishTime = String(item.finish_time ?? item.time ?? '').trim();
      const statusCode = normalizeResultStatusCode(item.result_status_code || finishTime);
      const rankPosition = Number(item.rank_position);
      const reviewStatus: EventResultInput['review_status'] =
        item.review_status === 'pending' || item.review_status === 'needs_review' ? item.review_status : 'confirmed';

      return {
        athlete_id: item.athlete_id ? Number(item.athlete_id) : null,
        athlete_name: athleteName,
        athlete_name_snapshot: athleteName,
        bib_number: item.bib_number ? String(item.bib_number) : null,
        gender_group: item.gender_group ? String(item.gender_group) : '公开组',
        discipline,
        board_class: item.board_class ? String(item.board_class) : null,
        round_label: item.round_label ? String(item.round_label) : null,
        rank_position: Number.isFinite(rankPosition) ? rankPosition : NaN,
        result_label: item.result_label ? String(item.result_label) : null,
        finish_time: finishTime,
        result_status_code: statusCode,
        result_status_note: item.result_status_note ? String(item.result_status_note) : (statusCode ? getResultStatusLabel(statusCode) : null),
        points: item.points === undefined || item.points === null || item.points === '' ? null : Number(item.points),
        team_name: item.team_name ? String(item.team_name) : '个人',
        team_members: parseTeamMembersInput(item.team_members),
        nationality_snapshot: normalizeNationality(item.nationality_snapshot),
        source_type: item.source_type ? String(item.source_type) : null,
        source_id: item.source_id ? Number(item.source_id) : null,
        source_title: item.source_title ? String(item.source_title) : null,
        source_locator: item.source_locator ? String(item.source_locator) : null,
        source_url: item.source_url ? String(item.source_url) : null,
        source_note: item.source_note ? String(item.source_note) : null,
        parse_confidence: item.parse_confidence === undefined || item.parse_confidence === null || item.parse_confidence === '' ? null : Number(item.parse_confidence),
        review_status: reviewStatus,
        is_verified: item.is_verified === undefined ? true : Boolean(item.is_verified),
      };
    })
    .filter((item) => item.athlete_name && item.discipline && item.finish_time && Number.isFinite(item.rank_position));
}

export function formatResultsForTextarea(value: unknown) {
  const items = normalizeEventResultsInput(value);
  return JSON.stringify(items, null, 2);
}

export function parseResultsTextarea(text: string) {
  if (!text.trim()) return [] as EventResultInput[];
  try {
    return normalizeEventResultsInput(JSON.parse(text));
  } catch {
    return [] as EventResultInput[];
  }
}

export function parseFinishTimeToSeconds(input: string) {
  const raw = input.trim();
  if (!raw) return null;
  if (/^\d+(\.\d+)?$/.test(raw)) return Number(raw);
  const quoteMatch = raw.match(/^(\d+)'(\d+(?:\.\d+)?)"?$/);
  if (quoteMatch) return Number(quoteMatch[1]) * 60 + Number(quoteMatch[2]);
  const minuteSecondCentisecond = raw.match(/^([1-9]\d{1,2}):(\d{2}):(\d{2})$/);
  if (minuteSecondCentisecond && Number(minuteSecondCentisecond[1]) > 2) {
    return Number(minuteSecondCentisecond[1]) * 60
      + Number(minuteSecondCentisecond[2])
      + Number(minuteSecondCentisecond[3]) / 100;
  }
  const dottedTime = raw.match(/^(\d+):(\d{2})\.(\d{2})\.(\d{1,3})$/);
  if (dottedTime) {
    return Number(dottedTime[1]) * 3600 + Number(dottedTime[2]) * 60 + Number(`${dottedTime[3]}.${dottedTime[4]}`);
  }

  const parts = raw.split(':').map((part) => part.trim());
  if (parts.some((part) => !/^\d+(\.\d+)?$/.test(part))) return null;

  if (parts.length === 2) {
    return Number(parts[0]) * 60 + Number(parts[1]);
  }
  if (parts.length === 3) {
    return Number(parts[0]) * 3600 + Number(parts[1]) * 60 + Number(parts[2]);
  }

  return null;
}

async function resolveAthleteId(connection: PoolConnection, result: EventResultInput) {
  if (result.athlete_id) return result.athlete_id;
  const athleteName = result.athlete_name_snapshot.trim();
  if (!athleteName) return null;
  const normalized = athleteName.replace(/\s+/g, '').toLowerCase();

  const [confirmedRows] = await connection.execute<AthleteRow[]>(
    `SELECT athlete_id
       FROM sup_athlete_identity_links
      WHERE normalized_name = ? AND status = 'confirmed' AND athlete_id IS NOT NULL
      ORDER BY confidence DESC, link_id ASC
      LIMIT 1`,
    [normalized]
  );
  if (confirmedRows.length) return confirmedRows[0].athlete_id;

  const [existingRows] = await connection.execute<AthleteRow[]>(
    'SELECT athlete_id FROM sup_athletes WHERE name = ? ORDER BY CASE status WHEN "published" THEN 0 ELSE 1 END, athlete_id ASC LIMIT 5',
    [athleteName]
  );

  if (existingRows.length > 0) {
    await connection.execute(
      `INSERT IGNORE INTO sup_athlete_identity_links
        (athlete_id, normalized_name, display_name, gender_hint, team_hint, nationality_hint, confidence, status, note)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
      [
        existingRows.length === 1 ? existingRows[0].athlete_id : null,
        normalized,
        athleteName,
        result.gender_group || null,
        result.team_name || null,
        normalizeNationality(result.nationality_snapshot),
        existingRows.length === 1 ? 0.85 : 0.45,
        existingRows.length === 1 ? '成绩录入发现唯一同名档案，等待后台确认后再绑定' : '成绩录入发现多个同名候选，需后台确认',
      ]
    );
    return null;
  }

  const [insertResult] = await connection.execute(
    `INSERT INTO sup_athletes (name, nationality, discipline, bio, status)
     VALUES (?, ?, 'race', ?, 'draft')`,
    [
      athleteName,
      normalizeNationality(result.nationality_snapshot) || '中国',
      `由赛事成绩录入自动生成的运动员草稿档案，待补充完整人物资料。`,
    ]
  );

  const athleteId = Number((insertResult as { insertId: number }).insertId);
  await connection.execute(
    `INSERT IGNORE INTO sup_athlete_identity_links
      (athlete_id, normalized_name, display_name, gender_hint, team_hint, nationality_hint, confidence, status, note)
     VALUES (?, ?, ?, ?, ?, ?, 0.800, 'pending', '导入成绩时自动创建草稿运动员，等待后台确认身份')`,
    [
      athleteId,
      normalized,
      athleteName,
      result.gender_group || null,
      result.team_name || null,
      normalizeNationality(result.nationality_snapshot),
    ]
  );

  return athleteId;
}

async function resolveAthleteByName(connection: PoolConnection, name: string, result: EventResultInput) {
  const cleanName = name.trim();
  if (!cleanName) return null;
  const normalized = cleanName.replace(/\s+/g, '').toLowerCase();
  const [confirmedRows] = await connection.execute<AthleteRow[]>(
    `SELECT athlete_id
       FROM sup_athlete_identity_links
      WHERE normalized_name = ? AND status = 'confirmed' AND athlete_id IS NOT NULL
      ORDER BY confidence DESC, link_id ASC
      LIMIT 1`,
    [normalized]
  );
  if (confirmedRows.length) return confirmedRows[0].athlete_id;

  const [existingRows] = await connection.execute<AthleteRow[]>(
    'SELECT athlete_id FROM sup_athletes WHERE name = ? ORDER BY CASE status WHEN "published" THEN 0 ELSE 1 END, athlete_id ASC LIMIT 5',
    [cleanName]
  );
  if (existingRows.length > 0) {
    await connection.execute(
      `INSERT IGNORE INTO sup_athlete_identity_links
        (athlete_id, normalized_name, display_name, gender_hint, team_hint, nationality_hint, confidence, status, note)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
      [
        existingRows.length === 1 ? existingRows[0].athlete_id : null,
        normalized,
        cleanName,
        result.gender_group || null,
        result.team_name || null,
        normalizeNationality(result.nationality_snapshot),
        existingRows.length === 1 ? 0.85 : 0.45,
        existingRows.length === 1 ? '团队赛成员发现唯一同名档案，等待后台确认后再绑定' : '团队赛成员发现多个同名候选，需后台确认',
      ]
    );
    return null;
  }

  const [insertResult] = await connection.execute(
    `INSERT INTO sup_athletes (name, nationality, discipline, bio, status)
     VALUES (?, ?, 'race', ?, 'draft')`,
    [
      cleanName,
      normalizeNationality(result.nationality_snapshot) || '中国',
      `由团队赛成绩录入自动生成的运动员草稿档案，待补充完整人物资料。`,
    ]
  );
  const athleteId = Number((insertResult as { insertId: number }).insertId);
  await connection.execute(
    `INSERT IGNORE INTO sup_athlete_identity_links
      (athlete_id, normalized_name, display_name, gender_hint, team_hint, nationality_hint, confidence, status, note)
     VALUES (?, ?, ?, ?, ?, ?, 0.820, 'pending', '团队赛成绩成员自动创建草稿运动员，等待后台确认身份')`,
    [
      athleteId,
      normalized,
      cleanName,
      result.gender_group || null,
      result.team_name || null,
      normalizeNationality(result.nationality_snapshot),
    ]
  );
  return athleteId;
}

async function replaceResultMembers(connection: PoolConnection, resultId: number, result: EventResultInput, primaryAthleteId: number | null) {
  await connection.execute('DELETE FROM sup_event_result_members WHERE result_id = ?', [resultId]);
  const members = parseTeamMembersInput(result.team_members);
  if (!members.length) return [];
  const touched = new Set<number>();
  for (let index = 0; index < members.length; index += 1) {
    const memberName = members[index];
    const athleteId = normalizedSameName(memberName, result.athlete_name_snapshot) && primaryAthleteId
      ? primaryAthleteId
      : await resolveAthleteByName(connection, memberName, result);
    if (athleteId) touched.add(athleteId);
    await connection.execute(
      `INSERT INTO sup_event_result_members (result_id, athlete_id, member_name, member_order)
       VALUES (?, ?, ?, ?)`,
      [resultId, athleteId, memberName, index]
    );
  }
  return [...touched];
}

function normalizedSameName(a: string, b: string) {
  return a.replace(/\s+/g, '').toLowerCase() === b.replace(/\s+/g, '').toLowerCase();
}

export async function syncAthleteRaceTimes(connection: PoolConnection, athleteId: number) {
  const [rows] = await connection.execute<AthleteRaceTimeRow[]>(
    `SELECT DISTINCT
       er.discipline,
       er.round_label,
       er.result_label,
       er.finish_time,
       er.result_status_code,
       er.result_status_note,
       er.rank_position,
       e.start_date,
       e.event_id,
       e.name AS event_name
     FROM sup_event_results er
     INNER JOIN sup_events e ON e.event_id = er.event_id
     LEFT JOIN sup_event_result_members erm ON erm.result_id = er.result_id
     WHERE er.athlete_id = ? OR erm.athlete_id = ?
     ORDER BY e.start_date DESC, er.rank_position ASC`,
    [athleteId, athleteId]
  );

  const raceTimes = rows.map((row) => ({
    distance: row.discipline,
    year: row.start_date ? new Date(row.start_date).getFullYear() : undefined,
    event: row.event_name,
    event_id: row.event_id,
    round: row.round_label || undefined,
    result: row.result_label || undefined,
    time: row.finish_time,
    status: row.result_status_code || undefined,
    status_label: row.result_status_code ? getResultStatusLabel(row.result_status_code, row.result_status_note) : undefined,
  }));

  await connection.execute(
    'UPDATE sup_athletes SET race_times = ? WHERE athlete_id = ?',
    [JSON.stringify(raceTimes), athleteId]
  );
}

interface NormalizedResultFields {
  normalized_discipline_key: string;
  discipline_family: string;
  normalized_group_key: string;
  norm_confidence: number;
}

/** 计算单条成绩的标准化字段（项目key/族/组别key/置信度）。置信度取项目与组别的较小值。 */
function computeNormalizedResultFields(result: EventResultInput): NormalizedResultFields {
  const disc = normalizeResultDiscipline(result.discipline, result.board_class, result.round_label);
  const grp = normalizeResultGroup(result.gender_group || '公开组', result.board_class, result.team_name);
  return {
    normalized_discipline_key: disc.normalized_key,
    discipline_family: disc.family,
    normalized_group_key: grp.normalized_group_key,
    norm_confidence: Math.min(disc.confidence, grp.confidence),
  };
}

/**
 * 预加载赛事报名组别并按标准化 key 建索引，供成绩匹配 category_id。
 * key = `${normalized_discipline_key}__${normalized_group_key}`，首个命中优先。
 */
async function buildEventCategoryMatcher(connection: PoolConnection, eventId: number) {
  const matcher = new Map<string, number>();
  const [rows] = await connection.execute<RowDataPacket[]>(
    `SELECT category_id, discipline, gender_group, board_class FROM sup_event_categories WHERE event_id = ?`,
    [eventId]
  );
  for (const row of rows) {
    const disc = normalizeResultDiscipline(String(row.discipline || ''), row.board_class, null);
    // 项目键为 unknown 时不可靠：多项目赛事(桨板/路跑等)都会落 unknown，会把不同项目误绑到同组别。
    if (disc.normalized_key === 'unknown') continue;
    const grp = normalizeResultGroup(String(row.gender_group || ''), row.board_class, null);
    const key = `${disc.normalized_key}__${grp.normalized_group_key}`;
    if (!matcher.has(key)) matcher.set(key, Number(row.category_id));
  }
  return matcher;
}

function matchCategoryId(matcher: Map<string, number>, norm: NormalizedResultFields): number | null {
  if (!matcher.size || norm.normalized_discipline_key === 'unknown') return null;
  return matcher.get(`${norm.normalized_discipline_key}__${norm.normalized_group_key}`) ?? null;
}

export async function replaceEventResults(connection: PoolConnection, eventId: number, inputResults: EventResultInput[]) {
  const [existingRows] = await connection.execute<RowDataPacket[]>(
    `SELECT athlete_id FROM sup_event_results WHERE event_id = ? AND athlete_id IS NOT NULL
     UNION
     SELECT erm.athlete_id
     FROM sup_event_result_members erm
     INNER JOIN sup_event_results er ON er.result_id = erm.result_id
     WHERE er.event_id = ? AND erm.athlete_id IS NOT NULL`,
    [eventId, eventId]
  );

  const touchedAthleteIds = new Set<number>(
    existingRows.map((row) => Number(row.athlete_id)).filter((value) => Number.isFinite(value))
  );

  await connection.execute('DELETE FROM sup_event_results WHERE event_id = ?', [eventId]);

  const categoryMatcher = await buildEventCategoryMatcher(connection, eventId);

  for (const result of inputResults) {
    const athleteId = await resolveAthleteId(connection, result);
    if (athleteId) touchedAthleteIds.add(athleteId);

    const norm = computeNormalizedResultFields(result);
    const categoryId = matchCategoryId(categoryMatcher, norm);

    await connection.execute(
      `INSERT INTO sup_event_results (
        event_id, athlete_id, athlete_name_snapshot, bib_number, gender_group, discipline, board_class, round_label,
        rank_position, result_label, finish_time, result_status_code, result_status_note, time_seconds, points, team_name, team_name_normalized, nationality_snapshot,
        source_type, source_id, source_title, source_locator, source_url, source_note, parse_confidence, review_status, is_verified,
        normalized_discipline_key, discipline_family, normalized_group_key, norm_confidence, category_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        eventId,
        athleteId,
        result.athlete_name_snapshot,
        result.bib_number || null,
        result.gender_group || '公开组',
        result.discipline,
        result.board_class || null,
        result.round_label || null,
        result.rank_position,
        result.result_label || null,
        result.finish_time,
        result.result_status_code || normalizeResultStatusCode(result.finish_time),
        result.result_status_note || (result.result_status_code ? getResultStatusLabel(result.result_status_code) : null),
        parseFinishTimeToSeconds(result.finish_time),
        typeof result.points === 'number' && Number.isFinite(result.points) ? result.points : null,
        result.team_name || '个人',
        normalizeClubTeamName(result.team_name || '个人') || null,
        normalizeNationality(result.nationality_snapshot),
        result.source_type || 'official',
        result.source_id || null,
        result.source_title || null,
        result.source_locator || null,
        result.source_url || null,
        result.source_note || null,
        typeof result.parse_confidence === 'number' && Number.isFinite(result.parse_confidence) ? result.parse_confidence : 1,
        result.review_status || 'confirmed',
        result.is_verified !== false ? 1 : 0,
        norm.normalized_discipline_key,
        norm.discipline_family,
        norm.normalized_group_key,
        norm.norm_confidence,
        categoryId,
      ]
    );
    const [idRows] = await connection.execute<RowDataPacket[]>('SELECT LAST_INSERT_ID() AS result_id');
    const resultId = Number(idRows[0]?.result_id || 0);
    if (resultId) {
      for (const memberAthleteId of await replaceResultMembers(connection, resultId, result, athleteId)) {
        touchedAthleteIds.add(memberAthleteId);
      }
    }
  }

  await syncClubTeamAliasesForEvent(connection, eventId);

  for (const athleteId of touchedAthleteIds) {
    await syncAthleteRaceTimes(connection, athleteId);
  }
}

export async function appendEventResults(connection: PoolConnection, eventId: number, inputResults: EventResultInput[]) {
  const touchedAthleteIds = new Set<number>();

  const categoryMatcher = await buildEventCategoryMatcher(connection, eventId);

  for (const result of inputResults) {
    const athleteId = await resolveAthleteId(connection, result);
    if (athleteId) touchedAthleteIds.add(athleteId);

    const norm = computeNormalizedResultFields(result);
    const categoryId = matchCategoryId(categoryMatcher, norm);

    await connection.execute(
      `INSERT INTO sup_event_results (
        event_id, athlete_id, athlete_name_snapshot, bib_number, gender_group, discipline, board_class, round_label,
        rank_position, result_label, finish_time, result_status_code, result_status_note, time_seconds, points, team_name, team_name_normalized, nationality_snapshot,
        source_type, source_id, source_title, source_locator, source_url, source_note, parse_confidence, review_status, is_verified,
        normalized_discipline_key, discipline_family, normalized_group_key, norm_confidence, category_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        result_id = LAST_INSERT_ID(result_id),
        athlete_id = VALUES(athlete_id),
        bib_number = VALUES(bib_number),
        board_class = VALUES(board_class),
        result_label = VALUES(result_label),
        finish_time = VALUES(finish_time),
        result_status_code = VALUES(result_status_code),
        result_status_note = VALUES(result_status_note),
        time_seconds = VALUES(time_seconds),
        points = VALUES(points),
        team_name = VALUES(team_name),
        team_name_normalized = VALUES(team_name_normalized),
        source_id = VALUES(source_id),
        source_title = VALUES(source_title),
        source_locator = VALUES(source_locator),
        source_url = VALUES(source_url),
        source_note = VALUES(source_note),
        parse_confidence = VALUES(parse_confidence),
        review_status = VALUES(review_status),
        is_verified = VALUES(is_verified),
        normalized_discipline_key = VALUES(normalized_discipline_key),
        discipline_family = VALUES(discipline_family),
        normalized_group_key = VALUES(normalized_group_key),
        norm_confidence = VALUES(norm_confidence),
        category_id = VALUES(category_id)`,
      [
        eventId,
        athleteId,
        result.athlete_name_snapshot,
        result.bib_number || null,
        result.gender_group || '公开组',
        result.discipline,
        result.board_class || null,
        result.round_label || null,
        result.rank_position,
        result.result_label || null,
        result.finish_time,
        result.result_status_code || normalizeResultStatusCode(result.finish_time),
        result.result_status_note || (result.result_status_code ? getResultStatusLabel(result.result_status_code) : null),
        parseFinishTimeToSeconds(result.finish_time),
        typeof result.points === 'number' && Number.isFinite(result.points) ? result.points : null,
        result.team_name || '个人',
        normalizeClubTeamName(result.team_name || '个人') || null,
        normalizeNationality(result.nationality_snapshot),
        result.source_type || 'official',
        result.source_id || null,
        result.source_title || null,
        result.source_locator || null,
        result.source_url || null,
        result.source_note || null,
        typeof result.parse_confidence === 'number' && Number.isFinite(result.parse_confidence) ? result.parse_confidence : 1,
        result.review_status || 'confirmed',
        result.is_verified !== false ? 1 : 0,
        norm.normalized_discipline_key,
        norm.discipline_family,
        norm.normalized_group_key,
        norm.norm_confidence,
        categoryId,
      ]
    );
    const [idRows] = await connection.execute<RowDataPacket[]>('SELECT LAST_INSERT_ID() AS result_id');
    const resultId = Number(idRows[0]?.result_id || 0);
    if (resultId) {
      for (const memberAthleteId of await replaceResultMembers(connection, resultId, result, athleteId)) {
        touchedAthleteIds.add(memberAthleteId);
      }
    }
  }

  await syncClubTeamAliasesForEvent(connection, eventId);

  for (const athleteId of touchedAthleteIds) {
    await syncAthleteRaceTimes(connection, athleteId);
  }
}
