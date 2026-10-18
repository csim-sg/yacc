import { TestBed } from '@angular/core/testing';
import { io, Socket } from 'socket.io-client';
import { WebSocketClientService } from './websocket-client.service';

/**
 * WebSocketClientService spec (ANG-004 PB-3 support).
 *
 * Pins the single Socket.io seam (ARCH-005 boundary 2): connection
 * options/handshake parity with the React client, idempotent connect,
 * the Manager-owned v4 reconnect lifecycle mapping (ANG-002 review-loop
 * finding), inbound-only event fan-out to per-event Subjects, and
 * disconnect teardown. ANG-006 builds the real-time binding layer on
 * this service.
 */

const socketOn = vi.fn();
const managerOn = vi.fn();
const socketDisconnect = vi.fn();

vi.mock('socket.io-client', () => ({
  io: vi.fn(() => ({
    on: socketOn,
    io: { on: managerOn },
    disconnect: socketDisconnect,
    connected: false,
  })),
}));

/** Emit one registered socket/manager event through the captured handler. */
function emit(registrar: ReturnType<typeof vi.fn>, event: string, ...args: unknown[]): void {
  const handler = registrar.mock.calls.find(([name]) => name === event)?.[1] as
    | ((...payload: unknown[]) => void)
    | undefined;
  if (!handler) {
    throw new Error(`no registered handler for "${event}"`);
  }
  handler(...args);
}

describe('WebSocketClientService', () => {
  let service: WebSocketClientService;

  beforeEach(() => {
    socketOn.mockClear();
    managerOn.mockClear();
    socketDisconnect.mockClear();
    vi.mocked(io).mockClear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(WebSocketClientService);
  });

  it('connects with the React client option set (handshake auth "", correlation header)', () => {
    service.connect();

    expect(service.connectionState()).toBe('connecting');
    expect(io).toHaveBeenCalledTimes(1);
    const [url, options] = vi.mocked(io).mock.calls[0];
    expect(url).toBeDefined();
    expect(options).toMatchObject({
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 10,
      timeout: 10000,
      transports: ['websocket', 'polling'],
      forceNew: true,
      auth: { token: '' },
    });
    expect(options?.extraHeaders?.['X-Request-ID']).toBeTruthy();
  });

  it('is idempotent — a second connect() reuses the live socket', () => {
    service.connect();
    service.connect();
    expect(io).toHaveBeenCalledTimes(1);
  });

  it('registers the lifecycle listeners and all 12 inbound event listeners', () => {
    service.connect();

    const socketEvents = socketOn.mock.calls.map(([name]) => name);
    for (const lifecycle of ['connect', 'disconnect', 'connect_error']) {
      expect(socketEvents).toContain(lifecycle);
    }
    const expectedEvents = [
      'conversation.updated',
      'message.received',
      'message.sent',
      'message.failed',
      'connection.established',
      'presence.updated',
      'notification.received',
      'conversation.reopened',
      'message.retry.scheduled',
      'queue.message.dlq',
      'typing.started',
      'typing.stopped',
    ];
    for (const event of expectedEvents) {
      expect(socketEvents).toContain(event);
    }
    expect(socketEvents.filter((name) => name === 'message.received')).toHaveLength(1);
    expect(managerOn.mock.calls.map(([name]) => name)).toEqual(
      expect.arrayContaining(['reconnect_attempt', 'reconnect_failed'])
    );
  });

  it('maps the v4 lifecycle to connection states (Manager-owned reconnect semantics)', () => {
    service.connect();
    const socket = vi.mocked(io).mock.results[0].value as Socket;

    emit(socketOn, 'connect');
    // The native client flips `connected` when the connection opens.
    (socket as { connected: boolean }).connected = true;
    expect(service.connectionState()).toBe('connected');
    expect(service.isConnected()).toBe(true);

    emit(socketOn, 'disconnect', 'transport close');
    (socket as { connected: boolean }).connected = false;
    expect(service.connectionState()).toBe('reconnecting');

    emit(managerOn, 'reconnect_attempt');
    expect(service.connectionState()).toBe('reconnecting');

    emit(socketOn, 'connect');
    (socket as { connected: boolean }).connected = true;
    expect(service.connectionState()).toBe('connected');

    // Intentional divergence from the React mapping: explicit teardown
    // states never auto-reconnect, so they land on `disconnected`.
    emit(socketOn, 'disconnect', 'io server disconnect');
    expect(service.connectionState()).toBe('disconnected');

    emit(managerOn, 'reconnect_failed');
    expect(service.connectionState()).toBe('disconnected');
  });

  it('maps a connect_error on the initial attempt to error, retry attempts stay reconnecting', () => {
    service.connect();

    emit(socketOn, 'connect_error', new Error('initial failure'));
    expect(service.connectionState()).toBe('error');

    emit(managerOn, 'reconnect_attempt');
    expect(service.connectionState()).toBe('reconnecting');

    // A retry-phase connect_error is not terminal (Manager keeps cycling).
    emit(socketOn, 'connect_error', new Error('retry failure'));
    expect(service.connectionState()).toBe('reconnecting');
  });

  it('fans each inbound event out to its typed Subject (inbound-only — no emit)', () => {
    service.connect();
    const payload = {
      event: 'message.sent',
      data: {
        messageId: 'm1',
        conversationId: 'c1',
        status: 'sent',
        platformMessageId: 'tg-1',
        timestamp: '2026-10-18T00:00:00',
      },
      timestamp: '2026-10-18T00:00:00',
    };
    const received: unknown[] = [];
    service.on$('message.sent').subscribe((event) => received.push(event));

    emit(socketOn, 'message.sent', payload);
    expect(received).toEqual([payload]);
    // The client never emits over the socket (T2 B14).
    expect(socketOn.mock.calls.every(([name]) => name !== 'emit')).toBe(true);
  });

  it('disconnects and drops the socket so a fresh connect can be made', () => {
    service.connect();
    emit(socketOn, 'connect');
    service.disconnect();

    expect(socketDisconnect).toHaveBeenCalledTimes(1);
    expect(service.connectionState()).toBe('disconnected');
    expect(service.isConnected()).toBe(false);

    service.connect();
    expect(io).toHaveBeenCalledTimes(2);
  });
});
