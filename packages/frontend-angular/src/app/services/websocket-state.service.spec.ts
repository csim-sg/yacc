import { TestBed } from '@angular/core/testing';

import { WebSocketStateService } from './websocket-state.service';

/**
 * WebSocketStateService spec (AC-ANG-005-2; T2 §3.2 `websocket.store` +
 * `presence.store` rows): the live client-state boundary — connection
 * health, subscriptions, typing, presence, event-id dedup. No
 * persistence (U7: T2 default; final confirmation owner is ANG-006).
 */
describe('WebSocketStateService', () => {
  let service: WebSocketStateService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(WebSocketStateService);
  });

  it('starts disconnected with default fields', () => {
    expect(service.connectionState()).toBe('disconnected');
    expect(service.isConnected()).toBe(false);
    expect(service.lastConnectTime()).toBeNull();
    expect(service.lastErrorMessage()).toBeNull();
    expect(service.reconnectAttempts()).toBe(0);
    expect(service.maxReconnectAttempts).toBe(5);
    expect(service.subscribedConversationIds().size).toBe(0);
  });

  it('transitions connection state and clears the error message on non-error states', () => {
    service.setLastErrorMessage('handshake failed');
    service.setConnectionState('error');
    expect(service.lastErrorMessage()).toBe('handshake failed');

    service.setConnectionState('connected');
    expect(service.isConnected()).toBe(true);
    expect(service.lastErrorMessage()).toBeNull();

    service.setLastConnectTime('2026-10-18T00:00:00Z');
    expect(service.lastConnectTime()).toBe('2026-10-18T00:00:00Z');

    service.setReconnectAttempts(3);
    expect(service.reconnectAttempts()).toBe(3);
  });

  it('tracks subscriptions; unsubscribe cleans up typing users for the conversation', () => {
    service.subscribe('c1');
    service.subscribe('c2');
    service.addTypingUser('c1', 'u1', 'User One');

    service.unsubscribe('c1');

    expect([...service.subscribedConversationIds()]).toEqual(['c2']);
    expect(service.typingUsers().has('c1')).toBe(false);
  });

  it('scopes typing users per conversation and supports removal/clear', () => {
    service.addTypingUser('c1', 'u1', 'User One');
    service.addTypingUser('c1', 'u2', 'User Two');
    service.addTypingUser('c2', 'u3', 'User Three');

    const c1Typing = service.typingUsers().get('c1');
    expect(c1Typing?.get('u1')?.userName).toBe('User One');
    expect(c1Typing?.get('u1')?.startedAt).toBeGreaterThan(0);
    expect(c1Typing?.size).toBe(2);

    service.removeTypingUser('c1', 'u1');
    expect(service.typingUsers().get('c1')?.size).toBe(1);

    service.clearTypingUsers('c1');
    expect(service.typingUsers().has('c1')).toBe(false);

    service.removeTypingUser('c1', 'u1'); // no-op on absent conversation
    expect(service.typingUsers().has('c1')).toBe(false);
  });

  it('tracks presence per user (mechanism folded from the dead presence store)', () => {
    service.setUserPresence('u1', 'online', '2026-10-18T00:00:00Z');
    service.setUserPresence('u2', 'away');

    expect(service.userPresence().get('u1')?.status).toBe('online');
    expect(service.userPresence().get('u2')?.status).toBe('away');
    expect(service.userPresence().get('u2')?.lastActivity).toBeGreaterThan(0);

    service.clearUserPresence('u1');
    expect(service.userPresence().has('u1')).toBe(false);
    service.clearUserPresence('u1'); // no-op
  });

  it('dedups event ids (ring behavior)', () => {
    expect(service.isEventProcessed('evt-1')).toBe(false);

    service.markEventProcessed('evt-1');

    expect(service.isEventProcessed('evt-1')).toBe(true);
    expect(service.isEventProcessed('evt-2')).toBe(false);
  });

  it('holds no persistence: a fresh instance starts empty', () => {
    service.subscribe('c1');
    service.markEventProcessed('evt-1');

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    const fresh = TestBed.inject(WebSocketStateService);
    expect(fresh.subscribedConversationIds().size).toBe(0);
    expect(fresh.processedEventIds().size).toBe(0);
  });
});
