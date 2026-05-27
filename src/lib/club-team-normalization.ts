import type { PoolConnection } from 'mysql2/promise';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';

const PERSONAL_TEAM_NAMES = new Set([
  '',
  '-',
  '--',
  '/',
  '个人',
  '无',
  '无队伍',
  '个人参赛',
  '个人报名',
  '独立参赛',
  '暂无',
  '未知',
]);

export function normalizeClubTeamName(value: unknown) {
  return String(value || '')
    .normalize('NFKC')
    .replace(/[（［【]/g, '(')
    .replace(/[）］】]/g, ')')
    .replace(/\s+/g, '')
    .replace(/[·•]/g, '')
    .toLowerCase();
}

export function cleanClubTeamName(value: unknown) {
  return String(value || '')
    .normalize('NFKC')
    .replace(/[（［【]/g, '(')
    .replace(/[）］】]/g, ')')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200);
}

export function isClaimableClubTeamName(value: unknown) {
  const clean = cleanClubTeamName(value);
  if (!clean) return false;
  if (PERSONAL_TEAM_NAMES.has(clean)) return false;
  const normalized = normalizeClubTeamName(clean);
  if (PERSONAL_TEAM_NAMES.has(normalized)) return false;
  return normalized.length >= 2;
}

export function slugifyClubName(name: string, fallbackId?: number | string) {
  const ascii = name
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .toLowerCase()
    .slice(0, 120);
  if (ascii) return ascii;
  const suffix = fallbackId ? String(fallbackId) : Buffer.from(name).toString('hex').slice(0, 12);
  return `club-${suffix}`;
}

export async function findExactClubByNormalizedName(connection: PoolConnection, normalizedName: string) {
  const [rows] = await connection.execute<RowDataPacket[]>(
    `SELECT club_id
     FROM sup_clubs
     WHERE LOWER(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(name, ' ', ''), '　', ''), '（', '('), '）', ')'), '·', ''), '•', '')) = ?
     ORDER BY status = 'published' DESC, club_id ASC
     LIMIT 1`,
    [normalizedName]
  );
  return rows[0] ? Number(rows[0].club_id) : null;
}

export async function upsertClubTeamAlias(
  connection: PoolConnection,
  teamName: unknown,
  stats: {
    eventId?: number | null;
    resultCount?: number;
    eventCount?: number;
    athleteCount?: number;
    sourceType?: string;
  } = {}
) {
  if (!isClaimableClubTeamName(teamName)) return null;
  const rawName = cleanClubTeamName(teamName);
  const normalizedName = normalizeClubTeamName(rawName);
  const clubId = await findExactClubByNormalizedName(connection, normalizedName);
  const status = clubId ? 'confirmed' : 'unmatched';
  const confidence = clubId ? 1 : 0.6;

  const [result] = await connection.execute<ResultSetHeader>(
    `INSERT INTO sup_club_team_aliases (
       team_name_raw, normalized_name, club_id, match_status, confidence,
       result_count, event_count, athlete_count, first_seen_event_id, last_seen_event_id, source_type
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       team_name_raw = VALUES(team_name_raw),
       club_id = CASE
         WHEN sup_club_team_aliases.match_status IN ('confirmed', 'ignored', 'rejected') THEN sup_club_team_aliases.club_id
         ELSE VALUES(club_id)
       END,
       match_status = CASE
         WHEN sup_club_team_aliases.match_status IN ('confirmed', 'ignored', 'rejected') THEN sup_club_team_aliases.match_status
         ELSE VALUES(match_status)
       END,
       confidence = GREATEST(sup_club_team_aliases.confidence, VALUES(confidence)),
       result_count = GREATEST(sup_club_team_aliases.result_count, VALUES(result_count)),
       event_count = GREATEST(sup_club_team_aliases.event_count, VALUES(event_count)),
       athlete_count = GREATEST(sup_club_team_aliases.athlete_count, VALUES(athlete_count)),
       last_seen_event_id = COALESCE(VALUES(last_seen_event_id), sup_club_team_aliases.last_seen_event_id),
       updated_at = NOW()`,
    [
      rawName,
      normalizedName,
      clubId,
      status,
      confidence,
      Math.max(1, Number(stats.resultCount || 1)),
      Math.max(1, Number(stats.eventCount || (stats.eventId ? 1 : 0))),
      Math.max(0, Number(stats.athleteCount || 0)),
      stats.eventId || null,
      stats.eventId || null,
      stats.sourceType || 'event_result_team',
    ]
  );

  return { alias_id: result.insertId || null, normalized_name: normalizedName, club_id: clubId, match_status: status };
}

export async function syncClubTeamAliasesForEvent(connection: PoolConnection, eventId: number) {
  const [rows] = await connection.execute<RowDataPacket[]>(
    `SELECT
       team_name,
       COUNT(*) AS result_count,
       COUNT(DISTINCT event_id) AS event_count,
       COUNT(DISTINCT COALESCE(athlete_id, athlete_name_snapshot)) AS athlete_count
     FROM sup_event_results
     WHERE event_id = ? AND team_name IS NOT NULL AND team_name <> ''
     GROUP BY team_name`,
    [eventId]
  );
  let touched = 0;
  for (const row of rows) {
    const result = await upsertClubTeamAlias(connection, row.team_name, {
      eventId,
      resultCount: Number(row.result_count || 0),
      eventCount: Number(row.event_count || 0),
      athleteCount: Number(row.athlete_count || 0),
    });
    if (result) touched += 1;
  }
  return touched;
}
