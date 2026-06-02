import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { requireUser } from '@/lib/user-auth';
import { localResultSourceCondition } from '@/lib/result-source-scope';
import { resultDefaultOrderBy } from '@/lib/result-ordering';
import type { RowDataPacket } from 'mysql2';

function bibPrefix(value: unknown) {
  const text = String(value || '').trim();
  return text ? text.slice(0, 2) : '';
}

function parseJsonObject(value: unknown) {
  if (!value) return {};
  if (typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
  try {
    const parsed = JSON.parse(String(value));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function normalizeMediaList(value: unknown) {
  if (Array.isArray(value)) return value.map((item) => String(item || '').trim()).filter(Boolean);
  if (!value) return [];
  try {
    const parsed = JSON.parse(String(value));
    return Array.isArray(parsed) ? parsed.map((item) => String(item || '').trim()).filter(Boolean) : [];
  } catch {
    return String(value).split(/[,\n]/).map((item) => item.trim()).filter(Boolean);
  }
}

export async function GET(request: NextRequest) {
  const user = requireUser(request);
  if (user instanceof NextResponse) return user;

  try {
    const athleteId = Number(request.nextUrl.searchParams.get('athlete_id'));
    if (!Number.isInteger(athleteId) || athleteId <= 0) {
      return NextResponse.json({ error: '无效运动员 ID' }, { status: 400 });
    }

    const [athletes] = await pool.execute<RowDataPacket[]>(
      `SELECT athlete_id, name, photo, photos, province, city, bio, social_links
       FROM sup_athletes
       WHERE athlete_id = ?
       LIMIT 1`,
      [athleteId]
    );
    if (!athletes.length) return NextResponse.json({ error: '运动员不存在' }, { status: 404 });

    const [ownerRows] = await pool.execute<RowDataPacket[]>(
      `SELECT user_id
       FROM sup_athlete_profile_owners
       WHERE athlete_id = ? AND status = 'active' AND role = 'owner'`,
      [athleteId]
    );
    const ownerIds = ownerRows.map((row) => Number(row.user_id));
    if (ownerIds.length > 0 && !ownerIds.includes(user.user_id)) {
      return NextResponse.json({ error: '该运动员资料已被本人绑定' }, { status: 403 });
    }
    const [userOwnerRows] = await pool.execute<RowDataPacket[]>(
      `SELECT athlete_id
       FROM sup_athlete_profile_owners
       WHERE user_id = ? AND status = 'active' AND role = 'owner'
       LIMIT 1`,
      [user.user_id]
    );
    if (userOwnerRows.length && Number(userOwnerRows[0].athlete_id) !== athleteId) {
      return NextResponse.json({ error: '一个用户只能绑定一个运动员' }, { status: 403 });
    }

    const [results] = await pool.execute<RowDataPacket[]>(
      `SELECT
         er.result_id, er.bib_number, er.gender_group, er.discipline, er.rank_position, er.finish_time,
         e.name AS event_name, e.start_date, e.province, e.city
       FROM sup_event_results er
       INNER JOIN sup_events e ON e.event_id = er.event_id
       INNER JOIN sup_event_result_sources src ON src.source_id = er.source_id
       WHERE er.athlete_id = ?
         AND e.status = 'published'
         AND e.event_status = 'completed'
         AND er.review_status = 'confirmed'
         AND er.is_verified = 1
         AND er.source_id IS NOT NULL
         AND ${localResultSourceCondition}
       ORDER BY COALESCE(e.start_date, '1900-01-01') DESC, ${resultDefaultOrderBy()}
       LIMIT 3`,
      [athleteId]
    );

    const athlete = athletes[0];
    const socialLinks = parseJsonObject(athlete.social_links);
    const publicProfile = parseJsonObject(socialLinks.public_profile);
    const [latestClaims] = await pool.execute<RowDataPacket[]>(
      `SELECT submitted_profile_json
       FROM sup_athlete_profile_claims
       WHERE athlete_id = ? AND user_id = ?
       ORDER BY created_at DESC, claim_id DESC
       LIMIT 1`,
      [athleteId, user.user_id]
    );
    const latestProfile = parseJsonObject(latestClaims[0]?.submitted_profile_json);
    const currentPhotoUrls = normalizeMediaList(athlete.photos);
    const profilePhotoUrls = normalizeMediaList(
      latestProfile.sup_photos || latestProfile.photos || publicProfile.sup_photos || publicProfile.photos || []
    );
    const mergedPhotoUrls = Array.from(new Set([...profilePhotoUrls, ...currentPhotoUrls]));
    const mergedProfile = {
      ...publicProfile,
      ...latestProfile,
      sup_photos: mergedPhotoUrls,
      photos: mergedPhotoUrls,
    };
    const isOwner = ownerIds.includes(user.user_id);

    return NextResponse.json({
      claim_mode: isOwner ? 'update' : 'claim',
      is_owner: isOwner,
      athlete: {
        ...athlete,
        public_profile: mergedProfile,
        social_links: undefined,
      },
      recent_results: results.map((row) => ({
        ...row,
        bib_prefix: bibPrefix(row.bib_number),
        bib_number: undefined,
      })),
    });
  } catch (error) {
    console.error('获取运动员认领选项失败:', error);
    return NextResponse.json({ error: '获取运动员认领选项失败' }, { status: 500 });
  }
}
