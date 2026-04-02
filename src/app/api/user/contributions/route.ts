/**
 * 我的贡献列表 API
 * GET /api/user/contributions - 获取当前用户的贡献历史
 */
import { NextRequest, NextResponse } from 'next/server';
import { extractToken, verifyToken } from '@/lib/auth';
import pool from '@/lib/db';
import type { RowDataPacket } from 'mysql2';
import type { ContributionStatus, PaginatedResponse } from '@/types';

interface ContributionRow extends RowDataPacket {
  contribution_id: number;
  sup_user_id: number;
  entity_type: string;
  entity_id: number | null;
  action: string;
  payload: string;
  status: string;
  review_note: string | null;
  reviewed_at: string | null;
  created_at: string;
}

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = extractToken(authHeader);

    if (!token) {
      return NextResponse.json(
        { error: '未登录' },
        { status: 401 }
      );
    }

    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json(
        { error: 'token 无效或已过期' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');
    const status = searchParams.get('status') as ContributionStatus | null;

    const offset = (page - 1) * pageSize;
    const conditions: string[] = ['sup_user_id = ?'];
    const params: (string | number)[] = [payload.sup_user_id];

    if (status) {
      conditions.push('status = ?');
      params.push(status);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    // 获取总数
    const [countResult] = await pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) as total FROM sup_contributions ${whereClause}`,
      params
    );
    const total = countResult[0].total;

    // 获取贡献列表
    const [contributions] = await pool.execute<ContributionRow[]>(
      `SELECT * FROM sup_contributions ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    );

    // 解析 JSON 字段
    const parsedContributions = contributions.map((c) => ({
      ...c,
      payload: JSON.parse(c.payload),
    }));

    const response: PaginatedResponse<ContributionRow> = {
      items: parsedContributions as unknown as ContributionRow[],
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('获取贡献列表失败:', error);
    return NextResponse.json(
      { error: '获取贡献列表失败' },
      { status: 500 }
    );
  }
}
