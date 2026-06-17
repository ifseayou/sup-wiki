import { NextRequest, NextResponse } from 'next/server';
import { withAdmin } from '@/lib/admin';
import { callSportHackerInternal } from '@/lib/sport-hacker-client';

// 手动触发 sport_hacker 端的「中国桨板」公众号抓取（fire-and-forget）
export const POST = withAdmin(async (request: NextRequest) => {
  try {
    const body = await request.json().catch(() => ({}));
    const maxPerRun = Number(body.maxPerRun) || 10;
    const r = await callSportHackerInternal('/api/sup-wiki/internal/wechat-crawl/run', { maxPerRun });
    return NextResponse.json(r.data, { status: r.status });
  } catch (error) {
    console.error('触发公众号抓取失败:', error);
    return NextResponse.json({ error: '触发失败' }, { status: 500 });
  }
});
