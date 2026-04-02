/**
 * 微信登录 API
 * POST /api/auth/wx-login - 微信小程序登录
 */
import { NextRequest, NextResponse } from 'next/server';
import { wxCode2Session, getOrCreateUser, generateToken } from '@/lib/auth';
import pool from '@/lib/db';
import type { RowDataPacket } from 'mysql2';

interface UserRow extends RowDataPacket {
  nickname: string | null;
  avatar: string | null;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code, nickname, avatar } = body;

    if (!code) {
      return NextResponse.json(
        { error: '缺少 code 参数' },
        { status: 400 }
      );
    }

    // 微信 code 换取 openid
    const wxSession = await wxCode2Session(code);
    const { openid } = wxSession;

    // 获取或创建用户
    const { user_id, sup_user_id, role } = await getOrCreateUser(openid);

    // 更新用户信息（如果提供了昵称和头像）
    if (nickname || avatar) {
      const updates: string[] = [];
      const params: (string | number)[] = [];

      if (nickname) {
        updates.push('nickname = ?');
        params.push(nickname);
      }

      if (avatar) {
        updates.push('avatar = ?');
        params.push(avatar);
      }

      if (updates.length > 0) {
        params.push(user_id);
        await pool.execute(
          `UPDATE users SET ${updates.join(', ')} WHERE user_id = ?`,
          params
        );
      }
    }

    // 获取完整用户信息
    const [users] = await pool.execute<UserRow[]>(
      'SELECT nickname, avatar FROM users WHERE user_id = ?',
      [user_id]
    );

    // 生成 JWT
    const token = generateToken(user_id, sup_user_id, role);

    return NextResponse.json({
      token,
      user: {
        user_id,
        sup_user_id,
        role,
        nickname: users[0]?.nickname || null,
        avatar: users[0]?.avatar || null,
      },
    });
  } catch (error) {
    console.error('微信登录失败:', error);
    return NextResponse.json(
      { error: '登录失败: ' + (error instanceof Error ? error.message : '未知错误') },
      { status: 500 }
    );
  }
}
