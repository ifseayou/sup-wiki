import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { hashPassword, generateUserToken } from '@/lib/auth';
import type { RowDataPacket } from 'mysql2';

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();
    if (!email || !password) {
      return NextResponse.json({ error: '请填写邮箱和密码' }, { status: 400 });
    }

    const passwordHash = hashPassword(password);
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT user_id, nickname, email FROM sup_users WHERE email = ? AND password_hash = ?',
      [email.toLowerCase().trim(), passwordHash]
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: '邮箱或密码错误' }, { status: 401 });
    }

    const user = rows[0] as { user_id: number; nickname: string; email: string };
    const token = generateUserToken(user);
    return NextResponse.json({ success: true, token, user });
  } catch (error) {
    console.error('登录失败:', error);
    return NextResponse.json({ error: '登录失败' }, { status: 500 });
  }
}
