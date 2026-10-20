import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router, RouterOutlet } from '@angular/router';

import { errorMappingInterceptor } from '../../interceptors/error-mapping.interceptor';
import { RoutingRules } from './routing-rules';

@Component({ selector: 'app-stub', template: '' })
class StubPage {}

@Component({
  selector: 'app-test-host',
  imports: [RouterOutlet],
  template: '<router-outlet />',
})
class TestHost {}

/**
 * RoutingRulesPage spec (W14 — CRUD + executions): list rendering with
 * status/priority badges and condition/action counts, the in-component
 * ADMIN gate (Access-Denied card), selection → execution-history load
 * (`pageSize` wire param), status toggle through PATCH + list
 * invalidation, delete through DELETE + selection clear, the React
 * creation-stub panel, and the error/empty states. Interactions go
 * through the DOM (existing page-spec convention).
 */
describe('Routing rules page', () => {
  let fixture: ComponentFixture<TestHost>;
  let router: Router;
  let http: HttpTestingController;

  const ADMIN = {
    id: '00000000-0000-4000-8000-00000000d001',
    email: 'admin2@yacc.local',
    name: 'Admin User',
    role: 'admin',
    status: 'active',
  };
  const PLAIN_USER = {
    id: '00000000-0000-4000-8000-00000000d004',
    email: 'user@yacc.local',
    name: 'Support User',
    role: 'user',
    status: 'active',
  };

  const VIP_RULE_ID = '00000000-0000-0000-0000-000000002001';
  const URGENT_RULE_ID = '00000000-0000-0000-0000-000000002002';

  const rule = (
    overrides: Partial<Record<string, unknown>> = {},
  ): Record<string, unknown> => ({
    id: VIP_RULE_ID,
    name: 'Auto-assign VIP to admin',
    status: 'active',
    priority: 100,
    conditions: [{ field: 'tag', operator: 'has', value: 'VIP' }],
    actions: [{ type: 'assign', value: '00000000-0000-0000-0000-000000000002' }],
    createdAt: '2026-10-18T19:30:54Z',
    updatedAt: '2026-10-18T19:30:54Z',
    ...overrides,
  });

  const rulesResponse = (rows: Record<string, unknown>[]) => ({
    data: rows,
    page: 1,
    limit: rows.length,
    total: rows.length,
  });

  const defaultRules = () =>
    rulesResponse([
      rule(),
      rule({
        id: URGENT_RULE_ID,
        name: 'Auto-tag urgent keywords',
        status: 'disabled',
        priority: 101,
        conditions: [{ field: 'keyword', operator: 'contains', value: 'urgent' }],
        actions: [{ type: 'priority', value: 'high' }],
      }),
    ]);

  const executionsResponse = (rows: Record<string, unknown>[]) => ({
    data: rows,
    page: 1,
    limit: 10,
    total: rows.length,
  });

  function pageElement(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  async function render(url = '/routing-rules'): Promise<void> {
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

  /** Flush the rules list response and let the store state settle. */
  async function flushRules(response: Record<string, unknown> = defaultRules()): Promise<void> {
    fixture.detectChanges();
    http.expectOne('/api/routing-rules').flush(response);
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(async () => {
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [TestHost, RoutingRules],
      providers: [
        provideHttpClient(withInterceptors([errorMappingInterceptor])),
        provideHttpClientTesting(),
        provideRouter([
          { path: 'routing-rules', component: RoutingRules },
          { path: '', component: StubPage },
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

  it('renders the rule rows with status/priority badges and condition/action counts', async () => {
    await renderSignedIn(ADMIN);
    await flushRules();

    expect(pageElement().querySelectorAll('[data-testid^="rule-item-"]')).toHaveLength(2);
    const firstRow = pageElement().querySelector(`[data-testid="rule-item-${VIP_RULE_ID}"]`);
    expect(firstRow?.querySelector('.badge')?.textContent?.trim()).toBe('active');
    expect(firstRow?.textContent).toContain('Priority: 100');
    expect(firstRow?.textContent).toContain('1 conditions');
    expect(firstRow?.textContent).toContain('1 actions');
    // Toggle labels mirror the row status (React parity): active → Disable.
    expect(firstRow?.textContent).toContain('Disable');
    const disabledRow = pageElement().querySelector(
      `[data-testid="rule-item-${URGENT_RULE_ID}"]`,
    );
    expect(disabledRow?.querySelector('.badge')?.textContent?.trim()).toBe('disabled');
    // disabled → Enable (React label fork parity).
    expect(disabledRow?.textContent).toContain('Enable');
  });

  it('shows the Access-Denied card for a non-admin (in-component React isAdmin parity)', async () => {
    await renderSignedIn(PLAIN_USER);
    await flushRules();

    expect(pageElement().textContent).toContain('Access Denied');
    expect(pageElement().textContent).toContain("You don't have permission to manage routing rules.");
    expect(pageElement().querySelectorAll('[data-testid="create-rule-button"]')).toHaveLength(0);
  });

  it('selecting a rule loads its executions (pageSize wire param) and renders the details panel', async () => {
    await renderSignedIn(ADMIN);
    await flushRules();

    pageElement()
      .querySelector(`[data-testid="rule-item-${VIP_RULE_ID}"]`)
      ?.dispatchEvent(new Event('click'));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    http
      .expectOne(`/api/routing-rules/${VIP_RULE_ID}/executions?page=1&pageSize=10`)
      .flush(
        executionsResponse([
          {
            id: 1,
            ruleId: VIP_RULE_ID,
            conversationId: '00000000-0000-0000-0000-000000001001',
            matchedConditions: [],
            appliedActions: [],
            createdAt: '2026-10-18T19:31:00Z',
          },
        ]),
      );
    await fixture.whenStable();
    fixture.detectChanges();

    const panel = pageElement().querySelector('.lg\\:col-span-1');
    expect(panel?.textContent).toContain('Auto-assign VIP to admin');
    expect(panel?.textContent).toContain('Priority');
    expect(panel?.textContent).toContain('100');
    // Conditions/actions JSON blocks (React JSON.stringify parity).
    expect(panel?.textContent).toContain('"field": "tag"');
    expect(panel?.textContent).toContain('"type": "assign"');
    // The execution row renders with its conversation id.
    expect(pageElement().querySelector('[data-testid="execution-1"]')?.textContent?.trim()).toBe(
      '00000000-0000-0000-0000-000000001001',
    );
  });

  it('toggles a rule status through PATCH and re-renders the flipped badge (list invalidation)', async () => {
    await renderSignedIn(ADMIN);
    await flushRules();

    const toggle = pageElement().querySelector(
      `[data-testid="toggle-rule-${VIP_RULE_ID}"]`,
    ) as HTMLButtonElement;
    toggle.click();
    await fixture.whenStable();
    fixture.detectChanges();

    http.expectOne(`/api/routing-rules/${VIP_RULE_ID}`).flush({
      data: rule({ status: 'disabled' }),
    });
    // The store invalidates the rules list → the background refetch.
    await fixture.whenStable();
    fixture.detectChanges();
    http.expectOne('/api/routing-rules').flush(
      rulesResponse([
        rule({ status: 'disabled' }),
        rule({
          id: URGENT_RULE_ID,
          name: 'Auto-tag urgent keywords',
          priority: 101,
          conditions: [{ field: 'keyword', operator: 'contains', value: 'urgent' }],
          actions: [{ type: 'priority', value: 'high' }],
        }),
      ]),
    );
    await fixture.whenStable();
    fixture.detectChanges();

    const firstRow = pageElement().querySelector(`[data-testid="rule-item-${VIP_RULE_ID}"]`);
    expect(firstRow?.querySelector('.badge')?.textContent?.trim()).toBe('disabled');
    expect(firstRow?.textContent).toContain('Enable');
    // stopPropagation parity: the row was NOT selected by the toggle click.
    expect(pageElement().textContent).toContain('Select a rule to view details');
  });

  it('deletes a rule through DELETE, clears the selection, and refetches the list', async () => {
    await renderSignedIn(ADMIN);
    await flushRules();

    // Select the second rule first (loads its executions — flushed empty).
    pageElement()
      .querySelector(`[data-testid="rule-item-${URGENT_RULE_ID}"]`)
      ?.dispatchEvent(new Event('click'));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    http
      .expectOne(`/api/routing-rules/${URGENT_RULE_ID}/executions?page=1&pageSize=10`)
      .flush(executionsResponse([]));
    await fixture.whenStable();
    fixture.detectChanges();
    expect(pageElement().textContent).toContain('Auto-tag urgent keywords');

    const del = pageElement().querySelector(
      `[data-testid="delete-rule-${URGENT_RULE_ID}"]`,
    ) as HTMLButtonElement;
    del.click();
    await fixture.whenStable();
    fixture.detectChanges();

    http.expectOne(`/api/routing-rules/${URGENT_RULE_ID}`).flush({ data: null });
    await fixture.whenStable();
    fixture.detectChanges();
    http.expectOne('/api/routing-rules').flush(rulesResponse([rule()]));
    await fixture.whenStable();
    fixture.detectChanges();

    expect(pageElement().querySelectorAll('[data-testid^="rule-item-"]')).toHaveLength(1);
    // React `onSuccess: setSelectedRuleId(null)` parity — the placeholder.
    expect(pageElement().textContent).toContain('Select a rule to view details');
  });

  it('toggles the React creation-stub panel (+ New Rule → coming soon → Close)', async () => {
    await renderSignedIn(ADMIN);
    await flushRules();

    (pageElement().querySelector('[data-testid="create-rule-button"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(pageElement().textContent).toContain('New Rule');
    expect(pageElement().textContent).toContain(
      'Rule creation UI coming soon. Define rules in API directly.',
    );

    const close = Array.from(pageElement().querySelectorAll('button')).find(
      (candidate) => candidate.textContent?.trim() === 'Close',
    );
    close?.dispatchEvent(new Event('click'));
    fixture.detectChanges();
    expect(pageElement().textContent).toContain('Select a rule to view details');
  });

  it('renders the rules-query-error alert when the list fails to load', async () => {
    await renderSignedIn(ADMIN);
    fixture.detectChanges();
    http
      .expectOne('/api/routing-rules')
      .flush({ error: 'Rules unavailable' }, { status: 500, statusText: 'Server Error' });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(pageElement().querySelector('[data-testid="rules-query-error"]')).toBeDefined();
    expect(pageElement().textContent).toContain('Rules unavailable');
  });

  it('renders the empty state when no rules exist', async () => {
    await renderSignedIn(ADMIN);
    await flushRules(rulesResponse([]));

    expect(pageElement().textContent).toContain('No routing rules yet');
    expect(pageElement().textContent).toContain('Select a rule to view details');
  });
});
