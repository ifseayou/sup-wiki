import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { extractToken, verifyUserToken } from '@/lib/auth';
import type { RowDataPacket } from 'mysql2';

// GET: 每个分类的总题数 + 当前用户已刷题数
export async function GET(request: NextRequest) {
  // 总题数（无需登录）
  const [totalRows] = await pool.execute<RowDataPacket[]>(
    `SELECT category, COUNT(*) as total
     FROM sup_quiz_questions
     WHERE status = 'published'
     GROUP BY category`
  );
  const totals: Record<string, number> = {};
  for (const row of totalRows) {
    totals[(row as { category: string; total: number }).category] = (row as { category: string; total: number }).total;
  }

  // 已刷题数（需登录）
  const attempted: Record<string, number> = {};
  const token = extractToken(request.headers.get('authorization'));
  if (token) {
    const user = verifyUserToken(token);
    if (user) {
      const [attemptRows] = await pool.execute<RowDataPacket[]>(
        `SELECT q.category, COUNT(*) as attempted
         FROM sup_quiz_attempts a
         JOIN sup_quiz_questions q ON a.question_id = q.question_id
         WHERE a.user_id = ? AND a.attempt_count > 0
         GROUP BY q.category`,
        [user.user_id]
      );
      for (const row of attemptRows) {
        attempted[(row as { category: string; attempted: number }).category] = (row as { category: string; attempted: number }).attempted;
      }
    }
  }

  return NextResponse.json({ totals, attempted });
}
