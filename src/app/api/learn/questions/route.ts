import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { extractToken, verifyUserToken } from '@/lib/auth';
import type { RowDataPacket } from 'mysql2';

const SELECT_FIELDS = `q.question_id, q.question, q.question_image, q.type, q.options, q.correct, q.explanation, q.explanation_image, q.category, q.difficulty`;

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
    const category  = searchParams.get('category');
    const difficulty = searchParams.get('difficulty');
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 50);
    const ids = searchParams.get('ids');

    // 尝试提取登录用户（可选，未登录降级为随机派题）
    const rawToken = extractToken(request.headers.get('authorization'));
    const user = rawToken ? verifyUserToken(rawToken) : null;

    // ── 按 ID 精确获取（书签/错题复习）──
    if (ids) {
      const idList = ids.split(',').map(Number).filter(n => !isNaN(n) && n > 0);
      if (idList.length === 0) return NextResponse.json({ items: [] });
      const [rows] = await pool.execute<RowDataPacket[]>(
        `SELECT ${SELECT_FIELDS} FROM sup_quiz_questions q
         WHERE q.status = 'published' AND q.question_id IN (${idList.map(() => '?').join(',')})`,
        idList
      );
      return NextResponse.json({ items: rows.map(parseQuestion) });
    }

    // ── 构建 WHERE 过滤条件 ──
    const conditions: string[] = ["q.status = 'published'"];
    const filterParams: (string | number)[] = [];
    if (category)   { conditions.push('q.category = ?');   filterParams.push(category); }
    if (difficulty) { conditions.push('q.difficulty = ?'); filterParams.push(difficulty); }
    const where = `WHERE ${conditions.join(' AND ')}`;

    let rows: RowDataPacket[];

    if (user) {
      // 已登录：按做题次数升序（做过越少越优先），同次数随机
      // JOIN 参数在前，WHERE 过滤参数在后
      [rows] = await pool.execute<RowDataPacket[]>(
        `SELECT ${SELECT_FIELDS}, COALESCE(a.attempt_count, 0) AS attempt_count
         FROM sup_quiz_questions q
         LEFT JOIN sup_quiz_attempts a
           ON q.question_id = a.question_id AND a.user_id = ?
         ${where}
         ORDER BY COALESCE(a.attempt_count, 0) ASC, RAND()
         LIMIT ${limit}`,
        [user.user_id, ...filterParams]
      );
    } else {
      // 未登录：纯随机
      [rows] = await pool.execute<RowDataPacket[]>(
        `SELECT ${SELECT_FIELDS} FROM sup_quiz_questions q ${where} ORDER BY RAND() LIMIT ${limit}`,
        filterParams
      );
    }

    return NextResponse.json({ items: rows.map(parseQuestion) });
  } catch (error) {
    console.error('获取题目失败:', error);
    return NextResponse.json({ error: '获取题目失败' }, { status: 500 });
  }
}
