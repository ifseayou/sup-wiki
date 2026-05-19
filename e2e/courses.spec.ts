import { test, expect } from '@playwright/test';

test.describe('课程模块', () => {
  test('Header 包含课程导航且位于学习之后', async ({ page }) => {
    await page.goto('/');
    const nav = page.locator('header nav').first();
    await expect(nav.locator('a[href="/learn"]').first()).toBeVisible();
    await expect(nav.locator('a[href="/courses"]').first()).toBeVisible();

    const labels = await nav.locator('a').evaluateAll((links) =>
      links.map((link) => link.textContent?.trim())
    );
    expect(labels.indexOf('课程')).toBeGreaterThan(labels.indexOf('学习'));
  });

  test('课程列表页展示初始化课程', async ({ page }) => {
    await page.goto('/courses');
    await expect(page.locator('h1')).toContainText('余杭塘河桨板课程');
    await expect(page.getByRole('heading', { name: '桨板体验' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '桨板入门课' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '桨板进阶课' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '入门&进阶' })).toBeVisible();
    await expect(page.locator('a[href="/courses/sup-beginner"]')).toBeVisible();
    await expect(page.locator('body')).toContainText('查看课程详情');
  });

  test('课程详情页按 slug 展示完整内容', async ({ page }) => {
    await page.goto('/courses/sup-beginner');
    await expect(page.locator('h1')).toContainText('桨板入门课');
    await expect(page.locator('body')).toContainText('598元/3小时/人');
    await expect(page.locator('body')).toContainText('中流击水桨板俱乐部（余杭塘河-梦想小镇段）');
    await expect(page.locator('body')).toContainText('技术动作安排');
    await expect(page.locator('body')).toContainText('微信咨询课程');
  });

  test('课程公开 API 返回课程和技术动作', async ({ page }) => {
    const res = await page.request.get('/api/courses');
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json).toHaveProperty('items');
    expect(Array.isArray(json.items)).toBe(true);
    expect(json.items.length).toBeGreaterThanOrEqual(4);

    const beginner = json.items.find((item: { slug: string }) => item.slug === 'sup-beginner');
    expect(beginner).toBeTruthy();
    expect(beginner).toHaveProperty('cover_image');
    expect(Array.isArray(beginner.images)).toBe(true);
    expect(Array.isArray(beginner.techniques)).toBe(true);
    expect(beginner.techniques.length).toBeGreaterThan(0);
  });
});
