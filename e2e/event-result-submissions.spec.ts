import { test, expect } from '@playwright/test';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';

function userToken() {
  const envPath = path.join(process.cwd(), '.env.local');
  const envText = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
  const jwtSecret = envText
    .split(/\r?\n/)
    .map((line) => line.match(/^JWT_SECRET=(.*)$/)?.[1]?.trim())
    .find(Boolean)
    ?.replace(/^['"]|['"]$/g, '') || process.env.JWT_SECRET || 'sup-wiki-secret-key';

  return jwt.sign(
    { role: 'user', user_id: 1, nickname: 'E2E', email: 'e2e@example.com' },
    jwtSecret,
    { expiresIn: '1h' }
  );
}

test.describe('赛事成绩册上传', () => {
  test('赛事页上传入口面向普通用户而不是管理员后台', async ({ page }) => {
    await page.goto('/events?search=不存在的赛事成绩册测试');
    const uploadLinks = page.getByRole('link', { name: '上传赛事成绩册' });
    await expect(uploadLinks.first()).toBeVisible();
    await expect(uploadLinks.first()).toHaveAttribute('href', /\/events\/upload-results/);
    await expect(uploadLinks.first()).not.toHaveAttribute('href', /\/admin/);
  });

  test('成绩查询无匹配结果时展示上传成绩册入口', async ({ page }) => {
    await page.route('**/api/results?**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [],
          total: 0,
          totalPages: 1,
          stats: { resultCount: 0, athleteCount: 0, eventCount: 0 },
        }),
      });
    });

    await page.goto('/results');
    await expect(page.getByRole('heading', { name: '未找到相关成绩记录' })).toBeVisible();
    const uploadLink = page.getByRole('link', { name: '上传比赛成绩册' });
    await expect(uploadLink).toBeVisible();
    await expect(uploadLink).toHaveAttribute('href', /\/events\/upload-results/);
    await expect(page.getByText('仅支持 PDF，单个文件不超过 20MB')).toBeVisible();
  });

  test('上传页未登录时引导登录并显示客服微信', async ({ page }, testInfo) => {
    await page.goto('/events/upload-results?event_id=123&event_name=测试赛事&event_date=2026-05-29&location=测试水域');
    await expect(page.getByRole('heading', { name: '上传赛事成绩册' })).toBeVisible();
    await expect(page.getByText('请先登录后上传')).toBeVisible();
    await expect(page.getByRole('link', { name: '登录后上传' })).toHaveAttribute('href', /\/login\?redirect=/);
    await expect(page.getByText('客服微信：i_add_u')).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('upload-results-login-gate.png'), fullPage: true });
  });

  test('上传页只要求上传 PDF 成绩册', async ({ page }) => {
    await page.addInitScript((token) => {
      localStorage.setItem('sup_user_token', token as string);
    }, userToken());
    await page.route('**/api/user/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ user: { user_id: 1, nickname: 'E2E', email: 'e2e@example.com' } }),
      });
    });

    await page.goto('/events/upload-results?event_id=123&event_name=测试赛事&event_date=2026-05-29&location=测试水域');
    await expect(page.getByLabel('PDF 成绩册')).toBeVisible();
    await expect(page.getByLabel('赛事名称')).toHaveCount(0);
    await expect(page.getByLabel('赛事日期')).toHaveCount(0);
    await expect(page.getByLabel('举办地')).toHaveCount(0);
    await expect(page.getByLabel('备注')).toHaveCount(0);
  });

  test('上传接口必须登录', async ({ request }) => {
    const res = await request.post('/api/user/event-result-submissions', {
      multipart: {
        file: {
          name: 'result.pdf',
          mimeType: 'application/pdf',
          buffer: Buffer.from('%PDF-1.4\n%%EOF'),
        },
      },
    });
    expect(res.status()).toBe(401);
  });

  test('上传接口拒绝非 PDF 与伪装 PDF', async ({ request }) => {
    const headers = { Authorization: `Bearer ${userToken()}` };

    const textRes = await request.post('/api/user/event-result-submissions', {
      headers,
      multipart: {
        file: {
          name: 'result.txt',
          mimeType: 'text/plain',
          buffer: Buffer.from('not pdf'),
        },
      },
    });
    expect(textRes.status()).toBe(400);
    await expect(textRes.json()).resolves.toEqual(expect.objectContaining({ error: '仅支持 PDF 成绩册' }));

    const fakePdfRes = await request.post('/api/user/event-result-submissions', {
      headers,
      multipart: {
        file: {
          name: 'result.pdf',
          mimeType: 'application/pdf',
          buffer: Buffer.from('not pdf'),
        },
      },
    });
    expect(fakePdfRes.status()).toBe(400);
    await expect(fakePdfRes.json()).resolves.toEqual(expect.objectContaining({ error: '文件内容不是有效 PDF' }));
  });
});
