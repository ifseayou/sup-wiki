import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { extractToken, isAdmin, verifyToken } from '@/lib/auth';
import {
  generateBatchId,
  reassignAllByAthlete,
  reassignNameSnapshots,
  snapshotDeletedAthlete,
  type LogContext,
} from '@/lib/athlete-merge-log';
import { syncAthleteRaceTimes } from '@/lib/event-results';
import type { RowDataPacket } from 'mysql2';

function ensureAdmin(request: NextRequest) {
  const token = extractToken(request.headers.get('authorization'));
  const payload = token ? verifyToken(token) : null;
  return isAdmin(payload);
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ link_id: string }> }) {
  if (!ensureAdmin(request)) return NextResponse.json({ error: '需要管理员权限' }, { status: 403 });
  const { link_id } = await params;
  const lid = Number(link_id);
  if (!Number.isInteger(lid) || lid <= 0) return NextResponse.json({ error: '无效 link_id' }, { status: 400 });
  const body = await request.json().catch(() => ({}));
  const action = String(body.action || '');

  if (action === 'reject') {
    await pool.execute("UPDATE sup_athlete_identity_links SET status = 'rejected', updated_at = NOW() WHERE link_id = ?", [lid]);
    return NextResponse.json({ success: true });
  }
  if (action !== 'merge') return NextResponse.json({ error: '无效操作' }, { status: 400 });

  const keep = Number(body.keep_athlete_id);
  if (!Number.isInteger(keep) || keep <= 0) return NextResponse.json({ error: '请选择要保留的运动员' }, { status: 400 });
  const merges = Array.isArray(body.merge_athlete_ids)
    ? Array.from(new Set(body.merge_athlete_ids.map(Number).filter((n: number) => Number.isInteger(n) && n > 0 && n !== keep)))
    : [];

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [linkRows] = await conn.execute<RowDataPacket[]>('SELECT normalized_name FROM sup_athlete_identity_links WHERE link_id = ? LIMIT 1', [lid]);
    const norm = String(linkRows[0]?.normalized_name || '');
    const [keepRows] = await conn.execute<RowDataPacket[]>('SELECT athlete_id FROM sup_athletes WHERE athlete_id = ? LIMIT 1', [keep]);
    if (!keepRows.length) { await conn.rollback(); return NextResponse.json({ error: '保留的运动员不存在' }, { status: 404 }); }

    // 一次合并 = 一个 batch，可整批回滚（含被删草稿档案的重建）
    const batchId = generateBatchId('merge');
    const ctx: LogContext = { batchId, operation: 'merge', adminUserId: null, note: `merge link ${lid}` };

    // 1) 把每个被合并档案的成绩/积分/认领重指到 keep（逐行记日志）；草稿档案删除前先快照
    for (const m of merges as number[]) {
      const [statusRows] = await conn.execute<RowDataPacket[]>('SELECT status FROM sup_athletes WHERE athlete_id = ? LIMIT 1', [m]);
      const isDraft = statusRows.length > 0 && String(statusRows[0].status) === 'draft';
      if (isDraft) await snapshotDeletedAthlete(conn, m, keep, ctx);
      await reassignAllByAthlete(conn, m, keep, ctx);
      await conn.execute('DELETE FROM sup_athlete_profile_owners WHERE athlete_id = ?', [m]);
      await conn.execute('UPDATE sup_athlete_identity_links SET athlete_id = ? WHERE athlete_id = ?', [keep, m]);
      if (isDraft) await conn.execute("DELETE FROM sup_athletes WHERE athlete_id = ? AND status = 'draft'", [m]);
    }

    // 2) 回链「未关联 athlete_id 的同名快照成绩」→ keep（逐行记日志，from=NULL）
    await reassignNameSnapshots(conn, norm, keep, ctx);

    // 3) 确认本条 + 同名其它 pending 链接，并指向 keep
    await conn.execute("UPDATE sup_athlete_identity_links SET status = 'confirmed', athlete_id = ?, updated_at = NOW() WHERE link_id = ?", [keep, lid]);
    if (norm) {
      await conn.execute("UPDATE sup_athlete_identity_links SET status = 'confirmed', athlete_id = ?, updated_at = NOW() WHERE normalized_name = ? AND status = 'pending'", [keep, norm]);
    }

    // 4) 重算 keep 的 race_times 缓存
    await syncAthleteRaceTimes(conn, keep);

    await conn.commit();
    return NextResponse.json({ success: true, keep, merged: merges, batch_id: batchId });
  } catch (error) {
    await conn.rollback();
    console.error('运动员身份合并失败:', error);
    return NextResponse.json({ error: '合并失败：' + (error instanceof Error ? error.message : '未知错误') }, { status: 500 });
  } finally {
    conn.release();
  }
}
