import { NextRequest, NextResponse } from 'next/server';
import { extractToken, verifyUserToken } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const token = extractToken(request.headers.get('authorization'));
  if (!token) return NextResponse.json({ error: '未登录' }, { status: 401 });
  const payload = verifyUserToken(token);
  if (!payload) return NextResponse.json({ error: 'Token 已过期，请重新登录' }, { status: 401 });
  return NextResponse.json({ user: { user_id: payload.user_id, nickname: payload.nickname, email: payload.email } });
}
