/**
 * 管理员 - 运动员管理 API
 * POST /api/admin/athletes - 直接创建运动员
 */
import { NextRequest, NextResponse } from 'next/server';
import { extractToken, verifyToken, isAdmin } from '@/lib/auth';
import pool from '@/lib/db';
import type { ResultSetHeader } from 'mysql2';

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const token = extractToken(authHeader);

  if (!token) {
    return NextResponse.json({ error: '请先登录' }, { status: 401 });
  }

  const payload = verifyToken(token);
  if (!payload || !isAdmin(payload)) {
    return NextResponse.json({ error: '需要管理员权限' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { name, name_en, nationality, photo, bio, discipline, achievements, icf_ranking, social_links } = body;

    if (!name) {
      return NextResponse.json({ error: '缺少必填字段: name' }, { status: 400 });
    }

    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO sup_athletes
       (name, name_en, nationality, photo, bio, discipline, achievements, icf_ranking, social_links)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        name, name_en || null, nationality || null, photo || null, bio || null,
        discipline || 'race',
        achievements ? JSON.stringify(achievements) : null,
        icf_ranking || null,
        social_links ? JSON.stringify(social_links) : null
      ]
    );

    return NextResponse.json({
      success: true,
      athlete_id: result.insertId,
    });
  } catch (error) {
    console.error('创建运动员失败:', error);
    return NextResponse.json({ error: '创建运动员失败' }, { status: 500 });
  }
}
