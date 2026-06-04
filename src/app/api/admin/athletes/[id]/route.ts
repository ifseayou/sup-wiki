import { NextRequest, NextResponse } from 'next/server';
import { withAdmin } from '@/lib/admin';
import pool from '@/lib/db';
import { normalizeNationality } from '@/lib/nationality';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';

function parseJsonObject(value: unknown) {
  if (!value) return {};
  if (typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
  try {
    const parsed = JSON.parse(String(value));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

async function mergeSocialLinks(athleteId: number, incoming: unknown) {
  const incomingLinks = parseJsonObject(incoming);
  const [rows] = await pool.execute<RowDataPacket[]>(
    'SELECT social_links FROM sup_athletes WHERE athlete_id = ? LIMIT 1',
    [athleteId]
  );
  const currentLinks = parseJsonObject(rows[0]?.social_links);
  return {
    ...currentLinks,
    ...incomingLinks,
    public_profile: {
      ...parseJsonObject(currentLinks.public_profile),
      ...parseJsonObject(incomingLinks.public_profile),
    },
  };
}

export const PUT = withAdmin(async (request: NextRequest) => {
  try {
    const url = new URL(request.url);
    const id = url.pathname.split('/').at(-1);
    const athleteId = Number(id);
    const body = await request.json();
    const allowed = [
      'name',
      'name_en',
      'gender',
      'gender_source',
      'gender_confidence',
      'nationality',
      'province',
      'city',
      'photo',
      'bio',
      'discipline',
      'icf_ranking',
      'status',
      'elite_event_status',
      'elite_event_note',
      'elite_event_source_title',
    ];
    const fields: string[] = [];
    const values: (string | number | null)[] = [];
    for (const f of allowed) {
      if (body[f] !== undefined) {
        fields.push(`${f} = ?`);
        values.push(f === 'nationality' ? normalizeNationality(body[f]) : body[f]);
      }
    }
    if (body.achievements !== undefined) { fields.push('achievements = ?'); values.push(JSON.stringify(body.achievements)); }
    if (body.elite_event_groups !== undefined) { fields.push('elite_event_groups = ?'); values.push(JSON.stringify(body.elite_event_groups)); }
    if (body.social_links !== undefined) {
      fields.push('social_links = ?');
      values.push(JSON.stringify(await mergeSocialLinks(athleteId, body.social_links)));
    }
    if (body.photos !== undefined) { fields.push('photos = ?'); values.push(JSON.stringify(body.photos)); }
    if (fields.length === 0) return NextResponse.json({ error: '没有要更新的字段' }, { status: 400 });
    values.push(athleteId);
    const [result] = await pool.execute<ResultSetHeader>(`UPDATE sup_athletes SET ${fields.join(', ')} WHERE athlete_id = ?`, values);
    if (result.affectedRows === 0) return NextResponse.json({ error: '运动员不存在' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('更新运动员失败:', error);
    return NextResponse.json({ error: '更新运动员失败' }, { status: 500 });
  }
});

export const DELETE = withAdmin(async (request: NextRequest) => {
  try {
    const url = new URL(request.url);
    const id = url.pathname.split('/').at(-1);
    const [result] = await pool.execute<ResultSetHeader>('DELETE FROM sup_athletes WHERE athlete_id = ?', [Number(id)]);
    if (result.affectedRows === 0) return NextResponse.json({ error: '运动员不存在' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('删除运动员失败:', error);
    return NextResponse.json({ error: '删除运动员失败' }, { status: 500 });
  }
});
