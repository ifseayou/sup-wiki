import { NextRequest, NextResponse } from 'next/server';
import { extractToken, verifyToken, isAdmin } from '@/lib/auth';
import { callSportHackerInternal } from '@/lib/sport-hacker-client';

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
  const r = await callSportHackerInternal(`/api/sup-wiki/internal/event-submissions/${sid}/supplement`, {
    event_id: body.event_id,
    event: body.event,
    admin_note: body.admin_note || '',
  });
  return NextResponse.json(r.data, { status: r.status });
}
