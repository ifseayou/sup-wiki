import { NextRequest, NextResponse } from 'next/server';
import { withAdmin } from '@/lib/admin';
import pool from '@/lib/db';
import type { RowDataPacket, ResultSetHeader } from 'mysql2';

// 黑名单 = sup_privacy_requests 里 request_type='admin_blacklist' 的活跃行（复用隐私脱敏基建）。
// 加入：保留名次但隐去姓名（buildPrivacyMap 把 admin_blacklist 作为 sticky hidden）。
const ACTIVE = "status IN ('approved', 'completed')";

async function isBlacklisted(athleteId: number): Promise<boolean> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT 1 FROM sup_privacy_requests
      WHERE target_type='athlete' AND target_id=? AND request_type='admin_blacklist' AND ${ACTIVE}
      LIMIT 1`,
    [athleteId]
  );
  return rows.length > 0;
}

// GET ?search=王璐 → 搜索运动员（含是否已在黑名单）；无 search → 列出当前黑名单成员
export const GET = withAdmin(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const search = (searchParams.get('search') || '').trim();
    if (search) {
      const like = `%${search}%`;
      const [rows] = await pool.execute<RowDataPacket[]>(
        `SELECT a.athlete_id, a.name, a.name_en, a.nationality, a.province, a.city,
                (SELECT COUNT(*) FROM sup_event_results er WHERE er.athlete_id = a.athlete_id) AS result_count,
                EXISTS(
                  SELECT 1 FROM sup_privacy_requests pr
                   WHERE pr.target_type='athlete' AND pr.target_id=a.athlete_id
                     AND pr.request_type='admin_blacklist' AND pr.${ACTIVE}
                ) AS blacklisted
           FROM sup_athletes a
          WHERE a.name LIKE ? OR a.name_en LIKE ?
          ORDER BY a.athlete_id ASC
          LIMIT 50`,
        [like, like]
      );
      return NextResponse.json({ mode: 'search', items: rows.map(normalizeRow) });
    }
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT a.athlete_id, a.name, a.name_en, a.nationality, a.province, a.city,
              (SELECT COUNT(*) FROM sup_event_results er WHERE er.athlete_id = a.athlete_id) AS result_count,
              MIN(pr.handled_at) AS blacklisted_at
         FROM sup_privacy_requests pr
         JOIN sup_athletes a ON a.athlete_id = pr.target_id
        WHERE pr.target_type='athlete' AND pr.request_type='admin_blacklist' AND pr.${ACTIVE}
        GROUP BY a.athlete_id, a.name, a.name_en, a.nationality, a.province, a.city
        ORDER BY blacklisted_at DESC`,
      []
    );
    return NextResponse.json({ mode: 'list', items: rows.map((r) => ({ ...normalizeRow(r), blacklisted: true })) });
  } catch (error) {
    console.error('黑名单查询失败:', error);
    return NextResponse.json({ error: '加载失败' }, { status: 500 });
  }
});

// POST {athlete_id} → 加入黑名单
export const POST = withAdmin(async (request: NextRequest) => {
  try {
    const body = await request.json().catch(() => ({}));
    const athleteId = Number(body.athlete_id);
    if (!Number.isInteger(athleteId) || athleteId <= 0) {
      return NextResponse.json({ error: '缺少运动员 ID' }, { status: 400 });
    }
    const [exists] = await pool.execute<RowDataPacket[]>('SELECT name FROM sup_athletes WHERE athlete_id = ? LIMIT 1', [athleteId]);
    if (!exists.length) return NextResponse.json({ error: '运动员不存在' }, { status: 404 });
    if (await isBlacklisted(athleteId)) {
      return NextResponse.json({ success: true, already: true, athlete_id: athleteId });
    }
    const [ins] = await pool.execute<ResultSetHeader>(
      `INSERT INTO sup_privacy_requests
        (nickname, request_type, target_type, target_id, athlete_id, description, status, handler_name, handler_note, handled_at)
       VALUES ('管理员', 'admin_blacklist', 'athlete', ?, ?, '后台加入隐私黑名单（应本人删除要求，隐去姓名保留名次）', 'completed', '管理员', '后台黑名单管理', NOW())`,
      [athleteId, athleteId]
    );
    return NextResponse.json({ success: true, athlete_id: athleteId, request_id: ins.insertId });
  } catch (error) {
    console.error('加入黑名单失败:', error);
    return NextResponse.json({ error: '操作失败' }, { status: 500 });
  }
});

// DELETE {athlete_id} → 移出黑名单（把活跃 admin_blacklist 行置 rejected，立即解除脱敏）
export const DELETE = withAdmin(async (request: NextRequest) => {
  try {
    const body = await request.json().catch(() => ({}));
    const athleteId = Number(body.athlete_id);
    if (!Number.isInteger(athleteId) || athleteId <= 0) {
      return NextResponse.json({ error: '缺少运动员 ID' }, { status: 400 });
    }
    await pool.execute(
      `UPDATE sup_privacy_requests
          SET status='rejected', handler_name='管理员', handler_note='后台移出隐私黑名单', handled_at=NOW()
        WHERE target_type='athlete' AND target_id=? AND request_type='admin_blacklist' AND ${ACTIVE}`,
      [athleteId]
    );
    return NextResponse.json({ success: true, athlete_id: athleteId });
  } catch (error) {
    console.error('移出黑名单失败:', error);
    return NextResponse.json({ error: '操作失败' }, { status: 500 });
  }
});

function normalizeRow(r: RowDataPacket) {
  return {
    athlete_id: Number(r.athlete_id),
    name: r.name || '',
    name_en: r.name_en || '',
    nationality: r.nationality || '',
    region: [r.province, r.city].filter(Boolean).join(' ') || '',
    result_count: Number(r.result_count || 0),
    blacklisted: Boolean(r.blacklisted),
    blacklisted_at: r.blacklisted_at || null,
  };
}
