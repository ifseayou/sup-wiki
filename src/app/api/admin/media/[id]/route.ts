import { NextRequest, NextResponse } from 'next/server';
import { withAdmin } from '@/lib/admin';
import pool from '@/lib/db';
import crypto from 'crypto';
import { normalizeMediaModule } from '@/lib/media-modules';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';

const OSS_AK = process.env.OSS_ACCESS_KEY_ID || '';
const OSS_SK = process.env.OSS_ACCESS_KEY_SECRET || '';
const OSS_BUCKET = process.env.OSS_BUCKET || 'sport-hacker-assets';
const OSS_ENDPOINT = `${OSS_BUCKET}.oss-cn-hangzhou.aliyuncs.com`;

interface MediaAssetRow extends RowDataPacket {
  asset_id: number;
  url: string;
  filename: string | null;
}

interface CountRow extends RowDataPacket {
  total: number;
}

interface ReferenceInfo {
  label: string;
  count: number;
}

const TEXT_REFERENCE_FIELDS = [
  { table: 'sup_athletes', field: 'photo', label: '运动员头像' },
  { table: 'sup_athletes', field: 'photos', label: '运动员相册' },
  { table: 'sup_events', field: 'images', label: '赛事图片' },
  { table: 'sup_products', field: 'images', label: '商品图片' },
  { table: 'sup_shop_items', field: 'images', label: '商城图片' },
  { table: 'sup_shop_items', field: 'variants', label: '商城规格图片' },
  { table: 'sup_shop_items', field: 'videos', label: '商城视频封面' },
  { table: 'sup_brands', field: 'logo', label: '品牌 Logo' },
  { table: 'sup_creators', field: 'avatar', label: '博主头像' },
  { table: 'sup_courses', field: 'cover_image', label: '课程封面' },
  { table: 'sup_courses', field: 'images', label: '课程图集' },
  { table: 'sup_techniques', field: 'cover_image', label: '技术动作封面' },
  { table: 'sup_techniques', field: 'images', label: '技术动作图集' },
  { table: 'sup_quiz_questions', field: 'question_image', label: '题目图片' },
  { table: 'sup_quiz_questions', field: 'explanation_image', label: '题目解析图片' },
  { table: 'sup_learn_articles', field: 'content', label: '学习文章内容' },
  { table: 'sup_training_session_images', field: 'image_url', label: '用户训练图片' },
] as const;

function ossSignDelete(date: string, ossKey: string): string {
  const stringToSign = `DELETE\n\n\n${date}\n/${OSS_BUCKET}/${ossKey}`;
  const signature = crypto.createHmac('sha1', OSS_SK).update(stringToSign).digest('base64');
  return `OSS ${OSS_AK}:${signature}`;
}

function getOssKey(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.hostname !== OSS_ENDPOINT) return null;
    const key = decodeURIComponent(parsed.pathname.replace(/^\/+/, ''));
    return key.startsWith('sup-wiki/') ? key : null;
  } catch {
    return null;
  }
}

async function hasColumn(table: string, field: string): Promise<boolean> {
  const [rows] = await pool.execute<CountRow[]>(
    `SELECT COUNT(*) AS total
       FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND COLUMN_NAME = ?`,
    [table, field]
  );
  return Number(rows[0]?.total || 0) > 0;
}

async function countLikeReference(table: string, field: string, url: string): Promise<number> {
  if (!(await hasColumn(table, field))) return 0;
  const [rows] = await pool.execute<CountRow[]>(
    `SELECT COUNT(*) AS total FROM \`${table}\` WHERE \`${field}\` LIKE ?`,
    [`%${url}%`]
  );
  return Number(rows[0]?.total || 0);
}

async function findMediaReferences(assetId: number, url: string): Promise<ReferenceInfo[]> {
  const references: ReferenceInfo[] = [];
  for (const item of TEXT_REFERENCE_FIELDS) {
    const count = await countLikeReference(item.table, item.field, url);
    if (count > 0) references.push({ label: item.label, count });
  }

  if (await hasColumn('sup_event_result_sources', 'asset_id')) {
    const [rows] = await pool.execute<CountRow[]>(
      'SELECT COUNT(*) AS total FROM sup_event_result_sources WHERE asset_id = ?',
      [assetId]
    );
    const count = Number(rows[0]?.total || 0);
    if (count > 0) references.push({ label: '成绩册来源附件', count });
  }

  if (await hasColumn('sup_event_result_sources', 'source_url')) {
    const count = await countLikeReference('sup_event_result_sources', 'source_url', url);
    if (count > 0) references.push({ label: '成绩册来源链接', count });
  }

  return references;
}

