/**
 * 博主/KOL 列表 API
 * GET /api/creators - 获取博主列表（支持分页、筛选）
 */
import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import type { RowDataPacket } from 'mysql2';
import type { Creator, Platform, FollowerTier, ContentStyle, PaginatedResponse } from '@/types';

interface CreatorRow extends RowDataPacket {
  creator_id: number;
  nickname: string;
  avatar: string | null;
  bio: string | null;
  platform: string;
  follower_tier: string;
  content_style: string;
  profile_url: string | null;
  created_at: string;
  updated_at: string;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');
    const platform = searchParams.get('platform') as Platform | null;
    const follower_tier = searchParams.get('follower_tier') as FollowerTier | null;
    const content_style = searchParams.get('content_style') as ContentStyle | null;
    const search = searchParams.get('search');

    const offset = (page - 1) * pageSize;
    const conditions: string[] = ['status = "published"'];
    const params: (string | number)[] = [];

    if (platform) {
      conditions.push('platform = ?');
      params.push(platform);
    }

    if (follower_tier) {
      conditions.push('follower_tier = ?');
      params.push(follower_tier);
    }

    if (content_style) {
      conditions.push('content_style = ?');
      params.push(content_style);
    }

    if (search) {
      conditions.push('nickname LIKE ?');
      params.push(`%${search}%`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // 获取总数
    const [countResult] = await pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) as total FROM sup_creators ${whereClause}`,
      params
    );
    const total = countResult[0].total;

    // 粉丝量级排序映射
    const tierOrder = `CASE follower_tier
      WHEN '1m+' THEN 1
      WHEN '100k-1m' THEN 2
      WHEN '10k-100k' THEN 3
      WHEN '1k-10k' THEN 4
      ELSE 5
    END`;

    // 获取博主列表
    const [creators] = await pool.execute<CreatorRow[]>(
      `SELECT * FROM sup_creators ${whereClause} ORDER BY ${tierOrder} ASC, nickname ASC LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    );

    const response: PaginatedResponse<Creator> = {
      items: creators as unknown as Creator[],
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('获取博主列表失败:', error);
    return NextResponse.json(
      { error: '获取博主列表失败' },
      { status: 500 }
    );
  }
}
