import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { flushTasks } from '../../testing/flush-tasks';
import type { SendMessageResponse } from '../contracts/http/messages.schema';
import { OfflineQueueService } from './offline-queue.service';
import { WebSocketStateService } from './websocket-state.service';

/**
 * OfflineQueueService spec (AC-ANG-005-4; T2 §3.2 `offline-queue.store`
 * row): persisted FIFO capped at 50, status transitions, the
 * sync-on-reconnect hook (browser `online` + socket-reconnect entry
 * point), and the manual retry affordance. U8: mechanism ported, NO UI
 * (parity of absence — disposition recorded by ANG-015).
 *
 * Sync delivery semantics (review loop 1, PR #427): rows are delivered
 * FIFO through the supported send seam (`POST /api/conversations/:id/
 * messages`) via `HttpTestingController`; a row is removed only after its
 * own send succeeds, failed sends keep the row with a per-message error,
 * and `lastSyncTime` is stamped only after a fully successful drain.
 */
describe('OfflineQueueService', () => {
  let service: OfflineQueueService;
  let websocketState: WebSocketStateService;
  let http: HttpTestingController;

  function draft(conversationId = 'c1') {
    return { conversationId, body: 'queued while offline' };
  }

  function sentRow(id: string, conversationId: string): SendMessageResponse {
    return {
      id,
      conversationId,
      senderId: null,
      senderName: 'Operator',
      body: 'queued while offline',
      status: 'sent',
      direction: 'outbound',
      createdAt: '2026-10-19T00:00:00',
      updatedAt: '2026-10-19T00:00:00',
    };
  }

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([])), provideHttpClientTesting()],
    });
    service = TestBed.inject(OfflineQueueService);
    websocketState = TestBed.inject(WebSocketStateService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('enqueues messages FIFO with pending status and a generated tempId', () => {
    const first = service.addMessage(draft());
    const second = service.addMessage(draft());

    expect(first).toMatch(/^temp-/);
    expect(second).not.toBe(first);
    expect(service.messages().map((row) => row.tempId)).toEqual([first, second]);
    expect(service.messages()[0]?.status).toBe('pending');
    expect(service.messages()[0]?.timestamp).toBeGreaterThan(0);
  });

  it('refuses to grow beyond the 50-message cap', () => {
    for (let index = 0; index < 50; index += 1) {
      service.addMessage(draft());
    }
    expect(service.isFull()).toBe(true);

    const dropped = service.addMessage(draft());
    expect(dropped).toBeNull();
    expect(service.messages()).toHaveLength(50);
  });

  it('tracks status transitions and per-row errors', () => {
    const tempId = service.addMessage(draft()) ?? '';

    service.updateMessageStatus(tempId, 'syncing');
    expect(service.messages()[0]?.status).toBe('syncing');

    service.updateMessageStatus(tempId, 'failed', 'network dropped');
    expect(service.messages()[0]?.status).toBe('failed');
    expect(service.messages()[0]?.error).toBe('network dropped');

    service.removeMessage(tempId);
    expect(service.messages()).toHaveLength(0);
  });

  it('persists the queue and restores it (persistence survives reload)', () => {
    service.addMessage(draft());

    const restored = TestBed.runInInjectionContext(() => new OfflineQueueService());
    expect(restored.messages()).toHaveLength(1);
    expect(restored.messages()[0]?.body).toBe('queued while offline');
  });

  it('ignores unparsable persisted payloads', () => {
    localStorage.setItem('yacc:offline-queue', 'not-json');

    const restored = TestBed.runInInjectionContext(() => new OfflineQueueService());
    expect(restored.messages()).toEqual([]);
  });

  it('sync delivers rows FIFO through the send endpoint and removes a row only after its confirmed send', async () => {
    const first = service.addMessage(draft('c1')) ?? '';
    service.addMessage(draft('c2'));
    service.updateMessageStatus(first, 'failed', 'earlier attempt');

    const done = service.sync();
    await flushTasks();

    // Strict FIFO: the first row (previously failed) is in flight alone —
    // the second request cannot exist before the first one is confirmed.
    expect(service.messages()[0]?.tempId).toBe(first);
    expect(service.messages()[0]?.status).toBe('syncing');
    expect(http.match((req) => req.url === '/api/conversations/c2/messages')).toHaveLength(0);
    const firstSend = http.expectOne('/api/conversations/c1/messages');
    expect(firstSend.request.body).toEqual({ body: 'queued while offline' });
    firstSend.flush(sentRow('m1', 'c1'));

    // Let the confirmed first send settle before the second request fires.
    await flushTasks();
    const secondSend = http.expectOne('/api/conversations/c2/messages');
    secondSend.flush(sentRow('m2', 'c2'));
    await done;

    expect(service.messages()).toHaveLength(0);
    expect(service.syncing()).toBe(false);
    expect(service.syncError()).toBeNull();
    expect(service.lastSyncTime()).toBeGreaterThan(0);
  });

  it('keeps every queued row when a send fails — no drop, per-message error, explicit non-success', async () => {
    const first = service.addMessage(draft('c1')) ?? '';
    service.addMessage(draft('c2'));

    const done = service.sync();
    await flushTasks();
    http
      .expectOne('/api/conversations/c1/messages')
      .flush({ error: 'server exploded' }, { status: 500, statusText: 'Server Error' });
    await done;

    // Nothing was dropped: the failed row stays with its own error and the
    // not-yet-attempted row stays queued as pending.
    expect(service.messages()).toHaveLength(2);
    expect(service.messages()[0]?.tempId).toBe(first);
    expect(service.messages()[0]?.status).toBe('failed');
    expect(service.messages()[0]?.error).toContain('500');
    expect(service.messages()[1]?.status).toBe('pending');
    expect(service.syncing()).toBe(false);
    expect(service.syncError()).toBeTruthy();
    expect(service.lastSyncTime()).toBeNull();
    // The kept rows were persisted for the retry.
    const restored = TestBed.runInInjectionContext(() => new OfflineQueueService());
    expect(restored.messages()).toHaveLength(2);
    expect(restored.messages()[0]?.status).toBe('failed');
  });

  it('retrySync redelivers the failed row first, preserving FIFO order', async () => {
    service.addMessage(draft('c1'));
    service.addMessage(draft('c2'));

    const failed = service.sync();
    await flushTasks();
    http
      .expectOne('/api/conversations/c1/messages')
      .flush({ error: 'server exploded' }, { status: 500, statusText: 'Server Error' });
    await failed;

    const retried = service.retrySync();
    await flushTasks();
    // The failed row is attempted again BEFORE the second row.
    expect(http.match((req) => req.url === '/api/conversations/c2/messages')).toHaveLength(0);
    http.expectOne('/api/conversations/c1/messages').flush(sentRow('m1', 'c1'));

    await flushTasks();
    http.expectOne('/api/conversations/c2/messages').flush(sentRow('m2', 'c2'));
    await retried;

    expect(service.messages()).toHaveLength(0);
    expect(service.syncError()).toBeNull();
    expect(service.lastSyncTime()).toBeGreaterThan(0);
  });

  it('a second sync call while a run is in progress is a no-op (no duplicate delivery)', async () => {
    service.addMessage(draft('c1'));

    const first = service.sync();
    const second = service.sync();
    await flushTasks();
    http.expectOne('/api/conversations/c1/messages').flush(sentRow('m1', 'c1'));
    await Promise.all([first, second]);

    // `http.verify()` in afterEach fails the test if a second POST fired.
    expect(service.messages()).toHaveLength(0);
    expect(service.lastSyncTime()).toBeGreaterThan(0);
  });

  it('reclaims rows left `syncing` by an interrupted run and retries them', async () => {
    service.addMessage(draft('c1'));
    service.updateMessageStatus(service.messages()[0]?.tempId ?? '', 'syncing');

    const done = service.sync();
    await flushTasks();
    http.expectOne('/api/conversations/c1/messages').flush(sentRow('m1', 'c1'));
    await done;

    expect(service.messages()).toHaveLength(0);
    expect(service.lastSyncTime()).toBeGreaterThan(0);
  });

  it('sync is a no-op on an empty queue', async () => {
    await service.sync();

    expect(service.lastSyncTime()).toBeNull();
    expect(service.syncing()).toBe(false);
  });

  it('handleReconnect drains the queue only from disconnected/error socket states', async () => {
    const syncSpy = vi.spyOn(service, 'sync').mockResolvedValue();

    websocketState.setConnectionState('connected');
    service.handleReconnect();
    expect(syncSpy).not.toHaveBeenCalled();

    websocketState.setConnectionState('disconnected');
    service.handleReconnect();
    expect(syncSpy).toHaveBeenCalledTimes(1);

    websocketState.setConnectionState('error');
    service.handleReconnect();
    expect(syncSpy).toHaveBeenCalledTimes(2);
  });

  it('the browser online event triggers a sync', async () => {
    const syncSpy = vi.spyOn(service, 'sync').mockResolvedValue();

    window.dispatchEvent(new Event('online'));

    expect(syncSpy).toHaveBeenCalledTimes(1);
  });

  it('manual retry refuses to run while offline', async () => {
    Object.defineProperty(window.navigator, 'onLine', { configurable: true, get: () => false });
    try {
      await expect(service.retrySync()).rejects.toThrow('Device is offline');
    } finally {
      Object.defineProperty(window.navigator, 'onLine', { configurable: true, get: () => true });
    }
  });

  it('clearQueue empties the queue and any recorded sync error', () => {
    service.addMessage(draft());
    service.setSyncError('stale');

    service.clearQueue();

    expect(service.messages()).toHaveLength(0);
    expect(service.syncError()).toBeNull();
  });
});
