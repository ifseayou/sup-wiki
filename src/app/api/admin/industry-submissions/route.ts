import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { withAdmin } from '@/lib/admin';
import type { RowDataPacket } from 'mysql2';

function parseJsonArray(value: unknown) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  try {
    const parsed = JSON.parse(String(value));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function normalizeRow(row: RowDataPacket) {
  return {
    ...row,
    roles: parseJsonArray(row.roles),
    profile_images: parseJsonArray(row.profile_images),
    club_photos: parseJsonArray(row.club_photos),
    certificate_images: parseJsonArray(row.certificate_images),
    license_images: parseJsonArray(row.license_images),
  };
}

export const GET = withAdmin(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const type = searchParams.get('type');
    const search = searchParams.get('search')?.trim();
    const page = Math.max(1, Number(searchParams.get('page') || '1') || 1);
    const pageSize = Math.min(50, Math.max(1, Number(searchParams.get('pageSize') || '20') || 20));
    const offset = (page - 1) * pageSize;
    const conditions: string[] = [];
    const params: (string | number)[] = [];

    if (status) {
      conditions.push('s.status = ?');
      params.push(status);
    }
    if (type) {
      conditions.push('s.submission_type = ?');
      params.push(type);
    }
    if (search) {
      conditions.push('(s.name LIKE ? OR s.club_name LIKE ? OR u.nickname LIKE ? OR u.email LIKE ? OR a.name LIKE ?)');
      const like = `%${search}%`;
      params.push(like, like, like, like, like);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const [countRows] = await pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) AS total
       FROM sup_industry_submissions s
       LEFT JOIN sup_users u ON u.user_id = s.user_id
       LEFT JOIN sup_athletes a ON a.athlete_id = s.athlete_id
       ${where}`,
      params
    );
    const total = Number(countRows[0]?.total || 0);
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT s.*, u.nickname, u.email,
              a.name AS athlete_name, a.photo AS athlete_photo, a.province AS athlete_province, a.city AS athlete_city
       FROM sup_industry_submissions s
       LEFT JOIN sup_users u ON u.user_id = s.user_id
       LEFT JOIN sup_athletes a ON a.athlete_id = s.athlete_id
       ${where}
       ORDER BY FIELD(s.status, 'pending', 'reviewing', 'approved', 'rejected'), s.created_at DESC
       LIMIT ${pageSize} OFFSET ${offset}`,
      params
    );
    return NextResponse.json({
      items: rows.map(normalizeRow),
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    });
  } catch (error) {
    console.error('获取行业入驻提交失败:', error);
    return NextResponse.json({ error: '获取入驻提交失败' }, { status: 500 });
  }
});
