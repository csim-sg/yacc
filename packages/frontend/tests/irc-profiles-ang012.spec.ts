import { expect, test, type Page } from '@playwright/test';

import { ensureSuperAdminCredential } from './helpers/auth';

/**
 * ANG-012 (#382) Tier-0 evidence rows — IRC profiles (W16): ADMIN-gated
 * CRUD + activate/disable/test + connection test (AC-ANG-012-1/2/3).
 *
 * OWNERSHIP AND ADDITIVITY (recorded, not silent): this file is NEW and is
 * owned by #382 — no existing suite file is edited (the ANG-003/ANG-007/
 * ANG-008/ANG-010/ANG-011 "0 spec-file edits" state stays intact; ANG-015
 * owns the final disposition-register / CI-scope classification of harness
 * files).
 *
 * Run posture (S1 fixture seed + a-1 super-admin mapping, identical to the
 * R1 + ANG-007 + ANG-008 + ANG-010 + ANG-011 evidence runs): the Java
 * service on :8080 with the S1 e2e posture (`e2e` profile +
 * `yacc.e2e.seed-enabled=true` + loopback DATABASE_URL + bootstrap super
 * admin); the Angular dev server is the harness webServer (:4200) and
 * relays `/api` to the service. Real UI sign-in — no mocks, no route
 * stubs. The SUPER_ADMIN identity is the ADR-025 bootstrap super admin
 * (`admin@yacc.local`/`admin123`) — `ensureSuperAdminCredential`
 * (helpers/auth.ts, the recorded a-1 forced-password-change adaptation)
 * clears the forced-change state before the UI leg when pending.
 *
 * Recorded boundaries (exact, not silent):
 * - The fixture world seeds exactly one IRC profile (`fixture-irc-profile`,
 *   `DeterministicSeed.seedIntegration()`), so the SUPER_ADMIN CRUD leg is
 *   baseline-relative: it drives the full lifecycle on ONE disposable
 *   profile through the REAL create form (frozen
 *   `POST /api/integrations/irc/profiles`), the REAL activate/disable
 *   toggles (frozen `.../:id/activate` / `.../:id/disable`) and the REAL
 *   delete confirm (frozen `DELETE .../:id`, hard delete) and never
 *   touches the seeded row. Residual: none — the disposable row is
 *   removed in the same leg.
 * - The connection tests target a non-resolvable IRC host on purpose: the
 *   honest real-backend outcome is a FAILED test result (the frozen
 *   `POST .../:id/test` and `POST /api/integrations/irc/test` operations
 *   are side-effect-free probes with a 10s server-side hard timeout). The
 *   rows assert the rendered failure surface, not a fake success.
 * - The create form and its in-form `IrcTestButton` are plain (non-dialog)
 *   markup, so real `fill`/`click` interactions work; the `window.confirm`
 *   delete gate is accepted through Playwright's dialog handler.
 * - Per-role rows: ADMIN gets read-only affordances on the seeded card
 *   (endpoint RBAC parity: super_admin mutates / admin+ reads); MANAGER
 *   (nav-visible per W23 but below the ADMIN route floor) and USER are
 *   bounced to `/inbox` by `roleGuard('ADMIN')` and the nav hides the
 *   item from USER.
 * - Serial mode within this file: the rows share the profiles world.
 */

test.describe.configure({ mode: 'serial' });

