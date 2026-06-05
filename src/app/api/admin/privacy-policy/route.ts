/**
 * 数据与隐私说明 后台管理 API
 * GET  /api/admin/privacy-policy → 当前配置
 * PUT  /api/admin/privacy-policy → 更新 { title, sections:[{title,body}] }
 */
import { NextResponse } from 'next/server';
import { withAdmin } from '@/lib/admin';
import { getPrivacyPolicy, savePrivacyPolicy } from '@/lib/privacy-policy';

export const GET = withAdmin(async () => {
  return NextResponse.json(await getPrivacyPolicy());
});

export const PUT = withAdmin(async request => {
  const body = await request.json().catch(() => ({}));
  const title = String(body.title || '').trim();
  const sections = Array.isArray(body.sections) ? body.sections : [];
  if (!title) return NextResponse.json({ error: '请填写标题' }, { status: 400 });
  const cleaned = sections
    .map((s: { title?: unknown; body?: unknown }) => ({ title: String(s?.title || '').trim(), body: String(s?.body || '').trim() }))
    .filter((s: { title: string; body: string }) => s.title || s.body);
  if (!cleaned.length) return NextResponse.json({ error: '至少保留一段说明' }, { status: 400 });
  await savePrivacyPolicy({ title, sections: cleaned });
  return NextResponse.json(await getPrivacyPolicy());
});
