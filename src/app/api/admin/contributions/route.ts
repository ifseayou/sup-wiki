/**
 * 管理员 - 待审核贡献列表 API
 * GET /api/admin/contributions - 获取待审核的贡献列表
 */
import { NextRequest, NextResponse } from 'next/server';
import { extractToken, verifyToken, isAdmin } from '@/lib/auth';
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
  user_nickname: string | null;
  user_avatar: string | null;
}

export async function GET(request: NextRequest) {
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
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');
    const status = searchParams.get('status') as ContributionStatus | null;
    const entityType = searchParams.get('entity_type');

    const offset = (page - 1) * pageSize;
    const conditions: string[] = [];
    const params: (string | number)[] = [];

    if (status) {
      conditions.push('c.status = ?');
      params.push(status);
    } else {
      // 默认显示待审核
      conditions.push('c.status = ?');
      params.push('pending');
    }

    if (entityType) {
      conditions.push('c.entity_type = ?');
      params.push(entityType);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // 获取总数
    const [countResult] = await pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) as total
       FROM sup_contributions c
       JOIN sup_wiki_users sw ON c.sup_user_id = sw.sup_user_id
       ${whereClause}`,
      params
    );
    const total = countResult[0].total;

    // 获取贡献列表（含用户信息）
    const [contributions] = await pool.execute<ContributionRow[]>(
      `SELECT c.*, u.nickname as user_nickname, u.avatar as user_avatar
       FROM sup_contributions c
       JOIN sup_wiki_users sw ON c.sup_user_id = sw.sup_user_id
       JOIN users u ON sw.user_id = u.user_id
       ${whereClause}
       ORDER BY c.created_at DESC
       LIMIT ? OFFSET ?`,
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
