import { test } from '@playwright/test';

test('Capture conversations response', async ({ page }) => {
  page.on('response', async (response) => {
    if (response.url().includes('/api/conversations')) {
      console.log('Status:', response.status());
      console.log('Body:', await response.text());
    }
  });

  await page.goto('http://localhost:5173/login');
  await page.fill('input[type="email"]', 'admin@yacc.local');
  await page.fill('input[type="password"]', 'admin123');
  await page.click('button[type="submit"]');
  await page.waitForURL('http://localhost:5173/');
  await page.waitForTimeout(3000);
});
