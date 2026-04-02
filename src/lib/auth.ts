/**
 * 认证工具库
 * 微信登录 + JWT 管理
 */
import jwt from 'jsonwebtoken';
import axios from 'axios';
import pool from './db';
import type { JwtPayload, UserRole } from '@/types';
import type { RowDataPacket, ResultSetHeader } from 'mysql2';

const JWT_SECRET = process.env.JWT_SECRET || 'sup-wiki-secret-key';
const JWT_EXPIRES_IN = '7d';

const WX_APPID = process.env.WX_APPID || '';
const WX_SECRET = process.env.WX_SECRET || '';

interface WxSession {
  openid: string;
  session_key: string;
  unionid?: string;
  errcode?: number;
  errmsg?: string;
}

interface UserRow extends RowDataPacket {
  user_id: number;
  openid: string;
  nickname: string;
  avatar: string;
}

interface SupUserRow extends RowDataPacket {
  sup_user_id: number;
  user_id: number;
  role: UserRole;
}

/**
 * 微信 code 换取 openid
 */
export async function wxCode2Session(code: string): Promise<WxSession> {
  const url = `https://api.weixin.qq.com/sns/jscode2session?appid=${WX_APPID}&secret=${WX_SECRET}&js_code=${code}&grant_type=authorization_code`;
  const response = await axios.get<WxSession>(url);

  if (response.data.errcode) {
    throw new Error(`微信登录失败: ${response.data.errmsg}`);
  }

  return response.data;
}

/**
 * 根据 openid 获取或创建用户
 */
export async function getOrCreateUser(openid: string): Promise<{ user_id: number; sup_user_id: number; role: UserRole }> {
  // 查找 users 表中的用户
  const [users] = await pool.execute<UserRow[]>(
    'SELECT user_id, openid, nickname, avatar FROM users WHERE openid = ?',
    [openid]
  );

  let user_id: number;

  if (users.length > 0) {
    user_id = users[0].user_id;
  } else {
    // 在 users 表中创建新用户
    const [result] = await pool.execute<ResultSetHeader>(
      'INSERT INTO users (openid) VALUES (?)',
      [openid]
    );
    user_id = result.insertId;
  }

  // 查找 sup_wiki_users 表中的用户
  const [supUsers] = await pool.execute<SupUserRow[]>(
    'SELECT sup_user_id, user_id, role FROM sup_wiki_users WHERE user_id = ?',
    [user_id]
  );

  let sup_user_id: number;
  let role: UserRole = 'contributor';

  if (supUsers.length > 0) {
    sup_user_id = supUsers[0].sup_user_id;
    role = supUsers[0].role;
  } else {
    // 在 sup_wiki_users 表中创建记录
    const [result] = await pool.execute<ResultSetHeader>(
      'INSERT INTO sup_wiki_users (user_id, role) VALUES (?, ?)',
      [user_id, 'contributor']
    );
    sup_user_id = result.insertId;
  }

  return { user_id, sup_user_id, role };
}

/**
 * 生成 JWT token
 */
export function generateToken(user_id: number, sup_user_id: number, role: UserRole): string {
  return jwt.sign(
    { user_id, sup_user_id, role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

/**
 * 验证 JWT token
 */
export function verifyToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JwtPayload;
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
export function isAdmin(payload: JwtPayload | null): boolean {
  return payload?.role === 'admin';
}
