import { test, expect } from '@playwright/test';

test.describe('商城页面', () => {
  test('商城列表页可正常加载', async ({ page }) => {
    await page.goto('/shop');
    await expect(page).toHaveTitle(/SUP/);
    await expect(page.locator('h1')).toContainText('桨板严选商城');
  });

  test('筛选分类 board 可正常工作', async ({ page }) => {
    await page.goto('/shop?category=board');
    await expect(page.locator('h1')).toContainText('桨板严选商城');
    // 筛选条不报错即可
    await expect(page.locator('body')).not.toContainText('500');
  });

  test('Header 包含商城导航链接', async ({ page }) => {
    await page.goto('/');
    const shopLink = page.locator('a[href="/shop"]');
    await expect(shopLink.first()).toBeVisible();
  });

  test('商城详情页 - 无效 ID 返回 404', async ({ page }) => {
    const res = await page.goto('/shop/999999');
    expect(res?.status()).toBe(404);
  });

  test('商城公开 API - 返回 JSON 数组', async ({ page }) => {
    const res = await page.request.get('/api/shop-items');
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json).toHaveProperty('items');
    expect(Array.isArray(json.items)).toBe(true);
  });

  test('商城分类筛选 API', async ({ page }) => {
    const res = await page.request.get('/api/shop-items?category=board');
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json).toHaveProperty('items');
  });
});

test.describe('微信咨询卡片（有商品时）', () => {
  test('详情页包含客服微信号', async ({ page }) => {
    // 先拿一个已发布商品
    const listRes = await page.request.get('/api/shop-items?pageSize=1');
    const listJson = await listRes.json();
    if (listJson.items.length === 0) {
      test.skip(); // 暂无发布商品，跳过
      return;
    }
    const id = listJson.items[0].shop_item_id;
    await page.goto(`/shop/${id}`);
    await expect(page.locator('text=19012881990')).toBeVisible();
  });

  test('详情页复制微信号按钮存在', async ({ page }) => {
    const listRes = await page.request.get('/api/shop-items?pageSize=1');
    const listJson = await listRes.json();
    if (listJson.items.length === 0) {
      test.skip();
      return;
    }
    const id = listJson.items[0].shop_item_id;
    await page.goto(`/shop/${id}`);
    await expect(page.locator('button', { hasText: '复制' })).toBeVisible();
  });
});
