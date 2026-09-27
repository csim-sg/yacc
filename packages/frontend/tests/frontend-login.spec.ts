/**
 * Frontend Login E2E Tests (MIG-034)
 *
 * The complete auth flow against the Spring auth contract (frozen
 * `.docs/migration/openapi.yaml` §auth), exercised with route mocks so the
 * flows run without a live backend:
 * - login (sign-in) → session → inbox
 * - forced re-login on session loss
 * - forced credential change for the bootstrap/recovery identity
 * - logout (sign-out + `/oauth2/revoke` for oidc sessions + local state clear)
 * - OIDC callback route (embedded AS code exchange)
 */

import { test, expect } from '@playwright/test';
import { authSessionFor, mockAuthContract, TEST_USERS } from './helpers/auth';

test.describe('Frontend Login Flow (Spring auth contract)', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthContract(page);
    // Let non-auth API calls fail fast and quietly.
    await page.route('**/api/conversations**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) })
    );
  });

  test('should display login page correctly', async ({ page }) => {
    await page.goto('/login');

    await expect(page.locator('h1')).toContainText('Welcome Back');
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
    await expect(page.locator('text=Forgot Password?')).toBeVisible();
    await expect(page.locator('text=Create One')).toBeVisible();
  });

  test('should show the frozen 401 error body on invalid credentials', async ({ page }) => {
    await mockAuthContract(page, { failSignIn: true });
    await page.goto('/login');

    await page.locator('[data-testid="login-email"]').fill('admin@yacc.local');
    await page.locator('[data-testid="login-password"]').fill('wrong-password');
    await page.locator('[data-testid="login-submit"]').click();

    await expect(page.locator('.alert-error')).toContainText('Invalid credentials');
    // No session was established — the user stays on the login page.
    await expect(page).toHaveURL(/\/login/);
    expect(await page.evaluate(() => localStorage.getItem('yacc_token'))).toBeNull();
  });

  test('should sign in and land on the inbox with the session user', async ({ page }) => {
    await page.goto('/login');

    await page.locator('[data-testid="login-email"]').fill(TEST_USERS.superAdmin.email);
    await page.locator('[data-testid="login-password"]').fill(TEST_USERS.superAdmin.password);
    await page.locator('[data-testid="login-submit"]').click();

    await page.waitForURL(/\/inbox/);
    // The token pair was adopted (local grant).
    expect(await page.evaluate(() => localStorage.getItem('yacc_token'))).toBeTruthy();
    expect(await page.evaluate(() => localStorage.getItem('yacc_refresh_token'))).toBeTruthy();
    expect(await page.evaluate(() => localStorage.getItem('yacc_token_kind'))).toBe('local');
  });

  test('should force the credential change for the bootstrap/recovery identity', async ({
    page,
  }) => {
    await mockAuthContract(page, { mustChangePassword: true });
    await page.goto('/login');

    await page.locator('[data-testid="login-email"]').fill(TEST_USERS.superAdmin.email);
    await page.locator('[data-testid="login-password"]').fill(TEST_USERS.superAdmin.password);
    await page.locator('[data-testid="login-submit"]').click();

    await page.waitForURL(/\/change-password/);
    await expect(page.getByTestId('forced-change-banner')).toBeVisible();

    // Replace the one-time credential (change-password contract).
    await page.route('**/api/auth/change-password', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) })
    );
    await page.getByTestId('change-password-current').fill('one-time-credential');
    await page.getByTestId('change-password-new').fill('new-founder-secret-1');
    await page.getByTestId('change-password-confirm').fill('new-founder-secret-1');
    await page.getByTestId('change-password-submit').click();

    await page.waitForURL(/\/inbox/);
    expect(await page.evaluate(() => localStorage.getItem('yacc_token'))).toBeTruthy();
  });

  test('should sign out and clear all local auth state', async ({ page }) => {
    await page.goto('/login');
    await page.locator('[data-testid="login-email"]').fill(TEST_USERS.superAdmin.email);
    await page.locator('[data-testid="login-password"]').fill(TEST_USERS.superAdmin.password);
    await page.locator('[data-testid="login-submit"]').click();
    await page.waitForURL(/\/inbox/);

    // Direct DOM click: the mocked empty-inbox layout can overlay the header.
    const logoutButton = page.locator('button[aria-label="Logout"]');
    await expect(logoutButton).toBeAttached();
    await page.evaluate(() => {
      (document.querySelector('button[aria-label="Logout"]') as HTMLElement).click();
    });
    await page.locator('.modal button:has-text("Sign Out")').click();

    await page.waitForURL(/\/login/);
    expect(await page.evaluate(() => localStorage.getItem('yacc_token'))).toBeNull();
    expect(await page.evaluate(() => localStorage.getItem('yacc_refresh_token'))).toBeNull();
  });

  test('should restore the session from the stored token on reload', async ({ page }) => {
    await page.goto('/login');
    await page.locator('[data-testid="login-email"]').fill(TEST_USERS.superAdmin.email);
    await page.locator('[data-testid="login-password"]').fill(TEST_USERS.superAdmin.password);
    await page.locator('[data-testid="login-submit"]').click();
    await page.waitForURL(/\/inbox/);

    await page.reload();
    // The stored access token resolves the session again (get-session).
    await page.waitForURL(/\/inbox/);
    await expect(page.locator('header')).toBeVisible();
  });

  test('should complete the OIDC callback and adopt the AS session', async ({ page }) => {
    await page.addInitScript(() => {
      sessionStorage.setItem('yacc_oidc_state', 'the-state');
      sessionStorage.setItem('yacc_oidc_verifier', 'the-verifier');
    });
    await page.route('**/oauth2/token', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          access_token: 'as-access-token',
          refresh_token: 'as-refresh-token',
          token_type: 'Bearer',
          expires_in: 1800,
          scope: 'openid profile email',
        }),
      });
    });
    // The AS-issued access token resolves the session (same RS256 key,
    // dual-issuer validator — MIG-033).
    await page.route('**/api/auth/get-session', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: authSessionFor(TEST_USERS.superAdmin).user,
          mustChangePassword: false,
        }),
      });
    });

    await page.goto('/auth/callback?code=the-code&state=the-state');

    await page.waitForURL(/\/inbox/);
    expect(await page.evaluate(() => localStorage.getItem('yacc_token'))).toBe('as-access-token');
    expect(await page.evaluate(() => localStorage.getItem('yacc_token_kind'))).toBe('oidc');
  });

  test('should reject an OIDC callback with a forged state', async ({ page }) => {
    await page.addInitScript(() => {
      sessionStorage.setItem('yacc_oidc_state', 'the-state');
      sessionStorage.setItem('yacc_oidc_verifier', 'the-verifier');
    });

    await page.goto('/auth/callback?code=the-code&state=forged-state');

    await expect(page.getByTestId('oidc-callback-error')).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem('yacc_token'))).toBeNull();
  });

  test('should revoke the AS grant at /oauth2/revoke when logging out an OIDC session', async ({
    page,
  }) => {
    const revokeBodies: string[] = [];
    await page.route('**/oauth2/revoke', async (route) => {
      revokeBodies.push(route.request().postData() ?? '');
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    });
    await page.addInitScript(() => {
      sessionStorage.setItem('yacc_oidc_state', 'the-state');
      sessionStorage.setItem('yacc_oidc_verifier', 'the-verifier');
    });
    await page.route('**/oauth2/token', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          access_token: 'as-access-token',
          refresh_token: 'as-refresh-token',
          token_type: 'Bearer',
          expires_in: 1800,
          scope: 'openid profile email',
        }),
      });
    });
    await page.route('**/api/auth/get-session', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: authSessionFor(TEST_USERS.superAdmin).user,
          mustChangePassword: false,
        }),
      });
    });

    // Establish the OIDC session through the callback (AS token pair).
    await page.goto('/auth/callback?code=the-code&state=the-state');
    await page.waitForURL(/\/inbox/);
    expect(await page.evaluate(() => localStorage.getItem('yacc_token_kind'))).toBe('oidc');

    const logoutButton = page.locator('button[aria-label="Logout"]');
    await expect(logoutButton).toBeAttached();
    await page.evaluate(() => {
      (document.querySelector('button[aria-label="Logout"]') as HTMLElement).click();
    });
    await page.locator('.modal button:has-text("Sign Out")').click();

    await page.waitForURL(/\/login/);
    // Logout revokes the AS refresh grant — local cleanup alone is not
    // sufficient for an oidc session (review loop 1, blocker finding 1).
    expect(revokeBodies).toHaveLength(1);
    expect(revokeBodies[0]).toContain('token=as-refresh-token');
    expect(revokeBodies[0]).toContain('client_id=yacc-frontend');
    expect(await page.evaluate(() => localStorage.getItem('yacc_token'))).toBeNull();
    expect(await page.evaluate(() => localStorage.getItem('yacc_refresh_token'))).toBeNull();
  });
});
