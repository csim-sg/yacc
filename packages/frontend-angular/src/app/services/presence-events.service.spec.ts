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
import { PresenceEventsService } from './presence-events.service';

/**
 * PresenceEventsService spec (W20/W21 state halves): the canonical
 * `presence.updated` shape writes the presence rows; `typing.*` writes
 * the typing rows with a 5s auto-clear that never leaks a timer.
 */

const socketFactory = vi.fn((url: string) => new FakeRealtimeSocket(url));

const CONVERSATION_ID = '00000000-0000-0000-0000-00000000000c';
const USER_ID = '00000000-0000-0000-0000-000000000004';

function typingStartedFrame(name = 'Alice'): string {
  return wsFrame('typing.started', {
    conversationId: CONVERSATION_ID,
    userId: USER_ID,
    name,
  });
}

function typingStoppedFrame(): string {
  return wsFrame('typing.stopped', {
    conversationId: CONVERSATION_ID,
    userId: USER_ID,
  });
}

describe('PresenceEventsService', () => {
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
    binding = TestBed.inject(PresenceEventsService).bind();
    client.connect('token-1');
    latestFakeSocket().open();
  });

  afterEach(() => {
    binding.unsubscribe(); // drives the typing-timer teardown (no leaks)
    client.disconnect();
    vi.useRealTimers();
  });

  it('writes the canonical presence payload (online|offline, lastSeen)', () => {
    latestFakeSocket().message(
      wsFrame('presence.updated', {
        userId: USER_ID,
        status: 'online',
        lastSeen: '2026-10-18T00:00:00Z',
      }),
    );
    latestFakeSocket().message(
      wsFrame('presence.updated', {
        userId: '00000000-0000-0000-0000-000000000002',
        status: 'offline',
        lastSeen: '2026-10-18T00:01:00Z',
      }),
    );

    expect(websocketState.userPresence().get(USER_ID)).toEqual({
      status: 'online',
      lastSeen: '2026-10-18T00:00:00Z',
      lastActivity: expect.any(Number),
    });
    expect(websocketState.userPresence().get('00000000-0000-0000-0000-000000000002')?.status).toBe(
      'offline',
    );
  });

  it('adds typing users and auto-clears them after 5s', async () => {
    vi.useFakeTimers();
    latestFakeSocket().message(typingStartedFrame());

    expect(websocketState.typingUsers().get(CONVERSATION_ID)?.get(USER_ID)?.userName).toBe('Alice');

    await vi.advanceTimersByTimeAsync(4999);
    expect(websocketState.typingUsers().get(CONVERSATION_ID)?.has(USER_ID)).toBe(true);

    await vi.advanceTimersByTimeAsync(1);
    expect(websocketState.typingUsers().has(CONVERSATION_ID)).toBe(false);
  });

  it('clears the pending auto-clear when typing.stopped arrives', async () => {
    vi.useFakeTimers();
    latestFakeSocket().message(typingStartedFrame());
    latestFakeSocket().message(typingStoppedFrame());

    expect(websocketState.typingUsers().has(CONVERSATION_ID)).toBe(false);
    await vi.advanceTimersByTimeAsync(10_000); // the cleared timer must not fire
    expect(websocketState.typingUsers().has(CONVERSATION_ID)).toBe(false);
  });

  it('restarts (never stacks) the auto-clear on repeat typing.started', async () => {
    vi.useFakeTimers();
    latestFakeSocket().message(typingStartedFrame('Alice'));
    await vi.advanceTimersByTimeAsync(3000);
    latestFakeSocket().message(typingStartedFrame('Alice')); // restart window

    await vi.advanceTimersByTimeAsync(3000); // 6s since the first frame
    expect(websocketState.typingUsers().has(CONVERSATION_ID)).toBe(true);

    await vi.advanceTimersByTimeAsync(2000); // 5s since the restart
    expect(websocketState.typingUsers().has(CONVERSATION_ID)).toBe(false);
  });

  it('scopes typing rows per conversation and drops contract-violating frames', () => {
    latestFakeSocket().message(typingStartedFrame('Alice'));
    latestFakeSocket().message(
      wsFrame('typing.started', {
        conversationId: '00000000-0000-0000-0000-0000000000d0',
        userId: '00000000-0000-0000-0000-000000000003',
        name: 'Bob',
      }),
    );
    latestFakeSocket().message(
      wsFrame('typing.stopped', { conversationId: CONVERSATION_ID, userId: 'no-uuid' }),
    );

    expect(websocketState.typingUsers().size).toBe(2);
    expect(websocketState.typingUsers().get(CONVERSATION_ID)?.get(USER_ID)?.userName).toBe('Alice');
    expect(websocketState.typingUsers().get('00000000-0000-0000-0000-0000000000d0')?.size).toBe(1);
  });
});
