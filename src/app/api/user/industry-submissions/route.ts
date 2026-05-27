import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import pool from '@/lib/db';
import { requireUser } from '@/lib/user-auth';
import { runIndustrySubmissionOcr } from '@/lib/industry-submission-ocr';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';

const OSS_AK = process.env.OSS_ACCESS_KEY_ID || '';
const OSS_SK = process.env.OSS_ACCESS_KEY_SECRET || '';
const OSS_BUCKET = process.env.OSS_BUCKET || 'sport-hacker-assets';
const OSS_ENDPOINT = `${OSS_BUCKET}.oss-cn-hangzhou.aliyuncs.com`;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE = 8 * 1024 * 1024;
const MAX_GROUP_FILES = 8;
const PROFESSIONAL_ROLES = ['coach', 'referee', 'club_owner'];

function ossSign(method: string, contentType: string, date: string, ossKey: string) {
  const stringToSign = `${method}\n\n${contentType}\n${date}\n/${OSS_BUCKET}/${ossKey}`;
  const signature = crypto.createHmac('sha1', OSS_SK).update(stringToSign).digest('base64');
  return `OSS ${OSS_AK}:${signature}`;
}

function cleanText(value: FormDataEntryValue | null, max = 255) {
  const text = String(value || '').trim();
  return text ? text.slice(0, max) : null;
}

function getFiles(formData: FormData, field: string) {
  return formData.getAll(field).filter((item): item is File => item instanceof File && item.size > 0);
}

function cleanRoles(formData: FormData) {
  const raw = [
    ...formData.getAll('roles'),
    ...(cleanText(formData.get('role'), 60) ? [cleanText(formData.get('role'), 60)] : []),
  ];
  return Array.from(new Set(raw.map((item) => String(item)).filter((item) => PROFESSIONAL_ROLES.includes(item))));
}

function validateImageFiles(files: File[], label: string) {
  if (files.length > MAX_GROUP_FILES) return `${label}最多上传 ${MAX_GROUP_FILES} 张`;
  for (const file of files) {
    if (!ALLOWED_TYPES.includes(file.type)) return `${file.name} 不是支持的图片格式`;
    if (file.size > MAX_SIZE) return `${file.name} 超过 8MB`;
  }
  return null;
}

async function uploadImageToOss(file: File, userId: number, submissionType: string, group: string) {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const safeExt = ['jpg', 'jpeg', 'png', 'webp'].includes(ext) ? ext : 'jpg';
  const ossKey = `sup-wiki/industry-submissions/${submissionType}/${userId}/${Date.now()}-${group}-${Math.random().toString(36).slice(2, 8)}.${safeExt}`;
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
    console.error('行业入驻图片上传 OSS 失败:', await ossRes.text());
    throw new Error('图片上传失败');
  }

  const url = `https://${OSS_ENDPOINT}/${ossKey}`;
  try {
    await pool.execute<ResultSetHeader>(
      `INSERT INTO sup_media_assets (url, folder, filename, mime_type, size_bytes, source_context, status)
       VALUES (?, ?, ?, ?, ?, 'industry_submission', 'active')
       ON DUPLICATE KEY UPDATE status = 'active', source_context = 'industry_submission'`,
      [url, `industry-submissions/${submissionType}/${group}`, file.name, file.type, file.size]
    );
  } catch (error) {
    console.error('行业入驻图片写入图片库失败:', error);
  }

  return url;
}

