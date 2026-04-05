import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { extractToken, verifyUserToken } from '@/lib/auth';
import type { RowDataPacket, ResultSetHeader } from 'mysql2';

function auth(request: NextRequest) {
  const token = extractToken(request.headers.get('authorization'));
  if (!token) return null;
  return verifyUserToken(token);
}

// 获取我的收藏题目 ID 列表
export async function GET(request: NextRequest) {
  const user = auth(request);
  if (!user) return NextResponse.json({ error: '请先登录' }, { status: 401 });

  const [rows] = await pool.execute<RowDataPacket[]>(
    'SELECT question_id FROM sup_quiz_bookmarks WHERE user_id = ? ORDER BY created_at DESC',
    [user.user_id]
  );
  return NextResponse.json({ bookmarks: rows.map(r => r.question_id) });
}

// 切换收藏（已收藏则取消，未收藏则添加）
export async function POST(request: NextRequest) {
  const user = auth(request);
  if (!user) return NextResponse.json({ error: '请先登录' }, { status: 401 });

  const { question_id } = await request.json();
  if (!question_id) return NextResponse.json({ error: '缺少 question_id' }, { status: 400 });

  // 检查是否已收藏
  const [existing] = await pool.execute<RowDataPacket[]>(
    'SELECT bookmark_id FROM sup_quiz_bookmarks WHERE user_id = ? AND question_id = ?',
    [user.user_id, question_id]
  );

  if (existing.length > 0) {
    // 已收藏 → 取消
    await pool.execute('DELETE FROM sup_quiz_bookmarks WHERE user_id = ? AND question_id = ?', [user.user_id, question_id]);
    return NextResponse.json({ success: true, bookmarked: false });
  } else {
    // 未收藏 → 添加
    await pool.execute('INSERT INTO sup_quiz_bookmarks (user_id, question_id) VALUES (?, ?)', [user.user_id, question_id]);
    return NextResponse.json({ success: true, bookmarked: true });
  }
}
