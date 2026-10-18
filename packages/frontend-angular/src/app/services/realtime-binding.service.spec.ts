import { TestBed } from '@angular/core/testing';

import { ConversationsStore } from './conversations.store';
import { MessagesStore } from './messages.store';
import { WebSocketStateService } from './websocket-state.service';
import { WS_SOCKET_FACTORY, WebSocketClientService } from './websocket-client.service';
import {
  FakeRealtimeSocket,
  latestFakeSocket,
  resetFakeSockets,
  wsFrame,
} from '../../test/ws-test-socket';
import { RealtimeBindingService } from './realtime-binding.service';

/**
 * RealtimeBindingService spec: the fixed listener set is registered once,
 * `connect$` invalidates the conversation + message caches, and the
 * handshake token (U6 → ANG-004) is consumed from `TokenStorageService`.
 */

const socketFactory = vi.fn((url: string) => new FakeRealtimeSocket(url));

describe('RealtimeBindingService', () => {
  let binding: RealtimeBindingService;
  let client: WebSocketClientService;

  beforeEach(() => {
    localStorage.clear();
    resetFakeSockets(socketFactory);
    TestBed.configureTestingModule({
      providers: [{ provide: WS_SOCKET_FACTORY, useValue: socketFactory }],
    });
    binding = TestBed.inject(RealtimeBindingService);
    client = TestBed.inject(WebSocketClientService);
  });

  afterEach(() => {
    binding.stop();
    client.disconnect();
    vi.useRealTimers();
    localStorage.clear();
  });

  it('connects with the stored access token (U6 seam) when a session exists', () => {
    localStorage.setItem('yacc_token', 'access-1');
    localStorage.setItem('yacc_refresh_token', 'refresh-1');

    binding.start();

    expect(socketFactory).toHaveBeenCalledTimes(1);
    expect(latestFakeSocket().url).toContain('token=access-1');
  });

  it('registers the listener set but never connects without a token', () => {
    binding.start();

    expect(socketFactory).not.toHaveBeenCalled();

    // The listeners are live: a system error still reaches the state row.
    client.connect('token-1');
    latestFakeSocket().open();
    latestFakeSocket().message(wsFrame('system.error', { type: 'error', timestamp: 't' }));
    expect(TestBed.inject(WebSocketStateService).lastErrorMessage()).toBe('error');
  });

  it('invalidates the conversations + message caches on every (re)connect', () => {
    vi.useFakeTimers();
    localStorage.setItem('yacc_token', 'access-1');
    const conversations = TestBed.inject(ConversationsStore);
    const messages = TestBed.inject(MessagesStore);
    const invalidateConversations = vi.spyOn(conversations, 'invalidate');
    const invalidateMessages = vi.spyOn(messages, 'invalidate');

    binding.start();
    latestFakeSocket().open();
    latestFakeSocket().close(); // reconnect ladder → attempt 1
    vi.advanceTimersByTime(1000);
    latestFakeSocket().open();

    expect(invalidateConversations).toHaveBeenCalledTimes(2);
    expect(invalidateMessages).toHaveBeenCalledTimes(2);
  });

  it('is idempotent — one binding, one connection', () => {
    localStorage.setItem('yacc_token', 'access-1');

    binding.start();
    binding.start();

    expect(socketFactory).toHaveBeenCalledTimes(1);
  });

  it('stop() tears the listeners down (frames no longer reach the stores)', () => {
    binding.start();
    client.connect('token-1');
    latestFakeSocket().open();
    binding.stop();

    latestFakeSocket().message(wsFrame('system.error', { type: 'error', timestamp: 't' }));

    expect(TestBed.inject(WebSocketStateService).lastErrorMessage()).toBeNull();
  });
});
