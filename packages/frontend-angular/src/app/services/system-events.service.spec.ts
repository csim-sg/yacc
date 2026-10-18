import { TestBed } from '@angular/core/testing';
import { Subscription } from 'rxjs';

import { WS_SOCKET_FACTORY, WebSocketClientService } from './websocket-client.service';
import { WebSocketStateService } from './websocket-state.service';
import {
  FakeRealtimeSocket,
  latestFakeSocket,
  resetFakeSockets,
  wsFrame,
} from '../../test/ws-test-socket';
import { SystemEventsService } from './system-events.service';

/**
 * SystemEventsService spec: `system.error` surfaces the error message on
 * the shared state row; the informational system channels route without
 * inventing state (heartbeat liveness is the client's, covered there).
 */

const socketFactory = vi.fn((url: string) => new FakeRealtimeSocket(url));

describe('SystemEventsService', () => {
  let client: WebSocketClientService;
  let websocketState: WebSocketStateService;
  let binding: Subscription;

  beforeEach(() => {
    resetFakeSockets(socketFactory);
    TestBed.configureTestingModule({
      providers: [{ provide: WS_SOCKET_FACTORY, useValue: socketFactory }],
    });
    client = TestBed.inject(WebSocketClientService);
    websocketState = TestBed.inject(WebSocketStateService);
    binding = TestBed.inject(SystemEventsService).bind();
    client.connect('token-1');
    latestFakeSocket().open();
  });

  afterEach(() => {
    binding.unsubscribe(); // listener teardown
    client.disconnect();
  });

  it('surfaces the frozen SystemPayload error on the shared state row', () => {
    latestFakeSocket().message(
      wsFrame('system.error', {
        type: 'error',
        timestamp: '2026-10-18T00:00:00Z',
        error: { code: 'HANDLER', message: 'boom' },
      }),
    );

    expect(websocketState.lastErrorMessage()).toBe('boom');
  });

  it('falls back to the payload type when no error object rides the frame', () => {
    latestFakeSocket().message(wsFrame('system.error', { type: 'error', timestamp: 't' }));

    expect(websocketState.lastErrorMessage()).toBe('error');
  });

  it('routes informational system channels without state writes', () => {
    latestFakeSocket().message(
      wsFrame('system.connection.established', { type: 'connection_established', timestamp: 't' }),
    );
    latestFakeSocket().message(
      wsFrame('system.backlog.replay.started', { type: 'backlog_replay', timestamp: 't' }),
    );
    latestFakeSocket().message(
      wsFrame('system.backlog.replay.completed', { type: 'backlog_replay', timestamp: 't' }),
    );

    // No invented store rows — the shared state stays clean of replay UI.
    expect(websocketState.lastErrorMessage()).toBeNull();
    expect(websocketState.isConnected()).toBe(true);
  });
});
