import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { AuthService } from './auth.service';
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
 * The AC-ANG-007-8 rows cover the auth/session-transition binding: a real
 * sign-in connects without a reload and sign-out disconnects — through the
 * transport's idempotent connect/disconnect edges only.
 */

const socketFactory = vi.fn((url: string) => new FakeRealtimeSocket(url));

/** Wire-shape session user (`AuthUserSchema` — lowercase role). */
const SESSION_USER = {
  id: '00000000-0000-0000-0000-000000000001',
  email: 'user@yacc.local',
  name: 'Test User',
  role: 'user',
  status: 'active',
  emailVerified: true,
  createdAt: '2026-10-01T00:00:00Z',
  updatedAt: '2026-10-01T00:00:00Z',
};

describe('RealtimeBindingService', () => {
  let binding: RealtimeBindingService;
  let client: WebSocketClientService;

  beforeEach(() => {
    localStorage.clear();
    resetFakeSockets(socketFactory);
    TestBed.configureTestingModule({
      // `provideHttpClient(Testing)`: the AC-ANG-007-8 rows drive the REAL
      // `AuthService` sign-in/sign-out paths (the auth transition source)
      // against the intercepted `HttpClient` — no auth mock is introduced.
      providers: [
        { provide: WS_SOCKET_FACTORY, useValue: socketFactory },
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
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

  it('connects on a real sign-in without a page reload (AC-ANG-007-8)', async () => {
    const http = TestBed.inject(HttpTestingController);
    const auth = TestBed.inject(AuthService);

    binding.start();
    // Signed out: no session, no socket attempt (fail-closed parity).
    expect(socketFactory).not.toHaveBeenCalled();

    // The REAL sign-in path: stores the token pair, then sets the identity
    // — the auth transition alone must connect the client (no reload).
    const signingIn = auth.signIn({ email: SESSION_USER.email, password: 'secret' });
    http
      .expectOne('/api/auth/sign-in/email')
      .flush({
        user: SESSION_USER,
        accessToken: 'access-signin',
        refreshToken: 'refresh-signin',
        mustChangePassword: false,
      });
    await signingIn;
    TestBed.flushEffects();

    expect(socketFactory).toHaveBeenCalledTimes(1);
    expect(latestFakeSocket().url).toContain('token=access-signin');
  });

  it('disconnects on sign-out (AC-ANG-007-8)', async () => {
    const http = TestBed.inject(HttpTestingController);
    const auth = TestBed.inject(AuthService);

    // Reach the connected state through the real sign-in transition.
    const signingIn = auth.signIn({ email: SESSION_USER.email, password: 'secret' });
    http
      .expectOne('/api/auth/sign-in/email')
      .flush({
        user: SESSION_USER,
        accessToken: 'access-signin',
        refreshToken: 'refresh-signin',
        mustChangePassword: false,
      });
    await signingIn;
    TestBed.flushEffects();
    binding.start();
    latestFakeSocket().open();
    expect(client.isConnected()).toBe(true);

    // The REAL sign-out path: clears the tokens + identity — the auth
    // transition must deliberately disconnect the live socket.
    const signingOut = auth.signOut();
    http.expectOne('/api/auth/sign-out').flush({ success: true });
    await signingOut;
    TestBed.flushEffects();

    expect(client.connectionState()).toBe('disconnected');
    expect(latestFakeSocket().closed).toBe(true);
  });

  it('ensureConnected() is idempotent — a live connection is never duplicated (AC-ANG-007-8)', () => {
    localStorage.setItem('yacc_token', 'access-1');
    localStorage.setItem('yacc_refresh_token', 'refresh-1');

    binding.start();
    binding.ensureConnected();
    binding.ensureConnected();

    expect(socketFactory).toHaveBeenCalledTimes(1);
  });

  it('ensureConnected() never attempts a doomed upgrade without a stored token (AC-ANG-007-8)', () => {
    binding.start();
    binding.ensureConnected();

    expect(socketFactory).not.toHaveBeenCalled();
  });
});
