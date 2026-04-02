import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { withAdmin } from '@/lib/admin';
import type { RowDataPacket, ResultSetHeader } from 'mysql2';

interface EventRow extends RowDataPacket {
  event_id: number;
  name: string;
  slug: string;
  event_type: string;
  province: string | null;
  city: string | null;
  start_date: string | null;
  end_date: string | null;
  organizer: string | null;
  status: string;
  event_status: string;
  created_at: Date;
  updated_at: Date;
}

export const GET = withAdmin(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const event_type = searchParams.get('event_type');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');
    const offset = (page - 1) * pageSize;

    const conditions: string[] = [];
    const params: (string | number)[] = [];

    if (status) { conditions.push('status = ?'); params.push(status); }
    if (event_type) { conditions.push('event_type = ?'); params.push(event_type); }
    if (search) {
      conditions.push('(name LIKE ? OR organizer LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const [countRows] = await pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) as total FROM sup_events ${where}`, params
    );
    const total = (countRows[0] as { total: number }).total;

    const [events] = await pool.execute<EventRow[]>(
      `SELECT event_id, name, slug, event_type, province, city, start_date, end_date,
              organizer, status, event_status, created_at, updated_at
       FROM sup_events ${where}
       ORDER BY created_at DESC LIMIT ${pageSize} OFFSET ${offset}`,
      params
    );

    return NextResponse.json({ items: events, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
  } catch (error) {
    console.error('获取赛事列表失败:', error);
    return NextResponse.json({ error: '获取赛事列表失败' }, { status: 500 });
  }
});

export const POST = withAdmin(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const {
      name, name_en, slug, event_type, location, province, city, venue,
      start_date, end_date, registration_deadline, organizer, description, requirements,
      website, registration_url, contact_info, images, schedule, disciplines,
      price_range, max_participants, status = 'draft', event_status = 'upcoming'
    } = body;

    if (!name || !slug) {
      return NextResponse.json({ error: '赛事名称和 slug 为必填项' }, { status: 400 });
    }

    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO sup_events (name, name_en, slug, event_type, location, province, city, venue,
        start_date, end_date, registration_deadline, organizer, description, requirements,
        website, registration_url, contact_info, images, schedule, disciplines,
        price_range, max_participants, status, event_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        name, name_en || null, slug, event_type || 'race',
        location || null, province || null, city || null, venue || null,
        start_date || null, end_date || null, registration_deadline || null,
        organizer || null, description || null, requirements || null,
        website || null, registration_url || null, contact_info || null,
        images ? JSON.stringify(images) : null,
        schedule ? JSON.stringify(schedule) : null,
        disciplines ? JSON.stringify(disciplines) : null,
        price_range || null, max_participants || null,
        status, event_status
      ]
    );

    return NextResponse.json({ success: true, event_id: result.insertId }, { status: 201 });
  } catch (error) {
    console.error('创建赛事失败:', error);
    return NextResponse.json({ error: '创建赛事失败' }, { status: 500 });
  }
});
