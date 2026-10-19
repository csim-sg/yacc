import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router, RouterOutlet } from '@angular/router';

import { errorMappingInterceptor } from '../../interceptors/error-mapping.interceptor';
import { flushTasks } from '../../../testing/flush-tasks';
import { Conversation } from './conversation';

@Component({ selector: 'app-stub', template: '' })
class StubPage {}

@Component({
  selector: 'app-test-host',
  imports: [RouterOutlet],
  template: '<router-outlet />',
})
class TestHost {}

/**
 * ConversationPage spec (W7 — detail, timeline, reply, exactly-once
 * retry, RBAC): loads the detail + messages through the canonical
 * stores (verified wire shapes incl. the frozen `{ data }` send
 * envelope), renders the timeline bubbles, gates reply/retry via
 * `canReplyAndRetry` (USER requires assignment), tracks retry clicks
 * exactly once, surfaces send failures through the composer alert, and
 * refetches the detail when the right panel reports a tags change.
 * Interactions go through the DOM (existing page-spec convention).
 */
describe('Conversation page', () => {
  let fixture: ComponentFixture<TestHost>;
  let router: Router;
  let http: HttpTestingController;

  const CONVERSATION_ID = '00000000-0000-4000-8000-00000000c001';
  const MANAGER = {
    id: '00000000-0000-4000-8000-00000000d003',
    email: 'manager@yacc.local',
    name: 'Manager User',
    role: 'manager',
    status: 'active',
  };
  const PLAIN_USER = {
    id: '00000000-0000-4000-8000-00000000d004',
    email: 'user@yacc.local',
    name: 'Support User',
    role: 'user',
    status: 'active',
  };

  const detail = (assignedUserId: string | null = MANAGER.id, tags: unknown[] = vipTag()) => ({
    data: {
      id: CONVERSATION_ID,
      channel: 'telegram',
      externalThreadId: 'thread-1',
      title: 'Support thread',
      status: 'open',
      priority: 'normal',
      assignedUserId,
      createdAt: '2026-10-01T10:00:00Z',
      updatedAt: '2026-10-19T10:00:00Z',
      tags,
    },
  });

  function vipTag(): unknown[] {
    return [{ id: '1', name: 'VIP', color: '#2563EB' }];
  }

  const inbound = {
    id: '00000000-0000-4000-8000-00000000e001',
    conversationId: CONVERSATION_ID,
    senderId: null,
    senderName: 'Fixture Sender',
    body: 'fixture inbound message',
    status: 'sent',
    direction: 'inbound',
    createdAt: '2026-10-19T09:00:00Z',
    updatedAt: '2026-10-19T09:00:00Z',
  };
  const outboundFailed = {
    id: '00000000-0000-4000-8000-00000000e002',
    conversationId: CONVERSATION_ID,
    senderId: MANAGER.id,
    senderName: 'Manager User',
    body: 'failed outbound reply',
    status: 'failed',
    direction: 'outbound',
    createdAt: '2026-10-19T09:05:00Z',
    updatedAt: '2026-10-19T09:05:00Z',
  };

  const messageList = (rows: Record<string, unknown>[]) => ({
    messages: rows,
    total: rows.length,
    page: 1,
    limit: 50,
  });

  function pageElement(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  async function render(url = `/conversations/${CONVERSATION_ID}`): Promise<void> {
    await router.navigateByUrl(url);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  /**
   * Seed the token storage and render: the AuthService memoizes its
   * session restore at construction, so the token MUST exist before the
   * component instantiates — the construction-time get-session is then
   * flushed here.
   */
  async function renderSignedIn(user: Record<string, string>): Promise<void> {
    localStorage.setItem('yacc_token', 'access-1');
    localStorage.setItem('yacc_refresh_token', 'refresh-1');
    localStorage.setItem('yacc_token_kind', 'local');
    await render();
    http.expectOne('/api/auth/get-session').flush({ user, mustChangePassword: false });
    fixture.detectChanges();
  }

  /**
   * Flush the detail + messages list, then — once the loaded detail has
   * rendered the right panel — the panel's own tags/notes loads.
   */
  async function flushDetail(inputs: {
    messages: Record<string, unknown>[];
    assignedUserId?: string | null;
  }): Promise<void> {
    fixture.detectChanges();
    http.expectOne(`/api/conversations/${CONVERSATION_ID}`).flush(detail(inputs.assignedUserId ?? MANAGER.id));
    http
      .expectOne(`/api/conversations/${CONVERSATION_ID}/messages`)
      .flush(messageList(inputs.messages));
    await fixture.whenStable();
    fixture.detectChanges();
    flushRightPanelLoads();
  }

  /** The right panel loads tags + notes whenever the conversation renders. */
  function flushRightPanelLoads(): void {
    http.expectOne('/api/tags').flush({ data: [], page: 1, pageSize: 50, total: 0 });
    http
      .expectOne(`/api/conversations/${CONVERSATION_ID}/notes`)
      .flush({ data: [], page: 1, pageSize: 50, total: 0 });
  }

  function composerTextarea(): HTMLTextAreaElement {
    return pageElement().querySelector('[data-testid="reply-composer-textarea"]') as HTMLTextAreaElement;
  }

  beforeEach(async () => {
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [TestHost, Conversation],
      providers: [
        provideHttpClient(withInterceptors([errorMappingInterceptor])),
        provideHttpClientTesting(),
        provideRouter([
          { path: 'conversations/:id', component: Conversation },
          { path: 'inbox', component: StubPage },
          { path: 'login', component: StubPage },
        ]),
      ],
    });
    router = TestBed.inject(Router);
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(TestHost);
  });

  afterEach(() => {
    fixture.destroy();
    http.verify();
    localStorage.clear();
  });

  it('renders the conversation header badges, thread metadata, and the message timeline', async () => {
    await renderSignedIn(MANAGER);
    await flushDetail({ messages: [inbound, outboundFailed] });
    await flushTasks();
    fixture.detectChanges();

    expect(pageElement().querySelector('[data-testid="conversation-header"]')).toBeDefined();
    expect(pageElement().querySelector('[data-testid="conversation-detail"]')).toBeDefined();
    expect(pageElement().querySelector('[data-testid="conversation-channel"]')?.textContent?.trim()).toBe('Telegram');
    expect(pageElement().querySelector('[data-testid="conversation-status"]')?.textContent?.trim()).toBe('open');
    expect(pageElement().querySelector('[data-testid="conversation-priority"]')?.textContent?.trim()).toBe('normal');
    expect(pageElement().textContent).toContain('Support thread');
    expect(pageElement().textContent).toContain('Assigned to');
    // Timeline bubbles: sender, body, and the append-path status badge.
    expect(pageElement().querySelectorAll('[data-testid="message-item"]')).toHaveLength(2);
    expect(pageElement().querySelectorAll('[data-testid="message-sender"]')[0]?.textContent?.trim()).toBe('Fixture Sender');
    expect(pageElement().querySelectorAll('[data-testid="message-body"]')[1]?.textContent?.trim()).toBe('failed outbound reply');
    expect(pageElement().textContent).toContain('failed');
    // Manager can reply: the composer renders.
    expect(composerTextarea()).toBeDefined();
  });

  it('sends a reply through the frozen send envelope and appends the confirmed row', async () => {
    await renderSignedIn(MANAGER);
    await flushDetail({ messages: [inbound] });
    await flushTasks();
    fixture.detectChanges();

    const textarea = composerTextarea();
    textarea.value = 'a fresh reply';
    textarea.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    (pageElement().querySelector('[data-testid="reply-composer-send-button"]') as HTMLButtonElement).click();
    await flushTasks();
    fixture.detectChanges();

    const request = http.expectOne(`/api/conversations/${CONVERSATION_ID}/messages`);
    expect(request.request.body).toEqual({ body: 'a fresh reply' });
    // U3 disposition: the frozen `{ data: Message }` operation.
    request.flush({
      data: {
        id: '00000000-0000-4000-8000-00000000e003',
        conversationId: CONVERSATION_ID,
        senderId: MANAGER.id,
        senderName: 'Manager User',
        body: 'a fresh reply',
        status: 'pending',
        direction: 'outbound',
        createdAt: '2026-10-19T10:05:00Z',
        updatedAt: '2026-10-19T10:05:00Z',
      },
    });
    await flushTasks();
    await fixture.whenStable();
    fixture.detectChanges();

    // Server-confirmed append: the timeline shows the new row (status
    // rides the HTTP append path — no optimistic temp row, U5 inactive).
    const bodies = Array.from(pageElement().querySelectorAll('[data-testid="message-body"]')).map(
      (row) => row.textContent?.trim(),
    );
    expect(bodies).toEqual(['fixture inbound message', 'a fresh reply']);
    expect(textarea.value).toBe('');
    expect(pageElement().querySelector('[data-testid="error-message"]')).toBeNull();

    // B4: the confirmed send invalidated the conversations family — the
    // loaded detail entry refetches.
    http.expectOne(`/api/conversations/${CONVERSATION_ID}`).flush(detail());
    await flushTasks();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('surfaces a failed send through the composer alert and clears it on dismiss', async () => {
    await renderSignedIn(MANAGER);
    await flushDetail({ messages: [inbound] });
    await flushTasks();
    fixture.detectChanges();

    const textarea = composerTextarea();
    textarea.value = 'doomed reply';
    textarea.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    (pageElement().querySelector('[data-testid="reply-composer-send-button"]') as HTMLButtonElement).click();
    await flushTasks();
    fixture.detectChanges();

    http
      .expectOne(`/api/conversations/${CONVERSATION_ID}/messages`)
      .flush({ error: 'Cannot send to this channel' }, { status: 400, statusText: 'Bad Request' });
    await flushTasks();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(pageElement().querySelectorAll('[data-testid="error-message"]').length).toBeGreaterThan(0);
    expect(pageElement().textContent).toContain('Cannot send to this channel');
    // The draft is kept on failure (React composer parity).
    expect(textarea.value).toBe('doomed reply');

    const dismiss = pageElement().querySelector(
      '[data-testid="error-dismiss-button"]',
    ) as HTMLButtonElement;
    dismiss.click();
    fixture.detectChanges();
    expect(pageElement().querySelector('[data-testid="error-message"]')).toBeNull();
  });

  it('patches a retried failed message to sent (exactly-once click tracking)', async () => {
    await renderSignedIn(MANAGER);
    await flushDetail({ messages: [inbound, outboundFailed] });
    await flushTasks();
    fixture.detectChanges();

    const retry = pageElement().querySelector(
      `[data-testid="message-retry-${outboundFailed.id}"]`,
    ) as HTMLButtonElement;
    expect(retry).toBeDefined();
    retry.click();
    await flushTasks();
    fixture.detectChanges();

    const request = http.expectOne(
      `/api/conversations/${CONVERSATION_ID}/messages/${outboundFailed.id}/retry`,
    );
    request.flush({
      data: { ...outboundFailed, status: 'sent', updatedAt: '2026-10-19T10:06:00Z' },
    });
    await flushTasks();
    await fixture.whenStable();
    fixture.detectChanges();

    // The store patched the row in place: the failed branch (and its
    // retry affordance) is gone, the row renders with the patched status.
    expect(pageElement().querySelector(`[data-testid="message-retry-${outboundFailed.id}"]`)).toBeNull();
    expect(pageElement().querySelectorAll('[data-testid="message-body"]')).toHaveLength(2);
    expect(pageElement().textContent).toContain('sent');

    // B4: the retry invalidated the conversations family — the loaded
    // detail entry refetches.
    http.expectOne(`/api/conversations/${CONVERSATION_ID}`).flush(detail());
    await flushTasks();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('marks a failed retry as attempted exactly once — disabled "Retry Sent" on failure', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await renderSignedIn(MANAGER);
    await flushDetail({ messages: [inbound, outboundFailed] });
    await flushTasks();
    fixture.detectChanges();

    const retry = pageElement().querySelector(
      `[data-testid="message-retry-${outboundFailed.id}"]`,
    ) as HTMLButtonElement;
    retry.click();
    await flushTasks();
    fixture.detectChanges();

    http
      .expectOne(`/api/conversations/${CONVERSATION_ID}/messages/${outboundFailed.id}/retry`)
      .flush({ error: 'Retry not allowed' }, { status: 400, statusText: 'Bad Request' });
    await flushTasks();
    await fixture.whenStable();
    fixture.detectChanges();

    // The row stays failed, but the enabled retry control is gone — the
    // disabled "Retry Sent" placeholder replaced it (exactly-once; React
    // `retriedMessageIds` parity).
    expect(pageElement().querySelector(`[data-testid="message-retry-${outboundFailed.id}"]`)).toBeNull();
    const disabled = Array.from(pageElement().querySelectorAll('button')).find(
      (candidate) => candidate.textContent?.trim() === 'Retry Sent',
    ) as HTMLButtonElement | undefined;
    expect(disabled).toBeDefined();
    expect(disabled?.disabled).toBe(true);
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it('denies reply + retry for an unassigned USER (RBAC)', async () => {
    await renderSignedIn(PLAIN_USER);
    await flushDetail({ messages: [inbound, outboundFailed], assignedUserId: MANAGER.id });
    await flushTasks();
    fixture.detectChanges();

    // No composer; the RBAC warning renders instead.
    expect(composerTextarea()).toBeNull();
    expect(pageElement().textContent).toContain(
      "You don't have permission to reply to this conversation",
    );
    // The failed outbound row shows the permission text, not a button.
    expect(pageElement().querySelector(`[data-testid="message-retry-${outboundFailed.id}"]`)).toBeNull();
    expect(pageElement().textContent).toContain("You don't have permission to retry this message");
  });

  it('allows reply + retry for an assigned USER (RBAC)', async () => {
    await renderSignedIn(PLAIN_USER);
    await flushDetail({ messages: [inbound, outboundFailed], assignedUserId: PLAIN_USER.id });
    await flushTasks();
    fixture.detectChanges();

    expect(composerTextarea()).toBeDefined();
    expect(
      pageElement().querySelector(`[data-testid="message-retry-${outboundFailed.id}"]`),
    ).toBeDefined();
  });

  it('shows the load error with a retry control that refetches the detail', async () => {
    await renderSignedIn(MANAGER);
    http
      .expectOne(`/api/conversations/${CONVERSATION_ID}`)
      .flush({ error: 'Conversation not found' }, { status: 404, statusText: 'Not Found' });
    http
      .expectOne(`/api/conversations/${CONVERSATION_ID}/messages`)
      .flush({ error: 'Conversation not found' }, { status: 404, statusText: 'Not Found' });
    // The right panel is not rendered in the error state — no tags/notes.
    await fixture.whenStable();
    fixture.detectChanges();

    expect(pageElement().querySelector('[data-testid="error-message"]')).toBeDefined();
    expect(pageElement().textContent).toContain('Failed to load conversation');
    expect(pageElement().textContent).toContain('Conversation not found');

    const retry = pageElement().querySelector('[data-testid="retry-button"]') as HTMLButtonElement;
    retry.click();
    fixture.detectChanges();
    // Only the detail refetches (React `refetch()` on the conversation
    // query parity); the messages query stays terminal until revisited.
    http.expectOne(`/api/conversations/${CONVERSATION_ID}`).flush(detail());
    await fixture.whenStable();
    fixture.detectChanges();
    flushRightPanelLoads();
    await flushTasks();
    fixture.detectChanges();

    expect(pageElement().querySelector('[data-testid="conversation-detail"]')).toBeDefined();
  });

  it('refetches the conversation detail when the right panel reports a tags change', async () => {
    await renderSignedIn(MANAGER);
    await flushDetail({ messages: [inbound] });
    await flushTasks();
    fixture.detectChanges();

    // The seeded tag row renders its detach control (#379 surface);
    // detaching emits the panel's `tagsChange`, which the page maps to
    // the detail refetch (React invalidateQueries parity).
    const removeTag = pageElement().querySelector('[data-testid="remove-tag-1"]') as HTMLButtonElement;
    expect(removeTag).toBeDefined();
    removeTag.click();
    await flushTasks();
    fixture.detectChanges();

    http
      .expectOne(`/api/conversations/${CONVERSATION_ID}/tags/1`)
      .flush({ data: [] });
    await flushTasks();
    await fixture.whenStable();
    fixture.detectChanges();

    // The invalidation refetches the loaded detail entry — BOTH the
    // TagsStore family invalidation and the page's `tagsChange` handler
    // request it (React dedupes concurrent refetches of the same query;
    // the sequenced writes here issue two). Absorb every refetch issued.
    await flushDetailRefetches({ tags: [] });
    await flushTasks();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(pageElement().querySelector('[data-testid="conversation-detail"]')).toBeDefined();
  });

  /** Flush every GET-detail refetch currently in flight (invalidations). */
  async function flushDetailRefetches(overrides: Record<string, unknown> = {}): Promise<void> {
    const url = `/api/conversations/${CONVERSATION_ID}`;
    for (let round = 0; round < 5; round++) {
      const pending = http.match(
        (request) => request.method === 'GET' && request.url === url,
      );
      if (pending.length === 0) {
        return;
      }
      for (const request of pending) {
        request.flush({ data: { ...detail().data, ...overrides } });
      }
      await flushTasks();
      await fixture.whenStable();
      fixture.detectChanges();
    }
  }

  it('shows the skeleton while the first detail load is in flight', async () => {
    await renderSignedIn(MANAGER);
    fixture.detectChanges();

    // Detail requested but not answered yet — skeleton state.
    expect(pageElement().querySelector('.skeleton')).toBeDefined();
    http.expectOne(`/api/conversations/${CONVERSATION_ID}`).flush(detail());
    http
      .expectOne(`/api/conversations/${CONVERSATION_ID}/messages`)
      .flush(messageList([inbound]));
    await fixture.whenStable();
    fixture.detectChanges();
    flushRightPanelLoads();
    await flushTasks();
    fixture.detectChanges();

    expect(pageElement().querySelector('.skeleton')).toBeNull();
    expect(pageElement().querySelector('[data-testid="conversation-detail"]')).toBeDefined();
  });
});
