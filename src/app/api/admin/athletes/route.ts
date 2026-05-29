import { NextRequest, NextResponse } from 'next/server';
import { withAdmin } from '@/lib/admin';
import pool from '@/lib/db';
import type { RowDataPacket, ResultSetHeader } from 'mysql2';

function parseJsonArray(value: unknown) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  try {
    const parsed = JSON.parse(String(value));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseJsonObject(value: unknown) {
  if (!value) return {};
  if (typeof value === 'object' && !Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(String(value));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function normalizeAthlete(row: RowDataPacket) {
  return {
    ...row,
    photos: parseJsonArray(row.photos),
    achievements: parseJsonArray(row.achievements),
    social_links: parseJsonObject(row.social_links),
  };
}

export const GET = withAdmin(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');
    const offset = (page - 1) * pageSize;
    const completedYear = new Date().getFullYear() - 1;

    const conditions: string[] = [];
    const params: (string | number)[] = [];
    if (status) { conditions.push('a.status = ?'); params.push(status); }
    if (search) { conditions.push('(a.name LIKE ? OR a.name_en LIKE ?)'); params.push(`%${search}%`, `%${search}%`); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [annualYearRows] = await pool.execute<RowDataPacket[]>(
      `SELECT COALESCE(MAX(CASE WHEN year <= ? THEN year END), MAX(year)) AS latest_year
       FROM sup_annual_point_standings`,
      [completedYear]
    );
    const latestAnnualYear = Number(annualYearRows[0]?.latest_year || 0);

    const [countRows] = await pool.execute<RowDataPacket[]>(`SELECT COUNT(*) as total FROM sup_athletes a ${where}`, params);
    const total = (countRows[0] as { total: number }).total;

    const [athletes] = await pool.execute<RowDataPacket[]>(
      `SELECT
         a.athlete_id, a.name, a.name_en, a.gender, a.gender_source, a.gender_confidence,
         a.nationality, a.province, a.city, a.photo, a.photos, a.bio, a.discipline,
         a.icf_ranking, a.achievements, a.social_links, a.status, a.updated_at,
         COALESCE(
           NULLIF(JSON_UNQUOTE(JSON_EXTRACT(a.social_links, '$.public_profile.living_province')), 'null'),
           latest_claim.submitted_living_province
         ) AS living_province,
         COALESCE(
           NULLIF(JSON_UNQUOTE(JSON_EXTRACT(a.social_links, '$.public_profile.living_city')), 'null'),
           latest_claim.submitted_living_city
         ) AS living_city,
         CASE WHEN COALESCE(owner_profile.owner_count, 0) > 0 OR latest_claim.claim_id IS NOT NULL THEN 1 ELSE 0 END AS is_claimed,
         annual.latest_annual_year,
         annual.latest_annual_group,
         annual.latest_annual_rank,
         annual.latest_annual_points
       FROM sup_athletes a
       LEFT JOIN (
         SELECT c.claim_id, c.athlete_id, c.submitted_living_province, c.submitted_living_city
         FROM sup_athlete_profile_claims c
         INNER JOIN (
           SELECT athlete_id, MAX(claim_id) AS claim_id
           FROM sup_athlete_profile_claims
           WHERE status = 'approved'
           GROUP BY athlete_id
         ) latest ON latest.claim_id = c.claim_id
       ) latest_claim ON latest_claim.athlete_id = a.athlete_id
       LEFT JOIN (
         SELECT athlete_id, COUNT(*) AS owner_count
         FROM sup_athlete_profile_owners
         WHERE status = 'active'
         GROUP BY athlete_id
       ) owner_profile ON owner_profile.athlete_id = a.athlete_id
       LEFT JOIN (
         SELECT
           athlete_id,
           MAX(year) AS latest_annual_year,
           SUBSTRING_INDEX(GROUP_CONCAT(group_name ORDER BY COALESCE(rank_position, 999999), total_points DESC, standing_id ASC SEPARATOR '|||'), '|||', 1) AS latest_annual_group,
           MIN(COALESCE(rank_position, 999999)) AS latest_annual_rank,
           CAST(SUBSTRING_INDEX(GROUP_CONCAT(total_points ORDER BY COALESCE(rank_position, 999999), total_points DESC, standing_id ASC SEPARATOR ','), ',', 1) AS DECIMAL(12,3)) AS latest_annual_points
         FROM sup_annual_point_standings
         WHERE year = ? AND athlete_id IS NOT NULL
         GROUP BY athlete_id
       ) annual ON annual.athlete_id = a.athlete_id
       ${where}
       ORDER BY CASE a.status WHEN 'published' THEN 0 ELSE 1 END, a.updated_at DESC
       LIMIT ${pageSize} OFFSET ${offset}`,
      [latestAnnualYear, ...params]
    );
    return NextResponse.json({ items: athletes.map(normalizeAthlete), total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
  } catch (error) {
    console.error('获取运动员列表失败:', error);
    return NextResponse.json({ error: '获取运动员列表失败' }, { status: 500 });
  }
});

export const PATCH = withAdmin(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const action = String(body.action || '');
    const ids = Array.isArray(body.ids) ? body.ids.map((id: unknown) => Number(id)).filter((id: number) => Number.isInteger(id) && id > 0) : [];

    if (!['publish', 'draft', 'delete'].includes(action)) {
      return NextResponse.json({ error: '无效批量操作' }, { status: 400 });
    }
    if (ids.length === 0) {
      return NextResponse.json({ error: '请选择要操作的运动员' }, { status: 400 });
    }
    if (ids.length > 200) {
      return NextResponse.json({ error: '单次最多批量处理 200 名运动员' }, { status: 400 });
    }

    const placeholders = ids.map(() => '?').join(',');
    let result: ResultSetHeader;

    if (action === 'publish' || action === 'draft') {
      const nextStatus = action === 'publish' ? 'published' : 'draft';
      const [updateResult] = await pool.execute<ResultSetHeader>(
        `UPDATE sup_athletes SET status = ? WHERE athlete_id IN (${placeholders})`,
        [nextStatus, ...ids]
      );
      result = updateResult;
    } else {
      const [deleteResult] = await pool.execute<ResultSetHeader>(
        `DELETE FROM sup_athletes WHERE athlete_id IN (${placeholders})`,
        ids
      );
      result = deleteResult;
    }

    return NextResponse.json({ success: true, affectedRows: result.affectedRows });
  } catch (error) {
    console.error('批量操作运动员失败:', error);
    return NextResponse.json({ error: '批量操作运动员失败' }, { status: 500 });
  }
});

export const POST = withAdmin(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const { name, name_en, gender = 'unknown', gender_source = 'manual', gender_confidence, nationality, province, city, photo, photos, bio, discipline, achievements, icf_ranking, social_links, status = 'draft' } = body;
    if (!name) return NextResponse.json({ error: '缺少必填字段: name' }, { status: 400 });

    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO sup_athletes (name, name_en, gender, gender_source, gender_confidence, nationality, province, city, photo, photos, bio, discipline, achievements, icf_ranking, social_links, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, name_en || null, gender || 'unknown', gender_source || 'manual', gender_confidence || null, nationality || null, province || null, city || null, photo || null, photos ? JSON.stringify(photos) : null, bio || null, discipline || 'race', achievements ? JSON.stringify(achievements) : null, icf_ranking || null, social_links ? JSON.stringify(social_links) : null, status]
    );
    return NextResponse.json({ success: true, athlete_id: result.insertId }, { status: 201 });
  } catch (error) {
    console.error('创建运动员失败:', error);
    return NextResponse.json({ error: '创建运动员失败' }, { status: 500 });
  }
});
