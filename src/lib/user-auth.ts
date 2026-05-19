import { NextRequest, NextResponse } from 'next/server';
import { extractToken, verifyUserToken, type UserPayload } from '@/lib/auth';

export function getUserFromRequest(request: NextRequest): UserPayload | null {
  const token = extractToken(request.headers.get('authorization'));
  return token ? verifyUserToken(token) : null;
}

export function requireUser(request: NextRequest): UserPayload | NextResponse {
  const user = getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: '请先登录后查看成绩信息' }, { status: 401 });
  return user;
}
