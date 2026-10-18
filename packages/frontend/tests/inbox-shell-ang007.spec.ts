import { expect, test, type Page } from '@playwright/test';

/**
 * ANG-007 (#377) Tier-0 evidence rows — authenticated shell + inbox +
 * notification center.
 *
 * OWNERSHIP AND ADDITIVITY (recorded, not silent): this file is NEW and is
 * owned by #377 — no existing suite file is edited (the ANG-003
 * "0 spec-file edits" state stays intact; ANG-015 owns the final
 * disposition-register / CI-scope classification of harness files).
 *
 * Run posture (S1 fixture seed, identical to the R1 evidence run): the Java
 * service is booted by the runner with the S1 e2e posture (`e2e` profile +
 * `yacc.e2e.seed-enabled=true` + loopback DATABASE_URL) plus
 * `YACC_REALTIME_WS_ALLOWED_ORIGINS=<the Angular origin>`; the Angular dev
 * server is the harness webServer (:4200) and relays `/api` to the service.
 * Real UI sign-in with the fixture manager identity — no mocks, no route
 * stubs.
 *
 * Recorded boundaries (exact, not silent):
 * - U1: the merged Java service has NO notification producer (no WS
 *   emitter; the panel is socket-fed by design, B6 fix). A notification
 *   cannot be driven into the panel through the real backend, so the
 *   mark-read / mark-all / dismiss / clear-all / click-through mechanics
 *   are evidenced at the unit level (`NotificationCenter` TestBed specs,
 *   including `navigateByUrl('/conversations/:id')`); this spec evidences
 *   the shell reachability of the bell and the live panel open/close/empty
 *   state.
 * - The `/conversations/:id` detail surface is ANG-008 (#378); until it
 *   lands, a click-through navigation ends on the `**` catch-all
 *   (`/inbox`), exactly as React's `*` route did. No detail route is
 *   stubbed here.
 * - `/inbox` is currently the ONLY shell-wrapped authenticated feature
 *   route (ANG-010..013 add the rest). "Reachable on every authenticated
 *   route" is component-evidenced by the shared `AppShell` mount (a single
 *   `NotificationCenter` instance wrapping the authenticated outlet); a
 *   second live authenticated route cannot exist yet.
 * - daisyUI/PostCSS is not wired in the Angular scaffold (pre-existing
 *   ANG-001 gap, disclosed in the #377 handover): utility classes are
 *   inert, so the bell button renders 0×0 (its aria surface is intact).
 *   Bell interactions below use real DOM events on the element
 *   (`dispatchEvent`) instead of pointer targeting; this is a styling
 *   limitation, not a structural or behavioral mock.
 */

