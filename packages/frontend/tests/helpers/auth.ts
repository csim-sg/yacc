import { Page, expect } from '@playwright/test';

/**
 * Test fixture user credentials for different roles
 */
export const TEST_USERS = {
  superAdmin: {
    id: '00000000-0000-0000-0000-000000000001',
    email: 'admin@yacc.local',
    password: 'admin123',
    role: 'super_admin',
    name: 'System Administrator',
  },
  admin: {
    id: '00000000-0000-0000-0000-000000000002',
    email: 'admin2@yacc.local',
    password: 'admin123',
    role: 'admin',
    name: 'Admin User',
  },
  manager: {
    id: '00000000-0000-0000-0000-000000000003',
    email: 'manager@yacc.local',
    password: 'admin123',
    role: 'manager',
    name: 'Manager User',
  },
  user: {
    id: '00000000-0000-0000-0000-000000000004',
    email: 'user@yacc.local',
    password: 'admin123',
    role: 'user',
    name: 'Support User',
  },
} as const;

/**
 * Login a user via UI and return storage state
 */
export async function loginAs(
  page: Page,
  user: (typeof TEST_USERS)[keyof typeof TEST_USERS]
): Promise<void> {
  // Navigate to login page
  await page.goto('/auth/login');

  // Fill in email and password
  const emailInput = page.locator('input[type="email"], input[name="email"]').first();
  const passwordInput = page.locator('input[type="password"], input[name="password"]').first();
  const submitButton = page.locator('button[type="submit"]').first();

  await emailInput.fill(user.email);
  await passwordInput.fill(user.password);
  await submitButton.click();

  // Wait for navigation to complete (redirect to inbox or dashboard)
  await page.waitForURL(/\/(inbox|admin|dashboard)/, { timeout: 10000 });

  // Verify logged in by checking for user menu or navbar
  await expect(page.locator('[data-testid="user-menu"], [data-testid="navbar"]').first()).toBeVisible({
    timeout: 5000,
  });
}

/**
 * Logout current user
 */
export async function logout(page: Page): Promise<void> {
  // Click user menu / logout button
  const userMenu = page.locator('[data-testid="user-menu"]');
  const logoutBtn = page.locator('[data-testid="logout-button"]');

  if (await userMenu.isVisible()) {
    await userMenu.click();
  }

  if (await logoutBtn.isVisible()) {
    await logoutBtn.click();
    await page.waitForURL(/\/auth\/login/, { timeout: 5000 });
  }
}

/**
 * Get current logged-in user ID from page context
 */
export async function getCurrentUserId(page: Page): Promise<string | null> {
  // Try to read from localStorage (if exposed by app)
  const userId = await page.evaluate(() => {
    try {
      const authData = localStorage.getItem('auth');
      return authData ? JSON.parse(authData).userId : null;
    } catch {
      return null;
    }
  });
  return userId;
}

/**
 * Check if user is authenticated
 */
export async function isAuthenticated(page: Page): Promise<boolean> {
  try {
    // If we can access a protected page without redirect, user is authenticated
    const response = await page.goto('/inbox');
    return response?.ok() ?? false;
  } catch {
    return false;
  }
}
