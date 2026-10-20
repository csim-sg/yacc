import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterOutlet, provideRouter, Router } from '@angular/router';

import { errorMappingInterceptor } from '../../interceptors/error-mapping.interceptor';
import { AuditLogs } from './audit-logs';

@Component({ selector: 'app-stub', template: '' })
class StubPage {}

@Component({
  selector: 'app-test-host',
  imports: [RouterOutlet],
  template: '<router-outlet />',
})
class TestHost {}

/**
 * Audit Logs page spec (ANG-013 — W18, React `AuditLogsPage` port).
 *
 * Covers: table rendering with the action badge, actor/entity columns,
 * locale timestamp and the Details metadata dropdown; the total badge;
 * loading/error/empty states; the four filters driving contract-conforming
 * list requests (empty values skipped, `page`+`limit=20` appended, NO page
 * reset on filter change — React parity); pagination boundaries with the
 * five-button window and the hidden-at-one-page rule; and the U4
 * disposition (API-only export — no export UI, no export/conversation
 * endpoint call).
 *
 * The MANAGER route gate itself is pinned in `app.routes.spec.ts`
 * (`roleGuard('MANAGER')` wiring) and the role×requirement matrix in
 * `guards.spec.ts`; the cross-role E2E rows live in the ANG-013 Tier-0
 * spec.
 */
