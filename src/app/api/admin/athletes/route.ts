import { NextRequest, NextResponse } from 'next/server';
import { withAdmin } from '@/lib/admin';
import pool from '@/lib/db';
import { getNationalityAliases, normalizeNationality } from '@/lib/nationality';
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
    nationality: normalizeNationality(row.nationality),
    photos: parseJsonArray(row.photos),
    achievements: parseJsonArray(row.achievements),
    social_links: parseJsonObject(row.social_links),
  };
}

async function tableExists(tableName: string) {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT COUNT(*) AS total
       FROM information_schema.tables
      WHERE table_schema = DATABASE() AND table_name = ?`,
    [tableName]
  );
  return Number(rows[0]?.total || 0) > 0;
}

async function columnExists(tableName: string, columnName: string) {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT COUNT(*) AS total
       FROM information_schema.columns
      WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`,
    [tableName, columnName]
  );
  return Number(rows[0]?.total || 0) > 0;
}

function rankBucketCondition(bucket: string) {
  if (bucket === 'top10') return 'annual.latest_annual_rank BETWEEN 1 AND 10';
  if (bucket === 'top50') return 'annual.latest_annual_rank BETWEEN 1 AND 50';
  if (bucket === 'top100') return 'annual.latest_annual_rank BETWEEN 1 AND 100';
  if (bucket === 'ranked') return 'annual.latest_annual_rank IS NOT NULL AND annual.latest_annual_rank < 999999';
  if (bucket === 'unranked') return '(annual.latest_annual_rank IS NULL OR annual.latest_annual_rank >= 999999)';
  return '';
}

