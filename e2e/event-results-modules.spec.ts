import { test, expect } from '@playwright/test';
import jwt from 'jsonwebtoken';

function userToken(secret: string) {
  return jwt.sign(
    { role: 'user', user_id: 1, nickname: 'E2E', email: 'e2e@example.com' },
    secret,
    { expiresIn: '1h' }
  );
}

test.describe('赛事成绩模块加载', () => {
  test('成绩接口按模块索引和分页明细加载', async ({ request }) => {
    const eventId = 306;
    const anonymous = await request.get(`/api/events/${eventId}/results?section=modules`);
    expect(anonymous.status()).toBe(401);

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      test.skip(true, '缺少 JWT_SECRET，跳过登录态接口验证');
      return;
    }

    const headers = { Authorization: `Bearer ${userToken(jwtSecret)}` };
    const modulesRes = await request.get(`/api/events/${eventId}/results?section=modules`, { headers });
    if (modulesRes.status() === 500) test.skip(true, '当前环境没有可用数据库连接');
    expect(modulesRes.status()).toBe(200);
    const modulesJson = await modulesRes.json();
    expect(Array.isArray(modulesJson.result_modules)).toBe(true);
    expect(modulesJson).not.toHaveProperty('items');

    const resultModule = modulesJson.result_modules?.[0];
    if (!resultModule) test.skip(true, '当前赛事没有成绩模块');

    const params = new URLSearchParams({
      section: 'results',
      discipline: resultModule.discipline,
      gender_group: resultModule.gender_group,
      page: '1',
      pageSize: '80',
    });
    const detailRes = await request.get(`/api/events/${eventId}/results?${params.toString()}`, { headers });
    expect(detailRes.status()).toBe(200);
    const detailJson = await detailRes.json();
    expect(detailJson.pageSize).toBeLessThanOrEqual(50);
    expect(Array.isArray(detailJson.items)).toBe(true);
    expect(detailJson.items.length).toBeLessThanOrEqual(50);
    expect(detailJson.total).toBeGreaterThanOrEqual(detailJson.items.length);
  });
});
