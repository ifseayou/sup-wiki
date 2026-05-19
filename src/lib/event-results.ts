import type { PoolConnection } from 'mysql2/promise';
import type { RowDataPacket } from 'mysql2';

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
  points?: number | null;
  team_name?: string | null;
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

export function normalizeEventResultsInput(value: unknown): EventResultInput[] {
  const items = parseJsonArray<Record<string, unknown>>(value);
  return items
    .map((item) => {
      const athleteName = String(item.athlete_name ?? item.athlete_name_snapshot ?? '').trim();
      const discipline = String(item.discipline ?? '').trim();
      const finishTime = String(item.finish_time ?? item.time ?? '').trim();
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
        points: item.points === undefined || item.points === null || item.points === '' ? null : Number(item.points),
        team_name: item.team_name ? String(item.team_name) : null,
        nationality_snapshot: item.nationality_snapshot ? String(item.nationality_snapshot) : null,
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

  const [existingRows] = await connection.execute<AthleteRow[]>(
    'SELECT athlete_id FROM sup_athletes WHERE name = ? ORDER BY CASE status WHEN "published" THEN 0 ELSE 1 END, athlete_id ASC LIMIT 5',
    [athleteName]
  );

  if (existingRows.length > 0) {
    if (existingRows.length > 1) {
      await connection.execute(
        `INSERT IGNORE INTO sup_athlete_identity_links
          (athlete_id, normalized_name, display_name, gender_hint, team_hint, nationality_hint, confidence, status, note)
         VALUES (?, ?, ?, ?, ?, ?, 0.500, 'pending', '同名运动员存在多个候选，需后台确认')`,
        [
          existingRows[0].athlete_id,
          athleteName.replace(/\s+/g, '').toLowerCase(),
          athleteName,
          result.gender_group || null,
          result.team_name || null,
          result.nationality_snapshot || null,
        ]
      );
    }
    return existingRows[0].athlete_id;
  }

  const [insertResult] = await connection.execute(
    `INSERT INTO sup_athletes (name, nationality, discipline, bio, status)
     VALUES (?, ?, 'race', ?, 'draft')`,
    [
      athleteName,
      result.nationality_snapshot || '中国',
      `由赛事成绩录入自动生成的运动员草稿档案，待补充完整人物资料。`,
    ]
  );

  const athleteId = Number((insertResult as { insertId: number }).insertId);
  await connection.execute(
    `INSERT IGNORE INTO sup_athlete_identity_links
      (athlete_id, normalized_name, display_name, gender_hint, team_hint, nationality_hint, confidence, status, note)
     VALUES (?, ?, ?, ?, ?, ?, 0.800, 'confirmed', '导入成绩时自动创建草稿运动员')`,
    [
      athleteId,
      athleteName.replace(/\s+/g, '').toLowerCase(),
      athleteName,
      result.gender_group || null,
      result.team_name || null,
      result.nationality_snapshot || null,
    ]
  );

  return athleteId;
}

export async function syncAthleteRaceTimes(connection: PoolConnection, athleteId: number) {
  const [rows] = await connection.execute<AthleteRaceTimeRow[]>(
    `SELECT
       er.discipline,
       er.round_label,
       er.result_label,
       er.finish_time,
       e.start_date,
       e.event_id,
       e.name AS event_name
     FROM sup_event_results er
     INNER JOIN sup_events e ON e.event_id = er.event_id
     WHERE er.athlete_id = ?
     ORDER BY e.start_date DESC, er.rank_position ASC`,
    [athleteId]
  );

  const raceTimes = rows.map((row) => ({
    distance: row.discipline,
    year: row.start_date ? new Date(row.start_date).getFullYear() : undefined,
    event: row.event_name,
    event_id: row.event_id,
    round: row.round_label || undefined,
    result: row.result_label || undefined,
    time: row.finish_time,
  }));

  await connection.execute(
    'UPDATE sup_athletes SET race_times = ? WHERE athlete_id = ?',
    [JSON.stringify(raceTimes), athleteId]
  );
}

export async function replaceEventResults(connection: PoolConnection, eventId: number, inputResults: EventResultInput[]) {
  const [existingRows] = await connection.execute<RowDataPacket[]>(
    'SELECT DISTINCT athlete_id FROM sup_event_results WHERE event_id = ? AND athlete_id IS NOT NULL',
    [eventId]
  );

  const touchedAthleteIds = new Set<number>(
    existingRows.map((row) => Number(row.athlete_id)).filter((value) => Number.isFinite(value))
  );

  await connection.execute('DELETE FROM sup_event_results WHERE event_id = ?', [eventId]);

  for (const result of inputResults) {
    const athleteId = await resolveAthleteId(connection, result);
    touchedAthleteIds.add(athleteId);

    await connection.execute(
      `INSERT INTO sup_event_results (
        event_id, athlete_id, athlete_name_snapshot, bib_number, gender_group, discipline, board_class, round_label,
        rank_position, result_label, finish_time, time_seconds, points, team_name, nationality_snapshot,
        source_type, source_id, source_title, source_locator, source_url, source_note, parse_confidence, review_status, is_verified
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        parseFinishTimeToSeconds(result.finish_time),
        typeof result.points === 'number' && Number.isFinite(result.points) ? result.points : null,
        result.team_name || null,
        result.nationality_snapshot || null,
        result.source_type || 'official',
        result.source_id || null,
        result.source_title || null,
        result.source_locator || null,
        result.source_url || null,
        result.source_note || null,
        typeof result.parse_confidence === 'number' && Number.isFinite(result.parse_confidence) ? result.parse_confidence : 1,
        result.review_status || 'confirmed',
        result.is_verified !== false ? 1 : 0,
      ]
    );
  }

  for (const athleteId of touchedAthleteIds) {
    await syncAthleteRaceTimes(connection, athleteId);
  }
}

export async function appendEventResults(connection: PoolConnection, eventId: number, inputResults: EventResultInput[]) {
  const touchedAthleteIds = new Set<number>();

  for (const result of inputResults) {
    const athleteId = await resolveAthleteId(connection, result);
    touchedAthleteIds.add(athleteId);

    await connection.execute(
      `INSERT INTO sup_event_results (
        event_id, athlete_id, athlete_name_snapshot, bib_number, gender_group, discipline, board_class, round_label,
        rank_position, result_label, finish_time, time_seconds, points, team_name, nationality_snapshot,
        source_type, source_id, source_title, source_locator, source_url, source_note, parse_confidence, review_status, is_verified
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        athlete_id = VALUES(athlete_id),
        bib_number = VALUES(bib_number),
        board_class = VALUES(board_class),
        result_label = VALUES(result_label),
        finish_time = VALUES(finish_time),
        time_seconds = VALUES(time_seconds),
        points = VALUES(points),
        team_name = VALUES(team_name),
        source_id = VALUES(source_id),
        source_title = VALUES(source_title),
        source_locator = VALUES(source_locator),
        source_url = VALUES(source_url),
        source_note = VALUES(source_note),
        parse_confidence = VALUES(parse_confidence),
        review_status = VALUES(review_status),
        is_verified = VALUES(is_verified)`,
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
        parseFinishTimeToSeconds(result.finish_time),
        typeof result.points === 'number' && Number.isFinite(result.points) ? result.points : null,
        result.team_name || null,
        result.nationality_snapshot || null,
        result.source_type || 'official',
        result.source_id || null,
        result.source_title || null,
        result.source_locator || null,
        result.source_url || null,
        result.source_note || null,
        typeof result.parse_confidence === 'number' && Number.isFinite(result.parse_confidence) ? result.parse_confidence : 1,
        result.review_status || 'confirmed',
        result.is_verified !== false ? 1 : 0,
      ]
    );
  }

  for (const athleteId of touchedAthleteIds) {
    await syncAthleteRaceTimes(connection, athleteId);
  }
}
