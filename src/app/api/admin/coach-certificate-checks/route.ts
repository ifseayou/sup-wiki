import { NextRequest, NextResponse } from 'next/server';
import { withAdmin } from '@/lib/admin';
import pool from '@/lib/db';
import { dateOrNull, maskCertificateNo, normalizeCoachCheckRow, numberOrNull, parseDelimitedCertificateRows, textOrNull } from '@/lib/coach-certificate-checks';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';

const allowedQueryStatuses = new Set(['queued', 'hit', 'not_found', 'ambiguous', 'blocked', 'error']);
const allowedMatchStatuses = new Set(['pending', 'confirmed', 'rejected', 'linked_elsewhere']);

export const GET = withAdmin(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search')?.trim();
    const queryStatus = searchParams.get('query_status')?.trim();
    const matchStatus = searchParams.get('match_status')?.trim();
    const page = Math.max(1, Number(searchParams.get('page') || '1') || 1);
    const pageSize = Math.min(100, Math.max(10, Number(searchParams.get('pageSize') || '30') || 30));
    const offset = (page - 1) * pageSize;
    const conditions: string[] = [];
    const params: (string | number)[] = [];

    if (search) {
      conditions.push('(c.athlete_name LIKE ? OR c.query_name LIKE ? OR c.certificate_no LIKE ? OR c.club_name LIKE ? OR a.name LIKE ?)');
      const like = `%${search}%`;
      params.push(like, like, like, like, like);
    }
    if (queryStatus && allowedQueryStatuses.has(queryStatus)) {
      conditions.push('c.query_status = ?');
      params.push(queryStatus);
    }
    if (matchStatus && allowedMatchStatuses.has(matchStatus)) {
      conditions.push('c.match_status = ?');
      params.push(matchStatus);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const [countRows] = await pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) AS total FROM sup_coach_certificate_checks c LEFT JOIN sup_athletes a ON a.athlete_id = c.athlete_id ${where}`,
      params
    );
    const [items] = await pool.execute<RowDataPacket[]>(
      `SELECT c.*, a.name AS linked_athlete_name, a.photo AS athlete_photo, p.name AS professional_name
       FROM sup_coach_certificate_checks c
       LEFT JOIN sup_athletes a ON a.athlete_id = c.athlete_id
       LEFT JOIN sup_professionals p ON p.professional_id = c.professional_id
       ${where}
       ORDER BY
         CASE c.match_status WHEN 'pending' THEN 0 WHEN 'confirmed' THEN 1 ELSE 2 END,
         CASE c.query_status WHEN 'hit' THEN 0 WHEN 'ambiguous' THEN 1 WHEN 'queued' THEN 2 ELSE 3 END,
         c.candidate_rank ASC,
         c.updated_at DESC
       LIMIT ${pageSize} OFFSET ${offset}`,
      params
    );
    const total = Number(countRows[0]?.total || 0);
    return NextResponse.json({ items: items.map(normalizeCoachCheckRow), total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
  } catch (error) {
    console.error('获取教练员线索失败:', error);
    return NextResponse.json({ error: '获取教练员线索失败' }, { status: 500 });
  }
});

export const POST = withAdmin(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const rawItems = Array.isArray(body.items)
      ? body.items
      : typeof body.text === 'string'
        ? parseDelimitedCertificateRows(body.text)
        : [];
    if (rawItems.length === 0) {
      return NextResponse.json({ error: '没有可导入的证书记录' }, { status: 400 });
    }
    let imported = 0;
    for (const item of rawItems) {
      const name = textOrNull(item.name || item.query_name || item.athlete_name || item['姓名']);
      if (!name) continue;
      const certificateNo = textOrNull(item.certificate_no || item.cert_no || item['证书编号']);
      const certificateNoMasked = maskCertificateNo(certificateNo);
      const clubName = textOrNull(item.club_name || item.club || item['所属俱乐部']);
      const expiryDate = dateOrNull(item.expiry_date || item.valid_until || item['证书有效期截止']);
      const sourceUrl = textOrNull(item.source_url || item.url || item['来源']);
      const sourceTitle = textOrNull(item.source_title || item['来源标题']) || '全国桨板教练员信息公示';
      const athleteId = numberOrNull(item.athlete_id);
      await pool.execute<ResultSetHeader>(
        `INSERT INTO sup_coach_certificate_checks (
           athlete_id, athlete_name, query_name, query_status, certificate_no, certificate_no_masked,
           club_name, expiry_date, source_title, source_url, source_excerpt, checked_at, match_status
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), 'pending')
         ON DUPLICATE KEY UPDATE
           athlete_id = COALESCE(VALUES(athlete_id), athlete_id),
           athlete_name = VALUES(athlete_name),
           query_status = VALUES(query_status),
           certificate_no = VALUES(certificate_no),
           certificate_no_masked = VALUES(certificate_no_masked),
           club_name = VALUES(club_name),
           expiry_date = VALUES(expiry_date),
           source_title = VALUES(source_title),
           source_url = VALUES(source_url),
           source_excerpt = VALUES(source_excerpt),
           checked_at = NOW(),
           updated_at = CURRENT_TIMESTAMP`,
        [
          athleteId,
          name,
          name,
          certificateNo ? 'hit' : 'ambiguous',
          certificateNo,
          certificateNoMasked,
          clubName,
          expiryDate,
          sourceTitle,
          sourceUrl,
          [name, certificateNo, clubName, expiryDate].filter(Boolean).join(' | '),
        ]
      );
      imported += 1;
    }
    return NextResponse.json({ success: true, imported });
  } catch (error) {
    console.error('导入教练员证书线索失败:', error);
    return NextResponse.json({ error: '导入教练员证书线索失败' }, { status: 500 });
  }
});
