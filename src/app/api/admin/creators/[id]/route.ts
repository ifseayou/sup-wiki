/**
 * 管理员 - 博主管理 API
 * PUT /api/admin/creators/[id] - 编辑博主
 * DELETE /api/admin/creators/[id] - 删除博主
 */
import { NextRequest, NextResponse } from 'next/server';
import { extractToken, verifyToken, isAdmin } from '@/lib/auth';
import pool from '@/lib/db';
import type { ResultSetHeader } from 'mysql2';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
    const { id } = await params;
    const creatorId = parseInt(id);
    const body = await request.json();

    const fields: string[] = [];
    const values: (string | number | null)[] = [];

    const allowedFields = ['nickname', 'avatar', 'bio', 'platform', 'follower_tier', 'content_style', 'profile_url'];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        fields.push(`${field} = ?`);
        values.push(body[field]);
      }
    }

    if (fields.length === 0) {
      return NextResponse.json({ error: '没有要更新的字段' }, { status: 400 });
    }

    values.push(creatorId);

    const [result] = await pool.execute<ResultSetHeader>(
      `UPDATE sup_creators SET ${fields.join(', ')} WHERE creator_id = ?`,
      values
    );

    if (result.affectedRows === 0) {
      return NextResponse.json({ error: '博主不存在' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('更新博主失败:', error);
    return NextResponse.json({ error: '更新博主失败' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
    const { id } = await params;
    const creatorId = parseInt(id);

    const [result] = await pool.execute<ResultSetHeader>(
      'DELETE FROM sup_creators WHERE creator_id = ?',
      [creatorId]
    );

    if (result.affectedRows === 0) {
      return NextResponse.json({ error: '博主不存在' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('删除博主失败:', error);
    return NextResponse.json({ error: '删除博主失败' }, { status: 500 });
  }
}
