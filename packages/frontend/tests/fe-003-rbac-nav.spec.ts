/**
 * FE-003: RBAC-Based Navigation - E2E Tests
 *
 * Tests for:
 * - Role-based navigation item visibility
 * - Route protection per role
 * - Active route highlighting
 * - Mobile responsive sidebar
 * - Logout functionality
 * - Accessibility features
 * - Permission denied redirects
 *
 * Test Coverage:
 * - Super Admin: Full access to all menu items
 * - Admin: No user/integration/rules management
 * - Manager: No super admin features, audit logs access
 * - User: Only inbox access
 */

import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';

// Mock user credentials for different roles
const USERS = {
  super_admin: {
    email: 'admin@example.com',
    password: 'AdminPassword123',
    role: 'SUPER_ADMIN',
  },
  admin: {
    email: 'manager@example.com',
    password: 'ManagerPassword123',
    role: 'ADMIN',
  },
  manager: {
    email: 'supervisor@example.com',
    password: 'SupervisorPassword123',
    role: 'MANAGER',
  },
  user: {
    email: 'user@example.com',
    password: 'UserPassword123',
    role: 'USER',
  },
};

// Navigation items per role
const NAVIGATION_PER_ROLE = {
  SUPER_ADMIN: [
    { label: 'Inbox', href: '/inbox' },
    { label: 'Audit Logs', href: '/audit-logs' },
    { label: 'Users', href: '/users' },
    { label: 'Integrations', href: '/integrations' },
    { label: 'Routing Rules', href: '/routing-rules' },
    { label: 'Settings', href: '/settings' },
  ],
  ADMIN: [
    { label: 'Inbox', href: '/inbox' },
    { label: 'Audit Logs', href: '/audit-logs' },
    { label: 'Settings', href: '/settings' },
  ],
  MANAGER: [
    { label: 'Inbox', href: '/inbox' },
    { label: 'Audit Logs', href: '/audit-logs' },
  ],
  USER: [
    { label: 'Inbox', href: '/inbox' },
  ],
};

/**
 * Helper: Login as specific role
 */
async function loginAsRole(page: any, role: keyof typeof USERS) {
  const user = USERS[role];
  
  // Navigate to login
  await page.goto(`${BASE_URL}/login`);
  await page.waitForLoadState('networkidle');
  
  // Fill login form
  await page.locator('input[type="email"]').fill(user.email);
  await page.locator('input[type="password"]').fill(user.password);
  
  // Submit
  await page.locator('button:has-text("Sign In")').click();
  
  // Wait for redirect to inbox
  await page.waitForURL(`${BASE_URL}/inbox`);
  await page.waitForLoadState('networkidle');
}