export const GET = withAdmin(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const gender = searchParams.get('gender')?.trim();
    const nationality = searchParams.get('nationality')?.trim();
    const city = searchParams.get('city')?.trim();
    const rankBucket = searchParams.get('rankBucket')?.trim();
    const sortBy = searchParams.get('sortBy') || '';
    const sortOrder = searchParams.get('sortOrder') === 'asc' ? 'ASC' : 'DESC';
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');
    const offset = (page - 1) * pageSize;
    const completedYear = new Date().getFullYear() - 1;
    const hasAnnualTables = await tableExists('sup_annual_point_standings') && await tableExists('sup_annual_point_sources');
    const hasPointScope = hasAnnualTables && await columnExists('sup_annual_point_sources', 'point_scope');
    const hasOwners = await tableExists('sup_athlete_profile_owners');
    const hasClaims = await tableExists('sup_athlete_profile_claims');
    const hasPrivacy = await tableExists('sup_privacy_requests');

    const conditions: string[] = [];
    const params: (string | number)[] = [];
    if (status) { conditions.push('a.status = ?'); params.push(status); }
    if (search) { conditions.push('(a.name LIKE ? OR a.name_en LIKE ? OR a.nationality LIKE ?)'); params.push(`%${search}%`, `%${search}%`, `%${search}%`); }
    if (gender) { conditions.push('a.gender = ?'); params.push(gender); }
    if (nationality) {
      const aliases = getNationalityAliases(nationality);
      conditions.push(`a.nationality IN (${aliases.map(() => '?').join(',')})`);
      params.push(...aliases);
    }
    if (city) {
      conditions.push(hasClaims ? `(
          a.province LIKE ? OR a.city LIKE ?
          OR COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(a.social_links, '$.public_profile.living_province')), 'null'), latest_claim.submitted_living_province) LIKE ?
          OR COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(a.social_links, '$.public_profile.living_city')), 'null'), latest_claim.submitted_living_city) LIKE ?
        )` : `(
          a.province LIKE ? OR a.city LIKE ?
          OR NULLIF(JSON_UNQUOTE(JSON_EXTRACT(a.social_links, '$.public_profile.living_province')), 'null') LIKE ?
          OR NULLIF(JSON_UNQUOTE(JSON_EXTRACT(a.social_links, '$.public_profile.living_city')), 'null') LIKE ?
        )`);
      const like = `%${city}%`;
      params.push(like, like, like, like);
    }
    const rankCondition = hasAnnualTables ? rankBucketCondition(rankBucket || '') : '';
    if (rankCondition) conditions.push(rankCondition);
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    let latestAnnualYear = 0;
    if (hasAnnualTables) {
      const scopeWhere = hasPointScope ? `WHERE src.point_scope = 'domestic'` : '';
      const [annualYearRows] = await pool.execute<RowDataPacket[]>(
        `SELECT COALESCE(MAX(CASE WHEN year <= ? THEN year END), MAX(year)) AS latest_year
         FROM sup_annual_point_standings s
         INNER JOIN sup_annual_point_sources src ON src.source_id = s.source_id
         ${scopeWhere}`,
        [completedYear]
      );
      latestAnnualYear = Number(annualYearRows[0]?.latest_year || 0);
    }

    const fromSql = `FROM sup_athletes a
       ${hasClaims ? `LEFT JOIN (
         SELECT c.claim_id, c.athlete_id, c.submitted_living_province, c.submitted_living_city
         FROM sup_athlete_profile_claims c
         INNER JOIN (
           SELECT athlete_id, MAX(claim_id) AS claim_id
           FROM sup_athlete_profile_claims
           WHERE status = 'approved'
           GROUP BY athlete_id
         ) latest ON latest.claim_id = c.claim_id
       ) latest_claim ON latest_claim.athlete_id = a.athlete_id` : ''}
       ${hasAnnualTables ? `LEFT JOIN (
         SELECT
           s.athlete_id,
           MAX(s.year) AS latest_annual_year,
           SUBSTRING_INDEX(GROUP_CONCAT(s.group_name ORDER BY COALESCE(s.rank_position, 999999), s.total_points DESC, s.standing_id ASC SEPARATOR '|||'), '|||', 1) AS latest_annual_group,
           MIN(COALESCE(s.rank_position, 999999)) AS latest_annual_rank,
           CAST(SUBSTRING_INDEX(GROUP_CONCAT(s.total_points ORDER BY COALESCE(s.rank_position, 999999), s.total_points DESC, s.standing_id ASC SEPARATOR ','), ',', 1) AS DECIMAL(12,3)) AS latest_annual_points
         FROM sup_annual_point_standings s
         INNER JOIN sup_annual_point_sources src ON src.source_id = s.source_id
         WHERE s.year = ? AND s.athlete_id IS NOT NULL ${hasPointScope ? `AND src.point_scope = 'domestic'` : ''}
         GROUP BY s.athlete_id
       ) annual ON annual.athlete_id = a.athlete_id` : ''}`;
    const sortableColumns: Record<string, string> = {
      ...(hasAnnualTables ? { latest_annual_rank: 'COALESCE(annual.latest_annual_rank, 999999)' } : {}),
      nationality: 'a.nationality',
      gender: 'a.gender',
      name: 'a.name',
      updated_at: 'a.updated_at',
    };
    const orderBy = sortBy && sortableColumns[sortBy]
      ? `${sortableColumns[sortBy]} ${sortOrder}, a.athlete_id ASC`
      : `CASE a.status WHEN 'published' THEN 0 ELSE 1 END, a.updated_at DESC`;

    const queryParams = hasAnnualTables ? [latestAnnualYear, ...params] : params;
    const [countRows] = await pool.execute<RowDataPacket[]>(`SELECT COUNT(*) as total ${fromSql} ${where}`, queryParams);
    const total = (countRows[0] as { total: number }).total;

    const [athletes] = await pool.execute<RowDataPacket[]>(
      `SELECT
         a.athlete_id, a.name, a.name_en, a.gender, a.gender_source, a.gender_confidence,
         a.nationality, a.province, a.city, a.photo, a.photos, a.bio, a.discipline,
         a.icf_ranking, a.achievements, a.social_links, a.status, a.updated_at,
         ${hasClaims ? `COALESCE(
           NULLIF(JSON_UNQUOTE(JSON_EXTRACT(a.social_links, '$.public_profile.living_province')), 'null'),
           latest_claim.submitted_living_province
         )` : `NULLIF(JSON_UNQUOTE(JSON_EXTRACT(a.social_links, '$.public_profile.living_province')), 'null')`} AS living_province,
         ${hasClaims ? `COALESCE(
           NULLIF(JSON_UNQUOTE(JSON_EXTRACT(a.social_links, '$.public_profile.living_city')), 'null'),
           latest_claim.submitted_living_city
         )` : `NULLIF(JSON_UNQUOTE(JSON_EXTRACT(a.social_links, '$.public_profile.living_city')), 'null')`} AS living_city,
         CASE WHEN COALESCE(owner_profile.owner_count, 0) > 0 ${hasClaims ? 'OR latest_claim.claim_id IS NOT NULL' : ''} THEN 1 ELSE 0 END AS is_claimed,
         ${hasAnnualTables ? `annual.latest_annual_year,
         annual.latest_annual_group,
         annual.latest_annual_rank,
         annual.latest_annual_points,` : `NULL AS latest_annual_year,
         NULL AS latest_annual_group,
         NULL AS latest_annual_rank,
         NULL AS latest_annual_points,`}
         CASE
           WHEN privacy.deleted_count > 0 THEN 'deleted'
           WHEN privacy.hidden_count > 0 THEN 'hidden'
           WHEN privacy.anon_count > 0 THEN 'anonymous'
           ELSE 'public'
         END AS privacy_mode
       ${fromSql}
       ${hasOwners ? `LEFT JOIN (
         SELECT athlete_id, COUNT(*) AS owner_count
         FROM sup_athlete_profile_owners
         WHERE status = 'active' AND role = 'owner'
         GROUP BY athlete_id
       ) owner_profile ON owner_profile.athlete_id = a.athlete_id` : `LEFT JOIN (SELECT NULL AS athlete_id, 0 AS owner_count) owner_profile ON 1 = 0`}
       ${hasPrivacy ? `LEFT JOIN (
         SELECT
           target_id AS athlete_id,
           SUM(CASE WHEN request_type = 'delete_frontend' AND status IN ('approved','completed') THEN 1 ELSE 0 END) AS deleted_count,
           SUM(CASE WHEN request_type = 'hide_athlete' AND status IN ('pending','approved','completed') THEN 1 ELSE 0 END) AS hidden_count,
           SUM(CASE WHEN request_type = 'anonymize_name' AND status IN ('approved','completed') THEN 1 ELSE 0 END) AS anon_count
         FROM sup_privacy_requests
         WHERE target_type = 'athlete'
         GROUP BY target_id
       ) privacy ON privacy.athlete_id = a.athlete_id` : `LEFT JOIN (SELECT NULL AS athlete_id, 0 AS deleted_count, 0 AS hidden_count, 0 AS anon_count) privacy ON 1 = 0`}
       ${where}
       ORDER BY ${orderBy}
       LIMIT ${pageSize} OFFSET ${offset}`,
      queryParams
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

    if (action === 'set_privacy') {
      const athleteId = Number(body.athlete_id || ids[0]);
      const mode = String(body.privacy_mode || 'public');
      if (!Number.isInteger(athleteId) || athleteId <= 0) {
        return NextResponse.json({ error: '缺少运动员 ID' }, { status: 400 });
      }
      if (!['public', 'hidden', 'anonymous', 'deleted'].includes(mode)) {
        return NextResponse.json({ error: '无效隐私设置' }, { status: 400 });
      }
      const hasPrivacy = await tableExists('sup_privacy_requests');
      const hasPrivacyLogs = await tableExists('sup_privacy_request_logs');
      if (!hasPrivacy) {
        return NextResponse.json({ error: '隐私请求表不存在，请先执行迁移' }, { status: 500 });
      }
      await pool.execute(
        `UPDATE sup_privacy_requests
            SET status = 'rejected', handler_name = '管理员', handler_note = '管理员直接切换隐私状态', handled_at = NOW()
          WHERE target_type = 'athlete'
            AND target_id = ?
            AND request_type IN ('hide_athlete', 'anonymize_name', 'delete_frontend')
            AND status IN ('pending', 'approved', 'completed')`,
        [athleteId]
      );
      if (mode !== 'public') {
        const requestType = mode === 'hidden' ? 'hide_athlete' : mode === 'anonymous' ? 'anonymize_name' : 'delete_frontend';
        const [insertResult] = await pool.execute<ResultSetHeader>(
          `INSERT INTO sup_privacy_requests
            (nickname, request_type, target_type, target_id, athlete_id, description, status, handler_name, handler_note, handled_at)
           VALUES ('管理员', ?, 'athlete', ?, ?, '后台直接设置隐私状态', 'completed', '管理员', '后台运动员管理直接设置', NOW())`,
          [requestType, athleteId, athleteId]
        );
        if (hasPrivacyLogs) {
          await pool.execute(
            `INSERT INTO sup_privacy_request_logs (request_id, action, actor_name, note)
             VALUES (?, 'admin_set_privacy', '管理员', ?)`,
            [insertResult.insertId, `设置为 ${mode}`]
          );
        }
      }
      return NextResponse.json({ success: true, athlete_id: athleteId, privacy_mode: mode });
    }

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
    const normalizedNationality = normalizeNationality(nationality);

    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO sup_athletes (name, name_en, gender, gender_source, gender_confidence, nationality, province, city, photo, photos, bio, discipline, achievements, icf_ranking, social_links, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, name_en || null, gender || 'unknown', gender_source || 'manual', gender_confidence || null, normalizedNationality, province || null, city || null, photo || null, photos ? JSON.stringify(photos) : null, bio || null, discipline || 'race', achievements ? JSON.stringify(achievements) : null, icf_ranking || null, social_links ? JSON.stringify(social_links) : null, status]
    );
    return NextResponse.json({ success: true, athlete_id: result.insertId }, { status: 201 });
  } catch (error) {
    console.error('创建运动员失败:', error);
    return NextResponse.json({ error: '创建运动员失败' }, { status: 500 });
  }
});
