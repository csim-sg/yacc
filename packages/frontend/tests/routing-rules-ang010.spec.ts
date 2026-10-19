import { expect, test, type Page } from '@playwright/test';

/**
 * ANG-010 (#380) Tier-0 evidence rows — routing rules (W14): ADMIN-gated
 * CRUD + executions surface (AC-ANG-010-1, AC-ANG-010-2).
 *
 * OWNERSHIP AND ADDITIVITY (recorded, not silent): this file is NEW and is
 * owned by #380 — no existing suite file is edited (the ANG-003/ANG-007/
 * ANG-008 "0 spec-file edits" state stays intact; ANG-015 owns the final
 * disposition-register / CI-scope classification of harness files).
 *
 * Run posture (S1 fixture seed, identical to the R1 + ANG-007 + ANG-008
 * evidence runs): the Java service on :8080 with the S1 e2e posture
 * (`e2e` profile + `yacc.e2e.seed-enabled=true` + loopback DATABASE_URL);
 * the Angular dev server is the harness webServer (:4200) and relays
 * `/api` to the service. Real UI sign-in with fixture identities — no
 * mocks, no route stubs.
 *
 * Recorded boundaries (exact, not silent):
 * - UI creation is a React stub ("Rule creation UI coming soon") —
 *   parity-of-absence; the disposable row used for the read/delete leg is
 *   seeded through the REAL frozen `POST /api/routing-rules` operation
 *   (test-side API client, the same channel as the Tier-1 suite), then
 *   everything downstream (list appearance, selection, delete) is the
 *   real component/store path.
 * - The status toggle writes through the real PATCH; the shared fixture
 *   rule `…2001` is toggled back to `active` immediately (the fixture
 *   world is shared across the suite — no residual mutation).
 * - Serial mode within this file: the rows share the seeded rules world,
 *   so intra-file ordering is pinned (no parallel toggles of `…2001`).
 */

test.describe.configure({ mode: 'serial' });

