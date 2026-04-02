/**
 * 当前用户信息 API
 * GET /api/user/me - 获取当前登录用户信息
 */
import { NextRequest, NextResponse } from 'next/server';
import { extractToken, verifyToken } from '@/lib/auth';
import pool from '@/lib/db';
import type { RowDataPacket } from 'mysql2';

interface UserRow extends RowDataPacket {
  user_id: number;
  nickname: string | null;
  avatar: string | null;
  sup_user_id: number;
  role: string;
}

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = extractToken(authHeader);

    if (!token) {
      return NextResponse.json(
        { error: '未登录' },
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

    // 获取用户详细信息
    const [users] = await pool.execute<UserRow[]>(
      `SELECT u.user_id, u.nickname, u.avatar, sw.sup_user_id, sw.role
       FROM users u
       JOIN sup_wiki_users sw ON u.user_id = sw.user_id
       WHERE u.user_id = ?`,
      [payload.user_id]
    );

    if (users.length === 0) {
      return NextResponse.json(
        { error: '用户不存在' },
        { status: 404 }
      );
    }

    return NextResponse.json(users[0]);
  } catch (error) {
    console.error('获取用户信息失败:', error);
    return NextResponse.json(
      { error: '获取用户信息失败' },
      { status: 500 }
    );
  }
}
