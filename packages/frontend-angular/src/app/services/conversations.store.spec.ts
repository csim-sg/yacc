import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { ConversationsStore } from './conversations.store';

/**
 * ConversationsStore spec (AC-ANG-005-1/2; T2 §3.1): family endpoints,
 * cache-hit within the freshness window, and the B4 mutation-invalidation
 * mapping (detail + lists refetch after a mutation).
 */
describe('ConversationsStore', () => {
  let store: ConversationsStore;
  let http: HttpTestingController;

  const detail = { id: 'c1', title: 'Support', channel: 'telegram', status: 'open', priority: 'normal', participants: [], tags: [], createdAt: '2026-10-18T00:00:00', updatedAt: '2026-10-18T00:00:00' };
  const listResponse = {
    data: [{ id: 'c1', title: 'Support', channel: 'telegram', status: 'open', priority: 'normal', unreadCount: 0, participants: [], tags: [], createdAt: '2026-10-18T00:00:00', lastMessageAt: '2026-10-18T00:00:00', lastMessagePreview: 'hi' }],
    page: 1,
    limit: 20,
    total: 1,
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([])), provideHttpClientTesting()],
    });
    store = TestBed.inject(ConversationsStore);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('loads the filtered list and serves a cache hit within the freshness window', async () => {
    const first = store.loadList({ page: 1 });
    http.expectOne('/api/conversations?page=1').flush(listResponse);
    await first;

    expect(store.listSnapshot({ page: 1 })?.data).toEqual(listResponse);

    // Second load inside the 30s window must NOT issue another request.
    await store.loadList({ page: 1 });
    http.expectNone('/api/conversations?page=1');
  });

  it('loads a conversation detail and stores the unwrapped conversation', async () => {
    const pending = store.loadDetail('c1');
    http.expectOne('/api/conversations/c1').flush({ data: detail });
    await pending;

    expect(store.detailSnapshot('c1')?.data).toEqual(detail);
  });

  it('records load failures in the snapshot error field', async () => {
    const pending = store.loadList({});
    http.expectOne('/api/conversations').flush({ error: 'boom' }, { status: 500, statusText: 'err' });
    await pending;

    const snapshot = store.listSnapshot({});
    expect(snapshot?.error).toBeDefined();
    expect(snapshot?.data).toBeUndefined();
  });

  it('updateStatus invalidates detail + lists (B4 mapping)', async () => {
    const detailLoad = store.loadDetail('c1');
    http.expectOne('/api/conversations/c1').flush({ data: detail });
    await detailLoad;
    const listLoad = store.loadList({});
    http.expectOne('/api/conversations').flush(listResponse);
    await listLoad;

    const mutation = store.updateStatus('c1', 'resolved');
    http.expectOne('/api/conversations/c1/status').flush({ data: detail });
    await mutation;

    // Invalidation marked both entries stale — next loads refetch.
    const refetchDetail = store.loadDetail('c1');
    http.expectOne('/api/conversations/c1').flush({ data: detail });
    await refetchDetail;
    const refetchList = store.loadList({});
    http.expectOne('/api/conversations').flush(listResponse);
    await refetchList;
  });

  it('updatePriority and assign invalidate the same way', async () => {
    const load = store.loadList({});
    http.expectOne('/api/conversations').flush(listResponse);
    await load;

    const priority = store.updatePriority('c1', 'high');
    http.expectOne('/api/conversations/c1/priority').flush({ data: detail });
    await priority;
    const refetchAfterPriority = store.loadList({});
    http.expectOne('/api/conversations').flush(listResponse);
    await refetchAfterPriority;

    const assign = store.assign('c1', '00000000-0000-0000-0000-000000000009');
    http.expectOne('/api/conversations/c1/assign').flush({ data: detail });
    await assign;
    const refetchAfterAssign = store.loadList({});
    http.expectOne('/api/conversations').flush(listResponse);
    await refetchAfterAssign;
  });

  it('assignById rides PATCH /api/conversations/:id/assign and invalidates', async () => {
    const load = store.loadDetail('c1');
    http.expectOne('/api/conversations/c1').flush({ data: detail });
    await load;

    const mutation = store.assignById('c1', '00000000-0000-0000-0000-000000000009');
    http.expectOne('/api/conversations/c1/assign').flush({ data: detail });
    await mutation;

    const refetch = store.loadDetail('c1');
    http.expectOne('/api/conversations/c1').flush({ data: detail });
    await refetch;
  });

  it('mutation failures reject to the caller', async () => {
    const pending = store.updateStatus('c1', 'open');
    http.expectOne('/api/conversations/c1/status').flush({ error: 'denied' }, { status: 403, statusText: 'Forbidden' });

    await expect(pending).rejects.toBeDefined();
  });

  describe('markAsRead (W6 optimistic unread clear — ANG-007)', () => {
    const unreadResponse = {
      ...listResponse,
      data: [{ ...listResponse.data[0], unreadCount: 3 }],
    };

    it('patches the loaded list entry row to unreadCount 0 with no HTTP call', async () => {
      const load = store.loadList({});
      http.expectOne('/api/conversations').flush(unreadResponse);
      await load;

      store.markAsRead('c1', {});

      const snapshot = store.listSnapshot({});
      expect(snapshot?.data?.data[0]?.unreadCount).toBe(0);

      // Synchronous cache patch: no refetch, no HTTP.
      http.expectNone('/api/conversations');
    });

    it('leaves other rows untouched', async () => {
      const load = store.loadList({});
      const twoRows = {
        ...unreadResponse,
        data: [...unreadResponse.data, { ...unreadResponse.data[0], id: 'c2', unreadCount: 4 }],
      };
      http.expectOne('/api/conversations').flush(twoRows);
      await load;

      store.markAsRead('c1', {});

      const rows = store.listSnapshot({})?.data?.data ?? [];
      expect(rows.find((row) => row.id === 'c1')?.unreadCount).toBe(0);
      expect(rows.find((row) => row.id === 'c2')?.unreadCount).toBe(4);
    });

    it('is a no-op for an entry that was never loaded (no entry created)', () => {
      store.markAsRead('c1', { page: 9 });

      expect(store.listSnapshot({ page: 9 })).toBeUndefined();
      http.expectNone('/api/conversations');
    });

    it('patches become fresh: the next load inside the window serves the patched cache', async () => {
      const load = store.loadList({});
      http.expectOne('/api/conversations').flush(unreadResponse);
      await load;

      store.markAsRead('c1', {});

      await store.loadList({});
      http.expectNone('/api/conversations');
      expect(store.listSnapshot({})?.data?.data[0]?.unreadCount).toBe(0);
    });
  });
});
