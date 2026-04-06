import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { generateUserToken } from '@/lib/auth';
import type { RowDataPacket, ResultSetHeader } from 'mysql2';

const SPORT_HACKER_VERIFY = 'https://sport.iaddu.cn/api/sup-wiki/web-code/verify';

export async function POST(request: NextRequest) {
  try {
    const { code } = await request.json();
    if (!code || !/^\d{6}$/.test(String(code))) {
      return NextResponse.json({ error: '请输入6位数字验证码' }, { status: 400 });
    }

    // 1. 调用 sport_hacker 验证接口
    let shUser: { openid: string; nickname: string; avatar?: string } | null = null;
    try {
      const res = await fetch(SPORT_HACKER_VERIFY, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: String(code) }),
        signal: AbortSignal.timeout(8000),
      });
      const data = await res.json();

      if (!res.ok || data.error) {
        return NextResponse.json({ error: data.error || '验证码无效或已过期' }, { status: 401 });
      }

      // 解析 sport_hacker 返回的用户信息
      // 实际返回结构: { user_id, nickname, avatar }
      const userInfo = data.user || data;
      const shUserId = userInfo.user_id || userInfo.userId || userInfo.id;

      if (!shUserId) {
        console.error('sport_hacker verify 返回数据中缺少 user_id:', data);
        return NextResponse.json({ error: '验证失败，请重试' }, { status: 500 });
      }

      shUser = {
        openid: `sh_${shUserId}`,  // 用 sh_前缀+user_id 作为 sup_users 中的唯一标识
        nickname: userInfo.nickname || userInfo.name || '运动骇客用户',
        avatar: userInfo.avatar || userInfo.avatarUrl || userInfo.avatar_url || '',
      };
    } catch (err) {
      console.error('调用 sport_hacker verify 失败:', err);
      return NextResponse.json({ error: '验证服务暂时不可用，请稍后重试' }, { status: 503 });
    }

    // 2. 查/创建 sup_users 记录（以 openid 为唯一键）
    const [existing] = await pool.execute<RowDataPacket[]>(
      'SELECT user_id, nickname, email FROM sup_users WHERE openid = ?',
      [shUser.openid]
    );

    let user: { user_id: number; nickname: string; email: string };

    if (existing.length > 0) {
      // 已有账号 → 直接返回
      user = existing[0] as { user_id: number; nickname: string; email: string };
    } else {
      // 新用户 → 自动注册
      const placeholderEmail = `${shUser.openid}@sport_hacker.local`;
      const [result] = await pool.execute<ResultSetHeader>(
        `INSERT INTO sup_users (nickname, email, openid, password_hash)
         VALUES (?, ?, ?, '')`,
        [shUser.nickname, placeholderEmail, shUser.openid]
      );
      user = {
        user_id: result.insertId,
        nickname: shUser.nickname,
        email: placeholderEmail,
      };
    }

    // 3. 签发 JWT
    const token = generateUserToken(user);
    return NextResponse.json({ success: true, token, user });

  } catch (error) {
    console.error('code-login 失败:', error);
    return NextResponse.json({ error: '登录失败，请重试' }, { status: 500 });
  }
}
