/**
 * 管理员 - 产品管理 API
 * POST /api/admin/products - 直接创建产品
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
    const {
      brand_id, model, type, length_cm, width_cm, thickness_cm,
      weight_kg, material, max_load_kg, suitable_for,
      price_min, price_max, buy_links, images, description
    } = body;

    if (!brand_id || !model) {
      return NextResponse.json({ error: '缺少必填字段: brand_id, model' }, { status: 400 });
    }

    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO sup_products
       (brand_id, model, type, length_cm, width_cm, thickness_cm, weight_kg, material, max_load_kg, suitable_for, price_min, price_max, buy_links, images, description)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        brand_id, model, type || 'allround',
        length_cm || null, width_cm || null, thickness_cm || null,
        weight_kg || null, material || null, max_load_kg || null,
        suitable_for || 'beginner', price_min || null, price_max || null,
        buy_links ? JSON.stringify(buy_links) : null,
        images ? JSON.stringify(images) : null,
        description || null
      ]
    );

    return NextResponse.json({
      success: true,
      product_id: result.insertId,
    });
  } catch (error) {
    console.error('创建产品失败:', error);
    return NextResponse.json({ error: '创建产品失败' }, { status: 500 });
  }
}
