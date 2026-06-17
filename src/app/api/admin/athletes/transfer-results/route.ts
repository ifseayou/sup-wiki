/**
 * 跨档案成绩迁移 / 拆分（Phase 3）
 * POST /api/admin/athletes/transfer-results
 * body: { from_athlete_id, to_athlete_id, result_ids?, note? }
 *   - 传 result_ids：仅迁移这些成绩(及团体成员行)（拆分用，operation=split）
 *   - 不传 result_ids：迁移 from 的全部成绩/积分/认领到 to（全量迁移，operation=transfer；不删档案）
 * 返回 { success, batch_id, moved }，batch_id 可用于回滚。
 */
import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { extractToken, isAdmin, verifyToken } from '@/lib/auth';
import { transferResults } from '@/lib/athlete-merge-log';
import { syncAthleteRaceTimes } from '@/lib/event-results';
import type { RowDataPacket } from 'mysql2';

function ensureAdmin(request: NextRequest) {
  const token = extractToken(request.headers.get('authorization'));
  const payload = token ? verifyToken(token) : null;
  return isAdmin(payload);
}

export async function POST(request: NextRequest) {
  if (!ensureAdmin(request)) return NextResponse.json({ error: '需要管理员权限' }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  const fromAthleteId = Number(body.from_athlete_id);
  const toAthleteId = Number(body.to_athlete_id);
  const note = body.note ? String(body.note).slice(0, 255) : null;
  const resultIds: number[] | null = Array.isArray(body.result_ids)
    ? Array.from(new Set(body.result_ids.map(Number).filter((n: number) => Number.isInteger(n) && n > 0))) as number[]
    : null;

  if (!Number.isInteger(fromAthleteId) || fromAthleteId <= 0) return NextResponse.json({ error: '无效 from_athlete_id' }, { status: 400 });
  if (!Number.isInteger(toAthleteId) || toAthleteId <= 0) return NextResponse.json({ error: '无效 to_athlete_id' }, { status: 400 });
  if (fromAthleteId === toAthleteId) return NextResponse.json({ error: '源与目标运动员不能相同' }, { status: 400 });

  const operation: 'transfer' | 'split' = resultIds && resultIds.length ? 'split' : 'transfer';

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [aths] = await conn.execute<RowDataPacket[]>(
      'SELECT athlete_id FROM sup_athletes WHERE athlete_id IN (?, ?)',
      [fromAthleteId, toAthleteId]
    );
    const found = new Set(aths.map((r) => Number(r.athlete_id)));
    if (!found.has(fromAthleteId) || !found.has(toAthleteId)) {
      await conn.rollback();
      return NextResponse.json({ error: '源或目标运动员不存在' }, { status: 404 });
    }

    const { batchId, moved } = await transferResults(conn, {
      fromAthleteId,
      toAthleteId,
      resultIds: resultIds && resultIds.length ? resultIds : null,
      operation,
      adminUserId: null,
      note,
    });

    await syncAthleteRaceTimes(conn, fromAthleteId);
    await syncAthleteRaceTimes(conn, toAthleteId);

    await conn.commit();
    return NextResponse.json({ success: true, operation, batch_id: batchId, moved });
  } catch (error) {
    await conn.rollback();
    console.error('成绩迁移失败:', error);
    return NextResponse.json({ error: '迁移失败：' + (error instanceof Error ? error.message : '未知错误') }, { status: 500 });
  } finally {
    conn.release();
  }
}
