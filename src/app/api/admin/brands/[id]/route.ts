/**
 * 管理员 - 品牌管理 API
 * PUT /api/admin/brands/[id] - 编辑品牌
 * DELETE /api/admin/brands/[id] - 删除品牌
 */
import { NextRequest, NextResponse } from 'next/server';
import { extractToken, verifyToken, isAdmin } from '@/lib/auth';
import pool from '@/lib/db';
import type { ResultSetHeader } from 'mysql2';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // 验证管理员权限
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
    const brandId = parseInt(id);
    const body = await request.json();

    const fields: string[] = [];
    const values: (string | number | null)[] = [];

    const allowedFields = ['slug', 'name', 'name_en', 'logo', 'country', 'website', 'description', 'tier'];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        fields.push(`${field} = ?`);
        values.push(body[field]);
      }
    }

    if (fields.length === 0) {
      return NextResponse.json({ error: '没有要更新的字段' }, { status: 400 });
    }

    values.push(brandId);

    const [result] = await pool.execute<ResultSetHeader>(
      `UPDATE sup_brands SET ${fields.join(', ')} WHERE brand_id = ?`,
      values
    );

    if (result.affectedRows === 0) {
      return NextResponse.json({ error: '品牌不存在' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('更新品牌失败:', error);
    return NextResponse.json({ error: '更新品牌失败' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // 验证管理员权限
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
    const brandId = parseInt(id);

    const [result] = await pool.execute<ResultSetHeader>(
      'DELETE FROM sup_brands WHERE brand_id = ?',
      [brandId]
    );

    if (result.affectedRows === 0) {
      return NextResponse.json({ error: '品牌不存在' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('删除品牌失败:', error);
    return NextResponse.json({ error: '删除品牌失败' }, { status: 500 });
  }
}
