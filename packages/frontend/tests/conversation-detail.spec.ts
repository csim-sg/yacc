import { test, expect } from '@playwright/test';

const roles = [
  { label: 'Super Admin', email: 'admin@yacc.local', password: 'admin123' },
  { label: 'Admin', email: 'admin2@yacc.local', password: 'admin123' },
  { label: 'Manager', email: 'manager@yacc.local', password: 'admin123' },
  { label: 'User', email: 'user@yacc.local', password: 'admin123' },
];

for (const role of roles) {
  test(`Conversation detail view (${role.label})`, async ({ page }) => {


  await page.goto('http://localhost:5173/login');
  await page.fill('input[type="email"]', role.email);
  await page.fill('input[type="password"]', role.password);
  await page.click('button[type="submit"]');
  await page.waitForURL('http://localhost:5173/');

  await expect(page.locator('text=Mock Support Thread')).toBeVisible();
  await page.locator('a[href="/conversations/1001"]').click();
  await page.waitForURL('http://localhost:5173/conversations/1001');

  await expect(page.locator('text=Conversation')).toBeVisible();
  await expect(page.locator('text=Messages')).toBeVisible();
  await expect(page.locator('text=Hello from Telegram')).toBeVisible();
  await expect(page.locator('text=We are looking into this.').first()).toBeVisible();
  await expect(page.locator('text=This message failed to send.').first()).toBeVisible();
  await expect(page.locator('text=Any updates?')).toBeVisible();
  });
}
