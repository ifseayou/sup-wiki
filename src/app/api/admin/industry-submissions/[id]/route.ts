import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { withAdmin } from '@/lib/admin';
import { parseIndustryOcrText } from '@/lib/industry-submission-ocr';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';

const rolePriority = ['club_owner', 'coach', 'referee'];
const roleLabels: Record<string, string> = {
  coach: '教练员',
  referee: '裁判员',
  club_owner: '俱乐部负责人',
};

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

function slugFromSubmission(id: number) {
  return `industry-club-${id}`;
}

function primaryRole(roles: string[]) {
  return rolePriority.find((role) => roles.includes(role)) || roles[0] || 'coach';
}

async function findClubId(conn: Awaited<ReturnType<typeof pool.getConnection>>, name: string | null) {
  if (!name) return null;
  const [rows] = await conn.execute<RowDataPacket[]>(
    'SELECT club_id FROM sup_clubs WHERE name = ? ORDER BY status = "published" DESC, club_id DESC LIMIT 1',
    [name]
  );
  return rows[0] ? Number(rows[0].club_id) : null;
}

export const PATCH = withAdmin(async (request: NextRequest) => {
  const id = getId(request);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: '无效提交 ID' }, { status: 400 });
  }

  try {
    const body = await request.json();
    const action = String(body.action || '');
    const adminNote = String(body.admin_note || '').trim().slice(0, 1000) || null;

    if (action === 'reviewing' || action === 'reject') {
      const nextStatus = action === 'reviewing' ? 'reviewing' : 'rejected';
      const [result] = await pool.execute<ResultSetHeader>(
        `UPDATE sup_industry_submissions
         SET status = ?, admin_note = ?, reviewed_at = IF(? = 'rejected', NOW(), reviewed_at), reviewer_user_id = ?
         WHERE submission_id = ?`,
        [nextStatus, adminNote, nextStatus, null, id]
      );
      if (result.affectedRows === 0) return NextResponse.json({ error: '提交不存在' }, { status: 404 });
      return NextResponse.json({ success: true, status: nextStatus });
    }

    if (action !== 'approve') return NextResponse.json({ error: '未知审核操作' }, { status: 400 });

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [rows] = await conn.execute<RowDataPacket[]>(
        'SELECT * FROM sup_industry_submissions WHERE submission_id = ? FOR UPDATE',
        [id]
      );
      const submission = rows[0];
      if (!submission) {
        await conn.rollback();
        return NextResponse.json({ error: '提交不存在' }, { status: 404 });
      }
      if (submission.status === 'approved') {
        await conn.rollback();
        return NextResponse.json({ error: '该提交已通过审核' }, { status: 409 });
      }
      if (submission.status === 'rejected') {
        await conn.rollback();
        return NextResponse.json({ error: '该提交已驳回，不能直接通过' }, { status: 409 });
      }

      const roles = parseJsonArray(submission.roles);
      const profileImages = parseJsonArray(submission.profile_images);
      const clubPhotos = parseJsonArray(submission.club_photos);
      const certificateImages = parseJsonArray(submission.certificate_images);
      const licenseImages = parseJsonArray(submission.license_images);
      const sourceNote = `industry_submission:${id}`;
      let createdClubId: number | null = null;
      let createdProfessionalId: number | null = null;

      if (submission.submission_type === 'club') {
        const existingClubId = submission.matched_club_id ? Number(submission.matched_club_id) : await findClubId(conn, submission.name);
        if (existingClubId) {
          await conn.execute(
            `UPDATE sup_clubs
             SET cover_image = COALESCE(cover_image, ?),
                 images = ?,
                 address = COALESCE(address, ?),
                 claim_status = 'pending',
                 verification_status = 'pending',
                 source_type = 'industry_submission',
                 source_note = ?,
                 status = 'published'
             WHERE club_id = ?`,
            [clubPhotos[0] || licenseImages[0] || null, JSON.stringify([...clubPhotos, ...licenseImages]), submission.location_note || null, sourceNote, existingClubId]
          );
          createdClubId = existingClubId;
        } else {
          const [insert] = await conn.execute<ResultSetHeader>(
            `INSERT INTO sup_clubs (
               slug, name, cover_image, images, address, intro, owner_user_id,
               claim_status, verification_status, source_type, source_note, status
             ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', 'pending', 'industry_submission', ?, 'published')`,
            [
              slugFromSubmission(id),
              submission.name,
              clubPhotos[0] || licenseImages[0] || null,
              JSON.stringify([...clubPhotos, ...licenseImages]),
              submission.location_note || null,
              '由俱乐部负责人提交入驻资料生成，待补充服务、水域和安全信息。',
              submission.user_id,
              sourceNote,
            ]
          );
          createdClubId = insert.insertId;
        }
      } else {
        const clubId = submission.matched_club_id
          ? Number(submission.matched_club_id)
          : await findClubId(conn, submission.club_name || null);
        const matchName = String(submission.name || '').trim();
        let professionalId = submission.matched_professional_id ? Number(submission.matched_professional_id) : null;
        if (!professionalId && matchName) {
          const [existing] = await conn.execute<RowDataPacket[]>(
            `SELECT professional_id FROM sup_professionals
             WHERE name = ? AND (? IS NULL OR club_id = ?)
             ORDER BY status = 'published' DESC, professional_id DESC LIMIT 1`,
            [matchName, clubId, clubId]
          );
          professionalId = existing[0] ? Number(existing[0].professional_id) : null;
        }
        const role = primaryRole(roles);
        const avatar = profileImages[0] || certificateImages[0] || licenseImages[0] || null;
        if (professionalId) {
          await conn.execute(
            `UPDATE sup_professionals
             SET user_id = COALESCE(user_id, ?),
                 avatar = COALESCE(avatar, ?),
                 athlete_id = COALESCE(athlete_id, ?),
                 roles = ?,
                 primary_role = ?,
                 club_id = COALESCE(club_id, ?),
                 claim_status = 'claimed',
                 verification_status = 'pending',
                 source_type = 'industry_submission',
                 source_note = ?,
                 status = 'published'
             WHERE professional_id = ?`,
            [submission.user_id, avatar, submission.athlete_id || null, JSON.stringify(roles), role, clubId, sourceNote, professionalId]
          );
          createdProfessionalId = professionalId;
        } else {
          const [insert] = await conn.execute<ResultSetHeader>(
            `INSERT INTO sup_professionals (
               user_id, athlete_id, name, avatar, roles, primary_role, club_id, bio,
               claim_status, verification_status, source_type, source_note, status
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'claimed', 'pending', 'industry_submission', ?, 'published')`,
            [
              submission.user_id,
              submission.athlete_id || null,
              matchName,
              avatar,
              JSON.stringify(roles),
              role,
              clubId,
              '由本人提交入驻资料生成，待补充资质、服务和经历。',
              sourceNote,
            ]
          );
          createdProfessionalId = insert.insertId;
        }

        const ocrParsed = parseIndustryOcrText(String(submission.ocr_text || ''));
        const certUrls = [...certificateImages, ...licenseImages];
        for (let index = 0; index < certUrls.length; index += 1) {
          await conn.execute(
            `INSERT INTO sup_professional_certificates (
               professional_id, certificate_name, certificate_type, issuer, certificate_no_masked,
               certificate_image_url, source_type, verification_status, remark, status
             ) VALUES (?, ?, ?, ?, ?, ?, 'industry_submission', 'pending', ?, 'published')`,
            [
              createdProfessionalId,
              ocrParsed.certificate_name || `${roleLabels[roles[index] || role] || '专业人员'}证件资料`,
              roles[index] || role,
              ocrParsed.issuer || null,
              ocrParsed.certificate_no_masked || null,
              certUrls[index],
              sourceNote,
            ]
          );
        }

        if (clubId && createdProfessionalId) {
          await conn.execute(
            `INSERT INTO sup_club_members (club_id, professional_id, user_id, role, join_status, is_public, status)
             VALUES (?, ?, ?, ?, 'approved', 1, 'published')`,
            [clubId, createdProfessionalId, submission.user_id, role === 'club_owner' ? 'owner' : role]
          );
        }
      }

      await conn.execute(
        `UPDATE sup_industry_submissions
         SET status = 'approved',
             admin_note = ?,
             reviewed_at = NOW(),
             reviewer_user_id = ?,
             created_club_id = COALESCE(?, created_club_id),
             created_professional_id = COALESCE(?, created_professional_id)
         WHERE submission_id = ?`,
        [adminNote, null, createdClubId, createdProfessionalId, id]
      );
      await conn.commit();
      return NextResponse.json({ success: true, status: 'approved', created_club_id: createdClubId, created_professional_id: createdProfessionalId });
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
  } catch (error) {
    console.error('审核行业入驻提交失败:', error);
    return NextResponse.json({ error: '审核入驻提交失败' }, { status: 500 });
  }
});
