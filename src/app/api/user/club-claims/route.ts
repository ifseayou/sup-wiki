import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import pool from '@/lib/db';
import { requireUser } from '@/lib/user-auth';
import { cleanClubTeamName, isClaimableClubTeamName, normalizeClubTeamName } from '@/lib/club-team-normalization';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';

const OSS_AK = process.env.OSS_ACCESS_KEY_ID || '';
const OSS_SK = process.env.OSS_ACCESS_KEY_SECRET || '';
const OSS_BUCKET = process.env.OSS_BUCKET || 'sport-hacker-assets';
const OSS_ENDPOINT = `${OSS_BUCKET}.oss-cn-hangzhou.aliyuncs.com`;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE = 8 * 1024 * 1024;
const MAX_FILES = 8;

function ossSign(method: string, contentType: string, date: string, ossKey: string) {
  const stringToSign = `${method}\n\n${contentType}\n${date}\n/${OSS_BUCKET}/${ossKey}`;
  const signature = crypto.createHmac('sha1', OSS_SK).update(stringToSign).digest('base64');
  return `OSS ${OSS_AK}:${signature}`;
}

function cleanText(value: FormDataEntryValue | null, max = 255) {
  const text = String(value || '').trim();
  return text ? text.slice(0, max) : null;
}

function getProofFiles(formData: FormData) {
  return formData.getAll('proof_images').filter((item): item is File => item instanceof File && item.size > 0);
}

async function uploadProofImage(file: File, userId: number) {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const safeExt = ['jpg', 'jpeg', 'png', 'webp'].includes(ext) ? ext : 'jpg';
  const ossKey = `sup-wiki/club-claims/${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${safeExt}`;
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
    console.error('俱乐部认领图片上传 OSS 失败:', await ossRes.text());
    throw new Error('图片上传失败');
  }
  const url = `https://${OSS_ENDPOINT}/${ossKey}`;
  try {
    await pool.execute<ResultSetHeader>(
      `INSERT INTO sup_media_assets (url, folder, module, filename, mime_type, size_bytes, source_context, status)
       VALUES (?, 'club-claims', 'club', ?, ?, ?, 'club_claim', 'active')
       ON DUPLICATE KEY UPDATE status = 'active', module = 'club', source_context = 'club_claim'`,
      [url, file.name, file.type, file.size]
    );
  } catch (error) {
    console.error('俱乐部认领图片写入图片库失败:', error);
  }
  return url;
}

export async function GET(request: NextRequest) {
  const user = requireUser(request);
  if (user instanceof NextResponse) return user;

  try {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT cc.*, c.name AS club_name, c.slug AS club_slug, a.team_name_raw, a.result_count, a.event_count
       FROM sup_club_claims cc
       LEFT JOIN sup_clubs c ON c.club_id = COALESCE(cc.created_club_id, cc.club_id)
       LEFT JOIN sup_club_team_aliases a ON a.alias_id = cc.alias_id
       WHERE cc.user_id = ?
       ORDER BY cc.created_at DESC
       LIMIT 30`,
      [user.user_id]
    );
    return NextResponse.json({ items: rows });
  } catch (error) {
    console.error('获取俱乐部认领提交失败:', error);
    return NextResponse.json({ error: '获取俱乐部认领提交失败' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const user = requireUser(request);
  if (user instanceof NextResponse) return user;

  try {
    if (!OSS_AK || !OSS_SK) return NextResponse.json({ error: '图片上传服务未配置' }, { status: 500 });
    const formData = await request.formData();
    const submittedClubName = cleanClubTeamName(formData.get('club_name'));
    const aliasId = Number(cleanText(formData.get('alias_id'), 30) || 0) || null;
    const clubId = Number(cleanText(formData.get('club_id'), 30) || 0) || null;
    const submittedRole = cleanText(formData.get('submitted_role'), 100);
    const contactInfo = cleanText(formData.get('contact_info'), 255);
    const claimNote = cleanText(formData.get('claim_note'), 2000);
    const aliasNames = Array.from(new Set([
      ...(cleanText(formData.get('alias_names'), 1000) || '').split(/[\n,，、;；/]+/),
      submittedClubName,
    ].map(cleanClubTeamName).filter(isClaimableClubTeamName)));
    const files = getProofFiles(formData);

    if (!submittedClubName) return NextResponse.json({ error: '请填写俱乐部或队伍名称' }, { status: 400 });
    if (!contactInfo) return NextResponse.json({ error: '请填写联系方式，便于管理员核对' }, { status: 400 });
    if (!submittedRole) return NextResponse.json({ error: '请填写你与俱乐部的关系' }, { status: 400 });
    if (files.length === 0 && !claimNote) return NextResponse.json({ error: '请上传证明图片，或在说明里补充可核验依据' }, { status: 400 });
    if (files.length > MAX_FILES) return NextResponse.json({ error: `证明图片最多上传 ${MAX_FILES} 张` }, { status: 400 });
    for (const file of files) {
      if (!ALLOWED_TYPES.includes(file.type)) return NextResponse.json({ error: `${file.name} 不是支持的图片格式` }, { status: 400 });
      if (file.size > MAX_SIZE) return NextResponse.json({ error: `${file.name} 超过 8MB` }, { status: 400 });
    }

    let matchedAliasId = aliasId;
    if (matchedAliasId) {
      const [aliasRows] = await pool.execute<RowDataPacket[]>('SELECT alias_id FROM sup_club_team_aliases WHERE alias_id = ? LIMIT 1', [matchedAliasId]);
      if (!aliasRows.length) matchedAliasId = null;
    }
    if (!matchedAliasId && isClaimableClubTeamName(submittedClubName)) {
      const normalized = normalizeClubTeamName(submittedClubName);
      const [aliasRows] = await pool.execute<RowDataPacket[]>('SELECT alias_id FROM sup_club_team_aliases WHERE normalized_name = ? LIMIT 1', [normalized]);
      matchedAliasId = aliasRows[0] ? Number(aliasRows[0].alias_id) : null;
    }

    const proofImages = await Promise.all(files.map((file) => uploadProofImage(file, user.user_id)));
    const [inserted] = await pool.execute<ResultSetHeader>(
      `INSERT INTO sup_club_claims (
         user_id, club_id, alias_id, submitted_club_name, submitted_alias_names,
         submitted_role, contact_info, claim_note, proof_images, status
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [
        user.user_id,
        clubId,
        matchedAliasId,
        submittedClubName,
        JSON.stringify(aliasNames),
        submittedRole,
        contactInfo,
        claimNote,
        JSON.stringify(proofImages),
      ]
    );

    return NextResponse.json({ success: true, claim_id: inserted.insertId, status: 'pending' }, { status: 201 });
  } catch (error) {
    console.error('提交俱乐部认领失败:', error);
    return NextResponse.json({ error: '提交俱乐部认领失败' }, { status: 500 });
  }
}
