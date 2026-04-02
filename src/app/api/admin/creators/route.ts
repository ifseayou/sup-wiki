/**
 * 管理员 - 博主管理 API
 * POST /api/admin/creators - 直接创建博主
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
    const { nickname, avatar, bio, platform, follower_tier, content_style, profile_url } = body;

    if (!nickname || !platform) {
      return NextResponse.json({ error: '缺少必填字段: nickname, platform' }, { status: 400 });
    }

    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO sup_creators
       (nickname, avatar, bio, platform, follower_tier, content_style, profile_url)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        nickname, avatar || null, bio || null, platform,
        follower_tier || '1k-10k', content_style || 'vlog', profile_url || null
      ]
    );

    return NextResponse.json({
      success: true,
      creator_id: result.insertId,
    });
  } catch (error) {
    console.error('创建博主失败:', error);
    return NextResponse.json({ error: '创建博主失败' }, { status: 500 });
  }
}
