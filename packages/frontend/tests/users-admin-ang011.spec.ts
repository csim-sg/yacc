import { expect, test, type Locator, type Page } from '@playwright/test';

import { ensureSuperAdminCredential } from './helpers/auth';

/**
 * ANG-011 (#381) Tier-0 evidence rows — users admin (W15): SUPER_ADMIN-
 * gated CRUD surface (AC-ANG-011-1, AC-ANG-011-2).
 *
 * OWNERSHIP AND ADDITIVITY (recorded, not silent): this file is NEW and is
 * owned by #381 — no existing suite file is edited (the ANG-003/ANG-007/
 * ANG-008/ANG-010 "0 spec-file edits" state stays intact; ANG-015 owns the
 * final disposition-register / CI-scope classification of harness files).
 *
 * Run posture (S1 fixture seed + a-1 super-admin mapping, identical to the
 * R1 + ANG-007 + ANG-008 + ANG-010 evidence runs): the Java service on
 * :8080 with the S1 e2e posture (`e2e` profile +
 * `yacc.e2e.seed-enabled=true` + loopback DATABASE_URL + bootstrap super
 * admin); the Angular dev server is the harness webServer (:4200) and
 * relays `/api` to the service. Real UI sign-in — no mocks, no route
 * stubs. The SUPER_ADMIN identity is the ADR-025 bootstrap super admin
 * (`admin@yacc.local`/`admin123`) — `ensureSuperAdminCredential`
 * (helpers/auth.ts, the recorded a-1 forced-password-change adaptation)
 * clears the forced-change state before the UI leg when pending.
 *
 * Recorded boundaries (exact, not silent):
 * - U4: `GET /api/users/roles` is API-only parity (contracts manifest G8,
 *   no live FE consumer) — the page never calls it and this suite asserts
 *   no roles UI; there is intentionally no roles surface to drive here.
 * - The CRUD leg creates a disposable user through the REAL UI create
 *   modal (frozen `POST /api/users`), renames it through the REAL edit
 *   modal (frozen `PUT /api/users/:id`) and deletes it through the REAL
 *   confirmation modal (frozen `DELETE /api/users/:id`, soft delete). The
 *   seeded fixture identities are never mutated; the only residual is the
 *   soft-deleted disposable row (same class as ANG-010's disposable rule).
 * - Serial mode within this file: the rows share the seeded users world,
 *   so intra-file ordering is pinned.
 * - Styling gap (recorded, pre-existing): daisyUI is not wired into the
 *   Angular build yet (the disclosed ANG-001 gap), so the React
 *   `modal modal-open` markup carries no display CSS and the `<dialog>`
 *   stays non-rendered. Hidden inputs cannot take focus, so Playwright
 *   `fill` cannot drive them; the modal leg therefore sets values through
 *   real DOM `input`/`change` events on the elements (evaluate-dispatch —
 *   the recorded ANG-007 hidden-element class) and activates buttons by
 *   dispatched clicks, which still run the browser's native submit
 *   activation (constraint validation included). The store → frozen-API →
 *   list-invalidation path is fully real; the rendered-modal visuals land
 *   with the ANG-015/ANG-016 styling polish.
 */

