import { test, expect, type Page } from '@playwright/test';

const FRONTEND_URL = process.env.VITE_APP_URL || 'http://localhost:5173';

const loginAsAdmin = async (page: Page) => {
  await page.goto(`${FRONTEND_URL}/login`);
  await page.fill('input[type="email"]', 'admin@yacc.local');
  await page.fill('input[type="password"]', 'admin123');
  await page.click('button[type="submit"]');
  await page.waitForURL(`${FRONTEND_URL}/`);
};

test.describe('Regression Test Suite (UI)', () => {
  test('REGR_001: Login + Inbox Load', async ({ page }) => {
    await loginAsAdmin(page);

    await expect(page.locator('text=YACC Inbox')).toBeVisible();
    await expect(page.locator('h3', { hasText: 'Mock Support Thread' })).toBeVisible();
  });

  test('REGR_002: Send Reply + Delivery Status', async ({ page }) => {
    test.skip(true, 'Reply composer UI not available yet.');
    await loginAsAdmin(page);
    await page.locator('a[href="/conversations/1001"]').click();
    await page.waitForURL(`${FRONTEND_URL}/conversations/1001`);
  });

  test('REGR_003: Telegram Inbound Message', async ({ page }) => {
    test.skip(true, 'Telegram inbound simulation not wired in UI fixtures.');
    await loginAsAdmin(page);
  });

  test('REGR_004: IRC Inbound Message', async ({ page }) => {
    test.skip(true, 'IRC fixture data not available for UI validation.');
    await loginAsAdmin(page);
  });

  test('REGR_005: Tag Conversation', async ({ page }) => {
    test.skip(true, 'Tag management UI not implemented yet.');
    await loginAsAdmin(page);
  });

  test('REGR_006: Assign + Notification', async ({ page }) => {
    test.skip(true, 'Assignment/notification UI not implemented yet.');
    await loginAsAdmin(page);
  });

  test('REGR_007: Bulk Assign + Partial Failure', async ({ page }) => {
    test.skip(true, 'Bulk action UI not implemented yet.');
    await loginAsAdmin(page);
  });

  test('REGR_008: Search + Filters', async ({ page }) => {
    await loginAsAdmin(page);

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
    await prioritySelect.selectOption('medium');
    await expect(page.locator('button', { hasText: 'Priority: medium' })).toBeVisible();
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

  test('REGR_009: Message Retry', async ({ page }) => {
    test.skip(true, 'Message retry UI not implemented yet.');
    await loginAsAdmin(page);
  });

  test('REGR_010: Audit Log Query + Export', async ({ page }) => {
    test.skip(true, 'Audit log UI not implemented yet.');
    await loginAsAdmin(page);
  });

  test('REGR_011: WebSocket Reconnect', async ({ page }) => {
    test.skip(true, 'WebSocket client reconnect UI not available yet.');
    await loginAsAdmin(page);
  });

  test('REGR_012: Rules Execution', async ({ page }) => {
    test.skip(true, 'Rules UI not implemented yet.');
    await loginAsAdmin(page);
  });
});
