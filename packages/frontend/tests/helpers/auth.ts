import { expect, type APIRequestContext, type Page } from '@playwright/test';

/**
 * Java service request base (PREREQ-ANG-003-S1 helper re-point — mirrors
 * `helpers/api.ts`; the frozen Java OpenAPI contract is the test target).
 */
const API_BASE_URL = process.env.API_URL || 'http://localhost:8080/api';

/**
 * Test fixture user credentials for different roles.
 *
 * MIG-034: credentials are resolved by the Spring auth contract
 * (`POST /api/auth/sign-in/email`); in mocked runs these shapes ride
 * `page.route` stubs, in live runs against the seeded Java service.
 *
 * Super-admin mapping a-1 (PREREQ-ANG-003-S1; SPEC-003 AD-5 option (a),
 * pre-registered disposition): the suite's super-admin identity is served by
 * the ADR-025 first-run bootstrap Super Admin — created only by
 * `SuperAdminBootstrap` at Java-service startup from
 * `YACC_BOOTSTRAP_SUPER_ADMIN_EMAIL` + `YACC_BOOTSTRAP_SUPER_ADMIN_INITIAL_CREDENTIAL`
 * (E2E boot: admin@yacc.local / admin123). The fixture seed never creates a
 * `super_admin` row; these credentials map onto the bootstrap identity, and
 * {@link ensureSuperAdminCredential} performs the forced-password-change
 * step the bootstrap identity carries.
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

/** Canonical `AuthSessionResponse` (frozen openapi.yaml) for a fixture user. */
export function authSessionFor(user: {
  id: string;
  email: string;
  name: string;
  role: string;
}): {
  user: Record<string, unknown>;
  accessToken: string;
  refreshToken: string;
  mustChangePassword: boolean;
} {
  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      status: 'active',
      emailVerified: true,
      createdAt: '2026-09-27T08:00:00',
      updatedAt: '2026-09-27T08:00:00',
    },
    accessToken: `access-${user.id}`,
    refreshToken: `refresh-${user.id}`,
    mustChangePassword: false,
  };
}

/**
 * Sign in with the frozen `/api/auth/sign-in/email` contract and return the
 * raw session response payload (`{user, accessToken, refreshToken,
 * mustChangePassword}`).
 */
export async function apiSignIn(
  request: APIRequestContext,
  email: string,
  password: string
): Promise<{ status: number; body: Record<string, unknown> }> {
  const response = await request.post(`${API_BASE_URL}/auth/sign-in/email`, {
    data: { email, password },
  });
  const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  return { status: response.status(), body };
}

/**
 * Super-admin mapping a-1 forced-password-change step (PREREQ-ANG-003-S1;
 * pre-registered disposition): the ADR-025 bootstrap Super Admin carries the
 * `must_change_password` flag, so its first sign-in answers
 * `mustChangePassword: true` and the identity is denied everything outside
 * `/api/auth/*` until the credential is replaced. This helper signs in, and
 * when the forced-change state is present performs the credential
 * replacement via the frozen `POST /api/auth/change-password` contract
 * (same-value rotation: admin123 → admin123), then re-signs-in so the
 * returned session is fully usable.
 *
 * Test-helper adaptation only — no `*.spec.ts` edit and no production
 * auth behaviour change (the flag is cleared through the shipped
 * MIG-030 endpoint, exactly as a real first login would).
 */
export async function ensureSuperAdminCredential(
  request: APIRequestContext
): Promise<{ status: number; body: Record<string, unknown>; passwordChangePerformed: boolean }> {
  const { email, password } = TEST_USERS.superAdmin;
  const first = await apiSignIn(request, email, password);
  if (first.status !== 200 || first.body.mustChangePassword !== true) {
    return { ...first, passwordChangePerformed: false };
  }

  const change = await request.post(`${API_BASE_URL}/auth/change-password`, {
    headers: {
      Authorization: `Bearer ${String(first.body.accessToken ?? '')}`,
    },
    data: { currentPassword: password, newPassword: password },
  });
  if (change.status() !== 200) {
    return {
      status: change.status(),
      body: (await change.json().catch(() => ({}))) as Record<string, unknown>,
      passwordChangePerformed: false,
    };
  }

  const second = await apiSignIn(request, email, password);
  return { ...second, passwordChangePerformed: true };
}

/**
 * Install route mocks for the frozen `/api/auth/*` contract so auth flows
 * run without a live backend.
 */
export async function mockAuthContract(
  page: Page,
  options: { mustChangePassword?: boolean; failSignIn?: boolean } = {}
): Promise<void> {
  const { mustChangePassword = false, failSignIn = false } = options;

  await page.route('**/api/auth/sign-in/email', async (route) => {
    if (failSignIn) {
      await route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: 'Invalid credentials' }) });
      return;
    }
    const body = route.request().postDataJSON() as { email: string };
    const user = Object.values(TEST_USERS).find((candidate) => candidate.email === body.email);
    if (!user) {
      await route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: 'Invalid credentials' }) });
      return;
    }
    const session = authSessionFor(user);
    session.mustChangePassword = mustChangePassword;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(session) });
  });

  await page.route('**/api/auth/get-session', async (route) => {
    const token = (await page.evaluate(() => localStorage.getItem('yacc_token'))) ?? '';
    const user = Object.values(TEST_USERS).find((candidate) => token.endsWith(candidate.id));
    if (!token || !user) {
      await route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: 'Missing or invalid token' }) });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ user: authSessionFor(user).user, mustChangePassword }),
    });
  });

  await page.route('**/api/auth/sign-out', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
  });

  await page.route('**/api/auth/refresh-token', async (route) => {
    await route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: 'Invalid, expired, or revoked refresh token' }) });
  });
}

/**
 * Login a user via UI and wait for the inbox.
 */
export async function loginAs(
  page: Page,
  user: (typeof TEST_USERS)[keyof typeof TEST_USERS]
): Promise<void> {
  // Navigate to login page
  await page.goto('/login');

  // Fill in email and password
  const emailInput = page.locator('input[type="email"], input[name="email"]').first();
  const passwordInput = page.locator('input[type="password"], input[name="password"]').first();
  const submitButton = page.locator('button[type="submit"]').first();

  await emailInput.fill(user.email);
  await passwordInput.fill(user.password);
  await submitButton.click();

  // Wait for navigation to complete (redirect to inbox)
  await page.waitForURL(/\/(inbox|dashboard)/, { timeout: 10000 });

  // Verify logged in by checking for the user menu or navbar
  await expect(page.locator('[data-testid="user-menu"], header').first()).toBeVisible({
    timeout: 5000,
  });
}

/**
 * Logout the current user through the header controls.
 */
export async function logout(page: Page): Promise<void> {
  // Click logout (opens the confirmation modal), then confirm
  await expect(page.locator('button[aria-label="Logout"]')).toBeVisible();
  // Direct DOM click: overlays in dense layouts can intercept hit-testing.
  await page.evaluate(() => {
    (document.querySelector('button[aria-label="Logout"]') as HTMLElement).click();
  });

  const confirmBtn = page.locator('.modal button:has-text("Sign Out")');
  await expect(confirmBtn).toBeVisible();
  await confirmBtn.click();

  await page.waitForURL(/\/login/, { timeout: 5000 });
}

/**
 * Check if the user is authenticated (protected page reachable).
 */
export async function isAuthenticated(page: Page): Promise<boolean> {
  await page.goto('/inbox');
  return page.url().includes('/inbox');
}