describe('Audit Logs page', () => {
  let fixture: ComponentFixture<TestHost>;
  let router: Router;
  let http: HttpTestingController;

  const log = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
    id: 'log-1',
    actorId: '00000000-0000-0000-0000-00000000aa01',
    action: 'conversation.assigned',
    entityType: 'conversation',
    entityId: '00000000-0000-0000-0000-000000001001',
    metadata: { assignedUserId: '00000000-0000-0000-0000-00000000aa02' },
    createdAt: '2026-10-19T00:00:00.000Z',
    ...overrides,
  });

  const defaultLogs = (): Record<string, unknown>[] => [
    log(),
    log({
      id: 'log-2',
      action: 'tag.added',
      entityType: 'conversation',
      metadata: { tag: 'vip' },
    }),
    log({
      id: 'log-3',
      action: 'note.created',
      metadata: {},
    }),
  ];

  const listResponse = (
    rows: Record<string, unknown>[],
    total = rows.length,
  ): Record<string, unknown> => ({ data: rows, page: 1, limit: 20, total });

  function pageElement(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function query(testId: string): HTMLElement | null {
    return pageElement().querySelector(`[data-testid="${testId}"]`);
  }

  function button(testId: string): HTMLButtonElement {
    return query(testId) as HTMLButtonElement;
  }

  function input(testId: string): HTMLInputElement {
    return query(testId) as HTMLInputElement;
  }

  function setInput(testId: string, value: string): void {
    const element = input(testId);
    element.value = value;
    element.dispatchEvent(new Event('input'));
  }

  async function render(url = '/audit-logs'): Promise<void> {
    await router.navigateByUrl(url);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  /** Flush the audit-log list response for the first page and settle. */
  async function flushLogs(
    response: Record<string, unknown> = listResponse(defaultLogs()),
    url = '/api/audit-logs?page=1&limit=20',
  ): Promise<void> {
    fixture.detectChanges();
    http.expectOne(url).flush(response);
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [TestHost, AuditLogs],
      providers: [
        provideHttpClient(withInterceptors([errorMappingInterceptor])),
        provideHttpClientTesting(),
        provideRouter([
          { path: 'audit-logs', component: AuditLogs },
          { path: '', component: StubPage },
        ]),
      ],
    }).compileComponents();
    router = TestBed.inject(Router);
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(TestHost);
  });

  afterEach(() => {
    fixture.destroy();
    http.verify();
    localStorage.clear();
  });

  it('renders the log rows with actor, action badge, entity columns, timestamp and the metadata dropdown', async () => {
    await render();
    await flushLogs();

    expect(pageElement().textContent).toContain('Audit Logs');
    expect(pageElement().querySelector('.badge-lg')?.textContent?.trim()).toBe('3');

    const rows = pageElement().querySelectorAll('[data-testid^="log-row-"]');
    expect(rows).toHaveLength(3);

    const first = pageElement().querySelector('[data-testid="log-row-log-1"]');
    expect(first?.textContent).toContain('00000000-0000-0000-0000-00000000aa01');
    expect(first?.querySelector('.badge')?.textContent?.trim()).toBe('conversation.assigned');
    expect(first?.textContent).toContain('conversation');
    expect(first?.textContent).toContain(new Date('2026-10-19T00:00:00.000Z').toLocaleString());
    // Details dropdown carries the JSON.stringify(metadata, null, 2) payload.
    expect(first?.querySelector('summary')?.textContent?.trim()).toBe('View');
    expect(first?.querySelector('pre')?.textContent).toContain('"assignedUserId"');
  });

  it('shows the loading state until the first list load lands', async () => {
    await render();
    fixture.detectChanges();

    expect(pageElement().querySelector('.loading')).toBeDefined();

    await flushLogs();
    expect(pageElement().querySelector('.loading')).toBeNull();
    expect(query('log-row-log-1')).toBeDefined();
  });

  it('renders the error alert with the API message on a failed load', async () => {
    await render();
    fixture.detectChanges();
    http
      .expectOne('/api/audit-logs?page=1&limit=20')
      .flush({ error: 'Audit trail unavailable' }, { status: 500, statusText: 'Server Error' });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(query('query-error')).toBeDefined();
    expect(pageElement().textContent).toContain('Audit trail unavailable');
    expect(query('log-row-log-1')).toBeNull();
  });

  it('renders the empty state when no audit logs match', async () => {
    await render();
    await flushLogs(listResponse([], 0));

    expect(pageElement().textContent).toContain('No audit logs found');
    expect(query('log-row-log-1')).toBeNull();
  });

  it('sends contract-conforming filter params (empties skipped, page+limit appended) without resetting the page', async () => {
    await render();
    await flushLogs(listResponse(defaultLogs(), 45));

    // React parity: a filter change does NOT reset the page — page 2 is
    // kept and the new key refetches with the filter + page=2.
    button('next-page').click();
    fixture.detectChanges();
    http.expectOne('/api/audit-logs?page=2&limit=20').flush(listResponse(defaultLogs(), 45));
    await fixture.whenStable();
    fixture.detectChanges();

    setInput('filter-action', 'conversation.assigned');
    fixture.detectChanges();
    http
      .expectOne('/api/audit-logs?action=conversation.assigned&page=2&limit=20')
      .flush(listResponse([log()], 1));
    await fixture.whenStable();
    fixture.detectChanges();

    setInput('filter-entity-type', 'conversation');
    fixture.detectChanges();
    http
      .expectOne(
        '/api/audit-logs?action=conversation.assigned&entityType=conversation&page=2&limit=20',
      )
      .flush(listResponse([log()], 1));
    await fixture.whenStable();
    fixture.detectChanges();

    // The date pickers ride the same key (dateFrom/dateFrom wire names).
    setInput('filter-date-from', '2026-01-01');
    fixture.detectChanges();
    http
      .expectOne(
        '/api/audit-logs?action=conversation.assigned&entityType=conversation&dateFrom=2026-01-01&page=2&limit=20',
      )
      .flush(listResponse([log()], 1));
    await fixture.whenStable();
    fixture.detectChanges();

    setInput('filter-date-to', '2026-12-31');
    fixture.detectChanges();
    http
      .expectOne(
        '/api/audit-logs?action=conversation.assigned&entityType=conversation&dateFrom=2026-01-01&dateTo=2026-12-31&page=2&limit=20',
      )
      .flush(listResponse([log()], 1));
    await fixture.whenStable();
    fixture.detectChanges();

    // Clearing every filter returns to the default key — served fresh
    // from the store cache (TanStack staleTime parity): NO new request.
    setInput('filter-action', '');
    setInput('filter-entity-type', '');
    setInput('filter-date-from', '');
    setInput('filter-date-to', '');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    http.expectNone('/api/audit-logs?page=2&limit=20');
  });

  it('paginates through the list and flips prev/next at the boundaries', async () => {
    await render();
    await flushLogs(listResponse(defaultLogs(), 45));
    await fixture.whenStable();
    fixture.detectChanges();

    expect(pageElement().textContent).toContain('Page 1 of 3 (45 total)');
    expect(button('prev-page').disabled).toBe(true);
    expect(button('next-page').disabled).toBe(false);
    // Window: min(5, 3) numbered buttons.
    expect(query('page-1')).toBeDefined();
    expect(query('page-3')).toBeDefined();
    expect(query('page-4')).toBeNull();

    button('page-2').click();
    fixture.detectChanges();
    http.expectOne('/api/audit-logs?page=2&limit=20').flush(listResponse(defaultLogs(), 45));
    await fixture.whenStable();
    fixture.detectChanges();
    expect(pageElement().textContent).toContain('Page 2 of 3 (45 total)');
    expect(button('prev-page').disabled).toBe(false);

    button('next-page').click();
    fixture.detectChanges();
    http.expectOne('/api/audit-logs?page=3&limit=20').flush(listResponse(defaultLogs(), 45));
    await fixture.whenStable();
    fixture.detectChanges();
    expect(pageElement().textContent).toContain('Page 3 of 3 (45 total)');
    expect(button('next-page').disabled).toBe(true);

    button('prev-page').click();
    fixture.detectChanges();
    // Back to page 2 is served from the store cache (30s freshness —
    // TanStack staleTime parity): NO second request is made.
    expect(pageElement().textContent).toContain('Page 2 of 3 (45 total)');
    expect(button('next-page').disabled).toBe(false);
  });

  it('caps the page-number window at five buttons', async () => {
    await render();
    await flushLogs(listResponse(defaultLogs(), 200));
    await fixture.whenStable();
    fixture.detectChanges();

    expect(pageElement().textContent).toContain('Page 1 of 10 (200 total)');
    for (const pageNumber of [1, 2, 3, 4, 5]) {
      expect(query(`page-${pageNumber}`)).toBeDefined();
    }
    expect(query('page-6')).toBeNull();
  });

  it('hides the pagination bar while the list fits one page', async () => {
    await render();
    await flushLogs();

    expect(query('prev-page')).toBeNull();
    expect(query('next-page')).toBeNull();
    expect(query('page-1')).toBeNull();
  });

  it('never calls the export or conversation-scoped endpoints (U4 API-only parity)', async () => {
    await render();
    await flushLogs();

    // U4: no export UI is rendered and no export request can slip through
    // (`HttpTestingController.verify()` in `afterEach` fails the suite on
    // any unexpected request).
    expect(query('export-button')).toBeNull();
    expect(query('export-error')).toBeNull();
    expect(
      Array.from(pageElement().querySelectorAll('button')).some((candidate) =>
        /export/i.test(candidate.textContent ?? ''),
      ),
    ).toBe(false);
    expect(http.match((request) => request.url.startsWith('/api/audit-logs/export'))).toEqual([]);
    // The conversation-scoped query stays a store/service-level surface —
    // the page never calls it (React `queryByConversation` parity).
    expect(
      http.match((request) => request.url.includes('/audit-logs') && request.url.includes('/conversations/')),
    ).toEqual([]);
  });
});
