/**
 * Raw-WebSocket test double (ANG-006 unit specs).
 *
 * Drives `WebSocketClientService` through its transport lifecycle
 * without a live server: specs construct the service with the
 * `wsSocketFactoryProvider()`, then `open()`/`message()`/`close()` the
 * captured fake sockets. Lives under `src/test/` (coverage-excluded
 * test infrastructure, next to `setup.ts`).
 */

export class FakeRealtimeSocket {
  static instances: FakeRealtimeSocket[] = [];

  readonly sent: string[] = [];
  readyState = 0;
  closed = false;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;

  constructor(readonly url: string) {
    FakeRealtimeSocket.instances.push(this);
  }

  open(): void {
    this.readyState = 1;
    this.onopen?.();
  }

  message(data: unknown): void {
    this.onmessage?.({ data } as MessageEvent);
  }

  error(): void {
    this.onerror?.();
  }

  close(): void {
    this.readyState = 3;
    if (!this.closed) {
      this.closed = true;
      this.onclose?.();
    }
  }
}

/** The latest fake socket (the one the service just opened). */
export function latestFakeSocket(): FakeRealtimeSocket {
  const socket = FakeRealtimeSocket.instances.at(-1);
  if (!socket) {
    throw new Error('no socket created');
  }
  return socket;
}

/** One frozen `{event, data, timestamp}` frame as JSON text. */
export function wsFrame(event: string, data: unknown, timestamp = '2026-10-18T00:00:00Z'): string {
  return JSON.stringify({ event, data, timestamp });
}

/** Reset the fake socket registry (call in `beforeEach`). */
export function resetFakeSockets(factory: ReturnType<typeof vi.fn>): void {
  FakeRealtimeSocket.instances = [];
  factory.mockClear();
}