async function deleteOssObject(url: string): Promise<'deleted' | 'external' | 'skipped'> {
  const ossKey = getOssKey(url);
  if (!ossKey) return 'external';
  if (!OSS_AK || !OSS_SK) throw new Error('OSS credentials missing');

  const date = new Date().toUTCString();
  const res = await fetch(`https://${OSS_ENDPOINT}/${encodeURI(ossKey)}`, {
    method: 'DELETE',
    headers: {
      Date: date,
      Authorization: ossSignDelete(date, ossKey),
    },
  });

  if (res.ok || res.status === 404) return 'deleted';
  const detail = await res.text();
  console.error('OSS delete error:', detail);
  throw new Error('OSS delete failed');
}

export const PUT = withAdmin(async (request: NextRequest) => {
  try {
    const id = Number(new URL(request.url).pathname.split('/').at(-1));
    const body = await request.json();
    const allowed = ['folder', 'module', 'filename', 'alt_text', 'source_context', 'status'];
    const fields: string[] = [];
    const values: (string | number | null)[] = [];
    for (const field of allowed) {
      if (body[field] !== undefined) {
        if (field === 'module') {
          const mediaModule = normalizeMediaModule(body[field]);
          if (!mediaModule) return NextResponse.json({ error: '图片模块无效' }, { status: 400 });
          fields.push('module = ?');
          values.push(mediaModule);
          continue;
        }
        fields.push(`${field} = ?`);
        values.push(body[field] === '' ? null : body[field]);
      }
    }
    if (fields.length === 0) return NextResponse.json({ error: '没有要更新的字段' }, { status: 400 });
    values.push(id);
    const [result] = await pool.execute<ResultSetHeader>(
      `UPDATE sup_media_assets SET ${fields.join(', ')} WHERE asset_id = ?`,
      values
    );
    if (result.affectedRows === 0) return NextResponse.json({ error: '图片记录不存在' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('更新图片记录失败:', error);
    return NextResponse.json({ error: '更新图片记录失败' }, { status: 500 });
  }
});

export const DELETE = withAdmin(async (request: NextRequest) => {
  try {
    const requestUrl = new URL(request.url);
    const id = Number(requestUrl.pathname.split('/').at(-1));
    const permanent = requestUrl.searchParams.get('permanent') === '1';

    if (!permanent) {
      const [result] = await pool.execute<ResultSetHeader>(
        `UPDATE sup_media_assets SET status = 'hidden' WHERE asset_id = ?`,
        [id]
      );
      if (result.affectedRows === 0) return NextResponse.json({ error: '图片记录不存在' }, { status: 404 });
      return NextResponse.json({ success: true });
    }

    const [assets] = await pool.execute<MediaAssetRow[]>(
      'SELECT asset_id, url, filename FROM sup_media_assets WHERE asset_id = ?',
      [id]
    );
    const asset = assets[0];
    if (!asset) return NextResponse.json({ error: '图片记录不存在' }, { status: 404 });

    const references = await findMediaReferences(id, asset.url);
    if (references.length > 0) {
      return NextResponse.json(
        { error: '图片仍被内容引用，不能删除', references },
        { status: 409 }
      );
    }

    const ossStatus = await deleteOssObject(asset.url);
    const [result] = await pool.execute<ResultSetHeader>(
      'DELETE FROM sup_media_assets WHERE asset_id = ?',
      [id]
    );
    if (result.affectedRows === 0) return NextResponse.json({ error: '图片记录不存在' }, { status: 404 });
    return NextResponse.json({ success: true, oss_status: ossStatus });
  } catch (error) {
    console.error('删除图片记录失败:', error);
    return NextResponse.json({ error: '删除图片记录失败' }, { status: 500 });
  }
});
