import { NextRequest, NextResponse } from 'next/server';
import { withAdmin } from '@/lib/admin';
import pool from '@/lib/db';
import { nationalityMatchesSearch, normalizeNationality } from '@/lib/nationality';
import type { RowDataPacket } from 'mysql2';

function normalizeSearch(value: string | null) {
  return String(value || '').trim();
}

export const GET = withAdmin(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const search = normalizeSearch(searchParams.get('search'));
    const like = `%${search}%`;

    if (type === 'nationality') {
      const [rows] = await pool.execute<RowDataPacket[]>(
        `SELECT TRIM(nationality) AS value, COUNT(*) AS count
         FROM sup_athletes
         WHERE NULLIF(TRIM(nationality), '') IS NOT NULL
         GROUP BY TRIM(nationality)
         ORDER BY count DESC, value ASC`
      );
      const grouped = new Map<string, number>();
      for (const row of rows) {
        const normalized = normalizeNationality(row.value);
        if (!normalized || !nationalityMatchesSearch(normalized, search)) continue;
        grouped.set(normalized, (grouped.get(normalized) || 0) + Number(row.count || 0));
      }
      const items = [...grouped.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'zh-CN'))
        .slice(0, 30);
      return NextResponse.json({
        items: items.map(([value, count]) => ({
          value,
          label: value,
          meta: `${count} 人`,
        })),
      });
    }

    if (type === 'city') {
      const params: string[] = [];
      let where = `WHERE NULLIF(TRIM(value), '') IS NOT NULL AND TRIM(value) NOT IN ('null', '-')`;
      if (search) {
        where += ' AND value LIKE ?';
        params.push(like);
      }
      const [rows] = await pool.execute<RowDataPacket[]>(
        `SELECT TRIM(value) AS value, COUNT(*) AS count
         FROM (
           SELECT city AS value FROM sup_athletes
           UNION ALL
           SELECT NULLIF(JSON_UNQUOTE(JSON_EXTRACT(social_links, '$.public_profile.living_city')), 'null') AS value FROM sup_athletes
           UNION ALL
           SELECT submitted_living_city AS value
           FROM sup_athlete_profile_claims
           WHERE status = 'approved'
         ) city_values
         ${where}
         GROUP BY TRIM(value)
         ORDER BY count DESC, value ASC
         LIMIT 30`,
        params
      );
      return NextResponse.json({
        items: rows.map((row) => ({
          value: String(row.value),
          label: String(row.value),
          meta: `${Number(row.count || 0)} 人`,
        })),
      });
    }

    return NextResponse.json({ error: '无效筛选类型' }, { status: 400 });
  } catch (error) {
    console.error('获取运动员筛选选项失败:', error);
    return NextResponse.json({ error: '获取运动员筛选选项失败' }, { status: 500 });
  }
});
