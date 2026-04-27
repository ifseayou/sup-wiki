import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { extractToken, verifyUserToken } from '@/lib/auth';
import { ensureTrainingTables } from '@/lib/training-db';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';

function auth(request: NextRequest) {
  const token = extractToken(request.headers.get('authorization'));
  return token ? verifyUserToken(token) : null;
}

function nullableNumber(value: unknown): number | null {
  if (value === '' || value === undefined || value === null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function nullableDate(value: unknown): string | null {
  if (!value || typeof value !== 'string') return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return value.slice(0, 19).replace('T', ' ');
}

export async function GET(request: NextRequest) {
  const user = auth(request);
  if (!user) return NextResponse.json({ error: '请先登录' }, { status: 401 });

  await ensureTrainingTables();
  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get('page') || 1));
  const pageSize = Math.min(50, Math.max(1, Number(url.searchParams.get('pageSize') || 12)));
  const offset = (page - 1) * pageSize;

  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT * FROM sup_training_sessions
     WHERE user_id = ?
     ORDER BY COALESCE(started_at, created_at) DESC
     LIMIT ? OFFSET ?`,
    [user.user_id, pageSize, offset]
  );

  const [countRows] = await pool.execute<RowDataPacket[]>(
    'SELECT COUNT(*) AS total FROM sup_training_sessions WHERE user_id = ?',
    [user.user_id]
  );

  const [summaryRows] = await pool.execute<RowDataPacket[]>(
    `SELECT
       COUNT(*) AS sessions,
       COALESCE(SUM(distance_km), 0) AS total_distance_km,
       COALESCE(SUM(duration_seconds), 0) AS total_duration_seconds,
       ROUND(AVG(avg_pace_sec_per_km)) AS avg_pace_sec_per_km,
       ROUND(AVG(avg_heart_rate)) AS avg_heart_rate,
       COALESCE(SUM(stroke_count), 0) AS total_strokes
     FROM sup_training_sessions
     WHERE user_id = ?`,
    [user.user_id]
  );

  return NextResponse.json({
    items: rows,
    pagination: { page, pageSize, total: Number(countRows[0]?.total || 0) },
    summary: summaryRows[0] || {},
  });
}

export async function POST(request: NextRequest) {
  const user = auth(request);
  if (!user) return NextResponse.json({ error: '请先登录' }, { status: 401 });

  try {
    await ensureTrainingTables();
    const body = await request.json();
    const imageIds = Array.isArray(body.image_ids) ? body.image_ids.map(Number).filter(Boolean) : [];
    const laps = Array.isArray(body.laps) ? body.laps : [];

    const fields = [
      'title', 'activity_type', 'started_at', 'duration_seconds', 'moving_time_seconds', 'elapsed_time_seconds',
      'distance_km', 'avg_pace_sec_per_km', 'avg_moving_pace_sec_per_km', 'best_pace_sec_per_km',
      'avg_speed_kmh', 'max_speed_kmh', 'avg_heart_rate', 'max_heart_rate', 'stroke_count',
      'avg_stroke_rate', 'max_stroke_rate', 'avg_stroke_distance_m', 'training_effect_aerobic',
      'training_effect_anaerobic', 'training_load', 'intensity_minutes_moderate',
      'intensity_minutes_vigorous', 'body_battery_impact', 'raw_ocr_json', 'status'
    ];

    const values = {
      title: String(body.title || '桨板训练').slice(0, 120),
      activity_type: 'sup',
      started_at: nullableDate(body.started_at),
      duration_seconds: nullableNumber(body.duration_seconds),
      moving_time_seconds: nullableNumber(body.moving_time_seconds),
      elapsed_time_seconds: nullableNumber(body.elapsed_time_seconds),
      distance_km: nullableNumber(body.distance_km),
      avg_pace_sec_per_km: nullableNumber(body.avg_pace_sec_per_km),
      avg_moving_pace_sec_per_km: nullableNumber(body.avg_moving_pace_sec_per_km),
      best_pace_sec_per_km: nullableNumber(body.best_pace_sec_per_km),
      avg_speed_kmh: nullableNumber(body.avg_speed_kmh),
      max_speed_kmh: nullableNumber(body.max_speed_kmh),
      avg_heart_rate: nullableNumber(body.avg_heart_rate),
      max_heart_rate: nullableNumber(body.max_heart_rate),
      stroke_count: nullableNumber(body.stroke_count),
      avg_stroke_rate: nullableNumber(body.avg_stroke_rate),
      max_stroke_rate: nullableNumber(body.max_stroke_rate),
      avg_stroke_distance_m: nullableNumber(body.avg_stroke_distance_m),
      training_effect_aerobic: nullableNumber(body.training_effect_aerobic),
      training_effect_anaerobic: nullableNumber(body.training_effect_anaerobic),
      training_load: nullableNumber(body.training_load),
      intensity_minutes_moderate: nullableNumber(body.intensity_minutes_moderate),
      intensity_minutes_vigorous: nullableNumber(body.intensity_minutes_vigorous),
      body_battery_impact: nullableNumber(body.body_battery_impact),
      raw_ocr_json: JSON.stringify(body.raw_ocr_json || null),
      status: body.status === 'draft' ? 'draft' : 'confirmed',
    } as Record<string, string | number | null>;

    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO sup_training_sessions (${fields.join(', ')})
       VALUES (${fields.map(() => '?').join(', ')})`,
      fields.map(field => values[field])
    );

    const sessionId = result.insertId;

    for (const lap of laps) {
      await pool.execute(
        `INSERT INTO sup_training_laps (session_id, lap_no, time_seconds, distance_km, avg_pace_sec_per_km)
         VALUES (?, ?, ?, ?, ?)`,
        [
          sessionId,
          nullableNumber(lap.lap_no),
          nullableNumber(lap.time_seconds),
          nullableNumber(lap.distance_km),
          nullableNumber(lap.avg_pace_sec_per_km),
        ]
      );
    }

    if (imageIds.length > 0) {
      await pool.query(
        `UPDATE sup_training_session_images
         SET session_id = ?
         WHERE user_id = ? AND image_id IN (${imageIds.map(() => '?').join(',')})`,
        [sessionId, user.user_id, ...imageIds]
      );
    }

    return NextResponse.json({ success: true, session_id: sessionId });
  } catch (error) {
    console.error('保存训练记录失败:', error);
    return NextResponse.json({ error: '保存训练记录失败' }, { status: 500 });
  }
}
