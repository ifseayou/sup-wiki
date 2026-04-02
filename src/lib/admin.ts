/**
 * 管理员权限验证工具
 */
import { NextRequest, NextResponse } from 'next/server';
import { extractToken, verifyToken, isAdmin } from './auth';
import type { AdminPayload } from './auth';

export interface AdminContext {
  payload: AdminPayload;
}

export type AdminHandler = (
  request: NextRequest,
  context: AdminContext
) => Promise<NextResponse>;

/**
 * 管理员权限验证包装器
 */
export function withAdmin(handler: AdminHandler) {
  return async (request: NextRequest): Promise<NextResponse> => {
    const authHeader = request.headers.get('authorization');
    const token = extractToken(authHeader);

    if (!token) {
      return NextResponse.json(
        { error: '请先登录' },
        { status: 401 }
      );
    }

    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json(
        { error: 'token 无效或已过期' },
        { status: 401 }
      );
    }

    if (!isAdmin(payload)) {
      return NextResponse.json(
        { error: '需要管理员权限' },
        { status: 403 }
      );
    }

    return handler(request, { payload });
  };
}
