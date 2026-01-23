import { test } from '@playwright/test';

test('Inspect inbox for debug', async ({ page }) => {
  await page.goto('http://localhost:5173/login');
  await page.fill('input[type="email"]', 'admin@yacc.local');
  await page.fill('input[type="password"]', 'admin123');
  await page.click('button[type="submit"]');
  await page.waitForURL('http://localhost:5173/');

  await page.waitForTimeout(2000);
  await page.screenshot({ path: '/tmp/inbox-debug.png', fullPage: true });

  const html = await page.content();
  console.log('Has conversation link:', html.includes('/conversations/'));
});
