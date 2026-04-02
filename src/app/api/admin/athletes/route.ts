import { NextRequest, NextResponse } from 'next/server';
import { withAdmin } from '@/lib/admin';
import pool from '@/lib/db';
import type { RowDataPacket, ResultSetHeader } from 'mysql2';

export const GET = withAdmin(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');
    const offset = (page - 1) * pageSize;

    const conditions: string[] = [];
    const params: (string | number)[] = [];
    if (status) { conditions.push('status = ?'); params.push(status); }
    if (search) { conditions.push('(name LIKE ? OR name_en LIKE ?)'); params.push(`%${search}%`, `%${search}%`); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [countRows] = await pool.execute<RowDataPacket[]>(`SELECT COUNT(*) as total FROM sup_athletes ${where}`, params);
    const total = (countRows[0] as { total: number }).total;

    const [athletes] = await pool.execute<RowDataPacket[]>(
      `SELECT athlete_id, name, name_en, nationality, discipline, icf_ranking, status, updated_at FROM sup_athletes ${where} ORDER BY updated_at DESC LIMIT ${pageSize} OFFSET ${offset}`,
      params
    );
    return NextResponse.json({ items: athletes, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
  } catch (error) {
    console.error('获取运动员列表失败:', error);
    return NextResponse.json({ error: '获取运动员列表失败' }, { status: 500 });
  }
});

export const POST = withAdmin(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const { name, name_en, nationality, photo, bio, discipline, achievements, icf_ranking, social_links, status = 'draft' } = body;
    if (!name) return NextResponse.json({ error: '缺少必填字段: name' }, { status: 400 });

    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO sup_athletes (name, name_en, nationality, photo, bio, discipline, achievements, icf_ranking, social_links, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, name_en || null, nationality || null, photo || null, bio || null, discipline || 'race', achievements ? JSON.stringify(achievements) : null, icf_ranking || null, social_links ? JSON.stringify(social_links) : null, status]
    );
    return NextResponse.json({ success: true, athlete_id: result.insertId }, { status: 201 });
  } catch (error) {
    console.error('创建运动员失败:', error);
    return NextResponse.json({ error: '创建运动员失败' }, { status: 500 });
  }
});