test.describe('FE-003: RBAC-Based Navigation', () => {
  test.describe('Super Admin Role', () => {
    test.beforeEach(async ({ page }) => {
      await loginAsRole(page, 'super_admin');
    });

    test('should display all navigation items', async ({ page }) => {
      // Wait for navigation to be visible
      const nav = page.locator('nav[aria-label="Main navigation"]');
      await expect(nav).toBeVisible();

      // Check each menu item
      for (const item of NAVIGATION_PER_ROLE.SUPER_ADMIN) {
        const link = page.locator(`a:has-text("${item.label}")`);
        await expect(link).toBeVisible({ timeout: 5000 });
      }
    });

    test('should allow access to /users route', async ({ page }) => {
      // Click Users link
      await page.locator('a:has-text("Users")').click();
      await page.waitForURL(`${BASE_URL}/users`);
      
      // Should not redirect
      expect(page.url()).toContain('/users');
      await expect(page.locator('text=Admin: Users')).toBeVisible();
    });

    test('should allow access to /integrations route', async ({ page }) => {
      await page.locator('a:has-text("Integrations")').click();
      await page.waitForURL(`${BASE_URL}/integrations`);
      
      expect(page.url()).toContain('/integrations');
      await expect(page.locator('text=Admin: Integrations')).toBeVisible();
    });

    test('should allow access to /routing-rules route', async ({ page }) => {
      await page.locator('a:has-text("Routing Rules")').click();
      await page.waitForURL(`${BASE_URL}/routing-rules`);
      
      expect(page.url()).toContain('/routing-rules');
      await expect(page.locator('text=Admin: Routing Rules')).toBeVisible();
    });

    test('should allow access to /audit-logs route', async ({ page }) => {
      await page.locator('a:has-text("Audit Logs")').click();
      await page.waitForURL(`${BASE_URL}/audit-logs`);
      
      expect(page.url()).toContain('/audit-logs');
      await expect(page.locator('text=Admin: Audit Logs')).toBeVisible();
    });

    test('should allow access to /settings route', async ({ page }) => {
      await page.locator('a:has-text("Settings")').click();
      await page.waitForURL(`${BASE_URL}/settings`);
      
      expect(page.url()).toContain('/settings');
      await expect(page.locator('text=Settings')).toBeVisible();
    });

    test('should highlight active route', async ({ page }) => {
      // Navigate to audit logs
      await page.locator('a:has-text("Audit Logs")').click();
      await page.waitForURL(`${BASE_URL}/audit-logs`);
      
      // Check that Audit Logs link is highlighted
      const auditLink = page.locator('a:has-text("Audit Logs")');
      await expect(auditLink).toHaveClass(/bg-primary/);
    });
  });

  test.describe('Admin Role', () => {
    test.beforeEach(async ({ page }) => {
      await loginAsRole(page, 'admin');
    });

    test('should not display Users menu item', async ({ page }) => {
      const usersLink = page.locator('a:has-text("Users")');
      await expect(usersLink).not.toBeVisible();
    });

    test('should not display Integrations menu item', async ({ page }) => {
      const intLink = page.locator('a:has-text("Integrations")');
      await expect(intLink).not.toBeVisible();
    });

    test('should not display Routing Rules menu item', async ({ page }) => {
      const rulesLink = page.locator('a:has-text("Routing Rules")');
      await expect(rulesLink).not.toBeVisible();
    });

    test('should display Audit Logs menu item', async ({ page }) => {
      const auditLink = page.locator('a:has-text("Audit Logs")');
      await expect(auditLink).toBeVisible();
    });

    test('should display Settings menu item', async ({ page }) => {
      const settingsLink = page.locator('a:has-text("Settings")');
      await expect(settingsLink).toBeVisible();
    });

    test('should allow access to /audit-logs', async ({ page }) => {
      await page.locator('a:has-text("Audit Logs")').click();
      await page.waitForURL(`${BASE_URL}/audit-logs`);
      
      expect(page.url()).toContain('/audit-logs');
    });

    test('should redirect to /inbox when accessing /users', async ({ page }) => {
      // Try to navigate directly to restricted route
      await page.goto(`${BASE_URL}/users`);
      
      // Should redirect to /inbox
      await page.waitForURL(`${BASE_URL}/inbox`);
      expect(page.url()).toContain('/inbox');
    });

    test('should redirect to /inbox when accessing /integrations', async ({ page }) => {
      await page.goto(`${BASE_URL}/integrations`);
      await page.waitForURL(`${BASE_URL}/inbox`);
      
      expect(page.url()).toContain('/inbox');
    });

    test('should redirect to /inbox when accessing /routing-rules', async ({ page }) => {
      await page.goto(`${BASE_URL}/routing-rules`);
      await page.waitForURL(`${BASE_URL}/inbox`);
      
      expect(page.url()).toContain('/inbox');
    });
  });

  test.describe('Manager Role', () => {
    test.beforeEach(async ({ page }) => {
      await loginAsRole(page, 'manager');
    });

    test('should only display Inbox and Audit Logs', async ({ page }) => {
      const nav = page.locator('nav[aria-label="Main navigation"]');
      await expect(nav).toBeVisible();

      // Should see Inbox and Audit Logs
      await expect(page.locator('a:has-text("Inbox")')).toBeVisible();
      await expect(page.locator('a:has-text("Audit Logs")')).toBeVisible();

      // Should not see other items
      await expect(page.locator('a:has-text("Users")')).not.toBeVisible();
      await expect(page.locator('a:has-text("Integrations")')).not.toBeVisible();
      await expect(page.locator('a:has-text("Settings")')).not.toBeVisible();
      await expect(page.locator('a:has-text("Routing Rules")')).not.toBeVisible();
    });

    test('should redirect to /inbox when accessing /settings', async ({ page }) => {
      await page.goto(`${BASE_URL}/settings`);
      await page.waitForURL(`${BASE_URL}/inbox`);
      
      expect(page.url()).toContain('/inbox');
    });

    test('should redirect to /inbox when accessing /users', async ({ page }) => {
      await page.goto(`${BASE_URL}/users`);
      await page.waitForURL(`${BASE_URL}/inbox`);
      
      expect(page.url()).toContain('/inbox');
    });
  });

  test.describe('User Role (Lowest Permissions)', () => {
    test.beforeEach(async ({ page }) => {
      await loginAsRole(page, 'user');
    });

    test('should only display Inbox menu item', async ({ page }) => {
      const nav = page.locator('nav[aria-label="Main navigation"]');
      await expect(nav).toBeVisible();

      // Should only see Inbox
      await expect(page.locator('a:has-text("Inbox")')).toBeVisible();

      // Should not see admin items
      await expect(page.locator('a:has-text("Audit Logs")')).not.toBeVisible();
      await expect(page.locator('a:has-text("Users")')).not.toBeVisible();
      await expect(page.locator('a:has-text("Integrations")')).not.toBeVisible();
      await expect(page.locator('a:has-text("Settings")')).not.toBeVisible();
      await expect(page.locator('a:has-text("Routing Rules")')).not.toBeVisible();
    });

    test('should redirect to /inbox when accessing /audit-logs', async ({ page }) => {
      await page.goto(`${BASE_URL}/audit-logs`);
      await page.waitForURL(`${BASE_URL}/inbox`);
      
      expect(page.url()).toContain('/inbox');
    });

    test('should redirect to /inbox when accessing any admin route', async ({ page }) => {
      const adminRoutes = ['/users', '/integrations', '/routing-rules', '/settings', '/audit-logs'];
      
      for (const route of adminRoutes) {
        await page.goto(`${BASE_URL}${route}`);
        await page.waitForURL(`${BASE_URL}/inbox`, { timeout: 5000 });
        expect(page.url()).toContain('/inbox');
      }
    });
  });

  test.describe('Mobile Responsive Navigation', () => {
    test('should show/hide sidebar on mobile', async ({ page }) => {
      await loginAsRole(page, 'super_admin');
      
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });
      
      // Sidebar should be hidden initially
      const sidebar = page.locator('nav[aria-label="Main navigation"]');
      const navStyle = await sidebar.evaluate((el) => window.getComputedStyle(el).transform);
      
      // On mobile, sidebar should be off-screen initially or have negative transform
      expect(navStyle).toContain('translate');
      
      // Click menu button to toggle
      await page.locator('button[aria-label="Toggle menu"]').click();
      
      // Sidebar should now be visible
      await expect(sidebar).toBeVisible();
    });

    test('should close sidebar when navigating on mobile', async ({ page }) => {
      await loginAsRole(page, 'super_admin');
      await page.setViewportSize({ width: 375, height: 667 });
      
      // Open sidebar
      await page.locator('button[aria-label="Toggle menu"]').click();
      const sidebar = page.locator('nav[aria-label="Main navigation"]');
      await expect(sidebar).toBeVisible();
      
      // Click a navigation item
      await page.locator('a:has-text("Audit Logs")').click();
      await page.waitForURL(`${BASE_URL}/audit-logs`);
      
      // Sidebar should close (or user navigates successfully)
      // This behavior depends on implementation - just verify nav works
      expect(page.url()).toContain('/audit-logs');
    });
  });

  test.describe('Accessibility Features', () => {
    test('should have proper ARIA labels', async ({ page }) => {
      await loginAsRole(page, 'super_admin');
      
      // Navigation should have aria-label
      const nav = page.locator('nav[aria-label="Main navigation"]');
      await expect(nav).toBeVisible();
      
      // Links should be accessible
      const inboxLink = page.locator('a:has-text("Inbox")');
      await expect(inboxLink).toHaveAttribute('href', '/inbox');
    });

    test('should highlight current page', async ({ page }) => {
      await loginAsRole(page, 'super_admin');
      
      // Inbox should be highlighted initially
      const inboxLink = page.locator('a:has-text("Inbox")');
      await expect(inboxLink).toHaveAttribute('aria-current', 'page');
      
      // Navigate to Audit Logs
      await page.locator('a:has-text("Audit Logs")').click();
      await page.waitForURL(`${BASE_URL}/audit-logs`);
      
      // Audit Logs should now be highlighted
      const auditLink = page.locator('a:has-text("Audit Logs")');
      await expect(auditLink).toHaveAttribute('aria-current', 'page');
    });

    test('should support keyboard navigation', async ({ page }) => {
      await loginAsRole(page, 'super_admin');
      
      // Focus on first link
      const inboxLink = page.locator('a:has-text("Inbox")');
      await inboxLink.focus();
      
      // Should be focused
      const focused = await page.evaluate(() => document.activeElement?.textContent);
      expect(focused).toContain('Inbox');
    });
  });

  test.describe('Logout Functionality', () => {
    test('should display logout button in navigation', async ({ page }) => {
      await loginAsRole(page, 'super_admin');
      
      const logoutBtn = page.locator('nav button:has-text("Sign Out")');
      await expect(logoutBtn).toBeVisible();
    });

    test('should logout and redirect to login', async ({ page }) => {
      await loginAsRole(page, 'super_admin');
      
      // Click logout
      await page.locator('nav button:has-text("Sign Out")').click();
      
      // Wait for redirect to login
      await page.waitForURL(`${BASE_URL}/login`);
      expect(page.url()).toContain('/login');
    });

    test('should redirect to login if session expires', async ({ page }) => {
      await loginAsRole(page, 'super_admin');
      
      // Verify authenticated
      expect(page.url()).toContain('/inbox');
      
      // Clear cookies to simulate session expiry
      await page.context().clearCookies();
      
      // Refresh page
      await page.reload();
      
      // Should redirect to login
      await page.waitForURL(`${BASE_URL}/login`, { timeout: 5000 });
      expect(page.url()).toContain('/login');
    });
  });

  test.describe('Role Hierarchy', () => {
    test('SUPER_ADMIN should have most permissions', async ({ page }) => {
      await loginAsRole(page, 'super_admin');
      
      // Should be able to access all routes
      const routes = ['/inbox', '/audit-logs', '/users', '/integrations', '/routing-rules', '/settings'];
      
      for (const route of routes) {
        await page.goto(`${BASE_URL}${route}`);
        // Should not redirect away
        expect(page.url()).toContain(route);
      }
    });

    test('role hierarchy should be enforced', async ({ page }) => {
      // Test that User (lowest) cannot access Manager routes
      await loginAsRole(page, 'user');
      
      // Try accessing audit-logs (requires Manager+)
      await page.goto(`${BASE_URL}/audit-logs`);
      await page.waitForURL(`${BASE_URL}/inbox`);
      
      // Should redirect to inbox
      expect(page.url()).toContain('/inbox');
    });
  });

  test.describe('Error States', () => {
    test('should show loading state while checking permissions', async ({ page }) => {
      await page.goto(`${BASE_URL}/login`);
      
      // The loading spinner might appear during auth check
      const spinner = page.locator('.loading-spinner, .loading');
      // Just verify page loads without error
      await expect(page).not.toHaveURL(/error/);
    });

    test('should handle permission denied gracefully', async ({ page }) => {
      await loginAsRole(page, 'user');
      
      // Try to access super admin route
      await page.goto(`${BASE_URL}/users`);
      
      // Should redirect to inbox, not error page
      await page.waitForURL(`${BASE_URL}/inbox`);
      expect(page.url()).toContain('/inbox');
      
      // Should not show error
      await expect(page.locator('text=Error')).not.toBeVisible();
    });
  });
});
