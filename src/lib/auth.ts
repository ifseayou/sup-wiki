/**
 * 认证工具库
 * 管理员密码登录 + JWT 管理
 */
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'sup-wiki-secret-key';
const JWT_EXPIRES_IN = '30d';

export interface AdminPayload {
  role: 'admin';
  iat: number;
  exp: number;
}

/**
 * 验证管理员密码并生成 JWT
 */
export function authenticateAdmin(password: string): string | null {
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
  if (password !== adminPassword) {
    return null;
  }
  return jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

/**
 * 生成管理员 JWT token（内部使用）
 */
export function generateAdminToken(): string {
  return jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

/**
 * 验证 JWT token
 */
export function verifyToken(token: string): AdminPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as AdminPayload;
  } catch {
    return null;
  }
}

/**
 * 从请求头提取 token
 */
export function extractToken(authHeader: string | null): string | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.slice(7);
}

/**
 * 检查是否是管理员
 */
export function isAdmin(payload: AdminPayload | null): boolean {
  return payload?.role === 'admin';
}

// 保持向后兼容的别名
export type JwtPayload = AdminPayload;
