import { NextRequest, NextResponse } from 'next/server';
import { withAdmin } from '@/lib/admin';
import pool from '@/lib/db';
import { maskCertificateNo, normalizeCoachCheckRow } from '@/lib/coach-certificate-checks';
import { queryWjxCoachCertificateByName, summarizeWjxRecords } from '@/lib/wjx-coach-certificate';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';

const syncableStatuses = new Set(['queued', 'not_found', 'error']);
const selectableStatuses = new Set(['queued', 'hit', 'not_found', 'ambiguous', 'blocked', 'error']);

type CoachCheckSyncRow = RowDataPacket & {
  check_id: number;
  athlete_name: string;
  query_name: string;
  query_status: string;
  match_status: string;
  candidate_rank: number;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeLimit(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 20;
  return Math.min(100, Math.max(1, Math.floor(parsed)));
}

function normalizeIdList(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => Number(item)).filter((item) => Number.isInteger(item) && item > 0).slice(0, 100);
}

function normalizeStatusList(value: unknown) {
  if (!Array.isArray(value)) return [...syncableStatuses];
  const statuses = value.map((item) => String(item)).filter((item) => selectableStatuses.has(item));
  return statuses.length ? statuses.slice(0, 6) : [...syncableStatuses];
}

export const POST = withAdmin(async (request: NextRequest) => {
  try {
    const body = await request.json().catch(() => ({}));
    const limit = normalizeLimit(body.limit);
    const ids = normalizeIdList(body.ids);
    const statuses = normalizeStatusList(body.statuses);
    const dryRun = Boolean(body.dry_run);
    const delayMs = Math.min(3000, Math.max(500, Number(body.delay_ms) || 1000));

    const params: (string | number)[] = [];
    const conditions = ['c.match_status <> ?'];
    params.push('confirmed');
    if (ids.length > 0) {
      conditions.push(`c.check_id IN (${ids.map(() => '?').join(',')})`);
      params.push(...ids);
    } else {
      conditions.push(`c.query_status IN (${statuses.map(() => '?').join(',')})`);
      params.push(...statuses);
    }

    const [rows] = await pool.execute<CoachCheckSyncRow[]>(
      `SELECT c.*
       FROM sup_coach_certificate_checks c
       WHERE ${conditions.join(' AND ')}
       ORDER BY
         CASE c.query_status WHEN 'queued' THEN 0 WHEN 'error' THEN 1 WHEN 'not_found' THEN 2 ELSE 3 END,
         c.candidate_rank ASC,
         c.updated_at ASC
       LIMIT ${limit}`,
      params
    );

    const items = rows.map((row) => normalizeCoachCheckRow(row) as CoachCheckSyncRow & { candidate_athlete_ids: number[] });
    const summary = {
      total: items.length,
      hit: 0,
      not_found: 0,
      ambiguous: 0,
      blocked: 0,
      error: 0,
      updated: 0,
      dry_run: dryRun,
    };
    const results: unknown[] = [];

    for (const [index, item] of items.entries()) {
      if (index > 0) await sleep(delayMs);
      const result = await queryWjxCoachCertificateByName(item.query_name || item.athlete_name);
      summary[result.status] += 1;

      const first = result.records[0] || null;
      const sourceExcerpt = result.records.length > 1 ? summarizeWjxRecords(result.records) : first?.sourceExcerpt || null;
      const errorMessage = result.errorMessage || null;

      if (!dryRun) {
        if (result.status === 'hit' && first) {
          await pool.execute<ResultSetHeader>(
            `UPDATE sup_coach_certificate_checks
             SET query_status = 'hit',
                 certificate_no = ?,
                 certificate_no_masked = ?,
                 club_name = ?,
                 expiry_date = ?,
                 source_title = ?,
                 source_url = ?,
                 source_excerpt = ?,
                 raw_hash = ?,
                 checked_at = NOW(),
                 error_message = NULL,
                 updated_at = CURRENT_TIMESTAMP
             WHERE check_id = ?`,
            [
              first.certificateNo,
              first.certificateNoMasked || maskCertificateNo(first.certificateNo),
              first.clubName,
              first.expiryDate,
              first.sourceTitle,
              first.sourceUrl,
              first.sourceExcerpt,
              first.rawHash,
              item.check_id,
            ]
          );
          summary.updated += 1;
        } else {
          await pool.execute<ResultSetHeader>(
            `UPDATE sup_coach_certificate_checks
             SET query_status = ?,
                 source_title = COALESCE(?, source_title),
                 source_url = COALESCE(?, source_url),
                 source_excerpt = COALESCE(?, source_excerpt),
                 checked_at = NOW(),
                 error_message = ?,
                 next_check_after = CASE WHEN ? = 'blocked' THEN DATE_ADD(NOW(), INTERVAL 1 DAY) ELSE next_check_after END,
                 updated_at = CURRENT_TIMESTAMP
             WHERE check_id = ?`,
            [
              result.status,
              first?.sourceTitle || '全国桨板教练员信息公示',
              first?.sourceUrl || 'https://www.wjx.cn/resultquery.aspx?activity=251493134',
              sourceExcerpt,
              errorMessage,
              result.status,
              item.check_id,
            ]
          );
          summary.updated += 1;
        }
      }

      results.push({
        check_id: item.check_id,
        query_name: item.query_name,
        status: result.status,
        record_count: result.records.length,
        certificate_no_masked: first?.certificateNoMasked || null,
        club_name: first?.clubName || null,
        expiry_date: first?.expiryDate || null,
        error_message: errorMessage,
      });
    }

    return NextResponse.json({ success: true, summary, results });
  } catch (error) {
    console.error('同步问卷星教练员证书失败:', error);
    return NextResponse.json({ error: '同步问卷星教练员证书失败' }, { status: 500 });
  }
});
