import { expect, test } from '@playwright/test';

test.describe('运动员中心', () => {
  test('列表分页页不展示号码或操作列，并可从运动员头像进入详情', async ({ page }) => {
    const response = await page.goto('/athletes');
    if (response?.status() === 500) test.skip(true, '当前环境没有可用数据库连接');

    await expect(page.getByRole('heading', { name: '运动员中心' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '运动员列表' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: '操作' })).toHaveCount(0);

    const table = page.locator('table');
    await expect(table).toBeVisible();
    await expect(table).not.toContainText(/#[A-Za-z0-9]+/);

    const firstAthleteLink = page.locator('tbody tr').first().locator('a').first();
    await expect(firstAthleteLink).toBeVisible();
    await firstAthleteLink.click();
    await expect(page).toHaveURL(/\/athletes\/\d+/);
  });
});
