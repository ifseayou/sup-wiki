import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { localResultSourceCondition } from '@/lib/result-source-scope';
import type { RowDataPacket } from 'mysql2';

type OptionRow = RowDataPacket & {
  value: string | number;
  label: string;
  meta?: string | null;
};

function addContextFilters(
  conditions: string[],
  params: (string | number)[],
  searchParams: URLSearchParams,
  excludedType: string,
) {
  const eventId = searchParams.get('event_id');
  const athleteId = searchParams.get('athlete_id');
  const discipline = searchParams.get('discipline')?.trim();
  const gender = searchParams.get('gender')?.trim();
  const year = searchParams.get('year');
  const star = searchParams.get('star_level')?.trim();
  const rankMax = searchParams.get('rank_max');

  if (eventId && excludedType !== 'event') {
    conditions.push('er.event_id = ?');
    params.push(Number(eventId));
  }
  if (athleteId && excludedType !== 'athlete') {
    conditions.push('(er.athlete_id = ? OR EXISTS (SELECT 1 FROM sup_event_result_members erm_a WHERE erm_a.result_id = er.result_id AND erm_a.athlete_id = ?))');
    params.push(Number(athleteId), Number(athleteId));
  }
  if (discipline && excludedType !== 'discipline') {
    conditions.push('er.discipline LIKE ?');
    params.push(`%${discipline}%`);
  }
  if (gender && excludedType !== 'gender') {
    conditions.push('er.gender_group LIKE ?');
    params.push(`%${gender}%`);
  }
  if (year && excludedType !== 'year') {
    conditions.push('YEAR(e.start_date) = ?');
    params.push(Number(year));
  }
  if (star && excludedType !== 'star_level') {
    conditions.push('e.star_level = ?');
    params.push(star);
  }
  if (rankMax) {
    conditions.push('er.rank_position <= ?');
    params.push(Number(rankMax));
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'athlete';
    const q = searchParams.get('q')?.trim() || '';
    const like = `%${q}%`;
    let rows: OptionRow[] = [];

    if (type === 'athlete') {
      const conditions = [
        "er.athlete_id IS NOT NULL",
        "e.status = 'published'",
        "e.event_status = 'completed'",
        "er.review_status = 'confirmed'",
        'er.is_verified = 1',
        localResultSourceCondition,
        "(? = '' OR a.name LIKE ? OR er.athlete_name_snapshot LIKE ?)",
      ];
      const params: (string | number)[] = [q, like, like];
      addContextFilters(conditions, params, searchParams, 'athlete');
      const [data] = await pool.execute<OptionRow[]>(
        `SELECT
           CAST(er.athlete_id AS CHAR) AS value,
           COALESCE(a.name, er.athlete_name_snapshot) AS label,
           CONCAT(COUNT(*), ' 条成绩') AS meta
         FROM sup_event_results er
         INNER JOIN sup_events e ON e.event_id = er.event_id
         INNER JOIN sup_event_result_sources src ON src.source_id = er.source_id
         LEFT JOIN sup_athletes a ON a.athlete_id = er.athlete_id
         WHERE ${conditions.join(' AND ')}
         GROUP BY er.athlete_id, label
         ORDER BY COUNT(*) DESC, label ASC
         LIMIT 40`,
        params
      );
      rows = data;
    } else if (type === 'event') {
      const conditions = [
        "e.status = 'published'",
        "e.event_status = 'completed'",
        "er.review_status = 'confirmed'",
        'er.is_verified = 1',
        localResultSourceCondition,
        "(? = '' OR e.name LIKE ?)",
      ];
      const params: (string | number)[] = [q, like];
      addContextFilters(conditions, params, searchParams, 'event');
      const [data] = await pool.execute<OptionRow[]>(
        `SELECT
           CAST(e.event_id AS CHAR) AS value,
           e.name AS label,
           CONCAT(COUNT(*), ' 条成绩') AS meta
         FROM sup_events e
         INNER JOIN sup_event_results er ON er.event_id = e.event_id
         INNER JOIN sup_event_result_sources src ON src.source_id = er.source_id
         WHERE ${conditions.join(' AND ')}
         GROUP BY e.event_id, e.name
         ORDER BY COALESCE(e.start_date, '1900-01-01') DESC, e.name ASC
         LIMIT 40`,
        params
      );
      rows = data;
    } else if (type === 'discipline') {
      const conditions = [
        "er.discipline IS NOT NULL",
        "er.discipline <> ''",
        "e.status = 'published'",
        "e.event_status = 'completed'",
        "er.review_status = 'confirmed'",
        'er.is_verified = 1',
        localResultSourceCondition,
        "(? = '' OR er.discipline LIKE ?)",
      ];
      const params: (string | number)[] = [q, like];
      addContextFilters(conditions, params, searchParams, 'discipline');
      const [data] = await pool.execute<OptionRow[]>(
        `SELECT er.discipline AS value, er.discipline AS label, CONCAT(COUNT(*), ' 条成绩') AS meta
         FROM sup_event_results er
         INNER JOIN sup_events e ON e.event_id = er.event_id
         INNER JOIN sup_event_result_sources src ON src.source_id = er.source_id
         WHERE ${conditions.join(' AND ')}
         GROUP BY er.discipline
         ORDER BY COUNT(*) DESC, er.discipline ASC
         LIMIT 60`,
        params
      );
      rows = data;
    } else if (type === 'gender') {
      const conditions = [
        "er.gender_group IS NOT NULL",
        "er.gender_group <> ''",
        "e.status = 'published'",
        "e.event_status = 'completed'",
        "er.review_status = 'confirmed'",
        'er.is_verified = 1',
        localResultSourceCondition,
        "(? = '' OR er.gender_group LIKE ?)",
      ];
      const params: (string | number)[] = [q, like];
      addContextFilters(conditions, params, searchParams, 'gender');
      const [data] = await pool.execute<OptionRow[]>(
        `SELECT er.gender_group AS value, er.gender_group AS label, CONCAT(COUNT(*), ' 条成绩') AS meta
         FROM sup_event_results er
         INNER JOIN sup_events e ON e.event_id = er.event_id
         INNER JOIN sup_event_result_sources src ON src.source_id = er.source_id
         WHERE ${conditions.join(' AND ')}
         GROUP BY er.gender_group
         ORDER BY COUNT(*) DESC, er.gender_group ASC
         LIMIT 60`,
        params
      );
      rows = data;
    } else if (type === 'year') {
      const conditions = [
        "e.start_date IS NOT NULL",
        "e.status = 'published'",
        "e.event_status = 'completed'",
        "er.review_status = 'confirmed'",
        'er.is_verified = 1',
        localResultSourceCondition,
        "(? = '' OR CAST(YEAR(e.start_date) AS CHAR) LIKE ?)",
      ];
      const params: (string | number)[] = [q, like];
      addContextFilters(conditions, params, searchParams, 'year');
      const [data] = await pool.execute<OptionRow[]>(
        `SELECT CAST(YEAR(e.start_date) AS CHAR) AS value, CAST(YEAR(e.start_date) AS CHAR) AS label, CONCAT(COUNT(*), ' 条成绩') AS meta
         FROM sup_events e
         INNER JOIN sup_event_results er ON er.event_id = e.event_id
         INNER JOIN sup_event_result_sources src ON src.source_id = er.source_id
         WHERE ${conditions.join(' AND ')}
         GROUP BY YEAR(e.start_date)
         ORDER BY YEAR(e.start_date) DESC
         LIMIT 40`,
        params
      );
      rows = data;
    } else if (type === 'star_level') {
      const conditions = [
        "e.star_level IS NOT NULL",
        "e.star_level <> ''",
        "e.status = 'published'",
        "e.event_status = 'completed'",
        "er.review_status = 'confirmed'",
        'er.is_verified = 1',
        localResultSourceCondition,
        "(? = '' OR e.star_level LIKE ?)",
      ];
      const params: (string | number)[] = [q, like];
      addContextFilters(conditions, params, searchParams, 'star_level');
      const [data] = await pool.execute<OptionRow[]>(
        `SELECT e.star_level AS value, e.star_level AS label, CONCAT(COUNT(*), ' 条成绩') AS meta
         FROM sup_events e
         INNER JOIN sup_event_results er ON er.event_id = e.event_id
         INNER JOIN sup_event_result_sources src ON src.source_id = er.source_id
         WHERE ${conditions.join(' AND ')}
         GROUP BY e.star_level
         ORDER BY FIELD(e.star_level, '五星+', '五星', '四星+', '四星', '三星'), e.star_level
         LIMIT 20`,
        params
      );
      rows = data;
    }

    return NextResponse.json({ items: rows });
  } catch (error) {
    console.error('查询成绩筛选选项失败:', error);
    return NextResponse.json({ error: '查询成绩筛选选项失败' }, { status: 500 });
  }
}