/** Set a hidden field's value through real DOM input events. */
async function typeInto(locator: Locator, value: string): Promise<void> {
  await locator.evaluate((el, v) => {
    const node = el as HTMLInputElement;
    node.value = v as string;
    node.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);
}

/** Change a hidden select through real DOM change events. */
async function selectWireRole(locator: Locator, value: string): Promise<void> {
  await locator.evaluate((el, v) => {
    const node = el as HTMLSelectElement;
    node.value = v as string;
    node.dispatchEvent(new Event('input', { bubbles: true }));
    node.dispatchEvent(new Event('change', { bubbles: true }));
  }, value);
}

test.describe.configure({ mode: 'serial' });

test.describe('ANG-011 users admin (real backend)', () => {
  const SUPER_ADMIN = { email: 'admin@yacc.local', password: 'admin123' };
  const USER = { email: 'user@yacc.local', password: 'admin123' };
  const ADMIN = { email: 'admin2@yacc.local', password: 'admin123' };

  const disposableEmail = `ang011-disposable-${Date.now()}@yacc.local`;
  const disposableName = 'ANG011 Disposable';

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

  test('ANG011-USERS-1: SUPER_ADMIN reaches the page through the gated nav and the seeded users render', async ({
    page,
    request,
  }) => {
    // a-1 forced-password-change step (idempotent) — required before any
    // non-auth API call succeeds for the bootstrap identity.
    const superSession = await ensureSuperAdminCredential(request);
    expect(superSession.status).toBe(200);

    await realSignIn(page, SUPER_ADMIN);

    // W23 nav gate: SUPER_ADMIN sees the Users item and it navigates.
    const nav = page.locator('nav[aria-label="Main navigation"]');
    await expect(nav.getByText('Users')).toBeVisible();
    await nav.getByText('Users').click();
    await expect(page).toHaveURL(/\/users$/);

    // W15 table: the seeded identities render with role badges and the
    // Showing range (fixture users + the bootstrap super admin itself).
    await expect(page.locator('[data-testid="users-table"]')).toBeVisible();
    await expect(page.locator('[data-testid="users-table"]')).toContainText('admin@yacc.local');
    await expect(page.locator('[data-testid="users-table"]')).toContainText('admin2@yacc.local');
    await expect(page.locator('[data-testid="users-table"]')).toContainText('manager@yacc.local');
    await expect(page.locator('[data-testid="users-table"]')).toContainText('user@yacc.local');
    await expect(page.getByText(/Showing 1-\d+ of \d+ users/)).toBeVisible();

    // Role badges (wire lowercase labels — React class fork parity).
    const adminRow = page.locator('[data-testid^="user-row-"]', { hasText: 'admin2@yacc.local' });
    await expect(adminRow.locator('.badge').first()).toHaveText('admin');
    const userRow = page.locator('[data-testid^="user-row-"]', { hasText: 'user@yacc.local' });
    await expect(userRow.locator('.badge').first()).toHaveText('user');

    // Self-modification prevention: the signed-in super admin cannot
    // delete its own row (React parity).
    const selfRow = page.locator('[data-testid^="user-row-"]', { hasText: 'admin@yacc.local' });
    await expect(selfRow.locator('[data-testid^="delete-btn-"]')).toBeDisabled();
  });

  test('ANG011-CRUD-1: create → rename → delete round-trips a disposable user through the real modals', async ({
    page,
    request,
  }) => {
    await ensureSuperAdminCredential(request);
    await realSignIn(page, SUPER_ADMIN);
    await page.goto('/users');
    await expect(page.locator('[data-testid="users-table"]')).toBeVisible();

    // CREATE through the real modal (frozen POST /api/users). Hidden-dialog
    // interaction classes are recorded in the file header.
    await page.getByTestId('create-user-btn').click();
    await expect(page.getByTestId('create-user-modal')).toHaveCount(1);
    await expect(page.getByTestId('create-submit-btn')).toBeDisabled();
    await typeInto(page.getByTestId('create-email-input'), disposableEmail);
    await typeInto(page.getByTestId('create-name-input'), disposableName);
    await typeInto(page.getByTestId('create-password-input'), 'ang011-secret-12');
    await selectWireRole(page.getByTestId('create-role-select'), 'manager');
    await expect(page.getByTestId('create-submit-btn')).toBeEnabled();
    await page.getByTestId('create-submit-btn').dispatchEvent('click');
    await expect(page.getByTestId('create-user-modal')).toHaveCount(0);

    // The list invalidation refetches; the disposable row appears.
    const disposableRow = page.locator('[data-testid^="user-row-"]', { hasText: disposableEmail });
    await expect(disposableRow).toBeVisible({ timeout: 15000 });
    await expect(disposableRow.locator('.badge').first()).toHaveText('manager');
    const rowTestId = (await disposableRow.getAttribute('data-testid')) ?? '';
    const disposableId = rowTestId.replace('user-row-', '');

    // UPDATE through the real modal (frozen PUT /api/users/:id).
    await page.getByTestId(`edit-btn-${disposableId}`).click();
    await expect(page.getByTestId('edit-user-modal')).toHaveCount(1);
    await expect(page.getByTestId('edit-name-input')).toHaveValue(disposableName);
    await expect(page.getByTestId('edit-submit-btn')).toBeDisabled();
    await typeInto(page.getByTestId('edit-name-input'), 'ANG011 Renamed');
    await expect(page.getByTestId('edit-submit-btn')).toBeEnabled();
    await page.getByTestId('edit-submit-btn').dispatchEvent('click');
    await expect(page.getByTestId('edit-user-modal')).toHaveCount(0);
    // The W15 table has no name column (React parity), so the persisted
    // rename is evidenced by the re-opened modal's freshly seeded form
    // (the list refetch re-derives it from the frozen PUT response).
    await page.getByTestId(`edit-btn-${disposableId}`).click();
    await expect(page.getByTestId('edit-user-modal')).toHaveCount(1);
    await expect(page.getByTestId('edit-name-input')).toHaveValue('ANG011 Renamed', {
      timeout: 15000,
    });
    await page.getByTestId('edit-user-modal').getByText('Cancel').dispatchEvent('click');
    await expect(page.getByTestId('edit-user-modal')).toHaveCount(0);

    // DELETE through the real confirmation modal (frozen soft delete).
    await page.getByTestId(`delete-btn-${disposableId}`).click();
    await expect(page.getByTestId('delete-user-modal')).toHaveCount(1);
    await page.getByTestId('delete-confirm-btn').dispatchEvent('click');
    await expect(page.getByTestId('delete-user-modal')).toHaveCount(0);
    await expect(disposableRow).toHaveCount(0, { timeout: 15000 });

    // The seeded fixture world is intact (identities still present).
    await expect(page.locator('[data-testid="users-table"]')).toContainText('admin2@yacc.local');
    await expect(page.locator('[data-testid="users-table"]')).toContainText('manager@yacc.local');
  });

  test('ANG011-RBAC-1: USER and ADMIN are bounced to /inbox by the SUPER_ADMIN route guard and the nav hides Users', async ({
    page,
  }) => {
    // USER: nav hides Users; direct goto never renders the page.
    await realSignIn(page, USER);
    const nav = page.locator('nav[aria-label="Main navigation"]');
    await expect(nav).toBeVisible();
    await expect(nav.getByText('Users')).toHaveCount(0);
    await page.goto('/users');
    await expect(page).toHaveURL(/\/inbox$/);
    await expect(page.locator('app-users')).toHaveCount(0);

    // ADMIN: same guard hierarchy (role < SUPER_ADMIN bounces).
    await realSignIn(page, ADMIN);
    await expect(nav.getByText('Users')).toHaveCount(0);
    await page.goto('/users');
    await expect(page).toHaveURL(/\/inbox$/);
    await expect(page.locator('app-users')).toHaveCount(0);
  });
});
