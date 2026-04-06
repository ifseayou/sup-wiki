import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import type { RowDataPacket } from 'mysql2';

const SELECT_FIELDS = `question_id, question, question_image, type, options, correct, explanation, explanation_image, category, difficulty`;

function parseQuestion(q: RowDataPacket) {
  return {
    ...q,
    options: Array.isArray(q.options) ? q.options : (q.options ? JSON.parse(String(q.options)) : []),
    correct: Array.isArray(q.correct) ? q.correct : (typeof q.correct === 'number' ? q.correct : JSON.parse(String(q.correct))),
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const difficulty = searchParams.get('difficulty');
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 50);
    const ids = searchParams.get('ids');

    const conditions: string[] = ["status = 'published'"];
    const params: (string | number)[] = [];

    if (ids) {
      const idList = ids.split(',').map(Number).filter(n => !isNaN(n) && n > 0);
      if (idList.length === 0) return NextResponse.json({ items: [] });
      conditions.push(`question_id IN (${idList.map(() => '?').join(',')})`);
      idList.forEach(id => params.push(id));
      const where = `WHERE ${conditions.join(' AND ')}`;
      const [rows] = await pool.execute<RowDataPacket[]>(`SELECT ${SELECT_FIELDS} FROM sup_quiz_questions ${where}`, params);
      return NextResponse.json({ items: rows.map(parseQuestion) });
    }

    if (category) { conditions.push('category = ?'); params.push(category); }
    if (difficulty) { conditions.push('difficulty = ?'); params.push(difficulty); }
    const where = `WHERE ${conditions.join(' AND ')}`;

    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT ${SELECT_FIELDS} FROM sup_quiz_questions ${where} ORDER BY RAND() LIMIT ${limit}`,
      params
    );
    return NextResponse.json({ items: rows.map(parseQuestion) });
  } catch (error) {
    console.error('获取题目失败:', error);
    return NextResponse.json({ error: '获取题目失败' }, { status: 500 });
  }
}
