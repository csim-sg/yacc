import { test } from '@playwright/test';

test('Debug inbox auth', async ({ page }) => {
  await page.goto('http://localhost:5173/login');
  await page.fill('input[type="email"]', 'admin@yacc.local');
  await page.fill('input[type="password"]', 'admin123');
  await page.click('button[type="submit"]');
  await page.waitForURL('http://localhost:5173/');

  await page.waitForTimeout(3000);
  await page.screenshot({ path: '/tmp/inbox-auth-debug.png', fullPage: true });

  const alert = page.locator('.alert-error');
  if (await alert.count()) {
    console.log('Error alert:', await alert.textContent());
  }

  const linkCount = await page.locator('a[href^="/conversations/"]').count();
  console.log('Conversation link count:', linkCount);
});
