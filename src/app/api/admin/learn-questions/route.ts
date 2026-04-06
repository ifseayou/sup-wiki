import { NextRequest, NextResponse } from 'next/server';
import { withAdmin } from '@/lib/admin';
import pool from '@/lib/db';
import type { RowDataPacket, ResultSetHeader } from 'mysql2';

export const GET = withAdmin(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const difficulty = searchParams.get('difficulty');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');
    const offset = (page - 1) * pageSize;

    const conditions: string[] = [];
    const params: (string | number)[] = [];
    if (category) { conditions.push('category = ?'); params.push(category); }
    if (difficulty) { conditions.push('difficulty = ?'); params.push(difficulty); }
    if (search) { conditions.push('question LIKE ?'); params.push(`%${search}%`); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [countRows] = await pool.execute<RowDataPacket[]>(`SELECT COUNT(*) as total FROM sup_quiz_questions ${where}`, params);
    const total = (countRows[0] as { total: number }).total;

    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT * FROM sup_quiz_questions ${where} ORDER BY category, difficulty, question_id LIMIT ${pageSize} OFFSET ${offset}`,
      params
    );
    return NextResponse.json({ items: rows, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
  } catch (error) {
    console.error('获取题目失败:', error);
    return NextResponse.json({ error: '获取题目失败' }, { status: 500 });
  }
});

export const POST = withAdmin(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const { question, question_image, type = 'single', options, correct, explanation, explanation_image, category, difficulty = 'beginner', status = 'published' } = body;
    if (!question || !category || correct === undefined) {
      return NextResponse.json({ error: '缺少必填字段' }, { status: 400 });
    }
    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO sup_quiz_questions (question, question_image, type, options, correct, explanation, explanation_image, category, difficulty, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [question, question_image || null, type, JSON.stringify(options || []), JSON.stringify(correct), explanation || null, explanation_image || null, category, difficulty, status]
    );
    return NextResponse.json({ success: true, question_id: result.insertId }, { status: 201 });
  } catch (error) {
    console.error('创建题目失败:', error);
    return NextResponse.json({ error: '创建题目失败' }, { status: 500 });
  }
});
