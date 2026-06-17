import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { withAdmin } from '@/lib/admin';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import { normalizeEventResultsInput, parseSourceLinksInput, replaceEventResults } from '@/lib/event-results';
import { geocodeAddress } from '@/lib/geocode';

function optionalValue(value: unknown) {
  return value === undefined || value === '' ? null : value;
}

function coordOrNull(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function dateValue(value: unknown) {
  if (value === undefined || value === '') return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : trimmed;
}

function jsonValue(value: unknown) {
  return value === undefined ? null : JSON.stringify(value);
}

function getMysqlErrorMessage(error: unknown) {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = String((error as { code?: unknown }).code || '');
    if (code === 'ER_DUP_ENTRY') return 'slug 已存在，请换一个 slug';
    if (code === 'WARN_DATA_TRUNCATED') return '字段值不符合数据库枚举或格式要求';
  }
  return '更新赛事失败';
}

export const GET = withAdmin(async (request: NextRequest, _ctx) => {
  try {
    const url = new URL(request.url);
    const id = Number(url.pathname.split('/').at(-1));
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ error: '无效赛事 ID' }, { status: 400 });
    }
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT
         e.*,
         COALESCE(r.results_count, 0) AS results_count,
         COALESCE(r.linked_athletes_count, 0) AS linked_athletes_count
       FROM sup_events e
       LEFT JOIN (
         SELECT event_id, COUNT(*) AS results_count, COUNT(DISTINCT athlete_id) AS linked_athletes_count
         FROM sup_event_results
         GROUP BY event_id
       ) r ON r.event_id = e.event_id
       WHERE e.event_id = ?`,
      [id]
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: '赛事不存在' }, { status: 404 });
    }

    return NextResponse.json(rows[0]);
  } catch (error) {
    console.error('获取赛事详情失败:', error);
    return NextResponse.json({ error: '获取赛事详情失败' }, { status: 500 });
  }
});

export const PUT = withAdmin(async (request: NextRequest, _ctx) => {
  try {
    const url = new URL(request.url);
    const id = Number(url.pathname.split('/').at(-1));
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ error: '无效赛事 ID' }, { status: 400 });
    }
    const body = await request.json();

    const { results } = body;

    // 坐标：管理员显式填了则尊重；否则（或带 regeocode）按地址自动地理编码后注入 body 供 fieldSetters 写入
    const explicitCoord = coordOrNull(body.venue_lat) !== null || coordOrNull(body.venue_lng) !== null;
    const wantsGeocode = body.regeocode === true
      || (!explicitCoord && (body.venue || body.location || body.city || body.province));
    if (wantsGeocode) {
      // 地址优先用本次提交的；缺失的从库里补（regeocode 时 body 可能只带 flag）
      const [existingRows] = await pool.execute<RowDataPacket[]>(
        'SELECT venue, location, city, province FROM sup_events WHERE event_id = ? LIMIT 1', [id]
      );
      const cur = (existingRows[0] || {}) as Record<string, unknown>;
      const geo = await geocodeAddress({
        venue: (body.venue ?? cur.venue) as string,
        location: (body.location ?? cur.location) as string,
        city: (body.city ?? cur.city) as string,
        province: (body.province ?? cur.province) as string,
      });
      if (geo) { body.venue_lat = geo.lat; body.venue_lng = geo.lng; }
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      const fieldSetters: Record<string, (value: unknown) => unknown> = {
        name: (value) => optionalValue(value),
        name_en: (value) => optionalValue(value),
        slug: (value) => optionalValue(value),
        event_type: (value) => optionalValue(value),
        location: (value) => optionalValue(value),
        province: (value) => optionalValue(value),
        city: (value) => optionalValue(value),
        nationality: (value) => optionalValue(value),
        venue: (value) => optionalValue(value),
        venue_lat: (value) => coordOrNull(value),
        venue_lng: (value) => coordOrNull(value),
        start_date: (value) => dateValue(value),
        end_date: (value) => dateValue(value),
        registration_deadline: (value) => dateValue(value),
        organizer: (value) => optionalValue(value),
        description: (value) => optionalValue(value),
        requirements: (value) => optionalValue(value),
        website: (value) => optionalValue(value),
        registration_url: (value) => optionalValue(value),
        contact_info: (value) => optionalValue(value),
        images: (value) => jsonValue(value),
        schedule: (value) => jsonValue(value),
        disciplines: (value) => jsonValue(value),
        price_range: (value) => optionalValue(value),
        max_participants: (value) => optionalValue(value),
        star_level: (value) => optionalValue(value),
        score_coefficient: (value) => optionalValue(value),
        source_scope: (value) => optionalValue(value),
        result_status: (value) => optionalValue(value),
        result_source_note: (value) => optionalValue(value),
        result_source_links: (value) => JSON.stringify(parseSourceLinksInput(value)),
        event_guide: (value) => jsonValue(value),
        status: (value) => optionalValue(value),
        event_status: (value) => optionalValue(value),
      };

      const updates: string[] = [];
      const values: (string | number | Date | null)[] = [];
      for (const [field, normalize] of Object.entries(fieldSetters)) {
        if (Object.prototype.hasOwnProperty.call(body, field)) {
          updates.push(`${field} = ?`);
          values.push(normalize(body[field]) as string | number | Date | null);
        }
      }
      if (Object.prototype.hasOwnProperty.call(body, 'result_status') && body.result_status && body.result_status !== 'none') {
        updates.push('result_last_verified_at = CURRENT_TIMESTAMP');
      }

      let result: ResultSetHeader = { affectedRows: 0 } as ResultSetHeader;
      if (updates.length > 0) {
        const [updateResult] = await connection.execute<ResultSetHeader>(
          `UPDATE sup_events SET ${updates.join(', ')} WHERE event_id = ?`,
          [...values, id]
        );
        result = updateResult;
      } else {
        const [existingRows] = await connection.execute<RowDataPacket[]>('SELECT event_id FROM sup_events WHERE event_id = ? LIMIT 1', [id]);
        result = { affectedRows: existingRows.length } as ResultSetHeader;
      }

      if (result.affectedRows === 0) {
        await connection.rollback();
        return NextResponse.json({ error: '赛事不存在' }, { status: 404 });
      }

      if (results !== undefined) {
        await replaceEventResults(connection, id, normalizeEventResultsInput(results));
      }

      await connection.commit();
      return NextResponse.json({ success: true });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('更新赛事失败:', error);
    return NextResponse.json({ error: getMysqlErrorMessage(error) }, { status: 500 });
  }
});

export const DELETE = withAdmin(async (request: NextRequest, _ctx) => {
  try {
    const url = new URL(request.url);
    const id = Number(url.pathname.split('/').at(-1));
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ error: '无效赛事 ID' }, { status: 400 });
    }

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
