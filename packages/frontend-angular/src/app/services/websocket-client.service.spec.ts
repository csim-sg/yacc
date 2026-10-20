import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../environments/environment';
import {
  WS_CONNECTION_TIMEOUT_MS,
  WS_MAX_RECONNECT_ATTEMPTS,
  WS_RECONNECT_DELAYS_MS,
} from '../contracts/ws/connection';
import { WS_SOCKET_FACTORY, WebSocketClientService } from './websocket-client.service';
import { WebSocketStateService } from './websocket-state.service';
import {
  FakeRealtimeSocket,
  latestFakeSocket,
  resetFakeSockets,
  wsFrame,
} from '../../test/ws-test-socket';

/**
 * WebSocketClientService spec (AC-ANG-006-1/2/3).
 *
 * Pins the single raw-WebSocket seam (ARCH-005 boundary 2, R1): the
 * upgrade URL + handshake-token wiring, idempotent connect, the frozen
 * `{event, data, timestamp}` envelope routing with per-channel `data`
 * validation, invalid/unknown frame handling, the application-owned
 * reconnect ladder (1s/2s/4s/8s/30s × 10) with manual retry, the
 * `system.heartbeat` liveness timestamp, teardown without leaked
 * sockets/timers, and INBOUND-ONLY transport (nothing is ever sent).
 */

const socketFactory = vi.fn((url: string) => new FakeRealtimeSocket(url));

