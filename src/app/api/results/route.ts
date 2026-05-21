import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { requireUser } from '@/lib/user-auth';
import { localResultSourceCondition } from '@/lib/result-source-scope';
import { resultDefaultOrderBy } from '@/lib/result-ordering';
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

function toNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isNormalFinish(row: Pick<ResultItemRow, 'result_status_code' | 'finish_time'>) {
  const code = String(row.result_status_code || '').trim().toUpperCase();
  if (code) return false;
  const finish = String(row.finish_time || '').trim().toUpperCase();
  return !['DNS', 'DNF', 'DSQ', 'DNQ', 'DQ'].includes(finish);
}

function parseDistanceKm(discipline: string | null) {
  const text = String(discipline || '').toLowerCase().replace(/\s+/g, '');
  const kmMatch = text.match(/(\d+(?:\.\d+)?)(?:公里|千米|km|k)/i);
  if (kmMatch) return Number(kmMatch[1]);
  const meterMatch = text.match(/(\d+(?:\.\d+)?)(?:米|m)/i);
  if (meterMatch) return Number(meterMatch[1]) / 1000;
  return null;
}

function isYouthGroup(genderGroup: string | null) {
  const text = String(genderGroup || '').toUpperCase();
  if (/(U\s*)?(18|15|12|10|9|8)\b/.test(text)) return true;
  return /青少年|少年|儿童|少儿|小学|中学/.test(text);
}

function isLongDistance(row: Pick<ResultItemRow, 'discipline' | 'gender_group'>, distanceKm: number | null) {
  if (!distanceKm) return false;
  if (isYouthGroup(row.gender_group)) return distanceKm >= 3;
  return distanceKm >= 6;
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

function formatPace(secondsPerKm: number) {
  if (!Number.isFinite(secondsPerKm) || secondsPerKm <= 0) return '-';
  const rounded = Math.round(secondsPerKm);
  const minutes = Math.floor(rounded / 60);
  const seconds = rounded % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}/km`;
}

async function loadPreviousTimes(items: ResultItemRow[]) {
  const normalItems = items.filter((item) => (
    item.result_id &&
    item.event_id &&
    Number(item.rank_position || 0) < 9000 &&
    toNumber(item.time_seconds) !== null &&
    isNormalFinish(item)
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
       AND er.review_status <> 'pending'
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
    const currentTime = toNumber(row.time_seconds);
    const previousTime = previousByGroup.get(key);
    if (previousTime !== undefined) previousByResult.set(Number(row.result_id), previousTime);
    if (currentTime !== null) previousByGroup.set(key, currentTime);
  }
  return previousByResult;
}

export async function GET(request: NextRequest) {
  const auth = requireUser(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search')?.trim();
    const gender = searchParams.get('gender')?.trim();
    const discipline = searchParams.get('discipline')?.trim();
    const eventId = searchParams.get('event_id');
    const athleteId = searchParams.get('athlete_id');
    const year = searchParams.get('year');
    const star = searchParams.get('star_level')?.trim();
    const rankMax = searchParams.get('rank_max');
    const timeMax = searchParams.get('time_max');
    const page = Math.max(1, Number(searchParams.get('page') || 1));
    const pageSize = Math.min(100, Math.max(10, Number(searchParams.get('pageSize') || 30)));
    const offset = (page - 1) * pageSize;

    const conditions = [
      "e.status = 'published'",
      "e.event_status = 'completed'",
      'er.source_id IS NOT NULL',
      localResultSourceCondition,
      "er.review_status <> 'pending'",
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
    if (rankMax) { conditions.push('er.rank_position <= ?'); params.push(Number(rankMax)); }
    if (timeMax) { conditions.push('er.time_seconds <= ?'); params.push(Number(timeMax)); }

    const where = `WHERE ${conditions.join(' AND ')}`;
    const [countRows] = await pool.execute<RowDataPacket[]>(
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
    );

    const [items] = await pool.execute<ResultItemRow[]>(
      `SELECT
         er.result_id, er.event_id, er.athlete_id, er.athlete_name_snapshot, er.bib_number,
         er.gender_group, er.discipline, er.board_class, er.round_label, er.rank_position,
         er.result_label, er.finish_time, er.result_status_code, er.result_status_note, er.time_seconds, er.points, er.team_name,
         er.source_title, er.source_url, er.source_locator, er.review_status,
         e.name AS event_name, e.start_date, e.city, e.province, e.star_level, e.score_coefficient,
         a.name AS athlete_name, a.photo AS athlete_photo,
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
       LIMIT ${pageSize} OFFSET ${offset}`,
      params
    );

    const previousTimes = await loadPreviousTimes(items);
    const enrichedItems = items.map((item) => {
      const timeSeconds = toNumber(item.time_seconds);
      const previousTime = previousTimes.get(Number(item.result_id));
      const gapSeconds = timeSeconds !== null && previousTime !== undefined
        ? Math.max(0, timeSeconds - previousTime)
        : null;
      const distanceKm = parseDistanceKm(item.discipline);
      const longDistance = isLongDistance(item, distanceKm);
      const paceSeconds = longDistance && isNormalFinish(item) && timeSeconds !== null && distanceKm
        ? timeSeconds / distanceKm
        : null;

      return {
        ...item,
        distance_km: distanceKm,
        is_long_distance: longDistance,
        gap_seconds: gapSeconds,
        gap_display: gapSeconds === null ? '-' : formatDuration(gapSeconds, true),
        pace_seconds_per_km: paceSeconds,
        pace_display: paceSeconds === null ? '-' : formatPace(paceSeconds),
      };
    });

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

    const total = Number(countRows[0]?.total || 0);
    return NextResponse.json({
      items: enrichedItems,
      total,
      stats: {
        resultCount: total,
        athleteCount: Number(countRows[0]?.athlete_count || 0),
        eventCount: Number(countRows[0]?.event_count || 0),
      },
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
      facets: facets[0] || {},
    });
  } catch (error) {
    console.error('查询成绩失败:', error);
    return NextResponse.json({ error: '查询成绩失败' }, { status: 500 });
  }
}
