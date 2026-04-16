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
      // 已登录：优先派从未做过的题（attempt_count=0 或无记录）
      // 若未做过的题不足 limit，再补充已做过的（按做题次数升序）
      const [undonRows] = await pool.execute<RowDataPacket[]>(
        `SELECT ${SELECT_FIELDS}
         FROM sup_quiz_questions q
         LEFT JOIN sup_quiz_attempts a
           ON q.question_id = a.question_id AND a.user_id = ?
         ${where}
           AND (a.attempt_count IS NULL OR a.attempt_count = 0)
         ORDER BY RAND()
         LIMIT ${limit}`,
        [user.user_id, ...filterParams]
      );

      if (undonRows.length >= limit) {
        rows = undonRows;
      } else {
        // 未做过的题不够，补充已做过的（做得少的优先）
        const remain = limit - undonRows.length;
        const [doneRows] = await pool.execute<RowDataPacket[]>(
          `SELECT ${SELECT_FIELDS}, a.attempt_count
           FROM sup_quiz_questions q
           JOIN sup_quiz_attempts a
             ON q.question_id = a.question_id AND a.user_id = ?
           ${where}
             AND a.attempt_count > 0
           ORDER BY a.attempt_count ASC, RAND()
           LIMIT ${remain}`,
          [user.user_id, ...filterParams]
        );
        rows = [...undonRows, ...doneRows];
        // 混合后再随机打散顺序
        rows = rows.sort(() => Math.random() - 0.5);
      }
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
