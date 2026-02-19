/**
 * INT-010: IRC Profile Management E2E Tests
 *
 * Tests IRC profile management admin UI with RBAC:
 * - Super Admin: full CRUD, test, activate, disable, delete
 * - Admin/Manager: read-only visibility
 * - User: no access
 *
 * Happy path: Create → Test → Activate → Disable → Delete (non-active)
 */

import { test, expect, type Page } from '@playwright/test';

const BASE_URL = process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:5173';
const API_BASE_URL = process.env.PLAYWRIGHT_TEST_API_BASE_URL || 'http://localhost:3000';

/**
 * Helper: Login as a specific role
 */
async function loginAs(page: Page, role: string) {
  // Use test credentials based on role
  const credentials: Record<string, { email: string; password: string }> = {
    super_admin: { email: 'admin@test.com', password: 'password123' },
    admin: { email: 'admin2@test.com', password: 'password123' },
    manager: { email: 'manager@test.com', password: 'password123' },
    user: { email: 'user@test.com', password: 'password123' },
  };

  const cred = credentials[role];
  if (!cred) {
    throw new Error(`Unknown role: ${role}`);
  }

  await page.goto(`${BASE_URL}/login`);
  await page.fill('[data-testid="email-input"]', cred.email);
  await page.fill('[data-testid="password-input"]', cred.password);
  await page.click('[data-testid="login-btn"]');

  // Wait for redirect to inbox
  await page.waitForURL(`${BASE_URL}/inbox`, { timeout: 10000 });
}

/**
 * Helper: Generate unique profile name
 */
function generateProfileName(): string {
  return `test-irc-${Date.now()}`;
}

