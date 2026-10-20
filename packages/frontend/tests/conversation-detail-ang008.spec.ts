import { expect, test, type Page } from '@playwright/test';

/**
 * ANG-008 (#378) Tier-0 evidence rows — conversation detail + reply +
 * retry/status UX + the notification click-through integration
 * (AC-ANG-008-6).
 *
 * OWNERSHIP AND ADDITIVITY (recorded, not silent): this file is NEW and is
 * owned by #378 — no existing suite file is edited (the ANG-003/ANG-007
 * "0 spec-file edits" state stays intact; ANG-015 owns the final
 * disposition-register / CI-scope classification of harness files).
 *
 * Run posture (S1 fixture seed, identical to the R1 + ANG-007 evidence
 * runs): the Java service is booted by the runner with the S1 e2e posture
 * (`e2e` profile + `yacc.e2e.seed-enabled=true` + loopback DATABASE_URL)
 * plus `YACC_REALTIME_WS_ALLOWED_ORIGINS=<the Angular origin>`; the
 * Angular dev server is the harness webServer (:4200) and relays `/api`
 * to the service. Real UI sign-in with fixture identities — no mocks, no
 * route stubs.
 *
 * Recorded boundaries (exact, not silent):
 * - U1: the merged Java service has NO notification producer (no WS
 *   emitter; the panel is socket-fed by design, B6 fix). AC-ANG-008-6's
 *   "notification exists" precondition cannot be driven through the real
 *   backend, so ANG008-NOTIF-1 seeds the app's OWN client-side
 *   `NotificationsStore` persistence (`notifications-store` localStorage
 *   key, the store's documented format) and then exercises everything
 *   downstream for real: the shell bell, the panel item click, the
 *   `navigateByUrl('/conversations/:id')` click-through, the route
 *   resolution, and the rendered detail. The direct-goto variant of the
 *   same integration (no seeded state at all) is ANG008-DETAIL-1.
 * - The retry button's exactly-once click tracking needs a FAILED
 *   outbound row; the S1 fixture world has none and the seed is not
 *   editable from this issue, and the Java service exposes no API path
 *   that produces a FAILED message. The retry surface is therefore
 *   evidenced at the unit level (`ConversationPage` TestBed specs:
 *   retry patch, disabled "Retry Sent" on failure, RBAC-denied text)
 *   and this file evidences the live reply + append-path status UX (U3).
 * - daisyUI/PostCSS is not wired in the Angular scaffold (pre-existing
 *   ANG-001 gap, disclosed in #377): utility classes are inert, so the
 *   bell button renders 0×0 (its aria surface is intact). Bell
 *   interactions below use real DOM events on the element
 *   (`dispatchEvent`), the same channel as the ANG-007 rows.
 */

