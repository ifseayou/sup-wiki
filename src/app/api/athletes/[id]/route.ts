/**
 * 运动员详情 API
 * GET /api/athletes/[id] - 获取运动员详情
 */
import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import type { RowDataPacket } from 'mysql2';

interface AthleteRow extends RowDataPacket {
  athlete_id: number;
  name: string;
  name_en: string | null;
  nationality: string | null;
  photo: string | null;
  bio: string | null;
  discipline: string;
  achievements: string | null;
  icf_ranking: number | null;
  social_links: string | null;
  created_at: string;
  updated_at: string;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const athleteId = parseInt(id);

    if (isNaN(athleteId)) {
      return NextResponse.json(
        { error: '无效的运动员 ID' },
        { status: 400 }
      );
    }

    const [athletes] = await pool.execute<AthleteRow[]>(
      "SELECT * FROM sup_athletes WHERE athlete_id = ? AND status = 'published'",
      [athleteId]
    );

    if (athletes.length === 0) {
      return NextResponse.json(
        { error: '运动员不存在' },
        { status: 404 }
      );
    }

    const athlete = athletes[0];

    const parseArr = (v: unknown) => Array.isArray(v) ? v : (v ? JSON.parse(String(v)) : []);
    const parseObj = (v: unknown) => (v && typeof v === 'object') ? v : (v ? JSON.parse(String(v)) : {});
    const result = {
      ...athlete,
      achievements: parseArr(athlete.achievements),
      social_links: parseObj(athlete.social_links),
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error('获取运动员详情失败:', error);
    return NextResponse.json(
      { error: '获取运动员详情失败' },
      { status: 500 }
    );
  }
}
