/**
 * 运动员数据许可协议 后台管理 API
 * GET  /api/admin/athlete-data-license → 当前配置
 * PUT  /api/admin/athlete-data-license → 更新 { title, sections:[{title,body}], version }
 */
import { NextResponse } from 'next/server';
import { withAdmin } from '@/lib/admin';
import { getAthleteDataLicense, saveAthleteDataLicense } from '@/lib/athlete-data-license';

export const GET = withAdmin(async () => {
  return NextResponse.json(await getAthleteDataLicense());
});

export const PUT = withAdmin(async request => {
  const body = await request.json().catch(() => ({}));
  const title = String(body.title || '').trim();
  const version = String(body.version || '').trim();
  const sections = Array.isArray(body.sections) ? body.sections : [];
  if (!title) return NextResponse.json({ error: '请填写标题' }, { status: 400 });
  if (!version) return NextResponse.json({ error: '请填写协议版本号（如 2026-06-05）' }, { status: 400 });
  const cleaned = sections
    .map((s: { title?: unknown; body?: unknown }) => ({ title: String(s?.title || '').trim(), body: String(s?.body || '').trim() }))
    .filter((s: { title: string; body: string }) => s.title || s.body);
  if (!cleaned.length) return NextResponse.json({ error: '至少保留一段协议内容' }, { status: 400 });
  await saveAthleteDataLicense({ title, sections: cleaned, version });
  return NextResponse.json(await getAthleteDataLicense());
});