export async function GET(request: NextRequest) {
  const user = requireUser(request);
  if (user instanceof NextResponse) return user;

  try {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT submission_id, submission_type, name, roles, club_name, status, admin_note,
              created_club_id, created_professional_id, created_at, updated_at
       FROM sup_industry_submissions
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT 30`,
      [user.user_id]
    );
    return NextResponse.json({ items: rows });
  } catch (error) {
    console.error('获取行业入驻提交记录失败:', error);
    return NextResponse.json({ error: '获取入驻提交记录失败' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const user = requireUser(request);
  if (user instanceof NextResponse) return user;

  try {
    if (!OSS_AK || !OSS_SK) return NextResponse.json({ error: '图片上传服务未配置' }, { status: 500 });

    const formData = await request.formData();
    const submissionType = cleanText(formData.get('submission_type'), 30);
    const name = cleanText(formData.get('name'), 200);
    const clubName = cleanText(formData.get('club_name'), 200);
    const contactInfo = cleanText(formData.get('contact_info'), 255);
    const locationNote = cleanText(formData.get('location_note'), 255);
    const roles = cleanRoles(formData);
    const profileFiles = getFiles(formData, 'profile_images');
    const clubFiles = getFiles(formData, 'club_photos');
    const certificateFiles = getFiles(formData, 'certificate_images');
    const licenseFiles = getFiles(formData, 'license_images');

    if (submissionType !== 'professional' && submissionType !== 'club') {
      return NextResponse.json({ error: '请选择入驻类型' }, { status: 400 });
    }
    if (!name) return NextResponse.json({ error: submissionType === 'club' ? '请填写俱乐部名称' : '请填写姓名' }, { status: 400 });
    if (submissionType === 'professional' && roles.length === 0) {
      return NextResponse.json({ error: '请选择教练员、裁判员或俱乐部负责人身份' }, { status: 400 });
    }
    if (submissionType === 'professional' && profileFiles.length + certificateFiles.length + licenseFiles.length === 0) {
      return NextResponse.json({ error: '请至少上传一张本人照片或证件照片' }, { status: 400 });
    }
    if (submissionType === 'club' && clubFiles.length === 0) {
      return NextResponse.json({ error: '请至少上传一张清晰的俱乐部照片' }, { status: 400 });
    }

    for (const [files, label] of [
      [profileFiles, '本人/工作照片'],
      [clubFiles, '俱乐部照片'],
      [certificateFiles, '证书照片'],
      [licenseFiles, '证明材料'],
    ] as const) {
      const error = validateImageFiles(files, label);
      if (error) return NextResponse.json({ error }, { status: 400 });
    }

    const profileImages = await Promise.all(profileFiles.map((file) => uploadImageToOss(file, user.user_id, submissionType, 'profile')));
    const clubPhotos = await Promise.all(clubFiles.map((file) => uploadImageToOss(file, user.user_id, submissionType, 'club')));
    const certificateImages = await Promise.all(certificateFiles.map((file) => uploadImageToOss(file, user.user_id, submissionType, 'certificate')));
    const licenseImages = await Promise.all(licenseFiles.map((file) => uploadImageToOss(file, user.user_id, submissionType, 'license')));

    const ocrImages = [...certificateImages, ...licenseImages, ...profileImages, ...clubPhotos];
    const ocr = await runIndustrySubmissionOcr(ocrImages);
    const ocrStatus = ocr.configured ? (ocr.warning && !ocr.text ? 'failed' : 'completed') : 'not_configured';

    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO sup_industry_submissions (
         user_id, submission_type, name, roles, club_name, contact_info, location_note,
         profile_images, club_photos, certificate_images, license_images,
         ocr_status, ocr_text, ocr_result_json, status
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [
        user.user_id,
        submissionType,
        name,
        JSON.stringify(roles),
        clubName,
        contactInfo,
        locationNote,
        JSON.stringify(profileImages),
        JSON.stringify(clubPhotos),
        JSON.stringify(certificateImages),
        JSON.stringify(licenseImages),
        ocrStatus,
        ocr.text || null,
        JSON.stringify({ provider: ocr.provider, parsed: ocr.parsed, warning: ocr.warning || null }),
      ]
    );

    return NextResponse.json({
      success: true,
      submission_id: result.insertId,
      status: 'pending',
      ocr_status: ocrStatus,
      ocr_warning: ocr.warning || null,
    }, { status: 201 });
  } catch (error) {
    console.error('提交行业入驻资料失败:', error);
    return NextResponse.json({ error: '提交入驻资料失败' }, { status: 500 });
  }
}
