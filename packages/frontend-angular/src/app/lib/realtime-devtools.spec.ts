import { TestBed } from '@angular/core/testing';
import { NotificationsStore } from '../services/notifications.store';
import { WebSocketClientService } from '../services/websocket-client.service';
import { installRealtimeDevtools, type RealtimeDevtoolsApi } from './realtime-devtools';

/**
 * Unit specs for the dev-only real-time observation seam (ANG-006 E2E
 * evidence support): the installer exposes snapshot accessors for the root
 * real-time services and never mutates client state.
 */
describe('installRealtimeDevtools', () => {
  let api: RealtimeDevtoolsApi;

  beforeEach(() => {
    // The unit runner defines ngDevMode; install inside an injection
    // context (TestBed.runInInjectionContext) like the root App does.
    TestBed.runInInjectionContext(() => installRealtimeDevtools());
    const installed = window.__yaccRealtimeDevtools;
    if (!installed) {
      throw new Error('devtools seam was not installed under ngDevMode');
    }
    api = installed;
  });

  afterEach(() => {
    delete window.__yaccRealtimeDevtools;
  });

  it('exposes the client state snapshot (W19 signals)', () => {
    const snapshot = api.client();
    expect(snapshot.connectionState).toBe('disconnected');
    expect(snapshot.isConnected).toBe(false);
    expect(snapshot.reconnectAttempt).toBe(0);
    expect(snapshot.maxReconnectAttempts).toBe(10);
    expect(snapshot.isExhausted).toBe(false);
    expect(snapshot.nextRetryAt).toBeNull();
    expect(snapshot.lastHeartbeatAt).toBeNull();
  });

  it('exposes the shared websocket-state boundary snapshot', () => {
    const snapshot = api.websocketState();
    expect(snapshot.connectionState).toBe('disconnected');
    expect(snapshot.lastConnectTime).toBeNull();
    expect(snapshot.lastErrorMessage).toBeNull();
    expect(snapshot.reconnectAttempts).toBe(0);
    expect(snapshot.typingUsers).toEqual({});
    expect(snapshot.userPresence).toEqual({});
  });

  it('exposes cache snapshots that start unloaded (no HTTP in this spec)', () => {
    expect(api.conversationsListSnapshot()).toBeNull();
    expect(api.messagesSnapshot('00000000-0000-0000-0000-000000001001')).toBeNull();
  });

  it('exposes the notifications sink snapshot', () => {
    const snapshot = api.notifications();
    expect(Array.isArray(snapshot.items)).toBe(true);
    expect(snapshot.unreadCount).toBe(0);
  });

  it('retryNow() is a safe no-op while no connection is held', () => {
    expect(() => api.retryNow()).not.toThrow();
    expect(TestBed.inject(WebSocketClientService).connectionState()).toBe('disconnected');
  });

  it('reflects live store writes through the snapshot accessors', () => {
    const notifications = TestBed.inject(NotificationsStore);
    notifications.addNotification({
      id: 'notif-1',
      userId: '00000000-0000-0000-0000-000000000004',
      type: 'assignment',
      conversationId: '00000000-0000-0000-0000-000000001001',
      message: 'Real-time notification row',
      isRead: false,
      createdAt: new Date().toISOString(),
    });
    const snapshot = api.notifications();
    expect(snapshot.items).toHaveLength(1);
    expect(snapshot.unreadCount).toBe(1);
  });
});
