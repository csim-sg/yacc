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
 * - Recorded adaptation (ANG-015 #385 parity root cause, 20 Oct 2026 —
 *   permitted edit inside this #377-owned additive spec only, recorded
 *   for the #385 register with file+SHA provenance): NOTIF-1's outside
 *   press targets the deterministic inbox heading instead of the fixed
 *   (640, 400) viewport point — in the unstyled shell the host is a
 *   full-width block whose band shifts with font metrics and with the
 *   CI realtime-origin reconnect banner (~77 px), so the fixed point
 *   landed inside the host and the press (correctly) did not close the
 *   panel; INBOX-1's final Back exit assertion is browser-neutral
 *   (about:blank where the browser kept the pre-app entry, else a no-op
 *   with unchanged history length + router navigationId) — Firefox's
 *   initial `page.goto` REPLACES the initial `about:blank` entry, and an
 *   instrumented history log proved the guard bounce already
 *   `replaceState`s (no extra pushed entry) and the app performs no
 *   post-bounce URL write. Both rows keep their original intent and
 *   regression power; no assertion was weakened, skipped or removed.
 * - ANG007-WS-1 (AC-ANG-007-8) reads the ANG-006 dev-only observation seam
 *   `window.__yaccRealtimeDevtools` (read-only client snapshot; dev builds
 *   only — `ng serve` webServer) and observes the app's real raw-WS
 *   upgrade via Playwright's `websocket` event. No transport behavior is
 *   mocked or driven; the seam is the same allowed evidence channel the
 *   #376 R1 rows use. Not a production surface (DCE'd from prod builds).
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
    // The UNFILTERED row count — the post-bounce display must return to it
    // (the store serves the still-fresh default key from cache, so no
    // reload request is expected after the bounce — TanStack staleTime
    // parity; the DISPLAYED list is the proof).
    const unfilteredCount = await page.locator('[data-testid="conversation-card"]').count();
    expect(unfilteredCount).toBeGreaterThan(0);

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

    // Review-loop-2 regression (guard-bounce desync — URL is the source of
    // truth on re-entry): the bounce re-uses the live Inbox component, so
    // the filter state must be re-initialized from the clean URL — chips
    // cleared, search input empty, page 1, and the DISPLAYED list restored
    // to the unfiltered dataset (served from the store's still-fresh
    // default cache; no reload request is expected — TanStack staleTime
    // parity).
    await expect(page.locator('button', { hasText: 'Channel: Telegram' })).toHaveCount(0);
    await expect(page.locator('button', { hasText: 'Search: Fixture' })).toHaveCount(0);
    await expect(page.getByPlaceholder('Search conversations')).toHaveValue('');
    await expect(page.locator('[data-testid="page-info"]')).toContainText('Page 1');
    await expect(page.locator('[data-testid="conversation-card"]')).toHaveCount(unfilteredCount);

    // The filter session created exactly ONE in-app entry: the next Back
    // must leave the app — or, when the browser kept no pre-app entry, be
    // a no-op that triggers NO further in-app navigation. Root-caused with
    // an instrumented history log (ANG-015 #385 parity failure, fixed
    // here): the public-guard bounce performs `history.replaceState` (no
    // pushed entry) and the reused Inbox component performs no URL write
    // after the bounce — the app-side session depth is exactly one Back on
    // every browser, React parity. The ORIGINAL exit assertion
    // (`toHaveURL(/about:blank/)`) pinned a browser artifact instead:
    // chromium/webkit keep the initial `about:blank` entry behind the app
    // (Back #2 exits), while Firefox's initial `page.goto` REPLACED that
    // entry, so Back #2 is a no-op on the last (clean) entry. The
    // app-owned contract is pinned browser-neutrally below: after Back #2
    // the session either exited to `about:blank` (chromium/webkit) or
    // stayed on the clean `/inbox` with UNCHANGED history length and
    // UNCHANGED router navigationId — a pushed bounce entry (the defect
    // class this row guards) would pop to `/login`, bounce again, and
    // advance both.
    const inAppNavIdAfterBounce = await page.evaluate(
      () => (history.state as { navigationId?: number } | null)?.navigationId ?? null,
    );
    const historyLengthAfterBounce = await page.evaluate(() => history.length);
    await page.goBack();
    await expect(page).toHaveURL(
      (url) => url.href === 'about:blank' || (url.pathname === '/inbox' && !url.search),
    );
    const afterSecondBack = await page.evaluate(() => ({
      href: location.href,
      length: history.length,
      navigationId: (history.state as { navigationId?: number } | null)?.navigationId ?? null,
    }));
    if (afterSecondBack.href !== 'about:blank') {
      // No-exit browsers (Firefox): the no-op must not have navigated.
      expect(afterSecondBack.length).toBe(historyLengthAfterBounce);
      expect(afterSecondBack.navigationId).toBe(inAppNavIdAfterBounce);
    }
  });

  test('ANG007-WS-1: a real sign-in connects the raw-WS client without a reload; sign-out disconnects (AC-ANG-007-8)', async ({
    page,
  }) => {
    // The app's own raw-WS upgrades (environment.wsUrl targets the Java
    // :8080 `/ws` directly — the runner's YACC_REALTIME_WS_ALLOWED_ORIGINS
    // makes the cross-origin upgrade legal; same posture as the R1 rows).
    const appSockets: Array<{ url: string; isClosed: () => boolean }> = [];
    page.on('websocket', (ws) => {
      if (ws.url().includes('/ws?token=')) {
        appSockets.push({ url: ws.url(), isClosed: () => ws.isClosed() });
      }
    });
    const devtoolsState = () =>
      page.evaluate(
        () =>
          (window as unknown as { __yaccRealtimeDevtools?: { client(): { connectionState: string } } })
            .__yaccRealtimeDevtools?.client().connectionState ?? null,
      );

    // Signed-out boot: no session token, no socket attempt, binding idle.
    await page.goto('/login');
    await expect(page.getByTestId('login-email')).toBeVisible();
    await expect.poll(devtoolsState, { timeout: 15_000 }).toBe('disconnected');
    expect(appSockets).toHaveLength(0);

    // REAL sign-in — SPA navigation to /inbox; there is NO page reload
    // between boot and this point, so any connected socket below was
    // reached through the auth/session transition alone (React
    // `WebSocketInitializer` parity).
    await page.getByTestId('login-email').fill(MANAGER.email);
    await page.getByTestId('login-password').fill(MANAGER.password);
    await page.getByTestId('login-submit').click();
    await page.waitForURL(/\/inbox/);

    await expect.poll(devtoolsState, { timeout: 15_000 }).toBe('connected');
    expect(appSockets).toHaveLength(1);

    // The upgrade rode the freshly stored access token (not a stale one).
    const storedToken = await page.evaluate(() => localStorage.getItem('yacc_token'));
    expect(storedToken).toBeTruthy();
    expect(appSockets[0].url).toContain(`token=${encodeURIComponent(storedToken as string)}`);

    // Sign-out (shell session control → delivered AuthService): the
    // binding deliberately disconnects the live socket.
    await page.evaluate(() => {
      (document.querySelector('button[aria-label="Logout"]') as HTMLElement).click();
    });
    await page.locator('.modal button:has-text("Sign Out")').click();
    await page.waitForURL(/\/login/);

    await expect.poll(devtoolsState, { timeout: 15_000 }).toBe('disconnected');
    // The client state flips synchronously; the underlying TCP close lands
    // a tick later — poll the observed socket closure.
    await expect.poll(() => appSockets[0].isClosed(), { timeout: 15_000 }).toBe(true);
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
    // The press targets a DETERMINISTIC element that is outside the
    // notification host by DOM structure (the inbox page heading in
    // `main`, not inside `app-notification-center`), never a fixed
    // viewport coordinate: the daisyUI-less shell renders the host as a
    // full-width block whose on-screen band moves with environment layout
    // metrics (font availability; the CI realtime-origin reconnect banner
    // adds ~77 px above the shell), and the fixed point this row used
    // before the ANG-015 parity failure (640, 400) landed INSIDE the host
    // in that shifted layout — an in-host press must not close the panel
    // (React listener parity; reproduced 3× on chromium/webkit, measured
    // host band chromium y 321–393 vs webkit y 329–401 vs CI ~398–470).
    // The assertion's intent is unchanged: aria-expanded becomes false
    // after an outside mousedown.
    await page.getByRole('heading', { name: 'YACC Inbox' }).click();
    await expect(bell).toHaveAttribute('aria-expanded', 'false');
  });
});
