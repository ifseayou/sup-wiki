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
  star_level: string | null;
  score_coefficient: string | null;
  source_scope: string | null;
  result_status: string | null;
  result_source_note: string | null;
  result_source_links: string | null;
  result_last_verified_at: string | null;
  status: string;
  event_status: string;
  created_at: Date;
  updated_at: Date;
}

interface EventResultRow extends RowDataPacket {
  result_id: number;
  event_id: number;
  athlete_id: number | null;
  athlete_name_snapshot: string;
  gender_group: string;
  discipline: string;
  round_label: string | null;
  rank_position: number;
  result_label: string | null;
  finish_time: string;
  source_note: string | null;
  athlete_name: string | null;
  athlete_photo: string | null;
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
    const [results] = await pool.execute<EventResultRow[]>(
      `SELECT
         er.result_id,
         er.event_id,
         er.athlete_id,
         er.athlete_name_snapshot,
         er.gender_group,
         er.discipline,
         er.round_label,
         er.rank_position,
         er.result_label,
         er.finish_time,
         er.source_note,
         a.name AS athlete_name,
         a.photo AS athlete_photo
       FROM sup_event_results er
       LEFT JOIN sup_athletes a ON a.athlete_id = er.athlete_id
       WHERE er.event_id = ?
       ORDER BY er.gender_group ASC, er.discipline ASC, er.round_label ASC, er.rank_position ASC`,
      [id]
    );

    return NextResponse.json({
      ...event,
      images: parseJson(event.images),
      schedule: parseJson(event.schedule),
      disciplines: parseJson(event.disciplines),
      result_source_links: parseJson(event.result_source_links),
      results: results.map((row) => ({
        ...row,
        athlete: row.athlete_id ? {
          athlete_id: row.athlete_id,
          name: row.athlete_name || row.athlete_name_snapshot,
          photo: row.athlete_photo,
        } : null,
      })),
    });
  } catch (error) {
    console.error('获取赛事详情失败:', error);
    return NextResponse.json({ error: '获取赛事详情失败' }, { status: 500 });
  }
}
