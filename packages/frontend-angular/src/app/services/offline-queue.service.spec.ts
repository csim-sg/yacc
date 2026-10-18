import { TestBed } from '@angular/core/testing';

import { WebSocketStateService } from './websocket-state.service';
import { OfflineQueueService } from './offline-queue.service';

/**
 * OfflineQueueService spec (AC-ANG-005-4; T2 §3.2 `offline-queue.store`
 * row): persisted FIFO capped at 50, status transitions, the
 * sync-on-reconnect hook (browser `online` + socket-reconnect entry
 * point), and the manual retry affordance. U8: mechanism ported, NO UI
 * (parity of absence — disposition recorded by ANG-015).
 */
describe('OfflineQueueService', () => {
  let service: OfflineQueueService;
  let websocketState: WebSocketStateService;

  function draft(conversationId = 'c1') {
    return { conversationId, body: 'queued while offline' };
  }

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(OfflineQueueService);
    websocketState = TestBed.inject(WebSocketStateService);
  });

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

  it('sync drains pending rows FIFO and stamps lastSyncTime', async () => {
    const first = service.addMessage(draft()) ?? '';
    service.addMessage(draft('c2'));
    service.updateMessageStatus(first, 'failed', 'earlier attempt');

    await service.sync();

    expect(service.messages()).toHaveLength(0);
    expect(service.syncing()).toBe(false);
    expect(service.syncError()).toBeNull();
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
