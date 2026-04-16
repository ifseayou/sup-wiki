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

  // 已刷题目 = 做过的不重复题目数（来自 sup_quiz_attempts）
  const [[uniqueRow], [wrongRow]] = await Promise.all([
    pool.execute<RowDataPacket[]>(
      'SELECT COUNT(*) as unique_attempted FROM sup_quiz_attempts WHERE user_id = ?',
      [user.user_id]
    ),
    pool.execute<RowDataPacket[]>(
      'SELECT COUNT(*) as wrong_count FROM sup_quiz_wrong_history WHERE user_id = ?',
      [user.user_id]
    ),
  ]);

  const unique_attempted = (uniqueRow[0] as { unique_attempted: number }).unique_attempted ?? 0;
  const wrong_count = (wrongRow[0] as { wrong_count: number }).wrong_count ?? 0;
  const total_correct = Math.max(0, unique_attempted - wrong_count);

  return NextResponse.json({
    total_attempted: unique_attempted,   // 已刷题目（唯一）
    total_correct,                        // 当前答对（唯一做过 - 当前错题）
    total_wrong: wrong_count,             // 当前错题库数量
  });
}

// POST: 更新用户统计（每轮答题结束后调用）
export async function POST(request: NextRequest) {
  const user = auth(request);
  if (!user) return NextResponse.json({ error: '请先登录' }, { status: 401 });

  const { attempted, correct, question_ids } = await request.json();
  if (typeof attempted !== 'number' || typeof correct !== 'number') {
    return NextResponse.json({ error: '参数错误' }, { status: 400 });
  }

  // 更新总统计
  await pool.execute(
    `INSERT INTO sup_quiz_user_stats (user_id, total_attempted, total_correct)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE
       total_attempted = total_attempted + VALUES(total_attempted),
       total_correct   = total_correct   + VALUES(total_correct)`,
    [user.user_id, attempted, correct]
  );

  // 记录每道题的做题次数（用于智能派题）
  if (Array.isArray(question_ids) && question_ids.length > 0) {
    const qids = question_ids.filter((id: unknown) => typeof id === 'number' && id > 0) as number[];
    if (qids.length > 0) {
      await pool.query(
        `INSERT INTO sup_quiz_attempts (user_id, question_id, attempt_count)
         VALUES ${qids.map(() => '(?,?,1)').join(',')}
         ON DUPLICATE KEY UPDATE attempt_count = attempt_count + 1, last_seen_at = NOW()`,
        qids.flatMap(qid => [user.user_id, qid])
      );
    }
  }

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