test.describe('ANG-010 routing rules (real backend)', () => {
  const ADMIN = { email: 'admin2@yacc.local', password: 'admin123' };
  const USER = { email: 'user@yacc.local', password: 'admin123' };

  /** Deterministic S1 fixture rules (DeterministicSeed RULE_*_ID). */
  const RULE_VIP_ID = '00000000-0000-0000-0000-000000002001';
  const RULE_VIP_NAME = 'Auto-assign VIP to admin';
  const RULE_DISABLED_ID = '00000000-0000-0000-0000-000000002003';
  const FIXTURE_CONVERSATION_ID = '00000000-0000-0000-0000-000000001001';

  const API_BASE = process.env.API_URL || 'http://localhost:8080/api';

  async function realSignIn(page: Page, identity: { email: string; password: string } = ADMIN): Promise<void> {
    await page.goto('/login');
    await page.getByTestId('login-email').fill(identity.email);
    await page.getByTestId('login-password').fill(identity.password);
    await page.getByTestId('login-submit').click();
    await page.waitForURL(/\/inbox/);
  }

  /** Frozen `POST /api/routing-rules` seed for the disposable delete row. */
  async function createRuleViaApi(page: Page, name: string): Promise<string> {
    const signIn = await page.request.post(`${API_BASE}/auth/sign-in/email`, {
      data: { email: ADMIN.email, password: ADMIN.password },
    });
    const { accessToken } = (await signIn.json()) as { accessToken: string };
    const created = await page.request.post(`${API_BASE}/routing-rules`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      data: { name, priority: 500, conditions: [], actions: [] },
    });
    expect(created.status()).toBe(201);
    const body = (await created.json()) as { data: { id: string } };
    return body.data.id;
  }

  test('ANG010-RULES-1: ADMIN reaches the page through the gated nav and direct goto; seeded rules render; selection shows details + executions', async ({
    page,
  }) => {
    await realSignIn(page);

    // W23 nav gate: ADMIN sees the Routing Rules item (nav data + role
    // filter) and it navigates to the page.
    const nav = page.locator('nav[aria-label="Main navigation"]');
    await expect(nav.getByText('Routing Rules')).toBeVisible();
    await nav.getByText('Routing Rules').click();
    await expect(page).toHaveURL(/\/routing-rules$/);

    // W14 list: the three seeded rules render with name, status badge and
    // priority. The never-toggled `…2003` pins the disabled-badge variant.
    await expect(page.locator(`[data-testid="rule-item-${RULE_VIP_ID}"]`)).toBeVisible();
    await expect(page.locator(`[data-testid="rule-item-${RULE_DISABLED_ID}"]`)).toBeVisible();
    await expect(page.locator(`[data-testid="rule-item-${RULE_VIP_ID}"]`)).toContainText(
      RULE_VIP_NAME,
    );
    await expect(page.locator(`[data-testid="rule-item-${RULE_VIP_ID}"]`)).toContainText(
      'Priority: 100',
    );
    await expect(
      page.locator(`[data-testid="rule-item-${RULE_DISABLED_ID}"] .badge`).first(),
    ).toHaveText('disabled');

    // Selection → details panel + execution history (real GET
    // `/api/routing-rules/:id/executions?page=1&pageSize=10`): the seed's
    // single execution row renders with its conversation id.
    await page.locator(`[data-testid="rule-item-${RULE_VIP_ID}"]`).click();
    const panel = page.locator('app-routing-rules .lg\\:col-span-1').last();
    await expect(panel).toContainText(RULE_VIP_NAME);
    await expect(panel).toContainText('Priority');
    await expect(panel).toContainText('"field": "tag"');
    await expect(panel).toContainText('"type": "assign"');
    await expect(panel).toContainText('Recent Executions');
    await expect(page.locator('[data-testid="execution-1"]')).toHaveText(FIXTURE_CONVERSATION_ID);
  });

  test('ANG010-CRUD-1: status toggle persists through PATCH; a seeded-then-deleted rule round-trips the list', async ({
    page,
  }) => {
    await realSignIn(page);
    await page.goto('/routing-rules');
    await expect(page.locator(`[data-testid="rule-item-${RULE_VIP_ID}"]`)).toBeVisible();

    // UPDATE leg (PATCH — NOT PUT): toggle off, assert, toggle back, assert
    // (the shared fixture row is restored immediately).
    const vipRow = page.locator(`[data-testid="rule-item-${RULE_VIP_ID}"]`);
    await vipRow.locator(`[data-testid="toggle-rule-${RULE_VIP_ID}"]`).click();
    await expect(vipRow.locator('.badge').first()).toHaveText('disabled', { timeout: 15000 });
    await expect(vipRow).toContainText('Enable');
    await vipRow.locator(`[data-testid="toggle-rule-${RULE_VIP_ID}"]`).click();
    await expect(vipRow.locator('.badge').first()).toHaveText('active', { timeout: 15000 });

    // CREATE leg is UI-stubbed (React parity-of-absence): seed a disposable
    // row through the real frozen POST, then read it in the UI.
    const disposableName = `ANG010 disposable rule ${Date.now()}`;
    const disposableId = await createRuleViaApi(page, disposableName);
    await page.reload();
    const disposableRow = page.locator(`[data-testid="rule-item-${disposableId}"]`);
    await expect(disposableRow).toBeVisible({ timeout: 15000 });
    await expect(disposableRow).toContainText(disposableName);

    // DELETE leg: the page's Delete clears the row (selection first — the
    // details panel shows the rule; delete returns the placeholder).
    await disposableRow.click();
    await expect(page.locator('app-routing-rules')).toContainText(disposableName);
    await disposableRow.locator(`[data-testid="delete-rule-${disposableId}"]`).click();
    await expect(disposableRow).toHaveCount(0, { timeout: 15000 });
    await expect(page.locator('app-routing-rules')).toContainText('Select a rule to view details');

    // The shared fixture world is intact (toggle restored; seeded rows all
    // present).
    await expect(vipRow.locator('.badge').first()).toHaveText('active');
    await expect(page.locator(`[data-testid="rule-item-${RULE_DISABLED_ID}"]`)).toBeVisible();
  });

  test('ANG010-RBAC-1: USER is bounced to /inbox by the ADMIN route guard and the nav hides Routing Rules', async ({
    page,
  }) => {
    await realSignIn(page, USER);

    // W23 nav gate: USER does NOT see the Routing Rules item.
    const nav = page.locator('nav[aria-label="Main navigation"]');
    await expect(nav).toBeVisible();
    await expect(nav.getByText('Routing Rules')).toHaveCount(0);

    // Direct goto — roleGuard('ADMIN') redirects to /inbox (React
    // `ProtectedRoute requiredRole="ADMIN"` parity: insufficient
    // permissions never show an error page). The page never renders.
    await page.goto('/routing-rules');
    await expect(page).toHaveURL(/\/inbox$/);
    await expect(page.locator('app-routing-rules')).toHaveCount(0);
  });
});
