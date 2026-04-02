import { NextRequest, NextResponse } from 'next/server';
import { authenticateAdmin } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { password } = body;

    if (!password) {
      return NextResponse.json({ error: '请输入密码' }, { status: 400 });
    }

    const token = authenticateAdmin(password);
    if (!token) {
      return NextResponse.json({ error: '密码错误' }, { status: 401 });
    }

    return NextResponse.json({ success: true, token });
  } catch {
    return NextResponse.json({ error: '登录失败' }, { status: 500 });
  }
}
