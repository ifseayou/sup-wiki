/**
 * POST /api/user/link-account
 * 把当前已登录的邮箱账号与 sport_hacker 微信账号关联
 * Body: { code: "123456" }
 */
import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { extractToken, verifyUserToken } from '@/lib/auth';
import type { RowDataPacket } from 'mysql2';

const SPORT_HACKER_VERIFY = 'https://sport.iaddu.cn/api/sup-wiki/web-code/verify';

export async function POST(request: NextRequest) {
  // 1. 验证当前登录用户
  const token = extractToken(request.headers.get('authorization'));
  if (!token) return NextResponse.json({ error: '请先登录' }, { status: 401 });
  const currentUser = verifyUserToken(token);
  if (!currentUser) return NextResponse.json({ error: 'Token 已过期，请重新登录' }, { status: 401 });

  const { code } = await request.json();
  if (!code || !/^\d{6}$/.test(String(code))) {
    return NextResponse.json({ error: '请输入6位数字验证码' }, { status: 400 });
  }

  // 2. 调用 sport_hacker 验证
  let shOpenid: string;
  let shNickname: string;
  try {
    const res = await fetch(SPORT_HACKER_VERIFY, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: String(code) }),
      signal: AbortSignal.timeout(8000),
    });
    const data = await res.json();
    if (!res.ok || data.error) {
      return NextResponse.json({ error: data.error || '验证码无效或已过期' }, { status: 401 });
    }
    const userInfo = data.user || data;
    const shUserId = userInfo.user_id || userInfo.userId || userInfo.id;
    if (!shUserId) return NextResponse.json({ error: '验证失败，请重试' }, { status: 500 });
    shOpenid = `sh_${shUserId}`;
    shNickname = userInfo.nickname || '运动骇客用户';
  } catch {
    return NextResponse.json({ error: '验证服务暂时不可用' }, { status: 503 });
  }

  // 3. 检查该 openid 是否已被其他账号使用
  const [existing] = await pool.execute<RowDataPacket[]>(
    'SELECT user_id FROM sup_users WHERE openid = ? AND user_id != ?',
    [shOpenid, currentUser.user_id]
  );
  if (existing.length > 0) {
    return NextResponse.json({ error: '该运动骇客账号已关联了其他 SUP Wiki 账号' }, { status: 409 });
  }

  // 4. 检查当前账号是否已有 openid
  const [self] = await pool.execute<RowDataPacket[]>(
    'SELECT openid FROM sup_users WHERE user_id = ?',
    [currentUser.user_id]
  );
  if (self.length > 0 && (self[0] as { openid: string | null }).openid) {
    return NextResponse.json({ error: '您的账号已关联了运动骇客账号，如需更换请联系管理员' }, { status: 409 });
  }

  // 5. 关联
  await pool.execute(
    'UPDATE sup_users SET openid = ? WHERE user_id = ?',
    [shOpenid, currentUser.user_id]
  );

  return NextResponse.json({ success: true, message: `运动骇客账号（${shNickname}）已成功关联` });
}
