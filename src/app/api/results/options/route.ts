import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { requireUser } from '@/lib/user-auth';
import { localResultSourceCondition } from '@/lib/result-source-scope';
import type { RowDataPacket } from 'mysql2';

type OptionRow = RowDataPacket & {
  value: string | number;
  label: string;
  meta?: string | null;
};

export async function GET(request: NextRequest) {
  const auth = requireUser(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'athlete';
    const q = searchParams.get('q')?.trim() || '';
    const like = `%${q}%`;
    let rows: OptionRow[] = [];

    if (type === 'athlete') {
      const [data] = await pool.execute<OptionRow[]>(
        `SELECT
           CAST(er.athlete_id AS CHAR) AS value,
           COALESCE(a.name, er.athlete_name_snapshot) AS label,
           CONCAT(COUNT(*), ' 条成绩') AS meta
         FROM sup_event_results er
         INNER JOIN sup_events e ON e.event_id = er.event_id
         INNER JOIN sup_event_result_sources src ON src.source_id = er.source_id
         LEFT JOIN sup_athletes a ON a.athlete_id = er.athlete_id
         WHERE er.athlete_id IS NOT NULL
           AND e.status = 'published'
           AND er.review_status <> 'pending'
           AND ${localResultSourceCondition}
           AND (? = '' OR a.name LIKE ? OR er.athlete_name_snapshot LIKE ?)
         GROUP BY er.athlete_id, label
         ORDER BY COUNT(*) DESC, label ASC
         LIMIT 40`,
        [q, like, like]
      );
      rows = data;
    } else if (type === 'event') {
      const [data] = await pool.execute<OptionRow[]>(
        `SELECT
           CAST(e.event_id AS CHAR) AS value,
           e.name AS label,
           CONCAT(COUNT(*), ' 条成绩') AS meta
         FROM sup_events e
         INNER JOIN sup_event_results er ON er.event_id = e.event_id
         INNER JOIN sup_event_result_sources src ON src.source_id = er.source_id
         WHERE e.status = 'published'
           AND er.review_status <> 'pending'
           AND ${localResultSourceCondition}
           AND (? = '' OR e.name LIKE ?)
         GROUP BY e.event_id, e.name
         ORDER BY COALESCE(e.start_date, '1900-01-01') DESC, e.name ASC
         LIMIT 40`,
        [q, like]
      );
      rows = data;
    } else if (type === 'discipline') {
      const [data] = await pool.execute<OptionRow[]>(
        `SELECT er.discipline AS value, er.discipline AS label, CONCAT(COUNT(*), ' 条成绩') AS meta
         FROM sup_event_results er
         INNER JOIN sup_event_result_sources src ON src.source_id = er.source_id
         WHERE er.discipline IS NOT NULL AND er.discipline <> ''
           AND er.review_status <> 'pending'
           AND ${localResultSourceCondition}
           AND (? = '' OR er.discipline LIKE ?)
         GROUP BY er.discipline
         ORDER BY COUNT(*) DESC, er.discipline ASC
         LIMIT 60`,
        [q, like]
      );
      rows = data;
    } else if (type === 'gender') {
      const [data] = await pool.execute<OptionRow[]>(
        `SELECT er.gender_group AS value, er.gender_group AS label, CONCAT(COUNT(*), ' 条成绩') AS meta
         FROM sup_event_results er
         INNER JOIN sup_event_result_sources src ON src.source_id = er.source_id
         WHERE er.gender_group IS NOT NULL AND er.gender_group <> ''
           AND er.review_status <> 'pending'
           AND ${localResultSourceCondition}
           AND (? = '' OR er.gender_group LIKE ?)
         GROUP BY er.gender_group
         ORDER BY COUNT(*) DESC, er.gender_group ASC
         LIMIT 60`,
        [q, like]
      );
      rows = data;
    } else if (type === 'year') {
      const [data] = await pool.execute<OptionRow[]>(
        `SELECT CAST(YEAR(e.start_date) AS CHAR) AS value, CAST(YEAR(e.start_date) AS CHAR) AS label, CONCAT(COUNT(*), ' 条成绩') AS meta
         FROM sup_events e
         INNER JOIN sup_event_results er ON er.event_id = e.event_id
         INNER JOIN sup_event_result_sources src ON src.source_id = er.source_id
         WHERE e.start_date IS NOT NULL
           AND er.review_status <> 'pending'
           AND ${localResultSourceCondition}
           AND (? = '' OR CAST(YEAR(e.start_date) AS CHAR) LIKE ?)
         GROUP BY YEAR(e.start_date)
         ORDER BY YEAR(e.start_date) DESC
         LIMIT 40`,
        [q, like]
      );
      rows = data;
    } else if (type === 'star_level') {
      const [data] = await pool.execute<OptionRow[]>(
        `SELECT e.star_level AS value, e.star_level AS label, CONCAT(COUNT(*), ' 条成绩') AS meta
         FROM sup_events e
         INNER JOIN sup_event_results er ON er.event_id = e.event_id
         INNER JOIN sup_event_result_sources src ON src.source_id = er.source_id
         WHERE e.star_level IS NOT NULL AND e.star_level <> ''
           AND er.review_status <> 'pending'
           AND ${localResultSourceCondition}
           AND (? = '' OR e.star_level LIKE ?)
         GROUP BY e.star_level
         ORDER BY FIELD(e.star_level, '五星+', '五星', '四星+', '四星', '三星'), e.star_level
         LIMIT 20`,
        [q, like]
      );
      rows = data;
    }

    return NextResponse.json({ items: rows });
  } catch (error) {
    console.error('查询成绩筛选选项失败:', error);
    return NextResponse.json({ error: '查询成绩筛选选项失败' }, { status: 500 });
  }
}
