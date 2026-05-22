import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { extractToken, isAdmin, verifyToken } from '@/lib/auth';

const LEVELS = new Set(['free', 'verified_athlete', 'trusted', 'blocked']);
const STATUSES = new Set(['active', 'blocked']);

function ensureAdmin(request: NextRequest) {
  const token = extractToken(request.headers.get('authorization'));
  const payload = token ? verifyToken(token) : null;
  return isAdmin(payload);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!ensureAdmin(request)) return NextResponse.json({ error: '需要管理员权限' }, { status: 403 });

  const { id } = await params;
  const userId = Number(id);
  if (!Number.isInteger(userId) || userId <= 0) {
    return NextResponse.json({ error: '无效用户 ID' }, { status: 400 });
  }

  try {
    const body = await request.json();
    const level = String(body.user_level || 'free');
    const status = String(body.status || 'active');
    if (!LEVELS.has(level) || !STATUSES.has(status)) {
      return NextResponse.json({ error: '用户等级或状态不合法' }, { status: 400 });
    }

    const rawLimit = body.daily_result_query_limit;
    const limit = rawLimit === '' || rawLimit === null || rawLimit === undefined
      ? null
      : Math.max(0, Math.min(10000, Number(rawLimit) || 0));
    const adminNote = String(body.admin_note || '').trim() || null;

    await pool.execute(
      `UPDATE sup_users
       SET user_level = ?, status = ?, daily_result_query_limit = ?, admin_note = ?
       WHERE user_id = ?`,
      [level, status, limit, adminNote, userId]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('更新用户失败:', error);
    return NextResponse.json({ error: '更新用户失败' }, { status: 500 });
  }
}
