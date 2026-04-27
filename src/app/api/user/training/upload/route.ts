import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { extractToken, verifyUserToken } from '@/lib/auth';
import { ensureTrainingTables } from '@/lib/training-db';
import { EMPTY_TRAINING_DRAFT } from '@/lib/training-parser';
import { parseTrainingOcrText, runTrainingOcr } from '@/lib/training-ocr';
import pool from '@/lib/db';
import type { ResultSetHeader } from 'mysql2';

const OSS_AK = process.env.OSS_ACCESS_KEY_ID || '';
const OSS_SK = process.env.OSS_ACCESS_KEY_SECRET || '';
const OSS_BUCKET = process.env.OSS_BUCKET || 'sport-hacker-assets';
const OSS_ENDPOINT = `${OSS_BUCKET}.oss-cn-hangzhou.aliyuncs.com`;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE = 8 * 1024 * 1024;

function ossSign(method: string, contentType: string, date: string, ossKey: string): string {
  const stringToSign = `${method}\n\n${contentType}\n${date}\n/${OSS_BUCKET}/${ossKey}`;
  const signature = crypto.createHmac('sha1', OSS_SK).update(stringToSign).digest('base64');
  return `OSS ${OSS_AK}:${signature}`;
}

export async function POST(request: NextRequest) {
  const token = extractToken(request.headers.get('authorization'));
  const user = token ? verifyUserToken(token) : null;
  if (!user) return NextResponse.json({ error: '请先登录' }, { status: 401 });

  try {
    await ensureTrainingTables();

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    if (!file) return NextResponse.json({ error: '请选择训练截图' }, { status: 400 });
    if (!ALLOWED_TYPES.includes(file.type)) return NextResponse.json({ error: '仅支持 JPG/PNG/WebP 截图' }, { status: 400 });
    if (file.size > MAX_SIZE) return NextResponse.json({ error: '单张截图不能超过 8MB' }, { status: 400 });
    if (!OSS_AK || !OSS_SK) return NextResponse.json({ error: 'OSS 未配置，无法上传截图' }, { status: 500 });

    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const ossKey = `sup-wiki/training/${user.user_id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
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
      console.error('training image OSS upload error:', await ossRes.text());
      return NextResponse.json({ error: '上传到 OSS 失败' }, { status: 500 });
    }

    const imageUrl = `https://${OSS_ENDPOINT}/${ossKey}`;
    const ocr = await runTrainingOcr(imageUrl);
    const draft = ocr.text ? parseTrainingOcrText(ocr.text) : EMPTY_TRAINING_DRAFT;

    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO sup_training_session_images (user_id, image_url, ocr_text, ocr_json, source_app)
       VALUES (?, ?, ?, ?, 'garmin')`,
      [user.user_id, imageUrl, ocr.text || null, JSON.stringify(ocr.raw ?? null)]
    );

    return NextResponse.json({
      success: true,
      image: {
        image_id: result.insertId,
        image_url: imageUrl,
      },
      ocr: {
        provider: ocr.provider,
        configured: ocr.configured,
        warning: ocr.warning || null,
        text: ocr.text,
      },
      draft,
    });
  } catch (error) {
    console.error('训练截图上传失败:', error);
    return NextResponse.json({ error: '训练截图上传失败' }, { status: 500 });
  }
}
