import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { hashPassword, generateUserToken } from '@/lib/auth';
import { normalizeUserLevel } from '@/lib/user-levels';
import type { RowDataPacket } from 'mysql2';

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();
    if (!email || !password) {
      return NextResponse.json({ error: '请填写邮箱和密码' }, { status: 400 });
    }

    const passwordHash = hashPassword(password);
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT user_id, nickname, email, status, user_level, daily_result_query_limit FROM sup_users WHERE email = ? AND password_hash = ?',
      [email.toLowerCase().trim(), passwordHash]
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: '邮箱或密码错误' }, { status: 401 });
    }

    if (rows[0].status === 'blocked') {
      return NextResponse.json({ error: '账号已被限制' }, { status: 403 });
    }

    await pool.execute('UPDATE sup_users SET last_login_at = NOW() WHERE user_id = ?', [rows[0].user_id]);

    const user = rows[0] as { user_id: number; nickname: string; email: string; user_level?: string; daily_result_query_limit?: number | null };
    const token = generateUserToken(user);
    return NextResponse.json({
      success: true,
      token,
      user: {
        user_id: user.user_id,
        nickname: user.nickname,
        email: user.email,
        user_level: normalizeUserLevel(user.user_level),
        daily_result_query_limit: user.daily_result_query_limit ?? null,
      },
    });
  } catch (error) {
    console.error('登录失败:', error);
    return NextResponse.json({ error: '登录失败' }, { status: 500 });
  }
}
