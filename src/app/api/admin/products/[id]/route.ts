/**
 * 管理员 - 产品管理 API
 * PUT /api/admin/products/[id] - 编辑产品
 * DELETE /api/admin/products/[id] - 删除产品
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
    const productId = parseInt(id);
    const body = await request.json();

    const fields: string[] = [];
    const values: (string | number | null)[] = [];

    const allowedFields = [
      'brand_id', 'model', 'type', 'length_cm', 'width_cm', 'thickness_cm',
      'weight_kg', 'material', 'max_load_kg', 'suitable_for',
      'price_min', 'price_max', 'description'
    ];

    const jsonFields = ['buy_links', 'images'];

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

    values.push(productId);

    const [result] = await pool.execute<ResultSetHeader>(
      `UPDATE sup_products SET ${fields.join(', ')} WHERE product_id = ?`,
      values
    );

    if (result.affectedRows === 0) {
      return NextResponse.json({ error: '产品不存在' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('更新产品失败:', error);
    return NextResponse.json({ error: '更新产品失败' }, { status: 500 });
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
    const productId = parseInt(id);

    const [result] = await pool.execute<ResultSetHeader>(
      'DELETE FROM sup_products WHERE product_id = ?',
      [productId]
    );

    if (result.affectedRows === 0) {
      return NextResponse.json({ error: '产品不存在' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('删除产品失败:', error);
    return NextResponse.json({ error: '删除产品失败' }, { status: 500 });
  }
}
