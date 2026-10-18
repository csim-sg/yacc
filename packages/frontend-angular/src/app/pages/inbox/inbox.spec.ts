import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router, RouterOutlet } from '@angular/router';

import { errorMappingInterceptor } from '../../interceptors/error-mapping.interceptor';
import { flushTasks } from '../../../testing/flush-tasks';
import { ConversationsStore } from '../../services/conversations.store';
import { Inbox } from './inbox';

@Component({ selector: 'app-stub', template: '' })
class StubPage {}

@Component({
  selector: 'app-test-host',
  imports: [RouterOutlet],
  template: '<router-outlet />',
})
class TestHost {}

/**
 * InboxPage spec (W5/W6): URL-param initialization + write-back,
 * filters/search/pagination against `GET /api/conversations` through the
 * canonical store, keep-previous (no loading flash), error/empty states,
 * and the W6 optimistic unread clear on open. Interactions go through the
 * DOM (existing page-spec convention).
 */
describe('Inbox page', () => {
  let fixture: ComponentFixture<TestHost>;
  let router: Router;
  let http: HttpTestingController;
  let store: ConversationsStore;

  const DEFAULT_URL = '/api/conversations?page=1&limit=20&sortBy=lastActivity&sortOrder=desc';

  const listResponse = {
    data: [
      {
        id: '00000000-0000-0000-0000-0000000000aa',
        channel: 'telegram',
        externalThreadId: 'thread-1',
        title: 'Support thread',
        status: 'open',
        priority: 'high',
        unreadCount: 3,
        assignedUserName: 'Manager User',
        latestMessagePreview: 'Hello there',
        latestMessageAt: '2026-10-19T10:00:00Z',
        createdAt: '2026-10-01T10:00:00Z',
        updatedAt: '2026-10-19T10:00:00Z',
      },
      {
        id: '00000000-0000-0000-0000-0000000000bb',
        channel: 'irc',
        externalThreadId: 'thread-2',
        title: null,
        status: 'pending',
        priority: 'normal',
        unreadCount: 0,
        assignedUserName: null,
        latestMessagePreview: null,
        latestMessageAt: null,
        createdAt: '2026-10-02T10:00:00Z',
        updatedAt: '2026-10-18T10:00:00Z',
        tags: [{ id: '7', name: 'vip', color: '#ff0000' }],
      },
    ],
    page: 1,
    limit: 20,
    total: 2,
  };

  function inboxElement(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  async function render(url = '/inbox'): Promise<void> {
    await router.navigateByUrl(url);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  /** Flush the pending list response and let the store state settle. */
  async function flushList(response: Record<string, unknown> = listResponse, url?: string): Promise<void> {
    fixture.detectChanges();
    http.expectOne(url ?? DEFAULT_URL).flush(response);
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function setSelect(testId: string, value: string): void {
    const select = inboxElement().querySelector(`[data-testid="${testId}"]`) as HTMLSelectElement;
    select.value = value;
    select.dispatchEvent(new Event('change'));
  }

  function buttonWithText(text: string, scope?: string): HTMLButtonElement {
    const container = scope ? (inboxElement().querySelector(scope) as HTMLElement) : inboxElement();
    const button = Array.from(container.querySelectorAll('button')).find(
      (candidate) => candidate.textContent?.trim() === text,
    );
    expect(button).toBeDefined();
    return button!;
  }

  beforeEach(async () => {
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [TestHost, Inbox],
      providers: [
        provideHttpClient(withInterceptors([errorMappingInterceptor])),
        provideHttpClientTesting(),
        provideRouter([
          { path: 'inbox', component: Inbox },
          { path: 'conversations/:id', component: StubPage },
          { path: 'login', component: StubPage },
        ]),
      ],
    });
    router = TestBed.inject(Router);
    http = TestBed.inject(HttpTestingController);
    store = TestBed.inject(ConversationsStore);
    fixture = TestBed.createComponent(TestHost);
  });

  afterEach(() => {
    fixture.destroy();
    http.verify();
    localStorage.clear();
  });

  it('loads and renders the conversation cards with badges and unread counts', async () => {
    await render();

    await flushList();

    expect(inboxElement().querySelectorAll('[data-testid="conversation-card"]')).toHaveLength(2);
    expect(inboxElement().querySelector('[data-testid="conversation-channel"]')?.textContent?.trim()).toBe('Telegram');
    expect(
      inboxElement().querySelector('[data-testid="conversation-status-badge"]')?.textContent?.trim(),
    ).toBe('open');
    expect(inboxElement().textContent).toContain('Thread thread-2');
    expect(inboxElement().textContent).toContain('Assigned to Manager User');
    expect(inboxElement().textContent).toContain('Unassigned');
    // W6 badge on the first row only (0 renders nothing).
    expect(inboxElement().querySelector('app-unread-badge span')?.textContent?.trim()).toBe('3');
    // Tag projection renders with its color.
    expect(inboxElement().querySelector('[data-testid="conversation-tag"]')?.textContent?.trim()).toBe('vip');
  });

  it('initializes every filter from the URL and requests the matching page', async () => {
    await render(
      '/inbox?page=2&channel=telegram&status=open&priority=high&search=hello&dateFrom=2026-01-01&dateTo=2026-02-01&unread=true',
    );

    await flushList(
      listResponse,
      '/api/conversations?page=2&limit=20&sortBy=lastActivity&sortOrder=desc&channel=telegram&status=open&priority=high&search=hello&dateFrom=2026-01-01&dateTo=2026-02-01&unread=true',
    );

    expect(inboxElement().querySelector('[data-testid="page-info"]')?.textContent).toContain('Page 2');
    // Active filter chips render for the non-default filters.
    expect(inboxElement().textContent).toContain('Channel: Telegram');
    expect(inboxElement().textContent).toContain('Status: open');
    expect(inboxElement().textContent).toContain('Search: hello');
    expect(inboxElement().textContent).toContain('Unread only');
  });

  it('writes non-default filters back to the URL (replace)', async () => {
    await render();

    await flushList({ ...listResponse, total: 45 });

    buttonWithText('Next', '[data-testid="pagination-controls"]').click();
    await flushList(
      { ...listResponse, page: 2, total: 45 },
      '/api/conversations?page=2&limit=20&sortBy=lastActivity&sortOrder=desc',
    );

    expect(router.url).toContain('page=2');
  });

  it('submits the trimmed search on Enter and resets to page 1', async () => {
    await render('/inbox?page=3');
    await flushList(undefined, '/api/conversations?page=3&limit=20&sortBy=lastActivity&sortOrder=desc');

    const input = inboxElement().querySelector('[data-testid="search-input"]') as HTMLInputElement;
    input.value = '  needle  ';
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    await flushList(
      { data: [], page: 1, limit: 20, total: 0 },
      '/api/conversations?page=1&limit=20&sortBy=lastActivity&sortOrder=desc&search=needle',
    );

    expect(inboxElement().textContent).toContain('Search: needle');
  });

  it('keeps the previous list visible while a filter change loads (no flash)', async () => {
    await render();
    await flushList();
    expect(inboxElement().querySelectorAll('[data-testid="conversation-card"]')).toHaveLength(2);

    // Change the channel filter; the new entry starts loading.
    setSelect('channel-filter', 'telegram');
    fixture.detectChanges();
    const request = http.expectOne(
      '/api/conversations?page=1&limit=20&sortBy=lastActivity&sortOrder=desc&channel=telegram',
    );

    // Still loading: skeleton shows AND the previous rows stay rendered.
    fixture.detectChanges();
    expect(inboxElement().querySelector('[data-testid="conversation-skeleton"]')).toBeTruthy();
    expect(inboxElement().querySelectorAll('[data-testid="conversation-card"]')).toHaveLength(2);

    // The empty response lands: empty state replaces the list.
    request.flush({ data: [], page: 1, limit: 20, total: 0 });
    await fixture.whenStable();
    fixture.detectChanges();
    expect(inboxElement().querySelector('[data-testid="empty-state"]')).toBeTruthy();
    expect(inboxElement().querySelectorAll('[data-testid="conversation-card"]')).toHaveLength(0);
  });

  it('resets to page 1 when a filter changes', async () => {
    await render('/inbox?page=2');
    await flushList(undefined, '/api/conversations?page=2&limit=20&sortBy=lastActivity&sortOrder=desc');

    setSelect('status-filter', 'open');
    fixture.detectChanges();
    await flushList(
      listResponse,
      '/api/conversations?page=1&limit=20&sortBy=lastActivity&sortOrder=desc&status=open',
    );

    expect(inboxElement().querySelector('[data-testid="page-info"]')?.textContent).toContain('Page 1');
  });

  it('paginates with disabled bounds', async () => {
    await render();
    await flushList({ ...listResponse, total: 45 });

    const controls = inboxElement().querySelector('[data-testid="pagination-controls"]')!;
    const buttons = Array.from(controls.querySelectorAll('button')) as HTMLButtonElement[];
    const [previous, next] = buttons;
    expect(previous.disabled).toBe(true);
    expect(next.disabled).toBe(false);

    next.click();
    await flushList(
      { ...listResponse, page: 2, total: 45 },
      '/api/conversations?page=2&limit=20&sortBy=lastActivity&sortOrder=desc',
    );

    expect(inboxElement().querySelector('[data-testid="page-info"]')?.textContent).toContain('Page 2 of 3');
    expect(previous.disabled).toBe(false);
  });

  it('renders the error state with a working retry', async () => {
    await render();

    const failed = http.expectOne(DEFAULT_URL);
    failed.flush({ error: 'Service unavailable' }, { status: 500, statusText: 'Server Error' });
    // Drain the store's in-flight-cleanup chain (macrotask helper; the
    // same convention as login.spec) before the retry interaction.
    await flushTasks();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(inboxElement().querySelector('[data-testid="error-message"]')).toBeTruthy();
    expect(inboxElement().textContent).toContain('Service unavailable');

    (inboxElement().querySelector('[data-testid="retry-button"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    await flushList();
    expect(inboxElement().querySelectorAll('[data-testid="conversation-card"]')).toHaveLength(2);
  });

  it('clears the unread badge optimistically when a conversation is opened', async () => {
    await render();
    await flushList();

    const card = inboxElement().querySelectorAll('[data-testid="conversation-card"]')[0] as HTMLButtonElement;
    card.click();
    fixture.detectChanges();

    // W6: the store patch is synchronous and HTTP-free.
    const snapshot = store.listSnapshot({ page: 1, limit: 20, sortBy: 'lastActivity', sortOrder: 'desc' });
    expect(snapshot?.data?.data[0]?.unreadCount).toBe(0);
    http.expectNone('/api/conversations');
  });

  it('clears all filters from the Clear button', async () => {
    await render('/inbox?channel=telegram&unread=true');
    await flushList(
      undefined,
      '/api/conversations?page=1&limit=20&sortBy=lastActivity&sortOrder=desc&channel=telegram&unread=true',
    );

    buttonWithText('Clear').click();
    await flushList();

    expect(inboxElement().querySelectorAll('[data-testid="conversation-card"]')).toHaveLength(2);
    expect(router.url).not.toContain('channel=');
  });

  it('applies the priority, unread-only and date filters with page reset', async () => {
    await render();
    await flushList();

    setSelect('status-filter', 'all'); // no change → no request
    const priority = inboxElement().querySelectorAll('select')[2] as HTMLSelectElement;
    priority.value = 'urgent';
    priority.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    await flushList(
      { data: [], page: 1, limit: 20, total: 0 },
      '/api/conversations?page=1&limit=20&sortBy=lastActivity&sortOrder=desc&priority=urgent',
    );

    const checkbox = inboxElement().querySelector('input[type="checkbox"]') as HTMLInputElement;
    checkbox.checked = true;
    checkbox.dispatchEvent(new Event('change'));
    const dateFrom = inboxElement().querySelector('input[type="date"]') as HTMLInputElement;
    dateFrom.value = '2026-10-01';
    dateFrom.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    await flushList(
      { data: [], page: 1, limit: 20, total: 0 },
      '/api/conversations?page=1&limit=20&sortBy=lastActivity&sortOrder=desc&priority=urgent&dateFrom=2026-10-01&unread=true',
    );

    const chips = inboxElement().textContent ?? '';
    expect(chips).toContain('Priority: urgent');
    expect(chips).toContain('Unread only');
    expect(chips).toContain('Date: 2026-10-01 → Any');
  });

  it('clears individual filter chips (search, dates)', async () => {
    await render('/inbox?search=hello&dateFrom=2026-01-01&dateTo=2026-02-01');
    await flushList(
      { data: [], page: 1, limit: 20, total: 0 },
      '/api/conversations?page=1&limit=20&sortBy=lastActivity&sortOrder=desc&search=hello&dateFrom=2026-01-01&dateTo=2026-02-01',
    );

    const chipButton = (label: string): HTMLButtonElement =>
      Array.from(inboxElement().querySelectorAll('.badge-outline')).find(
        (candidate) => candidate.textContent?.includes(label),
      ) as HTMLButtonElement;

    chipButton('Search: hello').click();
    fixture.detectChanges();
    await flushList(
      { data: [], page: 1, limit: 20, total: 0 },
      '/api/conversations?page=1&limit=20&sortBy=lastActivity&sortOrder=desc&dateFrom=2026-01-01&dateTo=2026-02-01',
    );

    chipButton('Date:').click();
    fixture.detectChanges();
    await flushList({ data: [], page: 1, limit: 20, total: 0 });

    expect(inboxElement().querySelectorAll('.badge-outline')).toHaveLength(0);
  });

  it('renders the in-page sidebar channel buttons and ignores non-Enter keys in search', async () => {
    await render();
    await flushList();

    const input = inboxElement().querySelector('[data-testid="search-input"]') as HTMLInputElement;
    input.value = 'typed';
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await flushTasks();
    fixture.detectChanges();

    // Sidebar channel buttons drive the same filter surface.
    const sidebarButtons = Array.from(inboxElement().querySelectorAll('aside button')).filter(
      (candidate) => candidate.textContent?.trim() === 'Telegram',
    );
    expect(sidebarButtons.length).toBeGreaterThan(0);
    sidebarButtons[0].dispatchEvent(new MouseEvent('click'));
    fixture.detectChanges();
    await flushList(
      listResponse,
      '/api/conversations?page=1&limit=20&sortBy=lastActivity&sortOrder=desc&channel=telegram',
    );

    expect(router.url).toContain('channel=telegram');
  });

  it('signs out from the navbar menu and renders the fallback timestamp/labels', async () => {
    await render();
    await flushList();

    // Card 2 renders the null branches: no title (thread label), no
    // assignment, no latest message timestamp.
    expect(inboxElement().textContent).toContain('Never');

    const logoutButton = Array.from(inboxElement().querySelectorAll('button')).find(
      (candidate) => candidate.textContent?.includes('Logout'),
    ) as HTMLButtonElement;
    logoutButton.click();
    const signOut = http.expectOne('/api/auth/sign-out');
    signOut.flush({ success: true });
    await fixture.whenStable();

    // The navbar logout signs out; the /login handover rides the router.
    expect(localStorage.getItem('yacc_token')).toBeNull();
  });
});
