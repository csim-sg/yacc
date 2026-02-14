import { test, expect } from '@playwright/test';

const FRONTEND_URL = process.env.VITE_APP_URL || 'http://localhost:5173';

test.describe('Inbox filters and search', () => {
  test('filters conversations by search, status, priority, and channel', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/login`);
    await page.fill('input[type="email"]', 'admin@yacc.local');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await page.waitForURL(`${FRONTEND_URL}/`);

    const conversationTitle = page.locator('h3', { hasText: 'Mock Support Thread' });
    await expect(conversationTitle).toBeVisible();

    const searchInput = page.getByPlaceholder('Search conversations');
    await searchInput.fill('Mock Support Thread');
    await page.getByRole('button', { name: 'Search' }).click();
    await expect(page.locator('button', { hasText: 'Search: Mock Support Thread' })).toBeVisible();
    await expect(conversationTitle).toBeVisible();

    const statusSelect = page.locator('select').filter({ hasText: 'All Statuses' });
    await statusSelect.selectOption('resolved');
    await expect(page.locator('button', { hasText: 'Status: resolved' })).toBeVisible();
    await expect(conversationTitle).toBeVisible();

     const prioritySelect = page.locator('select').filter({ hasText: 'All Priorities' });
    await prioritySelect.selectOption('normal');
    await expect(page.locator('button', { hasText: 'Priority: normal' })).toBeVisible();
    await expect(conversationTitle).toBeVisible();

    await page.locator('aside').getByRole('button', { name: 'Telegram' }).click();
    await expect(page.locator('button', { hasText: 'Channel: Telegram' })).toBeVisible();
    await expect(conversationTitle).toBeVisible();

    await page.getByRole('button', { name: 'Clear Filters' }).click();
    await expect(page.locator('button', { hasText: 'Search: Mock Support Thread' })).toHaveCount(0);
    await expect(page.locator('button', { hasText: 'Status: resolved' })).toHaveCount(0);
    await expect(page.locator('button', { hasText: 'Priority: medium' })).toHaveCount(0);
    await expect(page.locator('button', { hasText: 'Channel: Telegram' })).toHaveCount(0);
    await expect(conversationTitle).toBeVisible();
  });
});
