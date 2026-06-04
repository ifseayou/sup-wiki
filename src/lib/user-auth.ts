import { NextRequest, NextResponse } from 'next/server';
import { extractToken, verifyUserToken, type UserPayload } from '@/lib/auth';

const INTERNAL_API_TOKEN = process.env.INTERNAL_API_TOKEN || '';

/**
 * 可信网关判定：sport_hacker 小程序 BFF 以服务身份调用内部 API 时，
 * 携带 X-Internal-Token（与 INTERNAL_API_TOKEN 一致）证明可信，
 * 由网关侧统一管理小程序登录态与配额，sup-wiki 内部 API 仅做数据与隐私口径。
 */
export function isInternalGatewayRequest(request: NextRequest): boolean {
  if (!INTERNAL_API_TOKEN) return false;
  const token = request.headers.get('x-internal-token');
  return Boolean(token) && token === INTERNAL_API_TOKEN;
}

/**
 * 网关透传的观看者身份（sup_users.user_id），用于按观看者做隐私脱敏。
 * 缺省时表示匿名观看者（无自有运动员）。
 */
export function getActingUserId(request: NextRequest): number | null {
  const raw = request.headers.get('x-acting-sup-user-id');
  if (!raw) return null;
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export function getUserFromRequest(request: NextRequest): UserPayload | null {
  // 可信网关：按 acting user 解析观看者，使隐私脱敏对"已认领自己运动员"的用户生效。
  if (isInternalGatewayRequest(request)) {
    const actingId = getActingUserId(request);
    if (!actingId) return null;
    return { role: 'user', user_id: actingId, nickname: '', email: '', iat: 0, exp: 0 };
  }
  const token = extractToken(request.headers.get('authorization'));
  return token ? verifyUserToken(token) : null;
}

export function requireUser(request: NextRequest): UserPayload | NextResponse {
  const user = getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: '请先登录后查看成绩信息' }, { status: 401 });
  return user;
}
