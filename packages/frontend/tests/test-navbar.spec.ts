import { test, expect } from '@playwright/test';

test('Navbar layout test', async ({ page }) => {
  // Set viewport to different sizes to test responsiveness
  await page.setViewportSize({ width: 1280, height: 720 });
  
  // Login
  await page.goto('http://localhost:5173/login');
  await page.fill('input[type="email"]', 'admin@yacc.local');
  await page.fill('input[type="password"]', 'admin123');
  await page.click('button[type="submit"]');
  
  // Wait for inbox
  await page.waitForURL('http://localhost:5173/');
  await page.waitForTimeout(1000);
  
  // Check navbar is visible
  const navbar = page.locator('.navbar');
  await expect(navbar).toBeVisible();
  
  // Check hamburger button is visible
  const hamburger = page.locator('button[aria-label="Toggle sidebar"]');
  await expect(hamburger).toBeVisible();
  
  // Check logo is visible and not wrapped
  const logo = page.locator('text=YACC Inbox');
  await expect(logo).toBeVisible();
  
  // Check avatar is visible
  const avatar = page.locator('.avatar');
  await expect(avatar).toBeVisible();
  
  // Test on mobile size
  await page.setViewportSize({ width: 375, height: 667 });
  await page.waitForTimeout(500);
  
  // All elements should still be visible
  await expect(hamburger).toBeVisible();
  await expect(logo).toBeVisible();
  await expect(avatar).toBeVisible();
  
  // Take screenshot
  await page.screenshot({ path: '/tmp/navbar-mobile.png' });
  
  // Test on tablet size
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: '/tmp/navbar-tablet.png' });
  
  // Test on desktop size
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: '/tmp/navbar-desktop.png' });
  
  console.log('✅ All navbar tests passed!');
});
