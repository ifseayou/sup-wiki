import { NextRequest, NextResponse } from 'next/server';
import { withAdmin } from '@/lib/admin';
import pool from '@/lib/db';
import { inferMediaModule, normalizeMediaModule } from '@/lib/media-modules';
import type { RowDataPacket, ResultSetHeader } from 'mysql2';

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

function normalizeUrls(value: unknown) {
  if (Array.isArray(value)) return value.map((item) => String(item || '').trim()).filter(Boolean);
  if (typeof value === 'string' && value.trim()) return [value.trim()];
  return [];
}

async function tableExists(tableName: string) {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT COUNT(*) AS total
       FROM information_schema.tables
      WHERE table_schema = DATABASE() AND table_name = ?`,
    [tableName]
  );
  return Number(rows[0]?.total || 0) > 0;
}

async function enrichAthleteUploads(items: RowDataPacket[]) {
  const urls = items.map((item) => String(item.url || '').trim()).filter(Boolean);
  if (urls.length === 0 || !(await tableExists('sup_athlete_profile_claims'))) return items;
  const placeholders = urls.map(() => '?').join(',');
  const [claimRows] = await pool.execute<RowDataPacket[]>(
    `SELECT c.athlete_id, c.submitted_avatar_url, c.submitted_profile_json, c.created_at, a.name AS athlete_name
       FROM sup_athlete_profile_claims c
       LEFT JOIN sup_athletes a ON a.athlete_id = c.athlete_id
      WHERE c.submitted_avatar_url IN (${placeholders})
         OR c.submitted_profile_json IS NOT NULL
      ORDER BY c.created_at DESC
      LIMIT 1200`,
    urls
  );
  const urlSet = new Set(urls);
  const uploadMap = new Map<string, { athlete_id: number; athlete_name: string; created_at: string }>();
  for (const row of claimRows) {
    const profile = parseJsonObject(row.submitted_profile_json);
    const allUrls = [
      ...normalizeUrls(row.submitted_avatar_url),
      ...normalizeUrls(profile.sup_photos),
      ...normalizeUrls(profile.photos),
      ...normalizeUrls(profile.avatar_url),
      ...normalizeUrls(profile.photo),
    ];
    for (const url of allUrls) {
      if (!urlSet.has(url) || uploadMap.has(url)) continue;
      uploadMap.set(url, {
        athlete_id: Number(row.athlete_id || 0),
        athlete_name: String(row.athlete_name || ''),
        created_at: row.created_at ? String(row.created_at) : '',
      });
    }
  }
  return items.map((item) => {
    const upload = uploadMap.get(String(item.url || ''));
    return upload ? { ...item, athlete_upload: upload } : item;
  });
}

export const GET = withAdmin(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'active';
    const folder = searchParams.get('folder');
    const mediaModule = normalizeMediaModule(searchParams.get('module'));
    const search = searchParams.get('search');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
    const requestedPageSize = parseInt(searchParams.get('pageSize') || '40', 10) || 40;
    const pageSize = Math.min(100, Math.max(12, requestedPageSize));
    const offset = (page - 1) * pageSize;

    const conditions: string[] = [];
    const params: (string | number)[] = [];
    if (status) { conditions.push('status = ?'); params.push(status); }
    if (mediaModule) { conditions.push('module = ?'); params.push(mediaModule); }
    if (folder) { conditions.push('folder = ?'); params.push(folder); }
    if (search) {
      conditions.push('(filename LIKE ? OR alt_text LIKE ? OR url LIKE ?)');
      const like = `%${search}%`;
      params.push(like, like, like);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [countRows] = await pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) AS total FROM sup_media_assets ${where}`,
      params
    );
    const total = Number(countRows[0]?.total || 0);
    const [items] = await pool.execute<RowDataPacket[]>(
      `SELECT * FROM sup_media_assets ${where}
       ORDER BY created_at DESC, asset_id DESC
       LIMIT ${pageSize} OFFSET ${offset}`,
      params
    );
    const [moduleRows] = await pool.execute<RowDataPacket[]>(
      `SELECT module, COUNT(*) AS total
         FROM sup_media_assets
        WHERE status = ?
        GROUP BY module`,
      [status]
    );
    const moduleCounts = moduleRows.reduce<Record<string, number>>((acc, row) => {
      acc[String(row.module || 'system')] = Number(row.total || 0);
      return acc;
    }, {});

    const enrichedItems = await enrichAthleteUploads(items);
    return NextResponse.json({ items: enrichedItems, total, page, pageSize, totalPages: Math.ceil(total / pageSize), moduleCounts });
  } catch (error) {
    console.error('获取图片库失败:', error);
    return NextResponse.json({ error: '获取图片库失败' }, { status: 500 });
  }
});

export const POST = withAdmin(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const { url, folder = 'misc', filename, mime_type, size_bytes, alt_text, source_context = 'manual', status = 'active' } = body;
    const mediaModule = normalizeMediaModule(body.module) || inferMediaModule(folder, source_context);
    if (!url) return NextResponse.json({ error: '缺少必填字段: url' }, { status: 400 });

    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO sup_media_assets (url, folder, module, filename, mime_type, size_bytes, alt_text, source_context, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         folder = VALUES(folder),
         module = VALUES(module),
         filename = VALUES(filename),
         mime_type = VALUES(mime_type),
         size_bytes = VALUES(size_bytes),
         alt_text = VALUES(alt_text),
         source_context = VALUES(source_context),
         status = VALUES(status)`,
      [url, folder, mediaModule, filename || null, mime_type || null, size_bytes || null, alt_text || null, source_context, status]
    );
    return NextResponse.json({ success: true, asset_id: result.insertId }, { status: 201 });
  } catch (error) {
    console.error('创建图片记录失败:', error);
    return NextResponse.json({ error: '创建图片记录失败' }, { status: 500 });
  }
});
