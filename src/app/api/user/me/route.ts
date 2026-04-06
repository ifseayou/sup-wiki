import { NextRequest, NextResponse } from 'next/server';
import { extractToken, verifyUserToken } from '@/lib/auth';
import pool from '@/lib/db';
import type { RowDataPacket } from 'mysql2';

export async function GET(request: NextRequest) {
  const token = extractToken(request.headers.get('authorization'));
  if (!token) return NextResponse.json({ error: '未登录' }, { status: 401 });
  const payload = verifyUserToken(token);
  if (!payload) return NextResponse.json({ error: 'Token 已过期，请重新登录' }, { status: 401 });

  // 从数据库获取最新状态（包含 openid 关联状态）
  const [rows] = await pool.execute<RowDataPacket[]>(
    'SELECT user_id, nickname, email, openid FROM sup_users WHERE user_id = ?',
    [payload.user_id]
  );
  if (rows.length === 0) return NextResponse.json({ error: '用户不存在' }, { status: 404 });

  const u = rows[0] as { user_id: number; nickname: string; email: string; openid: string | null };
  return NextResponse.json({
    user: {
      user_id: u.user_id,
      nickname: u.nickname,
      email: u.email,
      has_sport_hacker: !!u.openid,  // 是否已关联运动骇客
    }
  });
}
