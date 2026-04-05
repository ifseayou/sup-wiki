import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { hashPassword, generateUserToken } from '@/lib/auth';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';

export async function POST(request: NextRequest) {
  try {
    const { nickname, email, password } = await request.json();
    if (!nickname || !email || !password) {
      return NextResponse.json({ error: '请填写昵称、邮箱和密码' }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ error: '密码至少6位' }, { status: 400 });
    }

    const passwordHash = hashPassword(password);
    try {
      const [result] = await pool.execute<ResultSetHeader>(
        'INSERT INTO sup_users (nickname, email, password_hash) VALUES (?, ?, ?)',
        [nickname.trim(), email.toLowerCase().trim(), passwordHash]
      );
      const user = { user_id: result.insertId, nickname: nickname.trim(), email: email.toLowerCase().trim() };
      const token = generateUserToken(user);
      return NextResponse.json({ success: true, token, user }, { status: 201 });
    } catch (err: unknown) {
      if ((err as { code?: string }).code === 'ER_DUP_ENTRY') {
        return NextResponse.json({ error: '该邮箱已注册' }, { status: 409 });
      }
      throw err;
    }
  } catch (error) {
    console.error('注册失败:', error);
    return NextResponse.json({ error: '注册失败' }, { status: 500 });
  }
}