test.describe('INT-010: IRC Profile Management', () => {
  /**
   * Test: Super Admin happy path
   * Create → Test → Activate → Disable → Delete
   */
  test('Super Admin: create, test, activate, disable, delete profile', async ({
    page,
  }) => {
    // Login as super admin
    await loginAs(page, 'super_admin');

    // Navigate to IRC Profiles page
    await page.goto(`${BASE_URL}/integrations/irc-profiles`);
    await expect(page.locator('h1')).toContainText('IRC Profiles');

    // Create profile
    const profileName = generateProfileName();
    await page.click('[data-testid="create-profile-btn"]');
    await expect(page.locator('[data-testid="create-form"]')).toBeVisible();

    await page.fill('[data-testid="profile-name-input"]', profileName);
    await page.fill('[data-testid="server-input"]', 'irc.libera.chat');
    await page.fill('[data-testid="port-input"]', '6667');
    await page.fill('[data-testid="username-input"]', 'testbot');
    await page.fill('[data-testid="channels-input"]', '#test');

    // Submit form
    await page.click('[data-testid="submit-btn"]');

    // Wait for profile to appear in list
    await page.waitForSelector(`[data-testid="profile-card-${1}"]`, {
      timeout: 10000,
    });

    // Verify profile appears with correct info
    const profileCard = page.locator(`[data-testid^="profile-card-"]`).first();
    await expect(profileCard).toContainText(profileName);
    await expect(profileCard).toContainText('irc.libera.chat');

    // Get profile ID from the card
    const profileCardId = await profileCard.getAttribute('data-testid');
    const profileId = profileCardId?.replace('profile-card-', '');

    // Test connection
    const testBtn = page.locator(`[data-testid="test-btn-${profileId}"]`);
    await testBtn.click();

    // Wait for test result
    const testResultAlert = page.locator(
      `[data-testid="test-result-${profileId}"]`
    );
    // Test might fail if server not accessible, but button should work
    await expect(testResultAlert).toBeVisible({ timeout: 15000 });

    // Activate profile
    const activateBtn = page.locator(
      `[data-testid="activate-btn-${profileId}"]`
    );
    await activateBtn.click();

    // Verify active badge appears
    await expect(page.locator('.badge-success')).toContainText('Active');

    // Disable profile
    const disableBtn = page.locator(
      `[data-testid="disable-btn-${profileId}"]`
    );
    await expect(disableBtn).toBeVisible();
    await disableBtn.click();

    // Verify active badge is gone
    const activeCard = page.locator(`[data-testid="profile-card-${profileId}"]`);
    await expect(activeCard.locator('.badge-success')).not.toBeVisible({
      timeout: 5000,
    });

    // Delete profile
    const deleteBtn = page.locator(
      `[data-testid="delete-btn-${profileId}"]`
    );
    await expect(deleteBtn).toBeEnabled(); // Should be enabled now (disabled=false)

    // Intercept and accept the confirm dialog
    page.once('dialog', (dialog) => {
      expect(dialog.type()).toBe('confirm');
      dialog.accept();
    });

    await deleteBtn.click();

    // Verify profile is gone
    await expect(
      page.locator(`[data-testid="profile-card-${profileId}"]`)
    ).not.toBeVisible({ timeout: 5000 });
  });

  /**
   * Test: Admin cannot see action buttons
   */
  test('Admin: can view profiles but no action buttons', async ({ page }) => {
    // First create a profile as super admin
    await loginAs(page, 'super_admin');
    await page.goto(`${BASE_URL}/integrations/irc-profiles`);

    const profileName = generateProfileName();
    await page.click('[data-testid="create-profile-btn"]');
    await page.fill('[data-testid="profile-name-input"]', profileName);
    await page.fill('[data-testid="server-input"]', 'irc.libera.chat');
    await page.fill('[data-testid="port-input"]', '6667');
    await page.fill('[data-testid="username-input"]', 'testbot');
    await page.fill('[data-testid="channels-input"]', '#test');
    await page.click('[data-testid="submit-btn"]');
    await page.waitForTimeout(1000);

    // Logout
    await page.click('[data-testid="logout-btn"]');

    // Login as admin
    await loginAs(page, 'admin');
    await page.goto(`${BASE_URL}/integrations/irc-profiles`);

    // Should see the profile
    await expect(page.locator('h1')).toContainText('IRC Profiles');
    await expect(page.locator('text=' + profileName)).toBeVisible();

    // Should NOT see create button
    await expect(
      page.locator('[data-testid="create-profile-btn"]')
    ).not.toBeVisible();

    // Should NOT see action buttons
    const profileCard = page.locator('text=' + profileName);
    const actionButtons = profileCard.locator(
      'button:has-text("Test Connection"), button:has-text("Activate")'
    );
    await expect(actionButtons).not.toBeVisible();
  });

  /**
   * Test: Manager can view but no actions
   */
  test('Manager: can view profiles (read-only)', async ({ page }) => {
    // Setup: Create profile as super admin
    await loginAs(page, 'super_admin');
    await page.goto(`${BASE_URL}/integrations/irc-profiles`);

    const profileName = generateProfileName();
    await page.click('[data-testid="create-profile-btn"]');
    await page.fill('[data-testid="profile-name-input"]', profileName);
    await page.fill('[data-testid="server-input"]', 'irc.libera.chat');
    await page.fill('[data-testid="port-input"]', '6667');
    await page.fill('[data-testid="username-input"]', 'testbot');
    await page.fill('[data-testid="channels-input"]', '#test');
    await page.click('[data-testid="submit-btn"]');
    await page.waitForTimeout(1000);

    // Logout
    await page.click('[data-testid="logout-btn"]');

    // Login as manager
    await loginAs(page, 'manager');
    await page.goto(`${BASE_URL}/integrations/irc-profiles`);

    // Should see IRC Profiles in navigation
    await expect(page.locator('text=IRC Profiles')).toBeVisible();

    // Should see the profile
    await expect(page.locator('text=' + profileName)).toBeVisible();

    // Should NOT see create button
    await expect(
      page.locator('[data-testid="create-profile-btn"]')
    ).not.toBeVisible();
  });

  /**
   * Test: User has no access
   */
  test('User: cannot access IRC profiles page', async ({ page }) => {
    await loginAs(page, 'user');

    // Try to navigate directly
    await page.goto(`${BASE_URL}/integrations/irc-profiles`);

    // Should NOT see IRC Profiles in navigation
    await expect(page.locator('text=IRC Profiles')).not.toBeVisible();

    // Might be redirected or shown error (depends on protected route implementation)
    // Either way, profile management should not be accessible
  });

  /**
   * Test: Delete active profile fails with 409
   */
  test('Super Admin: cannot delete active profile', async ({ page }) => {
    await loginAs(page, 'super_admin');
    await page.goto(`${BASE_URL}/integrations/irc-profiles`);

    // Create and activate a profile
    const profileName = generateProfileName();
    await page.click('[data-testid="create-profile-btn"]');
    await page.fill('[data-testid="profile-name-input"]', profileName);
    await page.fill('[data-testid="server-input"]', 'irc.libera.chat');
    await page.fill('[data-testid="port-input"]', '6667');
    await page.fill('[data-testid="username-input"]', 'testbot');
    await page.fill('[data-testid="channels-input"]', '#test');
    await page.click('[data-testid="submit-btn"]');
    await page.waitForTimeout(1000);

    // Activate
    const profileCard = page.locator('text=' + profileName);
    const profileCardElement = profileCard.locator('xpath=ancestor::div[@class*="card"]');
    const profileId = await profileCardElement
      .getAttribute('data-testid')
      ?.then((id) => id?.replace('profile-card-', ''));

    await page.click(`[data-testid="activate-btn-${profileId}"]`);
    await page.waitForTimeout(500);

    // Delete button should be disabled
    const deleteBtn = page.locator(`[data-testid="delete-btn-${profileId}"]`);
    await expect(deleteBtn).toBeDisabled();

    // Tooltip or title should indicate why
    const title = await deleteBtn.getAttribute('title');
    expect(title).toContain('Disable before deleting');
  });
});
