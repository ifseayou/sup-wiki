import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { extractToken, verifyUserToken } from '@/lib/auth';
import { ensureTrainingTables } from '@/lib/training-db';
import type { RowDataPacket } from 'mysql2';

function auth(request: NextRequest) {
  const token = extractToken(request.headers.get('authorization'));
  return token ? verifyUserToken(token) : null;
}

function nullableNumber(value: unknown): number | null {
  if (value === '' || value === undefined || value === null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export async function GET(request: NextRequest, ctx: RouteContext<'/api/user/training/sessions/[id]'>) {
  const user = auth(request);
  if (!user) return NextResponse.json({ error: '请先登录' }, { status: 401 });
  const { id } = await ctx.params;

  await ensureTrainingTables();
  const [rows] = await pool.execute<RowDataPacket[]>(
    'SELECT * FROM sup_training_sessions WHERE session_id = ? AND user_id = ?',
    [id, user.user_id]
  );
  if (rows.length === 0) return NextResponse.json({ error: '训练记录不存在' }, { status: 404 });

  const [laps] = await pool.execute<RowDataPacket[]>(
    'SELECT * FROM sup_training_laps WHERE session_id = ? ORDER BY lap_no ASC',
    [id]
  );
  const [images] = await pool.execute<RowDataPacket[]>(
    'SELECT image_id, image_url, ocr_text, source_app, created_at FROM sup_training_session_images WHERE session_id = ? AND user_id = ? ORDER BY created_at ASC',
    [id, user.user_id]
  );

  return NextResponse.json({ item: rows[0], laps, images });
}

export async function PUT(request: NextRequest, ctx: RouteContext<'/api/user/training/sessions/[id]'>) {
  const user = auth(request);
  if (!user) return NextResponse.json({ error: '请先登录' }, { status: 401 });
  const { id } = await ctx.params;
  const body = await request.json();

  await ensureTrainingTables();
  const [existing] = await pool.execute<RowDataPacket[]>(
    'SELECT session_id FROM sup_training_sessions WHERE session_id = ? AND user_id = ?',
    [id, user.user_id]
  );
  if (existing.length === 0) return NextResponse.json({ error: '训练记录不存在' }, { status: 404 });

  await pool.execute(
    `UPDATE sup_training_sessions SET
      title = ?, started_at = ?, duration_seconds = ?, moving_time_seconds = ?, elapsed_time_seconds = ?,
      distance_km = ?, avg_pace_sec_per_km = ?, avg_moving_pace_sec_per_km = ?, best_pace_sec_per_km = ?,
      avg_speed_kmh = ?, max_speed_kmh = ?, avg_heart_rate = ?, max_heart_rate = ?, stroke_count = ?,
      avg_stroke_rate = ?, max_stroke_rate = ?, avg_stroke_distance_m = ?, training_effect_aerobic = ?,
      training_effect_anaerobic = ?, training_load = ?, intensity_minutes_moderate = ?,
      intensity_minutes_vigorous = ?, body_battery_impact = ?, status = ?
     WHERE session_id = ? AND user_id = ?`,
    [
      String(body.title || '桨板训练').slice(0, 120),
      body.started_at || null,
      nullableNumber(body.duration_seconds),
      nullableNumber(body.moving_time_seconds),
      nullableNumber(body.elapsed_time_seconds),
      nullableNumber(body.distance_km),
      nullableNumber(body.avg_pace_sec_per_km),
      nullableNumber(body.avg_moving_pace_sec_per_km),
      nullableNumber(body.best_pace_sec_per_km),
      nullableNumber(body.avg_speed_kmh),
      nullableNumber(body.max_speed_kmh),
      nullableNumber(body.avg_heart_rate),
      nullableNumber(body.max_heart_rate),
      nullableNumber(body.stroke_count),
      nullableNumber(body.avg_stroke_rate),
      nullableNumber(body.max_stroke_rate),
      nullableNumber(body.avg_stroke_distance_m),
      nullableNumber(body.training_effect_aerobic),
      nullableNumber(body.training_effect_anaerobic),
      nullableNumber(body.training_load),
      nullableNumber(body.intensity_minutes_moderate),
      nullableNumber(body.intensity_minutes_vigorous),
      nullableNumber(body.body_battery_impact),
      body.status === 'draft' ? 'draft' : 'confirmed',
      id,
      user.user_id,
    ]
  );

  if (Array.isArray(body.laps)) {
    await pool.execute('DELETE FROM sup_training_laps WHERE session_id = ?', [id]);
    for (const lap of body.laps) {
      await pool.execute(
        `INSERT INTO sup_training_laps (session_id, lap_no, time_seconds, distance_km, avg_pace_sec_per_km)
         VALUES (?, ?, ?, ?, ?)`,
        [
          id,
          nullableNumber(lap.lap_no),
          nullableNumber(lap.time_seconds),
          nullableNumber(lap.distance_km),
          nullableNumber(lap.avg_pace_sec_per_km),
        ]
      );
    }
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest, ctx: RouteContext<'/api/user/training/sessions/[id]'>) {
  const user = auth(request);
  if (!user) return NextResponse.json({ error: '请先登录' }, { status: 401 });
  const { id } = await ctx.params;

  await ensureTrainingTables();
  await pool.execute('DELETE FROM sup_training_sessions WHERE session_id = ? AND user_id = ?', [id, user.user_id]);
  return NextResponse.json({ success: true });
}
