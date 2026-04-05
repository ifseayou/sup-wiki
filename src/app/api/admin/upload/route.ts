import { NextRequest, NextResponse } from 'next/server';
import { extractToken, verifyToken, isAdmin } from '@/lib/auth';
import crypto from 'crypto';

const OSS_AK = process.env.OSS_ACCESS_KEY_ID || '';
const OSS_SK = process.env.OSS_ACCESS_KEY_SECRET || '';
const OSS_BUCKET = process.env.OSS_BUCKET || 'sport-hacker-assets';
const OSS_ENDPOINT = `${OSS_BUCKET}.oss-cn-hangzhou.aliyuncs.com`;

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'];
const MAX_SIZE = 5 * 1024 * 1024;

function ossSign(method: string, contentType: string, date: string, ossKey: string): string {
  const stringToSign = `${method}\n\n${contentType}\n${date}\n/${OSS_BUCKET}/${ossKey}`;
  const signature = crypto.createHmac('sha1', OSS_SK).update(stringToSign).digest('base64');
  return `OSS ${OSS_AK}:${signature}`;
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const token = extractToken(authHeader);
  if (!token) return NextResponse.json({ error: '请先登录' }, { status: 401 });
  const payload = verifyToken(token);
  if (!payload || !isAdmin(payload)) return NextResponse.json({ error: '需要管理员权限' }, { status: 403 });

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const folder = (formData.get('folder') as string) || 'misc';

    if (!file) return NextResponse.json({ error: '请选择文件' }, { status: 400 });
    if (!ALLOWED_TYPES.includes(file.type)) return NextResponse.json({ error: '仅支持 JPG/PNG/WebP/GIF' }, { status: 400 });
    if (file.size > MAX_SIZE) return NextResponse.json({ error: '文件不能超过 5MB' }, { status: 400 });

    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const ossKey = `sup-wiki/${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const date = new Date().toUTCString();
    const authorization = ossSign('PUT', file.type, date, ossKey);
    const buffer = Buffer.from(await file.arrayBuffer());

    const ossRes = await fetch(`https://${OSS_ENDPOINT}/${ossKey}`, {
      method: 'PUT',
      headers: {
        'Content-Type': file.type,
        'Date': date,
        'Authorization': authorization,
      },
      body: buffer,
    });

    if (!ossRes.ok) {
      const errText = await ossRes.text();
      console.error('OSS upload error:', errText);
      return NextResponse.json({ error: '上传到 OSS 失败' }, { status: 500 });
    }

    const url = `https://${OSS_ENDPOINT}/${ossKey}`;
    return NextResponse.json({ success: true, url });
  } catch (error) {
    console.error('上传失败:', error);
    return NextResponse.json({ error: '上传失败' }, { status: 500 });
  }
}
