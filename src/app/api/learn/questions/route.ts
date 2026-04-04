import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import type { RowDataPacket } from 'mysql2';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const difficulty = searchParams.get('difficulty');
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 50);

    const conditions: string[] = ["status = 'published'"];
    const params: (string | number)[] = [];
    if (category) { conditions.push('category = ?'); params.push(category); }
    if (difficulty) { conditions.push('difficulty = ?'); params.push(difficulty); }
    const where = `WHERE ${conditions.join(' AND ')}`;

    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT question_id, question, type, options, correct, explanation, category, difficulty
       FROM sup_quiz_questions ${where}
       ORDER BY RAND() LIMIT ${limit}`,
      params
    );

    const questions = rows.map(q => ({
      ...q,
      options: Array.isArray(q.options) ? q.options : (q.options ? JSON.parse(String(q.options)) : []),
      correct: Array.isArray(q.correct) ? q.correct : (typeof q.correct === 'number' ? q.correct : JSON.parse(String(q.correct))),
    }));

    return NextResponse.json({ items: questions });
  } catch (error) {
    console.error('获取题目失败:', error);
    return NextResponse.json({ error: '获取题目失败' }, { status: 500 });
  }
}
