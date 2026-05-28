import { NextRequest, NextResponse } from 'next/server';
import { withAdmin } from '@/lib/admin';
import pool from '@/lib/db';
import { maskCertificateNo } from '@/lib/coach-certificate-checks';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';

function getId(request: NextRequest) {
  const parts = new URL(request.url).pathname.split('/');
  return Number(parts.at(-2));
}

export const POST = withAdmin(async (request: NextRequest) => {
  const id = getId(request);
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute<RowDataPacket[]>('SELECT * FROM sup_coach_certificate_checks WHERE check_id = ? FOR UPDATE', [id]);
    if (!rows.length) {
      await connection.rollback();
      return NextResponse.json({ error: '线索不存在' }, { status: 404 });
    }
    const item = rows[0];
    const athleteId = item.athlete_id ? Number(item.athlete_id) : null;
    const name = String(item.athlete_name || item.query_name || '').trim();
    if (!name) {
      await connection.rollback();
      return NextResponse.json({ error: '缺少姓名，无法确认入库' }, { status: 400 });
    }

    let professionalId = item.professional_id ? Number(item.professional_id) : null;
    if (!professionalId && athleteId) {
      const [existing] = await connection.execute<RowDataPacket[]>(
        'SELECT professional_id FROM sup_professionals WHERE athlete_id = ? AND primary_role = "coach" ORDER BY professional_id ASC LIMIT 1',
        [athleteId]
      );
      if (existing.length) professionalId = Number(existing[0].professional_id);
    }
    if (!professionalId) {
      const [inserted] = await connection.execute<ResultSetHeader>(
        `INSERT INTO sup_professionals (
           athlete_id, name, roles, primary_role, bio, intro_short, claim_status,
           verification_status, source_type, source_note, status
         ) VALUES (?, ?, JSON_ARRAY('coach'), 'coach', ?, ?, 'unclaimed', 'pending', 'coach_certificate_check', ?, 'draft')`,
        [
          athleteId,
          name,
          '由教练员证书公开信息线索生成，待管理员补充执教方向和服务信息。',
          item.club_name ? `所属俱乐部：${item.club_name}` : '教练员证书线索待完善。',
          `来源：${item.source_title || '全国桨板教练员信息公示'}`,
        ]
      );
      professionalId = inserted.insertId;
    } else {
      await connection.execute(
        `UPDATE sup_professionals
         SET athlete_id = COALESCE(athlete_id, ?),
             primary_role = 'coach',
             roles = JSON_ARRAY('coach'),
             verification_status = CASE WHEN verification_status = 'verified' THEN verification_status ELSE 'pending' END,
             source_type = COALESCE(source_type, 'coach_certificate_check'),
             source_note = COALESCE(source_note, ?)
         WHERE professional_id = ?`,
        [athleteId, `来源：${item.source_title || '全国桨板教练员信息公示'}`, professionalId]
      );
    }

    const certNoMasked = item.certificate_no_masked || maskCertificateNo(item.certificate_no);
    if (certNoMasked || item.club_name || item.expiry_date) {
      const [existingCert] = await connection.execute<RowDataPacket[]>(
        `SELECT certificate_id FROM sup_professional_certificates
         WHERE professional_id = ? AND certificate_type = 'coach' AND COALESCE(certificate_no_masked, '') = COALESCE(?, '')
         LIMIT 1`,
        [professionalId, certNoMasked || '']
      );
      if (existingCert.length) {
        await connection.execute(
          `UPDATE sup_professional_certificates
           SET issuer = COALESCE(issuer, '体育总局水上运动管理中心'),
               expiry_date = COALESCE(?, expiry_date),
               remark = ?,
               verification_status = CASE WHEN verification_status = 'verified' THEN verification_status ELSE 'pending' END
           WHERE certificate_id = ?`,
          [
            item.expiry_date || null,
            [item.club_name ? `所属俱乐部：${item.club_name}` : '', item.source_title ? `来源：${item.source_title}` : ''].filter(Boolean).join('；') || null,
            existingCert[0].certificate_id,
          ]
        );
      } else {
        await connection.execute(
          `INSERT INTO sup_professional_certificates (
             professional_id, certificate_name, certificate_type, certificate_level, issuer,
             expiry_date, certificate_no_masked, source_type, verification_status, remark, status
           ) VALUES (?, '桨板技能教练员等级证书', 'coach', NULL, '体育总局水上运动管理中心', ?, ?, 'coach_certificate_check', 'pending', ?, 'published')`,
          [
            professionalId,
            item.expiry_date || null,
            certNoMasked || null,
            [item.club_name ? `所属俱乐部：${item.club_name}` : '', item.source_title ? `来源：${item.source_title}` : ''].filter(Boolean).join('；') || null,
          ]
        );
      }
    }

    await connection.execute(
      `UPDATE sup_coach_certificate_checks
       SET match_status = 'confirmed',
           query_status = CASE WHEN query_status = 'queued' THEN 'hit' ELSE query_status END,
           professional_id = ?,
           checked_at = COALESCE(checked_at, NOW())
       WHERE check_id = ?`,
      [professionalId, id]
    );
    await connection.commit();
    return NextResponse.json({ success: true, professional_id: professionalId });
  } catch (error) {
    await connection.rollback();
    console.error('确认教练员线索失败:', error);
    return NextResponse.json({ error: '确认教练员线索失败' }, { status: 500 });
  } finally {
    connection.release();
  }
});
