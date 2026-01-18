import { test } from '@playwright/test';

test('Inspect inbox content', async ({ page }) => {
  await page.goto('http://localhost:5173/login');
  await page.fill('input[type="email"]', 'admin@yacc.local');
  await page.fill('input[type="password"]', 'admin123');
  await page.click('button[type="submit"]');
  await page.waitForURL('http://localhost:5173/');

  await page.waitForTimeout(3000);
  await page.screenshot({ path: '/tmp/inbox-debug.png', fullPage: true });

  const titles = await page.locator('text=QA Thread').count();
  console.log('QA Thread count:', titles);

  const linkCount = await page.locator('a[href^="/conversations/"]').count();
  console.log('Conversation link count:', linkCount);
});
