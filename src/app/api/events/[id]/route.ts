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
  requirements: string | null;
  website: string | null;
  registration_url: string | null;
  contact_info: string | null;
  images: string | null;
  schedule: string | null;
  disciplines: string | null;
  price_range: string | null;
  max_participants: number | null;
  status: string;
  event_status: string;
  created_at: Date;
  updated_at: Date;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const [rows] = await pool.execute<EventRow[]>(
      `SELECT * FROM sup_events WHERE event_id = ? AND status = 'published'`,
      [id]
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: '赛事不存在' }, { status: 404 });
    }

    const event = rows[0];
    const parseJson = (v: unknown) => Array.isArray(v) ? v : (v ? JSON.parse(String(v)) : []);
    return NextResponse.json({
      ...event,
      images: parseJson(event.images),
      schedule: parseJson(event.schedule),
      disciplines: parseJson(event.disciplines),
    });
  } catch (error) {
    console.error('获取赛事详情失败:', error);
    return NextResponse.json({ error: '获取赛事详情失败' }, { status: 500 });
  }
}
