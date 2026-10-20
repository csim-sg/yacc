import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { AuditLogsStore } from './audit-logs.store';

/**
 * AuditLogsStore spec (AC-ANG-005-2; T2 §3.1 family store): global and
 * conversation-scoped lists on their canonical keys; the blob export
 * rides the service (no cache involvement).
 */
describe('AuditLogsStore', () => {
  let store: AuditLogsStore;
  let http: HttpTestingController;

  const log = {
    id: 'a1',
    actorId: 'u1',
    actorEmail: 'admin@yacc.local',
    action: 'conversation.assigned',
    entityType: 'conversation',
    entityId: 'c1',
    createdAt: '2026-10-18T00:00:00',
  };
  const listResponse = { data: [log], page: 1, limit: 50, total: 1 };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([])), provideHttpClientTesting()],
    });
    store = TestBed.inject(AuditLogsStore);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('loads the filtered global audit-log list', async () => {
    const pending = store.loadLogs({ action: 'conversation.assigned', page: 1 });
    http.expectOne('/api/audit-logs?action=conversation.assigned&page=1').flush(listResponse);
    await pending;

    expect(store.listSnapshot({ action: 'conversation.assigned', page: 1 })?.data).toEqual(listResponse);
  });

  it('loads conversation-scoped audit logs onto the conversation family key', async () => {
    const pending = store.loadConversationLogs('c1', { limit: 50 });
    http.expectOne('/api/conversations/c1/audit-logs?limit=50').flush(listResponse);
    await pending;

    expect(store.conversationSnapshot('c1', { limit: 50 })?.data).toEqual(listResponse);
  });

  it('export downloads a blob via the POST /api/audit-logs/export surface', async () => {
    const pending = store.export({ format: 'csv' });
    const request = http.expectOne('/api/audit-logs/export');
    expect(request.request.body).toEqual({ format: 'csv' });
    request.flush(new Blob(['id\na1'], { type: 'text/csv' }));

    const blob = await pending;
    expect(blob).toBeInstanceOf(Blob);
  });

  it('fetch failures land in the snapshot error field', async () => {
    const pending = store.loadLogs({});
    http.expectOne('/api/audit-logs').flush({ error: 'boom' }, { status: 500, statusText: 'err' });
    await pending;

    expect(store.listSnapshot({})?.error).toBeDefined();
  });
});
