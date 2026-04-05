import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { extractToken, verifyUserToken } from '@/lib/auth';
import type { RowDataPacket } from 'mysql2';

function auth(request: NextRequest) {
  const token = extractToken(request.headers.get('authorization'));
  if (!token) return null;
  return verifyUserToken(token);
}

// GET: 获取用户统计
export async function GET(request: NextRequest) {
  const user = auth(request);
  if (!user) return NextResponse.json({ error: '请先登录' }, { status: 401 });

  const [rows] = await pool.execute<RowDataPacket[]>(
    'SELECT total_attempted, total_correct FROM sup_quiz_user_stats WHERE user_id = ?',
    [user.user_id]
  );

  if (rows.length === 0) {
    return NextResponse.json({ total_attempted: 0, total_correct: 0, total_wrong: 0 });
  }

  const { total_attempted, total_correct } = rows[0] as { total_attempted: number; total_correct: number };
  return NextResponse.json({
    total_attempted,
    total_correct,
    total_wrong: total_attempted - total_correct,
  });
}

// POST: 更新用户统计（每轮答题结束后调用）
export async function POST(request: NextRequest) {
  const user = auth(request);
  if (!user) return NextResponse.json({ error: '请先登录' }, { status: 401 });

  const { attempted, correct } = await request.json();
  if (typeof attempted !== 'number' || typeof correct !== 'number') {
    return NextResponse.json({ error: '参数错误' }, { status: 400 });
  }

  await pool.execute(
    `INSERT INTO sup_quiz_user_stats (user_id, total_attempted, total_correct)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE
       total_attempted = total_attempted + VALUES(total_attempted),
       total_correct   = total_correct   + VALUES(total_correct)`,
    [user.user_id, attempted, correct]
  );

  const [rows] = await pool.execute<RowDataPacket[]>(
    'SELECT total_attempted, total_correct FROM sup_quiz_user_stats WHERE user_id = ?',
    [user.user_id]
  );
  const stat = rows[0] as { total_attempted: number; total_correct: number };
  return NextResponse.json({
    success: true,
    total_attempted: stat.total_attempted,
    total_correct: stat.total_correct,
    total_wrong: stat.total_attempted - stat.total_correct,
  });
}
