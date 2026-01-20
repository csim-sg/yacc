import { test } from '@playwright/test';

test('Inbox UI Screenshot', async ({ page }) => {
  // Login
  await page.goto('http://localhost:5173/login');
  await page.fill('input[type="email"]', 'admin@yacc.local');
  await page.fill('input[type="password"]', 'admin123');
  await page.click('button[type="submit"]');
  
  // Wait for inbox
  await page.waitForURL('http://localhost:5173/');
  await page.waitForTimeout(1000);
  
  // Take screenshot with sidebar open
  await page.screenshot({ path: '/tmp/inbox-sidebar-open.png', fullPage: true });
  
  // Toggle sidebar closed
  await page.click('button[aria-label="Toggle sidebar"]');
  await page.waitForTimeout(500);
  
  // Take screenshot with sidebar closed
  await page.screenshot({ path: '/tmp/inbox-sidebar-closed.png', fullPage: true });
  
  console.log('Screenshots saved!');
});
