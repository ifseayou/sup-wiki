import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { withAdmin } from '@/lib/admin';
import { buildAthleteClaimDiffs } from '@/lib/athlete-claim-diff';
import type { RowDataPacket } from 'mysql2';

function parseJsonObject(value: unknown) {
  if (!value) return {};
  if (typeof value === 'object') return value as Record<string, unknown>;
  try {
    const parsed = JSON.parse(String(value));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function parseUrlArray(value: unknown) {
  const source = Array.isArray(value) ? value : [];
  return Array.from(new Set(source.map((item) => String(item || '').trim()).filter(Boolean)));
}

function normalizeClaimRow(row: RowDataPacket) {
  const submittedProfile = parseJsonObject(row.submitted_profile_json);
  const submittedSupPhotoUrls = parseUrlArray(submittedProfile.sup_photos || submittedProfile.photos);
  const previousProfile = parseJsonObject(row.previous_submitted_profile_json);
  const previousSupPhotoUrls = parseUrlArray(previousProfile.sup_photos || previousProfile.photos);
  const currentSocialLinks = parseJsonObject(row.current_social_links);
  const currentPhotoUrls = parseUrlArray(row.current_photos_json);
  const normalized = {
    ...row,
    submitted_contact: String(submittedProfile.contact || row.submitted_contact || ''),
    submitted_intro_short: row.submitted_intro_short || submittedProfile.intro_short || '',
    submitted_intro: row.submitted_intro || submittedProfile.intro || '',
    current_public_profile: parseJsonObject(currentSocialLinks.public_profile),
    current_photo_urls: currentPhotoUrls,
    previous_submitted_sup_photo_urls: previousSupPhotoUrls,
    submitted_sup_photo_urls: submittedSupPhotoUrls,
    submitted_photo_urls: Array.from(new Set([row.submitted_avatar_url, ...submittedSupPhotoUrls].filter(Boolean))),
  };
  return {
    ...normalized,
    diffs: buildAthleteClaimDiffs(normalized),
  };
}

export const GET = withAdmin(async (request: NextRequest) => {
  try {
    const status = request.nextUrl.searchParams.get('status') || 'pending';
    const search = request.nextUrl.searchParams.get('search')?.trim() || '';
    const conditions = ["(? = 'all' OR c.status = ?)"];
    const params: (string | number)[] = [status, status];

    if (search) {
      conditions.push('(a.name LIKE ? OR u.nickname LIKE ? OR u.email LIKE ?)');
      const like = `%${search}%`;
      params.push(like, like, like);
    }

    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT
         c.*,
         DATE_FORMAT(c.submitted_birth_date, '%Y-%m-%d') AS submitted_birth_date,
         DATE_FORMAT(CONVERT_TZ(c.created_at, '+00:00', '+08:00'), '%Y-%m-%d %H:%i:%s') AS created_at_display,
         COALESCE(
           NULLIF(c.submitted_hometown_province, ''),
           CASE WHEN JSON_VALID(c.submitted_profile_json) THEN JSON_UNQUOTE(JSON_EXTRACT(c.submitted_profile_json, '$.hometown.province')) ELSE NULL END
         ) AS submitted_hometown_province,
         COALESCE(
           NULLIF(c.submitted_hometown_city, ''),
           CASE WHEN JSON_VALID(c.submitted_profile_json) THEN JSON_UNQUOTE(JSON_EXTRACT(c.submitted_profile_json, '$.hometown.city')) ELSE NULL END
         ) AS submitted_hometown_city,
         u.nickname, u.email, u.user_level, u.status AS user_status,
         a.name AS current_name, a.photo AS current_photo, a.province AS current_province,
         a.city AS current_city, a.bio AS current_bio, a.social_links AS current_social_links,
         a.photos AS current_photos_json,
         pc.submitted_name AS previous_submitted_name,
         pc.submitted_avatar_url AS previous_submitted_avatar_url,
         pc.submitted_birth_year AS previous_submitted_birth_year,
         DATE_FORMAT(pc.submitted_birth_date, '%Y-%m-%d') AS previous_submitted_birth_date,
         COALESCE(
           NULLIF(pc.submitted_hometown_province, ''),
           CASE WHEN JSON_VALID(pc.submitted_profile_json) THEN JSON_UNQUOTE(JSON_EXTRACT(pc.submitted_profile_json, '$.hometown.province')) ELSE NULL END
         ) AS previous_submitted_hometown_province,
         COALESCE(
           NULLIF(pc.submitted_hometown_city, ''),
           CASE WHEN JSON_VALID(pc.submitted_profile_json) THEN JSON_UNQUOTE(JSON_EXTRACT(pc.submitted_profile_json, '$.hometown.city')) ELSE NULL END
         ) AS previous_submitted_hometown_city,
         pc.submitted_living_province AS previous_submitted_living_province,
         pc.submitted_living_city AS previous_submitted_living_city,
         pc.submitted_started_sup_year AS previous_submitted_started_sup_year,
         pc.submitted_intro_short AS previous_submitted_intro_short,
         pc.submitted_intro AS previous_submitted_intro,
         pc.submitted_profile_json AS previous_submitted_profile_json,
         pc.submitted_bib_number AS previous_submitted_bib_number,
         er.bib_number AS verified_bib_number, er.discipline, er.gender_group, er.rank_position, er.finish_time,
         e.name AS event_name, e.start_date, e.province AS event_province, e.city AS event_city
       FROM sup_athlete_profile_claims c
       INNER JOIN sup_users u ON u.user_id = c.user_id
       INNER JOIN sup_athletes a ON a.athlete_id = c.athlete_id
       LEFT JOIN sup_athlete_profile_claims pc ON pc.claim_id = (
         SELECT pc2.claim_id
         FROM sup_athlete_profile_claims pc2
         WHERE pc2.athlete_id = c.athlete_id
           AND pc2.user_id = c.user_id
           AND pc2.claim_id < c.claim_id
         ORDER BY pc2.created_at DESC, pc2.claim_id DESC
         LIMIT 1
       )
       LEFT JOIN sup_event_results er ON er.result_id = c.result_id
       LEFT JOIN sup_events e ON e.event_id = er.event_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY FIELD(c.status, 'pending', 'approved', 'rejected'), c.created_at DESC
       LIMIT 200`,
      params
    );

    return NextResponse.json({ items: rows.map(normalizeClaimRow) });
  } catch (error) {
    console.error('获取运动员资料审批列表失败:', error);
    return NextResponse.json({ error: '获取运动员资料审批列表失败' }, { status: 500 });
  }
});
