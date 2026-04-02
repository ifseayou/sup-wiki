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
    if (search) { conditions.push('nickname LIKE ?'); params.push(`%${search}%`); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [countRows] = await pool.execute<RowDataPacket[]>(`SELECT COUNT(*) as total FROM sup_creators ${where}`, params);
    const total = (countRows[0] as { total: number }).total;

    const [creators] = await pool.execute<RowDataPacket[]>(
      `SELECT creator_id, nickname, platform, follower_tier, content_style, status, updated_at FROM sup_creators ${where} ORDER BY updated_at DESC LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    );
    return NextResponse.json({ items: creators, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
  } catch (error) {
    console.error('获取博主列表失败:', error);
    return NextResponse.json({ error: '获取博主列表失败' }, { status: 500 });
  }
});

export const POST = withAdmin(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const { nickname, avatar, bio, platform, follower_tier, content_style, profile_url, status = 'draft' } = body;
    if (!nickname || !platform) return NextResponse.json({ error: '缺少必填字段: nickname, platform' }, { status: 400 });

    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO sup_creators (nickname, avatar, bio, platform, follower_tier, content_style, profile_url, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [nickname, avatar || null, bio || null, platform, follower_tier || '1k-10k', content_style || 'vlog', profile_url || null, status]
    );
    return NextResponse.json({ success: true, creator_id: result.insertId }, { status: 201 });
  } catch (error) {
    console.error('创建博主失败:', error);
    return NextResponse.json({ error: '创建博主失败' }, { status: 500 });
  }
});
