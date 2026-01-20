import { test, expect } from '@playwright/test';

test('Sidebar responsive test', async ({ page }) => {
  // Login
  await page.goto('http://localhost:5173/login');
  await page.fill('input[type="email"]', 'admin@yacc.local');
  await page.fill('input[type="password"]', 'admin123');
  await page.click('button[type="submit"]');
  await page.waitForURL('http://localhost:5173/');
  await page.waitForTimeout(1000);

  // Mobile view
  await page.setViewportSize({ width: 375, height: 667 });
  await page.waitForTimeout(1000);
  
  const hamburger = page.locator('button[aria-label="Toggle sidebar"]');
  
  // On mobile, hamburger should be visible
  await expect(hamburger).toBeVisible();
  console.log('✅ Hamburger visible on mobile');
  
  // Take screenshot
  await page.screenshot({ path: '/tmp/mobile-view.png', fullPage: true });
  
  // Desktop view
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.waitForTimeout(1000);
  
  // On desktop, hamburger should be hidden
  await expect(hamburger).toBeHidden();
  console.log('✅ Hamburger hidden on desktop');
  
  // Sidebar should be visible
  const sidebar = page.locator('aside.menu, aside ul.menu').first();
  await expect(sidebar).toBeVisible();
  console.log('✅ Sidebar visible on desktop');
  
  // Take screenshot
  await page.screenshot({ path: '/tmp/desktop-view.png', fullPage: true });
  
  console.log('✅ All tests passed!');
});