describe('WebSocketClientService', () => {
  let service: WebSocketClientService;
  let websocketState: WebSocketStateService;

  beforeEach(() => {
    resetFakeSockets(socketFactory);
    TestBed.configureTestingModule({
      providers: [{ provide: WS_SOCKET_FACTORY, useValue: socketFactory }],
    });
    service = TestBed.inject(WebSocketClientService);
    websocketState = TestBed.inject(WebSocketStateService);
  });

  afterEach(() => {
    service.disconnect();
    vi.useRealTimers();
  });

  it('connects to the frozen /ws endpoint with the token query parameter', () => {
    service.connect('token-1 secret');

    expect(service.connectionState()).toBe('connecting');
    expect(socketFactory).toHaveBeenCalledTimes(1);
    expect(latestFakeSocket().url).toBe(
      `${environment.wsUrl}?token=${encodeURIComponent('token-1 secret')}`,
    );
  });

  it('never attempts an unauthenticated upgrade (fail-closed server posture)', () => {
    service.connect('');

    expect(socketFactory).not.toHaveBeenCalled();
    expect(service.connectionState()).toBe('disconnected');
  });

  it('is idempotent — exactly one connection at runtime', () => {
    service.connect('token-1');
    service.connect('token-1');

    expect(socketFactory).toHaveBeenCalledTimes(1);
  });

  it('transitions to connected on open, syncs the shared state and emits connect$', async () => {
    const connected = firstValueFrom(service.connect$);
    service.connect('token-1');

    latestFakeSocket().open();

    expect(service.connectionState()).toBe('connected');
    expect(service.isConnected()).toBe(true);
    expect(websocketState.connectionState()).toBe('connected');
    expect(websocketState.lastConnectTime()).not.toBeNull();
    expect(await connected).toBeUndefined();
  });

  it('routes the frozen envelope to the typed channel streams', () => {
    service.connect('token-1');
    const socket = latestFakeSocket();
    socket.open();

    const updates: unknown[] = [];
    service.on$('conversation.updated').subscribe((payload) => updates.push(payload));
    socket.message(
      wsFrame('conversation.updated', {
        conversationId: '00000000-0000-0000-0000-00000000000c',
        updatedFields: { status: 'open' },
        changedBy: '00000000-0000-0000-0000-000000000004',
        changedAt: '2026-10-18T00:00:00Z',
      }),
    );

    expect(updates).toHaveLength(1);
    expect(updates[0]).toMatchObject({ updatedFields: { status: 'open' } });
  });

  it('drops malformed, non-envelope, unknown-channel and contract-violating frames', () => {
    service.connect('token-1');
    const socket = latestFakeSocket();
    socket.open();

    const updates: unknown[] = [];
    service.on$('conversation.updated').subscribe((payload) => updates.push(payload));
    const emit = () => updates.length;

    socket.message('not-json'); // malformed JSON
    socket.message(JSON.stringify({ event: 'conversation.updated' })); // missing data/timestamp
    socket.message(wsFrame('message.retry.scheduled', {})); // unconsumed frozen channel
    socket.message(wsFrame('notification.deleted', {})); // retained-no-emitter
    socket.message(wsFrame('totally.unknown', {})); // unknown channel
    socket.message(
      wsFrame('conversation.updated', { conversationId: 'not-a-uuid' }), // data contract violation
    );
    socket.message(wsFrame('system.heartbeat', { type: 'heartbeat' })); // valid — control
    socket.message(1337); // binary/non-text frame

    expect(emit()).toBe(0);
    expect(updates).toHaveLength(0);
    // The control frame still routed — the client is alive, not broken.
    expect(service.lastHeartbeatAt()).toBe('2026-10-18T00:00:00Z');
  });

  it('records system.heartbeat liveness and publishes the payload', () => {
    service.connect('token-1');
    const socket = latestFakeSocket();
    socket.open();

    const beats: unknown[] = [];
    service.on$('system.heartbeat').subscribe((payload) => beats.push(payload));
    socket.message(wsFrame('system.heartbeat', { type: 'heartbeat', timestamp: '2026-10-18T00:00:00Z' }));

    expect(service.lastHeartbeatAt()).toBe('2026-10-18T00:00:00Z');
    expect(beats).toHaveLength(1);
  });

  it('is inbound-only — nothing is ever sent over the socket', () => {
    service.connect('token-1');
    const socket = latestFakeSocket();
    socket.open();

    socket.message(wsFrame('conversation.updated', {
      conversationId: '00000000-0000-0000-0000-00000000000c',
      updatedFields: {},
      changedBy: '00000000-0000-0000-0000-000000000004',
      changedAt: '2026-10-18T00:00:00Z',
    }));
    socket.error();

    expect(socket.sent).toHaveLength(0);
  });

  it('maps an initial handshake error to the error state', () => {
    service.connect('token-1');
    latestFakeSocket().error();

    expect(service.connectionState()).toBe('error');
    expect(websocketState.lastErrorMessage()).toBe('WebSocket connection failed');
  });

  it('closes an upgrade that never opens (handshake timeout) and starts the ladder', async () => {
    vi.useFakeTimers();
    service.connect('token-1');
    const socket = latestFakeSocket();

    await vi.advanceTimersByTimeAsync(WS_CONNECTION_TIMEOUT_MS - 1);
    expect(socket.closed).toBe(false);

    await vi.advanceTimersByTimeAsync(1); // 10s handshake timeout elapsed
    expect(socket.closed).toBe(true);
    expect(service.connectionState()).toBe('reconnecting');
  });

  describe('application-owned reconnect ladder', () => {
    it('walks 1s/2s/4s/8s/30s × 10 and terminates exhausted', async () => {
      vi.useFakeTimers();
      service.connect('token-1');
      latestFakeSocket().open();

      latestFakeSocket().close(); // drop the live connection — the ladder starts
      for (let attempt = 1; attempt <= WS_MAX_RECONNECT_ATTEMPTS; attempt += 1) {
        expect(service.connectionState()).toBe('reconnecting');
        expect(service.reconnectAttempt()).toBe(attempt - 1);

        const rung = WS_RECONNECT_DELAYS_MS[Math.min(attempt - 1, WS_RECONNECT_DELAYS_MS.length - 1)];
        const scheduledAt = service.nextRetryAt();
        expect(scheduledAt).not.toBeNull();
        expect(scheduledAt! - Date.now()).toBe(rung);

        await vi.advanceTimersByTimeAsync(rung);
        expect(service.reconnectAttempt()).toBe(attempt);
        expect(service.nextRetryAt()).toBeNull();

        // Fail the attempt (transport error + drop) → next rung schedules.
        latestFakeSocket().error();
        latestFakeSocket().close();
      }

      expect(service.isExhausted()).toBe(true);
      expect(service.connectionState()).toBe('disconnected');
      expect(service.nextRetryAt()).toBeNull();
      expect(websocketState.lastErrorMessage()).toBe('WebSocket reconnection attempts exhausted');
      // Terminal: the ladder leaves no timers behind.
      await vi.advanceTimersByTimeAsync(60_000);
      expect(FakeRealtimeSocket.instances).toHaveLength(WS_MAX_RECONNECT_ATTEMPTS + 1);
    });

    it('resets the ladder on a successful reconnect and re-emits connect$', async () => {
      vi.useFakeTimers();
      service.connect('token-1');
      latestFakeSocket().open(); // initial connect

      let reconnects = 0;
      service.connect$.subscribe(() => (reconnects += 1));

      latestFakeSocket().close();
      await vi.advanceTimersByTimeAsync(WS_RECONNECT_DELAYS_MS[0]);
      latestFakeSocket().open();

      expect(service.connectionState()).toBe('connected');
      expect(service.reconnectAttempt()).toBe(0);
      expect(reconnects).toBe(1); // the reconnect (the initial open preceded the subscription)
    });

    it('does not reschedule after a manual disconnect', async () => {
      vi.useFakeTimers();
      service.connect('token-1');
      latestFakeSocket().open();
      service.disconnect();

      expect(service.connectionState()).toBe('disconnected');
      await vi.advanceTimersByTimeAsync(60_000);
      expect(FakeRealtimeSocket.instances).toHaveLength(1);
    });

    it('retryNow reconnects immediately after exhaustion and resets the budget', async () => {
      vi.useFakeTimers();
      service.connect('token-1');
      latestFakeSocket().open();
      for (let attempt = 0; attempt <= WS_MAX_RECONNECT_ATTEMPTS; attempt += 1) {
        latestFakeSocket().close();
        await vi.advanceTimersByTimeAsync(30_000);
      }
      expect(service.isExhausted()).toBe(true);

      service.retryNow();
      expect(service.connectionState()).toBe('connecting');
      expect(service.isExhausted()).toBe(false);
      expect(service.reconnectAttempt()).toBe(0);
      latestFakeSocket().open();
      expect(service.connectionState()).toBe('connected');
    });

    it('ignores stale sockets: a replaced socket closing does not re-enter the ladder', async () => {
      vi.useFakeTimers();
      service.connect('token-1');
      const first = latestFakeSocket();
      first.open();

      first.close(); // drop → ladder schedules attempt 1
      await vi.advanceTimersByTimeAsync(WS_RECONNECT_DELAYS_MS[0]);
      const second = latestFakeSocket();
      second.open(); // reconnect succeeded → the first socket is stale now
      expect(service.connectionState()).toBe('connected');
      expect(socketFactory).toHaveBeenCalledTimes(2);

      // The stale socket delivers a late close — the active-socket guard
      // ignores it: no new attempt, no state change.
      first.closed = false;
      first.close();
      expect(service.connectionState()).toBe('connected');
      expect(FakeRealtimeSocket.instances).toHaveLength(2);
      expect(service.reconnectAttempt()).toBe(0);

      // Manual retry is a no-op while a connection is live.
      service.retryNow();
      expect(socketFactory).toHaveBeenCalledTimes(2);
      expect(service.connectionState()).toBe('connected');
    });
  });

  it('disconnect clears every timer and drops the stored handshake token', async () => {
    vi.useFakeTimers();
    service.connect('token-1');
    latestFakeSocket().open();
    latestFakeSocket().close();
    expect(service.nextRetryAt()).not.toBeNull();

    service.disconnect();
    expect(service.nextRetryAt()).toBeNull();
    service.retryNow(); // token dropped — no resurrection after logout
    await vi.advanceTimersByTimeAsync(60_000);
    expect(FakeRealtimeSocket.instances).toHaveLength(1);
  });
});
