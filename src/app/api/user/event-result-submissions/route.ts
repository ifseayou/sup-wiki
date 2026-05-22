import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import pool from '@/lib/db';
import { requireUser } from '@/lib/user-auth';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';

const OSS_AK = process.env.OSS_ACCESS_KEY_ID || '';
const OSS_SK = process.env.OSS_ACCESS_KEY_SECRET || '';
const OSS_BUCKET = process.env.OSS_BUCKET || 'sport-hacker-assets';
const OSS_ENDPOINT = `${OSS_BUCKET}.oss-cn-hangzhou.aliyuncs.com`;
const MAX_SIZE = 20 * 1024 * 1024;

function ossSign(method: string, contentType: string, date: string, ossKey: string) {
  const stringToSign = `${method}\n\n${contentType}\n${date}\n/${OSS_BUCKET}/${ossKey}`;
  const signature = crypto.createHmac('sha1', OSS_SK).update(stringToSign).digest('base64');
  return `OSS ${OSS_AK}:${signature}`;
}

function cleanText(value: FormDataEntryValue | null, max = 255) {
  const text = String(value || '').trim();
  return text ? text.slice(0, max) : null;
}

function cleanDate(value: FormDataEntryValue | null) {
  const text = cleanText(value, 20);
  if (!text) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}

async function hasPdfHeader(file: File) {
  const header = Buffer.from(await file.slice(0, 5).arrayBuffer()).toString('utf8');
  return header === '%PDF-';
}

export async function GET(request: NextRequest) {
  const user = requireUser(request);
  if (user instanceof NextResponse) return user;

  try {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT submission_id, event_id, event_name, event_date, location, original_filename,
              size_bytes, user_note, status, admin_note, created_at, updated_at
       FROM sup_event_result_submissions
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT 30`,
      [user.user_id]
    );
    return NextResponse.json({ items: rows });
  } catch (error) {
    console.error('获取成绩册提交记录失败:', error);
    return NextResponse.json({ error: '获取成绩册提交记录失败' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const user = requireUser(request);
  if (user instanceof NextResponse) return user;

  try {
    const formData = await request.formData();
    const eventName = cleanText(formData.get('event_name'), 160);
    const location = cleanText(formData.get('location'), 160);
    const userNote = cleanText(formData.get('user_note'), 1000);
    const eventDate = cleanDate(formData.get('event_date'));
    const eventIdValue = cleanText(formData.get('event_id'), 30);
    const eventId = eventIdValue && Number.isInteger(Number(eventIdValue)) && Number(eventIdValue) > 0
      ? Number(eventIdValue)
      : null;
    const file = formData.get('file') as File | null;

    if (!eventName) return NextResponse.json({ error: '请填写赛事名称' }, { status: 400 });
    if (!file) return NextResponse.json({ error: '请选择 PDF 成绩册' }, { status: 400 });
    if (file.type !== 'application/pdf') return NextResponse.json({ error: '仅支持 PDF 成绩册' }, { status: 400 });
    if (!file.name.toLowerCase().endsWith('.pdf')) return NextResponse.json({ error: '文件扩展名必须是 .pdf' }, { status: 400 });
    if (file.size <= 0) return NextResponse.json({ error: 'PDF 文件为空' }, { status: 400 });
    if (file.size > MAX_SIZE) return NextResponse.json({ error: 'PDF 成绩册不能超过 20MB' }, { status: 400 });
    if (!(await hasPdfHeader(file))) return NextResponse.json({ error: '文件内容不是有效 PDF' }, { status: 400 });
    if (!OSS_AK || !OSS_SK) return NextResponse.json({ error: '文件上传服务未配置' }, { status: 500 });

    const safeName = file.name.replace(/[^\w.\-\u4e00-\u9fa5]+/g, '-').slice(0, 120);
    const ossKey = `sup-wiki/result-submissions/${user.user_id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeName}`;
    const date = new Date().toUTCString();
    const buffer = Buffer.from(await file.arrayBuffer());

    const ossRes = await fetch(`https://${OSS_ENDPOINT}/${ossKey}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/pdf',
        Date: date,
        Authorization: ossSign('PUT', 'application/pdf', date, ossKey),
      },
      body: buffer,
    });

    if (!ossRes.ok) {
      console.error('成绩册上传 OSS 失败:', await ossRes.text());
      return NextResponse.json({ error: '成绩册上传失败' }, { status: 500 });
    }

    const fileUrl = `https://${OSS_ENDPOINT}/${ossKey}`;
    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO sup_event_result_submissions (
         user_id, event_id, event_name, event_date, location, file_url,
         original_filename, mime_type, size_bytes, user_note, status
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [user.user_id, eventId, eventName, eventDate, location, fileUrl, file.name, file.type, file.size, userNote]
    );

    return NextResponse.json({ success: true, submission_id: result.insertId, status: 'pending' }, { status: 201 });
  } catch (error) {
    console.error('提交赛事成绩册失败:', error);
    return NextResponse.json({ error: '提交赛事成绩册失败' }, { status: 500 });
  }
}
