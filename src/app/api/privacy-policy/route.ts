/**
 * 数据与隐私说明（公开/内部读取）
 * GET /api/privacy-policy → { title, sections:[{title,body}] }
 * 小程序经内部网关读取此接口展示隐私说明。
 */
import { NextResponse } from 'next/server';
import { getPrivacyPolicy } from '@/lib/privacy-policy';

export async function GET() {
  try {
    const policy = await getPrivacyPolicy();
    return NextResponse.json(policy);
  } catch (error) {
    console.error('获取隐私说明失败:', error);
    return NextResponse.json({ error: '获取隐私说明失败' }, { status: 500 });
  }
}
