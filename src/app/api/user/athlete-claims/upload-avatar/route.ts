import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import pool from '@/lib/db';
import { requireUser } from '@/lib/user-auth';
import type { ResultSetHeader } from 'mysql2';

const OSS_AK = process.env.OSS_ACCESS_KEY_ID || '';
const OSS_SK = process.env.OSS_ACCESS_KEY_SECRET || '';
const OSS_BUCKET = process.env.OSS_BUCKET || 'sport-hacker-assets';
const OSS_ENDPOINT = `${OSS_BUCKET}.oss-cn-hangzhou.aliyuncs.com`;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE = 5 * 1024 * 1024;

function ossSign(method: string, contentType: string, date: string, ossKey: string) {
  const stringToSign = `${method}\n\n${contentType}\n${date}\n/${OSS_BUCKET}/${ossKey}`;
  const signature = crypto.createHmac('sha1', OSS_SK).update(stringToSign).digest('base64');
  return `OSS ${OSS_AK}:${signature}`;
}

export async function POST(request: NextRequest) {
  const user = requireUser(request);
  if (user instanceof NextResponse) return user;

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    if (!file) return NextResponse.json({ error: '请选择头像图片' }, { status: 400 });
    if (!ALLOWED_TYPES.includes(file.type)) return NextResponse.json({ error: '仅支持 JPG、PNG、WebP 图片' }, { status: 400 });
    if (file.size > MAX_SIZE) return NextResponse.json({ error: '图片不能超过 5MB' }, { status: 400 });
    if (!OSS_AK || !OSS_SK) return NextResponse.json({ error: '图片上传服务未配置' }, { status: 500 });

    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const ossKey = `sup-wiki/athletes/${Date.now()}-claim-${user.user_id}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const date = new Date().toUTCString();
    const buffer = Buffer.from(await file.arrayBuffer());

    const ossRes = await fetch(`https://${OSS_ENDPOINT}/${ossKey}`, {
      method: 'PUT',
      headers: {
        'Content-Type': file.type,
        Date: date,
        Authorization: ossSign('PUT', file.type, date, ossKey),
      },
      body: buffer,
    });

    if (!ossRes.ok) {
      console.error('用户头像上传 OSS 失败:', await ossRes.text());
      return NextResponse.json({ error: '头像上传失败' }, { status: 500 });
    }

    const url = `https://${OSS_ENDPOINT}/${ossKey}`;
    try {
      await pool.execute<ResultSetHeader>(
        `INSERT INTO sup_media_assets (url, folder, filename, mime_type, size_bytes, source_context, status)
         VALUES (?, 'athletes', ?, ?, ?, 'athlete_claim', 'active')
         ON DUPLICATE KEY UPDATE status = 'active', source_context = 'athlete_claim'`,
        [url, file.name, file.type, file.size]
      );
    } catch (dbError) {
      console.error('用户头像写入图片库失败:', dbError);
    }

    return NextResponse.json({ success: true, url });
  } catch (error) {
    console.error('上传用户头像失败:', error);
    return NextResponse.json({ error: '上传用户头像失败' }, { status: 500 });
  }
}