test.describe('ANG-007 shell + inbox + notifications (real backend)', () => {
  const MANAGER = { email: 'manager@yacc.local', password: 'admin123' };

  async function realSignIn(page: Page): Promise<void> {
    await page.goto('/login');
    await page.getByTestId('login-email').fill(MANAGER.email);
    await page.getByTestId('login-password').fill(MANAGER.password);
    await page.getByTestId('login-submit').click();
    await page.waitForURL(/\/inbox/);
  }

  test('ANG007-SHELL-1: public /login renders no shell; authenticated /inbox renders the shared shell (with session restore)', async ({
    page,
  }) => {
    // Public route: the auth form renders, the shell does not.
    await page.goto('/login');
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('nav[aria-label="Main navigation"]')).toHaveCount(0);
    await expect(page.locator('button[aria-label^="Notifications"]')).toHaveCount(0);

    // Real sign-in (server-issued JWT via the real AuthService flow).
    await realSignIn(page);

    // Shared shell on the authenticated route: role-filtered navigation,
    // header user identity, and the single NotificationCenter bell.
    const nav = page.locator('nav[aria-label="Main navigation"]');
    await expect(nav).toBeVisible();
    await expect(nav.getByText('Inbox', { exact: true })).toBeVisible();
    await expect(nav.getByText('Audit Logs')).toBeVisible(); // manager-visible item
    await expect(nav.getByText('Users')).toHaveCount(0); // super-admin-only
    await expect(nav.getByText('Manager User')).toBeVisible();
    await expect(page.locator('button[aria-label^="Notifications"]')).toHaveCount(1);

    // Session restore: a reload keeps the shell and the inbox route.
    await page.reload();
    await expect(page).toHaveURL(/\/inbox/);
    await expect(page.locator('nav[aria-label="Main navigation"]')).toBeVisible();
    await expect(page.locator('button[aria-label^="Notifications"]')).toHaveCount(1);
  });

  test('ANG007-INBOX-1: filter/search/page URL writes replace browser history — the whole filter session is one Back deep', async ({
    page,
  }) => {
    await realSignIn(page);

    // Default inbox: clean URL, loaded fixture rows.
    await expect(page).toHaveURL(/\/inbox$/);
    await expect(page.locator('[data-testid="conversation-card"]').first()).toBeVisible();

    const historyAtStart = await page.evaluate(() => history.length);

    // 1. Channel filter (sidebar button; telegram fixture rows).
    await page.locator('aside').getByRole('button', { name: 'Telegram' }).click();
    await expect(page).toHaveURL(/\/inbox\?channel=telegram/);
    await expect(page.locator('button', { hasText: 'Channel: Telegram' })).toBeVisible();

    // 2. Pagination (fixture world keeps page 2 populated).
    await page
      .locator('[data-testid="pagination-controls"]')
      .getByRole('button', { name: 'Next' })
      .click();
    await expect(page).toHaveURL(/page=2&channel=telegram/);

    // 3. Search submit (resets to page 1 — the page param leaves the URL).
    await page.getByPlaceholder('Search conversations').fill('Fixture');
    await page.getByRole('button', { name: 'Search' }).click();
    await expect(page).toHaveURL(/channel=telegram&search=Fixture/);
    await expect(page.locator('button', { hasText: 'Search: Fixture' })).toBeVisible();

    // Replace semantics in a real browser: three successive URL writes
    // pushed NO history entries (React `setSearchParams(…, {replace:true})`
    // parity — without it this count grows by three).
    expect(await page.evaluate(() => history.length)).toBe(historyAtStart);

    // ONE Back unwinds the whole filter session: the popstate lands on the
    // pre-inbox /login entry, whose public guard bounces to a CLEAN /inbox
    // URL — never through the intermediate `?channel=…` /
    // `?page=2&channel=…` / `?…&search=…` states.
    await page.goBack();
    await expect(page).toHaveURL(/\/inbox$/);
    await expect(page).toHaveURL((url) => !url.search, { timeout: 10_000 });

    // The filter session created exactly ONE in-app entry: the next Back
    // exits the app instead of surfacing another filter state.
    await page.goBack();
    await expect(page).toHaveURL(/about:blank/);
  });

  test('ANG007-NOTIF-1: the notification center is reachable in the shell; the live panel opens (empty) and closes on outside mousedown', async ({
    page,
  }) => {
    await realSignIn(page);
    await expect(page.locator('[data-testid="conversation-card"]').first()).toBeVisible();

    const bell = page.locator('button[aria-label^="Notifications"]');
    await expect(bell).toHaveCount(1);
    await expect(bell).toHaveAttribute('aria-expanded', 'false');

    // Open the panel (real DOM event; pointer targeting is unavailable on
    // the 0×0 bell — see the daisyUI boundary in the file header).
    await bell.dispatchEvent('click');
    await expect(bell).toHaveAttribute('aria-expanded', 'true');

    // Live panel state against the real backend: empty — the merged Java
    // service has no notification producer (U1, recorded boundary above).
    const panel = page.locator('[role="region"][aria-label="Notifications"]');
    await expect(panel).toBeVisible();
    await expect(panel).toContainText('No notifications yet');

    // A real outside mousedown closes the panel (document listener parity).
    await page.mouse.click(640, 400);
    await expect(bell).toHaveAttribute('aria-expanded', 'false');
  });
});
