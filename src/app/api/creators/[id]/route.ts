/**
 * 博主/KOL 详情 API
 * GET /api/creators/[id] - 获取博主详情
 */
import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import type { RowDataPacket } from 'mysql2';

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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const creatorId = parseInt(id);

    if (isNaN(creatorId)) {
      return NextResponse.json(
        { error: '无效的博主 ID' },
        { status: 400 }
      );
    }

    const [creators] = await pool.execute<CreatorRow[]>(
      "SELECT * FROM sup_creators WHERE creator_id = ? AND status = 'published'",
      [creatorId]
    );

    if (creators.length === 0) {
      return NextResponse.json(
        { error: '博主不存在' },
        { status: 404 }
      );
    }

    return NextResponse.json(creators[0]);
  } catch (error) {
    console.error('获取博主详情失败:', error);
    return NextResponse.json(
      { error: '获取博主详情失败' },
      { status: 500 }
    );
  }
}
