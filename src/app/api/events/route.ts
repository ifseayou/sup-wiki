import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import type { RowDataPacket } from 'mysql2';

interface EventRow extends RowDataPacket {
  event_id: number;
  name: string;
  name_en: string | null;
  slug: string;
  event_type: string;
  location: string | null;
  province: string | null;
  city: string | null;
  venue: string | null;
  start_date: string | null;
  end_date: string | null;
  registration_deadline: string | null;
  organizer: string | null;
  description: string | null;
  images: string | null;
  disciplines: string | null;
  price_range: string | null;
  star_level: string | null;
  score_coefficient: string | null;
  result_status: string | null;
  results_count: number;
  status: string;
  event_status: string;
  created_at: Date;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const event_type = searchParams.get('event_type');
    const province = searchParams.get('province');
    const event_status = searchParams.get('event_status');
    const year = searchParams.get('year');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');
    const offset = (page - 1) * pageSize;

    const conditions: string[] = ['status = "published"'];
    const params: (string | number)[] = [];

    if (event_type) {
      conditions.push('event_type = ?');
      params.push(event_type);
    }
    if (province) {
      conditions.push('province = ?');
      params.push(province);
    }
    if (event_status) {
      conditions.push('event_status = ?');
      params.push(event_status);
    }
    if (year) {
      conditions.push('YEAR(start_date) = ?');
      params.push(parseInt(year));
    }
    if (search) {
      conditions.push('(name LIKE ? OR organizer LIKE ? OR city LIKE ?)');
      const like = `%${search}%`;
      params.push(like, like, like);
    }

    const where = `WHERE ${conditions.join(' AND ')}`;

    const [countRows] = await pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) as total FROM sup_events ${where}`,
      params
    );
    const total = (countRows[0] as { total: number }).total;

    const [events] = await pool.execute<EventRow[]>(
      `SELECT event_id, name, name_en, slug, event_type, location, province, city, venue,
              start_date, end_date, registration_deadline, organizer, description,
              images, disciplines, price_range, star_level, score_coefficient, result_status,
              COALESCE(r.results_count, 0) AS results_count,
              status, event_status, created_at
       FROM sup_events
       LEFT JOIN (
         SELECT event_id, COUNT(*) AS results_count
         FROM sup_event_results
         GROUP BY event_id
       ) r ON r.event_id = sup_events.event_id
       ${where}
       ORDER BY
         CASE event_status WHEN 'ongoing' THEN 0 WHEN 'upcoming' THEN 1 WHEN 'completed' THEN 2 ELSE 3 END,
         start_date ASC
       LIMIT ${pageSize} OFFSET ${offset}`,
      params
    );

    const items = events.map(e => ({
      ...e,
      images: Array.isArray(e.images) ? e.images : (e.images ? JSON.parse(e.images) : []),
      disciplines: Array.isArray(e.disciplines) ? e.disciplines : (e.disciplines ? JSON.parse(e.disciplines) : []),
    }));

    return NextResponse.json({
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    console.error('获取赛事列表失败:', error);
    return NextResponse.json({ error: '获取赛事列表失败' }, { status: 500 });
  }
}
