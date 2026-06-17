/**
 * 身份治理批次查看 + 回滚（Phase 3）
 * GET  /api/admin/athletes/merge-rollback?athlete_id=123  列出相关批次
 * POST /api/admin/athletes/merge-rollback  body:{ batch_id }  回滚整批
 */
import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { extractToken, isAdmin, verifyToken } from '@/lib/auth';
import { rollbackBatch } from '@/lib/athlete-merge-log';
import { syncAthleteRaceTimes } from '@/lib/event-results';
import type { RowDataPacket } from 'mysql2';

function ensureAdmin(request: NextRequest) {
  const token = extractToken(request.headers.get('authorization'));
  const payload = token ? verifyToken(token) : null;
  return isAdmin(payload);
}

export async function GET(request: NextRequest) {
  if (!ensureAdmin(request)) return NextResponse.json({ error: '需要管理员权限' }, { status: 403 });
  const athleteId = Number(request.nextUrl.searchParams.get('athlete_id'));
  const params: number[] = [];
  let filter = '';
  if (Number.isInteger(athleteId) && athleteId > 0) {
    filter = 'WHERE from_athlete_id = ? OR to_athlete_id = ?';
    params.push(athleteId, athleteId);
  }
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT batch_id, operation,
            MIN(created_at) AS created_at,
            COUNT(*) AS row_count,
            MIN(rolled_back) AS fully_rolled_back,
            GROUP_CONCAT(DISTINCT from_athlete_id) AS from_ids,
            GROUP_CONCAT(DISTINCT to_athlete_id) AS to_ids
     FROM sup_athlete_merge_log
     ${filter}
     GROUP BY batch_id, operation
     ORDER BY MIN(created_at) DESC
     LIMIT 100`,
    params
  );
  return NextResponse.json({
    items: rows.map((r) => ({
      batch_id: r.batch_id,
      operation: r.operation,
      created_at: r.created_at,
      row_count: Number(r.row_count),
      rolled_back: Number(r.fully_rolled_back) === 1,
      from_ids: String(r.from_ids || ''),
      to_ids: String(r.to_ids || ''),
    })),
  });
}

export async function POST(request: NextRequest) {
  if (!ensureAdmin(request)) return NextResponse.json({ error: '需要管理员权限' }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  const batchId = String(body.batch_id || '').trim();
  if (!batchId) return NextResponse.json({ error: '缺少 batch_id' }, { status: 400 });

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    // 收集该批次涉及的运动员，回滚后重算其 race_times 缓存
    const [idRows] = await conn.execute<RowDataPacket[]>(
      `SELECT DISTINCT from_athlete_id AS aid FROM sup_athlete_merge_log WHERE batch_id = ? AND from_athlete_id IS NOT NULL
       UNION SELECT DISTINCT to_athlete_id AS aid FROM sup_athlete_merge_log WHERE batch_id = ? AND to_athlete_id IS NOT NULL`,
      [batchId, batchId]
    );
    const affected = idRows.map((r) => Number(r.aid)).filter((n) => Number.isInteger(n) && n > 0);

    const result = await rollbackBatch(conn, batchId);
    if (!result.restored) {
      await conn.rollback();
      return NextResponse.json({ error: '该批次不存在或已全部回滚' }, { status: 404 });
    }

    for (const aid of affected) {
      await syncAthleteRaceTimes(conn, aid);
    }

    await conn.commit();
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    await conn.rollback();
    console.error('身份治理回滚失败:', error);
    return NextResponse.json({ error: '回滚失败：' + (error instanceof Error ? error.message : '未知错误') }, { status: 500 });
  } finally {
    conn.release();
  }
}
