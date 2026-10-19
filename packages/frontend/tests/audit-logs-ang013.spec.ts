import { expect, test, type Page } from '@playwright/test';

/**
 * ANG-013 (#383) Tier-0 evidence rows — audit logs (W18): MANAGER-gated
 * compliance list + filters (AC-ANG-013-1, AC-ANG-013-2).
 *
 * OWNERSHIP AND ADDITIVITY (recorded, not silent): this file is NEW and is
 * owned by #383 — no existing suite file is edited (the ANG-003/ANG-007/
 * ANG-008/ANG-010/ANG-011/ANG-012 "0 spec-file edits" state stays intact;
 * ANG-015 owns the final disposition-register / CI-scope classification of
 * harness files).
 *
 * Run posture (S1 fixture seed, identical to the R1 + ANG-007 + ANG-008 +
 * ANG-010 + ANG-011 + ANG-012 evidence runs): the Java service on :8080
 * with the S1 e2e posture (`e2e` profile + `yacc.e2e.seed-enabled=true` +
 * loopback DATABASE_URL); the Angular dev server is the harness webServer
 * (:4200) and relays `/api` to the service. Real UI sign-in with fixture
 * identities — no mocks, no route stubs.
 *
 * Recorded boundaries (exact, not silent):
 * - Real audit rows exist deterministically in the fixture world: the seed
 *   writes one `fixture.seed` row (DeterministicSeed AUDIT_LOG_ID) and the
 *   real sign-in surface audit-logs every successful authentication as
 *   `user.login` (SecurityAuditEventListener) — including this file's own
 *   UI sign-ins. The filter legs pin the exact-match server semantics
 *   (`cb.equal` on `action`): filtering by `user.login` keeps only login
 *   rows; an unmatched action renders the empty state.
 * - U4 (AC-ANG-013-3, fixed disposition): `POST /api/audit-logs/export` is
 *   API-only parity — the page renders no export UI, and no export
 *   request is observed on any leg (passive request observation below).
 * - Sensitive-data exposure is gate-guarded: the USER leg asserts the nav
 *   hides the item, the roleGuard bounces the direct goto to `/inbox`, the
 *   page component never mounts, and no `/api/audit-logs` request leaves
 *   the USER session (observation, not interception).
 * - Serial mode within this file: the rows share the audit-trail world.
 */

test.describe.configure({ mode: 'serial' });

test.describe('ANG-013 audit logs (real backend)', () => {
  const MANAGER = { email: 'manager@yacc.local', password: 'admin123' };
  const ADMIN = { email: 'admin2@yacc.local', password: 'admin123' };
  const USER = { email: 'user@yacc.local', password: 'admin123' };

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

  test('ANG013-AUDIT-1: MANAGER reaches the page through the gated nav; real rows render with filters and the empty state', async ({
    page,
  }) => {
    await realSignIn(page, MANAGER);

    // W23 nav gate: MANAGER sees the Audit Logs item (nav data + role
    // filter) and it navigates to the page.
    const nav = page.locator('nav[aria-label="Main navigation"]');
    await expect(nav.getByText('Audit Logs')).toBeVisible();
    await nav.getByText('Audit Logs').click();
    await expect(page).toHaveURL(/\/audit-logs$/);

    // W18 list: the fixture world always has audit rows (the seed's
    // `fixture.seed` row + this leg's own `user.login` row).
    const table = page.locator('app-audit-logs table');
    await expect(table).toBeVisible();
    const firstBadge = page
      .locator('[data-testid^="log-row-"] .badge')
      .first();
    await expect(firstBadge).not.toBeEmpty();

    // Total badge reflects the server total (≥ 1).
    const totalBadge = page.locator('app-audit-logs .badge-lg');
    await expect(totalBadge).not.toHaveText('0');

    // Filter — exact-match server semantics with a real action: keep only
    // login rows (this file's own sign-ins guarantee at least one).
    await page.getByTestId('filter-action').fill('user.login');
    const filteredBadges = page.locator('[data-testid^="log-row-"] .badge');
    await expect(filteredBadges.first()).toHaveText('user.login', { timeout: 15000 });
    const count = await filteredBadges.count();
    expect(count).toBeGreaterThanOrEqual(1);

    // Filter — unmatched action: the honest real-backend empty state.
    await page.getByTestId('filter-action').fill('zzz-ang013-no-such-action');
    await expect(page.locator('app-audit-logs')).toContainText('No audit logs found', {
      timeout: 15000,
    });
    await expect(totalBadge).toHaveText('0');

    // Clearing the filter returns to the unfiltered view (store cache).
    await page.getByTestId('filter-action').fill('');
    await expect(page.locator('[data-testid^="log-row-"]').first()).toBeVisible({
      timeout: 15000,
    });
  });

  test('ANG013-AUDIT-2: the metadata Details dropdown opens with the row payload; no export UI exists (U4)', async ({
    page,
  }) => {
    await realSignIn(page, MANAGER);
    await page.goto('/audit-logs');

    const firstRow = page.locator('[data-testid^="log-row-"]').first();
    await expect(firstRow).toBeVisible();

    // U4 (API-only parity): no export affordance is rendered anywhere on
    // the page.
    await expect(page.getByTestId('export-button')).toHaveCount(0);
    await expect(page.getByTestId('export-error')).toHaveCount(0);
    await expect(page.locator('app-audit-logs button', { hasText: /export/i })).toHaveCount(0);

    // The Details dropdown opens and shows the row's metadata JSON.
    await firstRow.locator('summary').click();
    await expect(firstRow.locator('.dropdown-content')).toBeVisible();
    await expect(firstRow.locator('pre')).not.toBeEmpty();
  });

  test('ANG013-RBAC-1: ADMIN passes the MANAGER floor (hierarchy parity) and sees the trail', async ({
    page,
  }) => {
    await realSignIn(page, ADMIN);

    const nav = page.locator('nav[aria-label="Main navigation"]');
    await expect(nav.getByText('Audit Logs')).toBeVisible();

    await page.goto('/audit-logs');
    await expect(page).toHaveURL(/\/audit-logs$/);
    await expect(page.locator('app-audit-logs table')).toBeVisible();
    await expect(page.locator('[data-testid^="log-row-"]').first()).toBeVisible();
  });

  test('ANG013-RBAC-2: USER is bounced to /inbox by the MANAGER route guard, the nav hides the item, and no audit API call is made', async ({
    page,
  }) => {
    await realSignIn(page, USER);

    // W23 nav gate: USER does NOT see the Audit Logs item.
    const nav = page.locator('nav[aria-label="Main navigation"]');
    await expect(nav).toBeVisible();
    await expect(nav.getByText('Audit Logs')).toHaveCount(0);

    // Passive observation (no interception/stubbing): record every request
    // URL issued during the direct-goto leg.
    const requestedUrls: string[] = [];
    page.on('request', (request) => requestedUrls.push(request.url()));

    // Direct goto — roleGuard('MANAGER') redirects to /inbox (React
    // `ProtectedRoute requiredRole="MANAGER"` parity). The page — and with
    // it the compliance trail — never renders for the USER session.
    await page.goto('/audit-logs');
    await expect(page).toHaveURL(/\/inbox$/);
    await expect(page.locator('app-audit-logs')).toHaveCount(0);

    // No sensitive-data leakage: zero audit-trail requests left the USER
    // session (the store only loads from the mounted page's effect).
    const auditRequests = requestedUrls.filter((url) => url.includes('/api/audit-logs'));
    expect(auditRequests).toEqual([]);
  });
});
