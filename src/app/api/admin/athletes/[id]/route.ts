/**
 * 管理员 - 运动员管理 API
 * PUT /api/admin/athletes/[id] - 编辑运动员
 * DELETE /api/admin/athletes/[id] - 删除运动员
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
    const athleteId = parseInt(id);
    const body = await request.json();

    const fields: string[] = [];
    const values: (string | number | null)[] = [];

    const allowedFields = ['name', 'name_en', 'nationality', 'photo', 'bio', 'discipline', 'icf_ranking'];
    const jsonFields = ['achievements', 'social_links'];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        fields.push(`${field} = ?`);
        values.push(body[field]);
      }
    }

    for (const field of jsonFields) {
      if (body[field] !== undefined) {
        fields.push(`${field} = ?`);
        values.push(body[field] ? JSON.stringify(body[field]) : null);
      }
    }

    if (fields.length === 0) {
      return NextResponse.json({ error: '没有要更新的字段' }, { status: 400 });
    }

    values.push(athleteId);

    const [result] = await pool.execute<ResultSetHeader>(
      `UPDATE sup_athletes SET ${fields.join(', ')} WHERE athlete_id = ?`,
      values
    );

    if (result.affectedRows === 0) {
      return NextResponse.json({ error: '运动员不存在' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('更新运动员失败:', error);
    return NextResponse.json({ error: '更新运动员失败' }, { status: 500 });
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
    const athleteId = parseInt(id);

    const [result] = await pool.execute<ResultSetHeader>(
      'DELETE FROM sup_athletes WHERE athlete_id = ?',
      [athleteId]
    );

    if (result.affectedRows === 0) {
      return NextResponse.json({ error: '运动员不存在' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('删除运动员失败:', error);
    return NextResponse.json({ error: '删除运动员失败' }, { status: 500 });
  }
}
