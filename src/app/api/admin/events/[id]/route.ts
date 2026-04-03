import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { withAdmin } from '@/lib/admin';
import type { ResultSetHeader } from 'mysql2';

export const PUT = withAdmin(async (request: NextRequest, _ctx) => {
  try {
    const url = new URL(request.url);
    const id = url.pathname.split('/').at(-1);
    const body = await request.json();

    const {
      name, name_en, slug, event_type, location, province, city, venue,
      start_date, end_date, registration_deadline, organizer, description, requirements,
      website, registration_url, contact_info, images, schedule, disciplines,
      price_range, max_participants, status, event_status
    } = body;

    const [result] = await pool.execute<ResultSetHeader>(
      `UPDATE sup_events SET
        name = COALESCE(?, name),
        name_en = ?,
        slug = COALESCE(?, slug),
        event_type = COALESCE(?, event_type),
        location = ?,
        province = ?,
        city = ?,
        venue = ?,
        start_date = ?,
        end_date = ?,
        registration_deadline = ?,
        organizer = ?,
        description = ?,
        requirements = ?,
        website = ?,
        registration_url = ?,
        contact_info = ?,
        images = ?,
        schedule = ?,
        disciplines = ?,
        price_range = ?,
        max_participants = ?,
        status = COALESCE(?, status),
        event_status = COALESCE(?, event_status)
       WHERE event_id = ?`,
      [
        name || null, name_en !== undefined ? name_en : undefined,
        slug || null, event_type || null,
        location !== undefined ? location : undefined,
        province !== undefined ? province : undefined,
        city !== undefined ? city : undefined,
        venue !== undefined ? venue : undefined,
        start_date !== undefined ? start_date : undefined,
        end_date !== undefined ? end_date : undefined,
        registration_deadline !== undefined ? registration_deadline : undefined,
        organizer !== undefined ? organizer : undefined,
        description !== undefined ? description : undefined,
        requirements !== undefined ? requirements : undefined,
        website !== undefined ? website : undefined,
        registration_url !== undefined ? registration_url : undefined,
        contact_info !== undefined ? contact_info : undefined,
        images !== undefined ? JSON.stringify(images) : undefined,
        schedule !== undefined ? JSON.stringify(schedule) : undefined,
        disciplines !== undefined ? JSON.stringify(disciplines) : undefined,
        price_range !== undefined ? price_range : undefined,
        max_participants !== undefined ? max_participants : undefined,
        status || null, event_status || null,
        id
      ]
    );

    if (result.affectedRows === 0) {
      return NextResponse.json({ error: '赛事不存在' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('更新赛事失败:', error);
    return NextResponse.json({ error: '更新赛事失败' }, { status: 500 });
  }
});

export const DELETE = withAdmin(async (request: NextRequest, _ctx) => {
  try {
    const url = new URL(request.url);
    const id = url.pathname.split('/').at(-1) ?? '';

    const [result] = await pool.execute<ResultSetHeader>(
      'DELETE FROM sup_events WHERE event_id = ?',
      [id]
    );

    if (result.affectedRows === 0) {
      return NextResponse.json({ error: '赛事不存在' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('删除赛事失败:', error);
    return NextResponse.json({ error: '删除赛事失败' }, { status: 500 });
  }
});
