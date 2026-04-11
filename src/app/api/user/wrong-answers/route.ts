import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { extractToken, verifyUserToken } from '@/lib/auth';
import type { RowDataPacket } from 'mysql2';

function auth(request: NextRequest) {
  const token = extractToken(request.headers.get('authorization'));
  if (!token) return null;
  return verifyUserToken(token);
}

// 获取错题 ID 列表
export async function GET(request: NextRequest) {
  const user = auth(request);
  if (!user) return NextResponse.json({ error: '请先登录' }, { status: 401 });

  const [rows] = await pool.execute<RowDataPacket[]>(
    'SELECT question_id, wrong_count FROM sup_quiz_wrong_history WHERE user_id = ? ORDER BY wrong_count DESC, last_wrong_at DESC',
    [user.user_id]
  );
  return NextResponse.json({ wrong_answers: rows });
}

// 答对后从错题库移除
export async function DELETE(request: NextRequest) {
  const user = auth(request);
  if (!user) return NextResponse.json({ error: '请先登录' }, { status: 401 });

  const { question_ids } = await request.json();
  if (!Array.isArray(question_ids) || question_ids.length === 0) {
    return NextResponse.json({ error: '缺少 question_ids' }, { status: 400 });
  }

  await pool.query(
    `DELETE FROM sup_quiz_wrong_history WHERE user_id = ? AND question_id IN (${question_ids.map(() => '?').join(',')})`,
    [user.user_id, ...question_ids]
  );
  return NextResponse.json({ success: true, removed: question_ids.length });
}

// 批量上报错题（答完一轮后调用）
export async function POST(request: NextRequest) {
  const user = auth(request);
  if (!user) return NextResponse.json({ error: '请先登录' }, { status: 401 });

  const { question_ids } = await request.json();
  if (!Array.isArray(question_ids) || question_ids.length === 0) {
    return NextResponse.json({ error: '缺少 question_ids' }, { status: 400 });
  }

  // 使用 INSERT ... ON DUPLICATE KEY UPDATE 批量 upsert
  const values = question_ids.map((qid: number) => [user.user_id, qid]);
  await pool.query(
    `INSERT INTO sup_quiz_wrong_history (user_id, question_id, wrong_count)
     VALUES ${values.map(() => '(?,?,1)').join(',')}
     ON DUPLICATE KEY UPDATE wrong_count = wrong_count + 1, last_wrong_at = NOW()`,
    values.flat()
  );

  return NextResponse.json({ success: true, recorded: question_ids.length });
}
