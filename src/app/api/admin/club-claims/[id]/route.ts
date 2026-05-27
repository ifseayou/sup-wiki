import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { withAdmin } from '@/lib/admin';
import { cleanClubTeamName, normalizeClubTeamName, slugifyClubName } from '@/lib/club-team-normalization';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';

function parseJsonArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (!value) return [];
  try {
    const parsed = JSON.parse(String(value));
    return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function getId(request: NextRequest) {
  return Number(new URL(request.url).pathname.split('/').at(-1));
}

async function uniqueClubSlug(conn: Awaited<ReturnType<typeof pool.getConnection>>, name: string, fallbackId: number) {
  const base = slugifyClubName(name, fallbackId);
  for (let index = 0; index < 20; index += 1) {
    const slug = index === 0 ? base : `${base}-${index + 1}`;
    const [rows] = await conn.execute<RowDataPacket[]>('SELECT club_id FROM sup_clubs WHERE slug = ? LIMIT 1', [slug]);
    if (!rows.length) return slug;
  }
  return `${base}-${Date.now()}`;
}

export const PATCH = withAdmin(async (request: NextRequest) => {
  const claimId = getId(request);
  if (!Number.isInteger(claimId) || claimId <= 0) {
    return NextResponse.json({ error: '无效认领 ID' }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const action = String(body.action || '');
  const adminNote = String(body.admin_note || '').trim().slice(0, 1000) || null;

  if (action === 'reviewing' || action === 'reject') {
    const nextStatus = action === 'reviewing' ? 'reviewing' : 'rejected';
    const [result] = await pool.execute<ResultSetHeader>(
      `UPDATE sup_club_claims
       SET status = ?, admin_note = ?, reviewed_at = IF(? = 'rejected', NOW(), reviewed_at)
       WHERE claim_id = ?`,
      [nextStatus, adminNote, nextStatus, claimId]
    );
    if (result.affectedRows === 0) return NextResponse.json({ error: '认领不存在' }, { status: 404 });
    return NextResponse.json({ success: true, status: nextStatus });
  }

  if (action !== 'approve') return NextResponse.json({ error: '未知审核操作' }, { status: 400 });

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.execute<RowDataPacket[]>(
      `SELECT cc.*, a.club_id AS alias_club_id, a.team_name_raw, a.normalized_name
       FROM sup_club_claims cc
       LEFT JOIN sup_club_team_aliases a ON a.alias_id = cc.alias_id
       WHERE cc.claim_id = ?
       FOR UPDATE`,
      [claimId]
    );
    const claim = rows[0];
    if (!claim) {
      await conn.rollback();
      return NextResponse.json({ error: '认领不存在' }, { status: 404 });
    }
    if (claim.status === 'approved') {
      await conn.rollback();
      return NextResponse.json({ error: '该认领已通过审核' }, { status: 409 });
    }
    if (claim.status === 'rejected') {
      await conn.rollback();
      return NextResponse.json({ error: '该认领已驳回，不能直接通过' }, { status: 409 });
    }

    const submittedName = cleanClubTeamName(claim.submitted_club_name);
    let clubId = body.club_id ? Number(body.club_id) : Number(claim.club_id || claim.alias_club_id || 0);
    if (!clubId) {
      const normalized = normalizeClubTeamName(submittedName);
      const [existing] = await conn.execute<RowDataPacket[]>(
        `SELECT club_id FROM sup_clubs
         WHERE LOWER(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(name, ' ', ''), '　', ''), '（', '('), '）', ')'), '·', ''), '•', '')) = ?
         ORDER BY status = 'published' DESC, club_id ASC
         LIMIT 1`,
        [normalized]
      );
      clubId = existing[0] ? Number(existing[0].club_id) : 0;
    }

    if (!clubId) {
      const proofImages = parseJsonArray(claim.proof_images);
      const slug = await uniqueClubSlug(conn, submittedName, claimId);
      const [insert] = await conn.execute<ResultSetHeader>(
        `INSERT INTO sup_clubs (
           slug, name, cover_image, images, intro, owner_user_id,
           claim_status, verification_status, source_type, source_note, status
         ) VALUES (?, ?, ?, ?, ?, ?, 'claimed', 'pending', 'club_claim', ?, 'published')`,
        [
          slug,
          submittedName,
          proofImages[0] || null,
          JSON.stringify(proofImages),
          '由俱乐部负责人认领生成，训练水域、服务和安全信息待继续补充。',
          claim.user_id,
          `club_claim:${claimId}`,
        ]
      );
      clubId = insert.insertId;
    } else {
      await conn.execute(
        `UPDATE sup_clubs
         SET owner_user_id = COALESCE(owner_user_id, ?),
             claim_status = 'claimed',
             verification_status = CASE WHEN verification_status = 'verified' THEN verification_status ELSE 'pending' END,
             source_type = COALESCE(source_type, 'club_claim'),
             source_note = COALESCE(source_note, ?),
             status = 'published'
         WHERE club_id = ?`,
        [claim.user_id, `club_claim:${claimId}`, clubId]
      );
    }

    await conn.execute(
      `INSERT INTO sup_club_owners (club_id, user_id, role, status, verified_at, source_claim_id)
       VALUES (?, ?, 'owner', 'active', NOW(), ?)
       ON DUPLICATE KEY UPDATE role = 'owner', status = 'active', verified_at = NOW(), source_claim_id = VALUES(source_claim_id)`,
      [clubId, claim.user_id, claimId]
    );

    const aliasNames = Array.from(new Set([
      ...parseJsonArray(claim.submitted_alias_names),
      claim.team_name_raw,
      submittedName,
    ].map(cleanClubTeamName).filter(Boolean)));
    for (const aliasName of aliasNames) {
      await conn.execute(
        `INSERT INTO sup_club_team_aliases (club_id, team_name_raw, normalized_name, match_status, confidence, source_type, admin_note, reviewed_at)
         VALUES (?, ?, ?, 'confirmed', 1.000, 'club_claim', ?, NOW())
         ON DUPLICATE KEY UPDATE club_id = VALUES(club_id), match_status = 'confirmed', confidence = 1.000, admin_note = VALUES(admin_note), reviewed_at = NOW()`,
        [clubId, aliasName, normalizeClubTeamName(aliasName), `club_claim:${claimId}`]
      );
    }

    await conn.execute(
      `UPDATE sup_club_claims
       SET status = 'approved', admin_note = ?, reviewed_at = NOW(), created_club_id = ?
       WHERE claim_id = ?`,
      [adminNote, clubId, claimId]
    );
    await conn.commit();
    return NextResponse.json({ success: true, status: 'approved', club_id: clubId });
  } catch (error) {
    await conn.rollback();
    console.error('处理俱乐部认领失败:', error);
    return NextResponse.json({ error: '处理俱乐部认领失败' }, { status: 500 });
  } finally {
    conn.release();
  }
});
