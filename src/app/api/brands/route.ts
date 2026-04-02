/**
 * 品牌列表 API
 * GET /api/brands - 获取品牌列表（支持分页、筛选）
 */
import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import type { RowDataPacket } from 'mysql2';
import type { Brand, BrandTier, PaginatedResponse } from '@/types';

interface BrandRow extends RowDataPacket, Omit<Brand, 'created_at' | 'updated_at'> {
  created_at: string;
  updated_at: string;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');
    const tier = searchParams.get('tier') as BrandTier | null;
    const country = searchParams.get('country');
    const search = searchParams.get('search');

    const offset = (page - 1) * pageSize;
    const conditions: string[] = [];
    const params: (string | number)[] = [];

    if (tier) {
      conditions.push('b.tier = ?');
      params.push(tier);
    }

    if (country) {
      conditions.push('b.country = ?');
      params.push(country);
    }

    if (search) {
      conditions.push('(b.name LIKE ? OR b.name_en LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // 获取总数
    const [countResult] = await pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) as total FROM sup_brands b ${whereClause}`,
      params
    );
    const total = countResult[0].total;

    // 获取品牌列表（含产品数量）
    const [brands] = await pool.execute<BrandRow[]>(
      `SELECT b.*, COUNT(p.product_id) as product_count
       FROM sup_brands b
       LEFT JOIN sup_products p ON b.brand_id = p.brand_id
       ${whereClause}
       GROUP BY b.brand_id
       ORDER BY b.name ASC
       LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    );

    const response: PaginatedResponse<Brand> = {
      items: brands as unknown as Brand[],
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('获取品牌列表失败:', error);
    return NextResponse.json(
      { error: '获取品牌列表失败' },
      { status: 500 }
    );
  }
}
