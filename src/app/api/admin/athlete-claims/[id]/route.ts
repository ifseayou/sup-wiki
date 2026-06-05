import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { extractToken, isAdmin, verifyToken } from '@/lib/auth';
import { normalizeDateOnly } from '@/lib/china-time';
import type { RowDataPacket } from 'mysql2';

function ensureAdmin(request: NextRequest) {
  const token = extractToken(request.headers.get('authorization'));
  const payload = token ? verifyToken(token) : null;
  return isAdmin(payload);
}

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

function getNestedString(source: Record<string, unknown>, path: string[]) {
  let current: unknown = source;
  for (const key of path) {
    if (!current || typeof current !== 'object' || Array.isArray(current)) return null;
    current = (current as Record<string, unknown>)[key];
  }
  const value = typeof current === 'string' ? current.trim() : '';
  return value || null;
}

function parseUrlArray(value: unknown) {
  const source = Array.isArray(value) ? value : [];
  return Array.from(new Set(source.map((item) => String(item || '').trim()).filter(Boolean)));
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!ensureAdmin(request)) return NextResponse.json({ error: '需要管理员权限' }, { status: 403 });

  const { id } = await params;
  const claimId = Number(id);
  if (!Number.isInteger(claimId) || claimId <= 0) {
    return NextResponse.json({ error: '无效提交 ID' }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const action = body.action === 'reject' ? 'reject' : 'approve';
  const reviewerNote = String(body.reviewer_note || '').trim() || null;
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();
    const [claimRows] = await conn.execute<RowDataPacket[]>(
      `SELECT
         c.*,
         DATE_FORMAT(c.submitted_birth_date, '%Y-%m-%d') AS submitted_birth_date,
         a.social_links,
         a.photos AS current_photos
       FROM sup_athlete_profile_claims c
       INNER JOIN sup_athletes a ON a.athlete_id = c.athlete_id
       WHERE c.claim_id = ?
       FOR UPDATE`,
      [claimId]
    );
    const claim = claimRows[0];
    if (!claim) {
      await conn.rollback();
      return NextResponse.json({ error: '提交不存在' }, { status: 404 });
    }
    if (claim.status !== 'pending') {
      await conn.rollback();
      return NextResponse.json({ error: '该提交已经处理过' }, { status: 400 });
    }

    if (action === 'reject') {
      await conn.execute(
        `UPDATE sup_athlete_profile_claims
         SET status = 'rejected', reviewer_note = ?, reviewed_at = NOW()
         WHERE claim_id = ?`,
        [reviewerNote, claimId]
      );
      await conn.commit();
      return NextResponse.json({ success: true, status: 'rejected' });
    }

    const socialLinks = parseJsonObject(claim.social_links);
    const submittedProfile = parseJsonObject(claim.submitted_profile_json);
    const submittedSupPhotoUrls = parseUrlArray(submittedProfile.sup_photos || submittedProfile.photos);
    const submittedIntro = claim.submitted_intro || String(submittedProfile.intro || '');
    const nextPhotoUrls = submittedSupPhotoUrls;
    const hometownProvince = claim.submitted_hometown_province || getNestedString(submittedProfile, ['hometown', 'province']);
    const hometownCity = claim.submitted_hometown_city || getNestedString(submittedProfile, ['hometown', 'city']);
    const submittedBirthDate = normalizeDateOnly(claim.submitted_birth_date);
    // 提交值为空时保留运动员已有值，避免后续不带值的认领把既有资料（尤其一句话简介）清空。
    // 与下方 bio 的 COALESCE(NULLIF(...), 旧值) 语义保持一致。
    const existingPublicProfile = parseJsonObject(socialLinks.public_profile);
    const publicProfile = {
      ...existingPublicProfile,
      birth_date: submittedBirthDate || existingPublicProfile.birth_date || null,
      birth_year: claim.submitted_birth_year || existingPublicProfile.birth_year || null,
      hometown_province: hometownProvince || existingPublicProfile.hometown_province || null,
      hometown_city: hometownCity || existingPublicProfile.hometown_city || null,
      living_province: claim.submitted_living_province || existingPublicProfile.living_province || null,
      living_city: claim.submitted_living_city || existingPublicProfile.living_city || null,
      started_sup_year: claim.submitted_started_sup_year || existingPublicProfile.started_sup_year || null,
      intro_short: claim.submitted_intro_short || existingPublicProfile.intro_short || null,
      profile_claim_id: claimId,
    };
    const nextSocialLinks = JSON.stringify({ ...socialLinks, public_profile: publicProfile });

    await conn.execute(
      `UPDATE sup_athletes
       SET
         name = COALESCE(NULLIF(?, ''), name),
         photo = COALESCE(NULLIF(?, ''), photo),
         photos = ?,
         province = COALESCE(NULLIF(?, ''), province),
         city = COALESCE(NULLIF(?, ''), city),
         bio = COALESCE(NULLIF(?, ''), bio),
         social_links = ?
       WHERE athlete_id = ?`,
      [
        claim.submitted_name,
        claim.submitted_avatar_url,
        JSON.stringify(nextPhotoUrls),
        hometownProvince,
        hometownCity,
        submittedIntro,
        nextSocialLinks,
        claim.athlete_id,
      ]
    );

    await conn.execute(
      `INSERT INTO sup_athlete_profile_owners (athlete_id, user_id, role, status, verified_at)
       VALUES (?, ?, 'owner', 'active', NOW())
       ON DUPLICATE KEY UPDATE role = 'owner', status = 'active', verified_at = NOW()`,
      [claim.athlete_id, claim.user_id]
    );

    await conn.execute(
      `UPDATE sup_users
       SET user_level = CASE
         WHEN user_level = 'admin' THEN 'admin'
         WHEN user_level IN ('svip', 'trusted') THEN 'svip'
         WHEN user_level = 'blocked' THEN 'blocked'
         ELSE 'vip'
       END
       WHERE user_id = ? AND status <> 'blocked'`,
      [claim.user_id]
    );

    await conn.execute(
      `UPDATE sup_athlete_profile_claims
       SET status = 'approved', reviewer_note = ?, reviewed_at = NOW()
       WHERE claim_id = ?`,
      [reviewerNote, claimId]
    );

    await conn.commit();
    return NextResponse.json({ success: true, status: 'approved' });
  } catch (error) {
    await conn.rollback();
    console.error('处理运动员资料审批失败:', error);
    return NextResponse.json({ error: '处理运动员资料审批失败' }, { status: 500 });
  } finally {
    conn.release();
  }
}