test.describe('ANG-012 IRC profiles (real backend)', () => {
  const SUPER_ADMIN = { email: 'admin@yacc.local', password: 'admin123' };
  const ADMIN = { email: 'admin2@yacc.local', password: 'admin123' };
  const MANAGER = { email: 'manager@yacc.local', password: 'admin123' };
  const USER = { email: 'user@yacc.local', password: 'admin123' };

  const PROFILE_NAME = `ang012-disposable-${Date.now()}`;

  async function realSignIn(page: Page, identity: { email: string; password: string }): Promise<void> {
    // Reset any session from a previous leg first: a live session makes
    // /login bounce to /inbox (publicGuard) and would race the form.
    await page.goto('/login');
    await page.evaluate(() => localStorage.clear());
    await page.goto('/login');
    await page.getByTestId('login-email').fill(identity.email);
    await page.getByTestId('login-password').fill(identity.password);
    await page.getByTestId('login-submit').click();
    await page.waitForURL(/\/inbox/);
  }

  test('ANG012-IRC-1: SUPER_ADMIN creates, activates, disables, tests and deletes a profile', async ({
    page,
    request,
  }) => {
    // a-1 forced-password-change step (idempotent) — required before any
    // non-auth API call succeeds for the bootstrap identity.
    const superSession = await ensureSuperAdminCredential(request);
    expect(superSession.status).toBe(200);

    await realSignIn(page, SUPER_ADMIN);

    // W23 nav gate: SUPER_ADMIN sees the IRC Profiles item and it navigates.
    const nav = page.locator('nav[aria-label="Main navigation"]');
    await expect(nav.getByText('IRC Profiles')).toBeVisible();
    await nav.getByText('IRC Profiles').click();
    await expect(page).toHaveURL(/\/integrations\/irc-profiles$/);

    // Baseline: the seeded fixture profile renders (never mutated by this
    // leg — same disposition as ANG-011's seeded identities).
    const seededCard = page.locator('[data-testid^="profile-card-"]', {
      hasText: 'fixture-irc-profile',
    });
    await expect(seededCard).toBeVisible({ timeout: 15_000 });

    // Create through the real form (frozen POST /profiles; the payload is
    // the frozen CreateIrcProfileRequest shape).
    await page.getByTestId('create-profile-btn').click();
    await expect(page.getByTestId('create-form')).toBeVisible();
    await page.getByTestId('profile-name-input').fill(PROFILE_NAME);
    await page.getByTestId('server-input').fill('irc.invalid.example');
    await page.getByTestId('port-input').fill('6667');
    await page.getByTestId('username-input').fill('yacc-bot');
    await page.getByTestId('password-input').fill('secret');
    await page.getByTestId('channels-input').fill('#general, #dev');
    await page.getByTestId('submit-btn').click();

    // Invalidation refetch renders the created profile card.
    const card = page.locator(`[data-testid^="profile-card-"]`, { hasText: PROFILE_NAME });
    await expect(card).toBeVisible({ timeout: 15_000 });
    await expect(card).toContainText('irc.invalid.example:6667');
    await expect(card).toContainText('yacc-bot');
    await expect(card).toContainText('#general, #dev');

    // Activate → badge + Disable button appear (frozen POST .../:id/activate).
    await card.getByTestId(/^activate-btn-/).click();
    await expect(card.locator('.badge-success', { hasText: 'Active' })).toBeVisible({
      timeout: 15_000,
    });
    const disableBtn = card.getByTestId(/^disable-btn-/);
    await expect(disableBtn).toBeVisible({ timeout: 15_000 });

    // Disable again (frozen POST .../:id/disable) → Activate returns.
    await disableBtn.click();
    await expect(card.getByTestId(/^activate-btn-/)).toBeVisible({ timeout: 15_000 });

    // Per-profile connection test against the non-resolvable host: the
    // honest outcome is a rendered failure row (server-side 10s timeout
    // bound, hence the generous expectation window).
    await card.getByTestId(/^test-btn-/).click();
    await expect(card.locator('[data-testid^="test-result-"]')).toBeVisible({ timeout: 25_000 });
    await expect(card.locator('[data-testid^="test-result-"]')).toContainText(
      '✗ Connection Failed',
    );

    // Delete (enabled while inactive) through the confirm gate; the
    // hard delete removes the disposable row (no residue).
    page.once('dialog', (dialog) => dialog.accept());
    await card.getByTestId(/^delete-btn-/).click();
    await expect(page.locator(`[data-testid^="profile-card-"]`, { hasText: PROFILE_NAME })).toHaveCount(
      0,
      { timeout: 15_000 },
    );
    await expect(seededCard).toBeVisible({ timeout: 15_000 });
  });

  test('ANG012-IRC-2: the in-form live test surfaces the real connection failure', async ({
    page,
  }) => {
    await realSignIn(page, SUPER_ADMIN);
    await page.goto('/integrations/irc-profiles');
    await expect(page.getByTestId('create-profile-btn')).toBeVisible({ timeout: 15_000 });

    await page.getByTestId('create-profile-btn').click();
    await page.getByTestId('server-input').fill('irc.invalid.example');
    await page.getByTestId('port-input').fill('6667');
    await page.getByTestId('username-input').fill('yacc-bot');
    // The frozen-body gate: the button stays disabled without a channel.
    await expect(page.getByTestId('irc-test-button')).toBeDisabled();
    await page.getByTestId('channels-input').fill('#general');
    await expect(page.getByTestId('irc-test-button')).toBeEnabled();

    await page.getByTestId('irc-test-button').click();
    // The honest real-backend outcome for a non-resolvable host is the
    // error state carrying the surfaced failure message.
    await expect(page.getByTestId('irc-test-button')).toHaveAttribute('data-state', 'error', {
      timeout: 25_000,
    });

    // No profile was created by the test leg (no submit pressed).
    await page.getByTestId('cancel-btn').click();
    await expect(page.getByTestId('create-form')).toHaveCount(0);
    await expect(page.locator('[data-testid^="profile-card-"]', { hasText: PROFILE_NAME })).toHaveCount(0);
  });

  test('ANG012-IRC-3: ADMIN gets the read-only surface (no create, no actions)', async ({
    page,
  }) => {
    await realSignIn(page, ADMIN);

    const nav = page.locator('nav[aria-label="Main navigation"]');
    await expect(nav.getByText('IRC Profiles')).toBeVisible();
    await nav.getByText('IRC Profiles').click();
    await expect(page).toHaveURL(/\/integrations\/irc-profiles$/);

    // The seeded profile renders read-only: no create button and no
    // per-card action buttons (endpoint RBAC parity — admin+ read).
    const seededCard = page.locator('[data-testid^="profile-card-"]', {
      hasText: 'fixture-irc-profile',
    });
    await expect(seededCard).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('create-profile-btn')).toHaveCount(0);
    await expect(seededCard.getByTestId(/^test-btn-/)).toHaveCount(0);
    await expect(seededCard.getByTestId(/^activate-btn-/)).toHaveCount(0);
    await expect(seededCard.getByTestId(/^disable-btn-/)).toHaveCount(0);
    await expect(seededCard.getByTestId(/^delete-btn-/)).toHaveCount(0);
  });

  test('ANG012-IRC-4: MANAGER and USER are bounced to /inbox and USER loses the nav item', async ({
    page,
  }) => {
    // MANAGER sees the nav row (W23 allowedRoles) but the route floor is
    // ADMIN — roleGuard bounces to /inbox (React ProtectedRoute parity).
    await realSignIn(page, MANAGER);
    await page.goto('/integrations/irc-profiles');
    await expect(page).toHaveURL(/\/inbox$/, { timeout: 15_000 });

    // USER: neither the nav item nor the route.
    await realSignIn(page, USER);
    const nav = page.locator('nav[aria-label="Main navigation"]');
    await expect(nav.getByText('IRC Profiles')).toHaveCount(0);
    await page.goto('/integrations/irc-profiles');
    await expect(page).toHaveURL(/\/inbox$/, { timeout: 15_000 });
  });
});
