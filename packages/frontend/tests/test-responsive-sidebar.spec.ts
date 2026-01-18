import { test, expect } from '@playwright/test';

test('Responsive sidebar behavior', async ({ page }) => {
  // Login first
  await page.goto('http://localhost:5173/login');
  await page.fill('input[type="email"]', 'admin@yacc.local');
  await page.fill('input[type="password"]', 'admin123');
  await page.click('button[type="submit"]');
  await page.waitForURL('http://localhost:5173/');
  await page.waitForTimeout(1000);

  // Test on mobile (sidebar should be closed by default)
  console.log('Testing mobile view...');
  await page.setViewportSize({ width: 375, height: 667 });
  await page.waitForTimeout(500);
  
  // Hamburger should be visible on mobile
  const hamburger = page.locator('button[aria-label="Toggle sidebar"]');
  await expect(hamburger).toBeVisible();
  
  // Sidebar header with logo should NOT be visible (sidebar closed)
  const sidebarHeader = page.locator('.menu').first();
  // Check if sidebar is offscreen
  
  // Click hamburger to open sidebar
  await hamburger.click();
  await page.waitForTimeout(500);
  
  // Sidebar logo header should now be visible (mobile only)
  const mobileLogo = page.locator('text=YACC').nth(1); // Second YACC (in sidebar)
  await expect(mobileLogo).toBeVisible();
  
  // Close button in sidebar should be visible
  const closeBtn = page.locator('button[aria-label="Close sidebar"]');
  await expect(closeBtn).toBeVisible();
  
  // Take screenshot
  await page.screenshot({ path: '/tmp/sidebar-mobile-open.png' });
  
  // Close sidebar
  await closeBtn.click();
  await page.waitForTimeout(500);
  
  console.log('✅ Mobile view tests passed!');

  // Test on desktop (sidebar should be open by default, hamburger hidden)
  console.log('Testing desktop view...');
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.waitForTimeout(1000); // Wait for resize effect
  
  // Hamburger should NOT be visible on desktop
  await expect(hamburger).toBeHidden();
  
  // Sidebar should be visible
  await expect(sidebarHeader).toBeVisible();
  
  // Sidebar mobile header should NOT be visible on desktop
  const sidebarMobileHeader = page.locator('text=Inbox Menu');
  await expect(sidebarMobileHeader).toBeHidden();
  
  // Take screenshot
  await page.screenshot({ path: '/tmp/sidebar-desktop.png' });
  
  console.log('✅ Desktop view tests passed!');
  
  // Test on tablet
  console.log('Testing tablet view...');
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.waitForTimeout(500);
  
  // Hamburger should be visible on tablet
  await expect(hamburger).toBeVisible();
  
  // Take screenshot
  await page.screenshot({ path: '/tmp/sidebar-tablet.png' });
  
  console.log('✅ Tablet view tests passed!');
  console.log('✅ All responsive sidebar tests passed!');
});
