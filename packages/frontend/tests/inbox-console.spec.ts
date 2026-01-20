import { test } from '@playwright/test';

test('Capture browser console errors', async ({ page }) => {
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      console.log('Console error:', msg.text());
    }
  });

  await page.goto('http://localhost:5173/login');
  await page.fill('input[type="email"]', 'admin@yacc.local');
  await page.fill('input[type="password"]', 'admin123');
  await page.click('button[type="submit"]');
  await page.waitForURL('http://localhost:5173/');
  await page.waitForTimeout(3000);
});
