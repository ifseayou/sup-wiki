import { NextRequest, NextResponse } from 'next/server';
import { withAdmin } from '@/lib/admin';
import pool from '@/lib/db';
import { dateOrNull, maskCertificateNo, normalizeCoachCheckRow, numberOrNull, textOrNull } from '@/lib/coach-certificate-checks';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';

function getId(request: NextRequest) {
  return Number(new URL(request.url).pathname.split('/').at(-1));
}

export const GET = withAdmin(async (request: NextRequest) => {
  try {
    const id = getId(request);
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT c.*, a.name AS linked_athlete_name, p.name AS professional_name
       FROM sup_coach_certificate_checks c
       LEFT JOIN sup_athletes a ON a.athlete_id = c.athlete_id
       LEFT JOIN sup_professionals p ON p.professional_id = c.professional_id
       WHERE c.check_id = ?
       LIMIT 1`,
      [id]
    );
    if (!rows.length) return NextResponse.json({ error: '线索不存在' }, { status: 404 });
    return NextResponse.json({ item: normalizeCoachCheckRow(rows[0]) });
  } catch (error) {
    console.error('获取教练员线索失败:', error);
    return NextResponse.json({ error: '获取教练员线索失败' }, { status: 500 });
  }
});

export const PUT = withAdmin(async (request: NextRequest) => {
  try {
    const id = getId(request);
    const body = await request.json();
    const certificateNo = textOrNull(body.certificate_no);
    const queryStatus = textOrNull(body.query_status);
    const matchStatus = textOrNull(body.match_status);
    const [result] = await pool.execute<ResultSetHeader>(
      `UPDATE sup_coach_certificate_checks
       SET athlete_id = ?,
           athlete_name = ?,
           query_name = ?,
           query_status = ?,
           certificate_no = ?,
           certificate_no_masked = ?,
           club_name = ?,
           expiry_date = ?,
           source_title = ?,
           source_url = ?,
           source_excerpt = ?,
           match_status = ?,
           checked_at = CASE WHEN ? <> 'queued' THEN COALESCE(checked_at, NOW()) ELSE checked_at END,
           error_message = ?
       WHERE check_id = ?`,
      [
        numberOrNull(body.athlete_id),
        textOrNull(body.athlete_name || body.query_name) || '',
        textOrNull(body.query_name || body.athlete_name) || '',
        queryStatus || 'queued',
        certificateNo,
        maskCertificateNo(certificateNo),
        textOrNull(body.club_name),
        dateOrNull(body.expiry_date),
        textOrNull(body.source_title) || '全国桨板教练员信息公示',
        textOrNull(body.source_url),
        textOrNull(body.source_excerpt),
        matchStatus || 'pending',
        queryStatus || 'queued',
        textOrNull(body.error_message),
        id,
      ]
    );
    if (result.affectedRows === 0) return NextResponse.json({ error: '线索不存在' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('更新教练员线索失败:', error);
    return NextResponse.json({ error: '更新教练员线索失败' }, { status: 500 });
  }
});
