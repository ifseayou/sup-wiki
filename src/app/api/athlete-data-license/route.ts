/**
 * 运动员数据许可协议（公开/内部读取）
 * GET /api/athlete-data-license → { title, sections:[{title,body}], version }
 * 小程序经内部网关读取，在认领/绑定页展示并要求勾选同意。
 */
import { NextResponse } from 'next/server';
import { getAthleteDataLicense } from '@/lib/athlete-data-license';

export async function GET() {
  try {
    const license = await getAthleteDataLicense();
    return NextResponse.json(license);
  } catch (error) {
    console.error('获取运动员数据许可协议失败:', error);
    return NextResponse.json({ error: '获取运动员数据许可协议失败' }, { status: 500 });
  }
}
