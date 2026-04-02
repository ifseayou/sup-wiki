/**
 * 管理员 - 品牌管理 API
 * POST /api/admin/brands - 直接创建品牌
 */
import { NextRequest, NextResponse } from 'next/server';
import { extractToken, verifyToken, isAdmin } from '@/lib/auth';
import pool from '@/lib/db';
import type { ResultSetHeader } from 'mysql2';

export async function POST(request: NextRequest) {
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
    const body = await request.json();
    const { slug, name, name_en, logo, country, website, description, tier } = body;

    if (!slug || !name) {
      return NextResponse.json({ error: '缺少必填字段: slug, name' }, { status: 400 });
    }

    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO sup_brands (slug, name, name_en, logo, country, website, description, tier)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [slug, name, name_en || null, logo || null, country || null, website || null, description || null, tier || 'entry']
    );

    return NextResponse.json({
      success: true,
      brand_id: result.insertId,
    });
  } catch (error) {
    console.error('创建品牌失败:', error);
    return NextResponse.json({ error: '创建品牌失败' }, { status: 500 });
  }
}
