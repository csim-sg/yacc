import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { RoutingRulesStore } from './routing-rules.store';

/**
 * RoutingRulesStore spec (AC-ANG-005-2; T2 §3.1 family store): rules list
 * + execution history on canonical keys; rule mutations invalidate the
 * rules caches; rule detail stays on the service (no canonical detail
 * key — no ad-hoc keys, ANG-002 grep gate).
 */
describe('RoutingRulesStore', () => {
  let store: RoutingRulesStore;
  let http: HttpTestingController;

  const rule = {
    id: 'r1',
    name: 'telegram→billing',
    enabled: true,
    priority: 1,
    conditions: [],
    actions: [],
    createdAt: '2026-10-18T00:00:00',
    updatedAt: '2026-10-18T00:00:00',
  };
  const rulesResponse = { data: [rule], page: 1, limit: 20, total: 1 };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([])), provideHttpClientTesting()],
    });
    store = TestBed.inject(RoutingRulesStore);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  function loadRules(): Promise<void> {
    const pending = store.loadRules();
    http.expectOne('/api/routing-rules').flush(rulesResponse);
    return pending;
  }

  it('loads the rules list and serves a cache hit afterwards', async () => {
    await loadRules();
    expect(store.listSnapshot()?.data).toEqual(rulesResponse);

    await store.loadRules();
    http.expectNone('/api/routing-rules');
  });

  it('loads execution history onto the executions key', async () => {
    const pending = store.loadExecutions('r1', { page: 1, pageSize: 10 });
    http.expectOne('/api/routing-rules/r1/executions?page=1&pageSize=10')
      .flush({ data: [], page: 1, pageSize: 10, total: 0 });
    await pending;

    expect(store.executionsSnapshot('r1', { page: 1, pageSize: 10 })?.data?.total).toBe(0);
  });

  it('create/update/delete invalidate the rules list', async () => {
    await loadRules();

    const created = store.createRule({ name: 'new', priority: 1, conditions: [], actions: [] });
    http.expectOne('/api/routing-rules').flush({ data: rule });
    await created;
    await loadRules();

    const updated = store.updateRule('r1', { name: 'renamed' });
    http.expectOne('/api/routing-rules/r1').flush({ data: rule });
    await updated;
    await loadRules();

    const deleted = store.deleteRule('r1');
    http.expectOne('/api/routing-rules/r1').flush({ data: null });
    await deleted;
    await loadRules();
  });
});
