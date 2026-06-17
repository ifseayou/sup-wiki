import { NextRequest, NextResponse } from 'next/server';
import { extractToken, verifyToken, isAdmin } from '@/lib/auth';
import pool from '@/lib/db';

function ensureAdmin(request: NextRequest) {
  const token = extractToken(request.headers.get('authorization'));
  const payload = token ? verifyToken(token) : null;
  return isAdmin(payload);
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!ensureAdmin(request)) return NextResponse.json({ error: '需要管理员权限' }, { status: 403 });
  const { id } = await params;
  const sid = Number(id);
  if (!Number.isInteger(sid) || sid <= 0) return NextResponse.json({ error: '无效提报 ID' }, { status: 400 });
  const body = await request.json().catch(() => ({}));
  const adminNote = String(body.admin_note || '').slice(0, 1000) || null;
  await pool.execute(
    "UPDATE sup_event_submissions SET review_status = 'rejected', admin_note = ? WHERE submission_id = ?",
    [adminNote, sid]
  );
  return NextResponse.json({ success: true });
}
