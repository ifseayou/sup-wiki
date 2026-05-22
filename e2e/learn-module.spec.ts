import { expect, test } from '@playwright/test';

test.describe('学习模块', () => {
  test('导航中学习位于赛事后面，且学习页不展示国内媒体平台', async ({ page }) => {
    await page.goto('/learn');

    const navLinks = page.locator('header nav').first().locator('a');
    await expect(navLinks.filter({ hasText: '赛事' })).toBeVisible();
    await expect(navLinks.filter({ hasText: '学习' })).toBeVisible();

    const labels = await navLinks.allTextContents();
    expect(labels.indexOf('学习')).toBe(labels.indexOf('赛事') + 1);

    await expect(page.getByRole('heading', { name: '桨板知识系统学习' })).toBeVisible();
    await expect(page.getByText('媒体与官方平台')).toBeVisible();
    await expect(page.getByText('中国水上运动资讯网')).toHaveCount(0);
  });
});
