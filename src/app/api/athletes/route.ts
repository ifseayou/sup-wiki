/**
 * 运动员列表 API
 * GET /api/athletes - 获取运动员列表（支持分页、筛选）
 */
import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import type { RowDataPacket } from 'mysql2';
import type { Athlete, Discipline, PaginatedResponse } from '@/types';

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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');
    const discipline = searchParams.get('discipline') as Discipline | null;
    const nationality = searchParams.get('nationality');
    const search = searchParams.get('search');
    const sort = searchParams.get('sort') || 'ranking'; // ranking, name, newest

    const offset = (page - 1) * pageSize;
    const conditions: string[] = ['status = "published"'];
    const params: (string | number)[] = [];

    if (discipline) {
      conditions.push('discipline = ?');
      params.push(discipline);
    }

    if (nationality) {
      conditions.push('nationality = ?');
      params.push(nationality);
    }

    if (search) {
      conditions.push('(name LIKE ? OR name_en LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // 排序
    let orderBy = 'COALESCE(icf_ranking, 9999) ASC, name ASC';
    if (sort === 'name') {
      orderBy = 'name ASC';
    } else if (sort === 'newest') {
      orderBy = 'created_at DESC';
    }

    // 获取总数
    const [countResult] = await pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) as total FROM sup_athletes ${whereClause}`,
      params
    );
    const total = countResult[0].total;

    // 获取运动员列表
    const [athletes] = await pool.execute<AthleteRow[]>(
      `SELECT * FROM sup_athletes ${whereClause} ORDER BY ${orderBy} LIMIT ${pageSize} OFFSET ${offset}`,
      params
    );

    const parseArr = (v: unknown) => Array.isArray(v) ? v : (v ? JSON.parse(String(v)) : []);
    const parseObj = (v: unknown) => (v && typeof v === 'object') ? v : (v ? JSON.parse(String(v)) : {});
    const parsedAthletes = athletes.map((a) => ({
      ...a,
      achievements: parseArr(a.achievements),
      social_links: parseObj(a.social_links),
    }));

    const response: PaginatedResponse<Athlete> = {
      items: parsedAthletes as unknown as Athlete[],
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('获取运动员列表失败:', error);
    return NextResponse.json(
      { error: '获取运动员列表失败' },
      { status: 500 }
    );
  }
}