test.describe('ANG-008 conversation detail (real backend)', () => {
  const MANAGER = { email: 'manager@yacc.local', password: 'admin123' };
  const USER = { email: 'user@yacc.local', password: 'admin123' };

  /** Deterministic S1 fixture Telegram conversation ("Fixture Support Thread"). */
  const FIXTURE_CONVERSATION_ID = '00000000-0000-0000-0000-000000001001';
  const FIXTURE_MANAGER_USER_ID = '00000000-0000-0000-0000-000000000003';

  async function realSignIn(page: Page, identity: { email: string; password: string } = MANAGER): Promise<void> {
    await page.goto('/login');
    await page.getByTestId('login-email').fill(identity.email);
    await page.getByTestId('login-password').fill(identity.password);
    await page.getByTestId('login-submit').click();
    await page.waitForURL(/\/inbox/);
  }

  test('ANG008-DETAIL-1: /conversations/:id renders the conversation detail (not the catch-all); inbox card + unknown-path parity', async ({
    page,
  }) => {
    await realSignIn(page);

    // Direct goto — the AC-ANG-008-6 direct-goto assertion: the URL
    // renders the DETAIL, never the `**` → /inbox fallback.
    await page.goto(`/conversations/${FIXTURE_CONVERSATION_ID}`);
    await expect(page).toHaveURL(new RegExp(`/conversations/${FIXTURE_CONVERSATION_ID}$`));
    await expect(page.locator('[data-testid="conversation-detail"]')).toBeVisible();
    await expect(page).not.toHaveURL(/\/inbox/);

    // W7 header: badges, thread metadata (this fixture row's wire detail
    // carries NO `title` — the page renders the `title || externalThreadId`
    // fallback, React parity), and the fixture timeline.
    await expect(page.locator('[data-testid="conversation-header"]')).toBeVisible();
    await expect(page.locator('[data-testid="conversation-channel"]')).toHaveText('Telegram');
    await expect(page.locator('[data-testid="conversation-status"]')).toHaveText('open');
    await expect(page.locator('[data-testid="conversation-priority"]')).toHaveText('normal');
    await expect(page.getByText('fixture-tg-101')).toBeVisible();
    await expect(page.locator('[data-testid="conversation-messages"]')).toBeVisible();
    await expect(page.getByText('fixture inbound message')).toBeVisible();
    await expect(page.getByText('fixture outbound reply')).toBeVisible();
    // #379's right panel is mounted by the page (the React
    // ConversationPage → RightPanel composition parity).
    await expect(page.locator('[data-testid="right-panel"]')).toBeVisible();
    // Manager (staff): the reply composer renders (RBAC gate open).
    await expect(page.locator('[data-testid="reply-composer-textarea"]')).toBeVisible();

    // The `**` catch-all is intact (React `path="*"` parity): a path that
    // matches no route still lands on /inbox. (A `/conversations/<junk>`
    // segment DOES match the detail route — React `path="/conversations/:id"`
    // parity — and renders the detail's not-found/error state instead.)
    await page.goto('/this-route-does-not-exist');
    await expect(page).toHaveURL(/\/inbox$/);
    // (The inbox card click-through navigation is unit-evidenced in the
    // ANG-007 inbox spec; the S1 bulk rows push the fixture row past
    // inbox page 1, so it is not asserted here — the notification
    // click-through below is the live navigation evidence.)
  });

  test('ANG008-REPLY-1: a manager reply appends the server-confirmed row; status UX rides the HTTP append path (U3)', async ({
    page,
  }) => {
    await realSignIn(page);
    await page.goto(`/conversations/${FIXTURE_CONVERSATION_ID}`);
    await expect(page.locator('[data-testid="reply-composer-textarea"]')).toBeVisible();

    const body = `ANG008 reply ${Date.now()}`;
    await page.getByTestId('reply-composer-textarea').fill(body);
    await expect(page.getByTestId('character-counter')).toContainText(String(body.length));
    await page.getByTestId('reply-composer-send-button').click();

    // The confirmed row appears in the timeline with its append-path
    // status badge (the Java send answers 201; no optimistic temp row —
    // U5 inactive), and the draft is cleared.
    const timeline = page.locator('[data-testid="conversation-messages"]');
    await expect(timeline.getByTestId('message-body').filter({ hasText: body })).toBeVisible();
    const appendedRow = timeline.locator('[data-testid="message-item"]', {
      has: page.getByTestId('message-body').filter({ hasText: body }),
    });
    // The Java directory display name for the manager identity.
    await expect(appendedRow.getByTestId('message-sender')).toHaveText('Manager');
    await expect(appendedRow.locator('.badge').last()).toHaveText(/pending|sent|failed/);
    await expect(page.getByTestId('reply-composer-textarea')).toHaveValue('');
    // No send-failure alert is shown (the append succeeded).
    await expect(page.locator('[data-testid="error-message"]')).toHaveCount(0);
  });

  test('ANG008-RBAC-1: an unassigned USER cannot reply (canReplyAndRetry gate)', async ({
    page,
  }) => {
    // The fixture Telegram conversation is assigned to the admin; the
    // USER identity is unassigned → the composer is replaced by the
    // RBAC warning (backend stays the security boundary; UX parity).
    await realSignIn(page, USER);
    await page.goto(`/conversations/${FIXTURE_CONVERSATION_ID}`);
    await expect(page.locator('[data-testid="conversation-detail"]')).toBeVisible();
    await expect(page.locator('[data-testid="reply-composer-textarea"]')).toHaveCount(0);
    await expect(
      page.getByText("You don't have permission to reply to this conversation"),
    ).toBeVisible();
  });

  test('ANG008-NOTIF-1 (AC-ANG-008-6): the shell bell click-through lands on the rendered conversation detail', async ({
    page,
  }) => {
    await realSignIn(page);

    // U1 boundary (see header): seed the app's own NotificationsStore
    // persistence so an assignment notification EXISTS for the signed-in
    // manager; everything downstream is the real component path.
    const notification = {
      id: '00000000-0000-4000-8000-00000000f001',
      userId: FIXTURE_MANAGER_USER_ID,
      type: 'assignment',
      conversationId: FIXTURE_CONVERSATION_ID,
      actorId: '00000000-0000-0000-0000-000000000002',
      actorName: 'Admin User',
      message: 'Fixture conversation assigned',
      isRead: false,
      createdAt: new Date().toISOString(),
    };
    await page.evaluate((row) => {
      localStorage.setItem('notifications-store', JSON.stringify([row]));
    }, notification);

    await page.reload();
    await expect(page).toHaveURL(/\/inbox/);

    const bell = page.locator('button[aria-label^="Notifications"]');
    await expect(bell).toHaveCount(1);
    await bell.dispatchEvent('click');
    const panel = page.locator('[role="region"][aria-label="Notifications"]');
    await expect(panel).toBeVisible();
    await expect(panel.getByText('Fixture conversation assigned')).toBeVisible();

    // The click-through: panel closes, navigation happens, and the
    // DESTINATION renders the conversation detail — the #377
    // navigation-level evidence now resolves to rendered content (W17→W7).
    await panel.locator('[role="listitem"]').first().click();
    await expect(page).toHaveURL(new RegExp(`/conversations/${FIXTURE_CONVERSATION_ID}$`));
    await expect(page.locator('[data-testid="conversation-detail"]')).toBeVisible();
    await expect(page.getByText('fixture-tg-101')).toBeVisible();
    await expect(page.locator('[data-testid="reply-composer-textarea"]')).toBeVisible();
  });
});
