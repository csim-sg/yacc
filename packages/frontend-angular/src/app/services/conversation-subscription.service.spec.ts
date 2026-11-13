import { TestBed } from '@angular/core/testing';

import { WS_MAX_RECONNECT_ATTEMPTS, WS_RECONNECT_DELAYS_MS } from '../contracts/ws/connection';
import { WS_SOCKET_FACTORY, WebSocketClientService } from './websocket-client.service';
import {
  ConversationSubscriptionService,
  INBOX_INTEREST_LIMIT,
} from './conversation-subscription.service';
import {
  FakeRealtimeSocket,
  latestFakeSocket,
  resetFakeSockets,
  wsFrame,
} from '../../test/ws-test-socket';

/**
 * ConversationSubscriptionService spec (AC-1..AC-3, #499 — founder-
 * authorized B14 narrowing): contract-exact subscribe/unsubscribe of the
 * ACTIVE conversation (unsub before sub on switch, duplicate
 * suppression, ack/mismatch/error paths), the bounded inbox interest
 * (rendered page ids only, `INBOX_INTEREST_LIMIT` cap, diff on page
 * change, release on navigation), and idempotent re-subscription on the
 * `connect$` seam after every successful (re)open — with the R1
 * reconnect ladder, the 60s heartbeat handling and backlog replay
 * untouched (no calls into those paths, no new timers).
 */

const socketFactory = vi.fn((url: string) => new FakeRealtimeSocket(url));

const C1 = '00000000-0000-0000-0000-0000000000c1';
const C2 = '00000000-0000-0000-0000-0000000000c2';
const C3 = '00000000-0000-0000-0000-0000000000c3';

/** Parsed (event, data) pairs actually sent over the fake socket. */
function sentFrames(socket: FakeRealtimeSocket): Array<{ event: string; data: string }> {
  return socket.sent.map((raw) => JSON.parse(raw) as { event: string; data: string });
}

/** Indexes of the frames for one (event, conversationId) pair. */
function frameIndexes(socket: FakeRealtimeSocket, event: string, data: string): number[] {
  return sentFrames(socket)
    .map((frame, index) => (frame.event === event && frame.data === data ? index : -1))
    .filter((index) => index >= 0);
}

describe('ConversationSubscriptionService', () => {
  let service: ConversationSubscriptionService;
  let client: WebSocketClientService;

  beforeEach(() => {
    resetFakeSockets(socketFactory);
    TestBed.configureTestingModule({
      providers: [{ provide: WS_SOCKET_FACTORY, useValue: socketFactory }],
    });
    service = TestBed.inject(ConversationSubscriptionService);
    client = TestBed.inject(WebSocketClientService);
    client.connect('token-1');
    latestFakeSocket().open();
  });

  afterEach(() => {
    service.stop();
    client.disconnect();
    vi.useRealTimers();
  });

  /** Ack every subscribe frame the socket has sent so far. */
  function ackAllSubscribes(): void {
    const socket = latestFakeSocket();
    for (const frame of sentFrames(socket)) {
      if (frame.event === 'subscribe.conversation') {
        socket.message(wsFrame('conversation.subscribed', { conversationId: frame.data }));
      }
    }
  }

  // ---------------------------------------------------------------------------
  // AC-1 — active-detail lifecycle
  // ---------------------------------------------------------------------------

  it('subscribes the active conversation and marks it active on the ack', () => {
    service.setActive(C1);

    expect(frameIndexes(latestFakeSocket(), 'subscribe.conversation', C1)).toHaveLength(1);
    expect(service.isActive(C1)).toBe(true); // interest owner answer (pre-ack)

    latestFakeSocket().message(wsFrame('conversation.subscribed', { conversationId: C1 }));

    // Acked: applying further interest changes never re-subscribes it.
    service.setInboxPage([C2]);
    expect(frameIndexes(latestFakeSocket(), 'subscribe.conversation', C1)).toHaveLength(1);
    expect(frameIndexes(latestFakeSocket(), 'unsubscribe.conversation', C1)).toHaveLength(0);
  });

  it('unsubscribes the previous conversation BEFORE subscribing the next (switch order)', () => {
    service.setActive(C1);
    ackAllSubscribes();
    latestFakeSocket().sent.length = 0;

    service.setActive(C2);

    const frames = sentFrames(latestFakeSocket());
    expect(frames).toEqual([
      { event: 'unsubscribe.conversation', data: C1 },
      { event: 'subscribe.conversation', data: C2 },
    ]);
    const unsubAt = frameIndexes(latestFakeSocket(), 'unsubscribe.conversation', C1)[0];
    const subAt = frameIndexes(latestFakeSocket(), 'subscribe.conversation', C2)[0];
    expect(unsubAt).toBeLessThan(subAt);
    expect(service.isActive(C1)).toBe(false);
    expect(service.isActive(C2)).toBe(true);
  });

  it('unsubscribes on leave (setActive null)', () => {
    service.setActive(C1);
    ackAllSubscribes();
    latestFakeSocket().sent.length = 0;

    service.setActive(null);

    expect(sentFrames(latestFakeSocket())).toEqual([
      { event: 'unsubscribe.conversation', data: C1 },
    ]);
    expect(service.isActive(C1)).toBe(false);
  });

  it('never sends a duplicate subscribe for an already-active room', () => {
    service.setActive(C1);
    service.setActive(C1); // same id — suppressed at the owner
    service.setInboxPage([C1]); // also the rendered page — same room

    expect(frameIndexes(latestFakeSocket(), 'subscribe.conversation', C1)).toHaveLength(1);
  });

  it('ignores a mismatched ack without looping or marking joined', () => {
    service.setActive(C1);

    // Ack for a room with no request in flight.
    latestFakeSocket().message(wsFrame('conversation.subscribed', { conversationId: C2 }));

    expect(frameIndexes(latestFakeSocket(), 'subscribe.conversation', C2)).toHaveLength(0);
    // The pending C1 request stays pending — no resend until a new open.
    expect(frameIndexes(latestFakeSocket(), 'subscribe.conversation', C1)).toHaveLength(1);

    // A stale/unsubscribed ack cannot resurrect membership either.
    latestFakeSocket().message(wsFrame('conversation.unsubscribed', { conversationId: C2 }));
    expect(frameIndexes(latestFakeSocket(), 'subscribe.conversation', C2)).toHaveLength(0);
  });

  it('fails in-flight subscribes on system.error and retries once on the next reconnect', async () => {
    vi.useFakeTimers();
    service.setActive(C1);
    expect(frameIndexes(latestFakeSocket(), 'subscribe.conversation', C1)).toHaveLength(1);

    // bad_frame (e.g. malformed frame) surfaces through the existing
    // error channel — the subscription attempt fails without a retry
    // storm: no additional subscribe frame is sent.
    latestFakeSocket().message(wsFrame('system.error', { type: 'error', timestamp: 't' }));
    expect(frameIndexes(latestFakeSocket(), 'subscribe.conversation', C1)).toHaveLength(1);

    // The next successful open re-subscribes the interest set once (the
    // fresh session carries its own frames).
    latestFakeSocket().close();
    await vi.advanceTimersByTimeAsync(WS_RECONNECT_DELAYS_MS[0]);
    latestFakeSocket().open();

    const reconnected = latestFakeSocket();
    expect(frameIndexes(reconnected, 'subscribe.conversation', C1)).toHaveLength(1);
    expect(
      FakeRealtimeSocket.instances.reduce(
        (total, socket) => total + frameIndexes(socket, 'subscribe.conversation', C1).length,
        0,
      ),
    ).toBe(2); // initial open + the reconnect open — nothing in between
  });

  // ---------------------------------------------------------------------------
  // AC-2 — bounded inbox interest
  // ---------------------------------------------------------------------------

  it('subscribes exactly the rendered inbox page ids and diffs a page change', () => {
    service.setInboxPage([C1, C2]);

    let frames = sentFrames(latestFakeSocket());
    expect(frames).toEqual([
      { event: 'subscribe.conversation', data: C1 },
      { event: 'subscribe.conversation', data: C2 },
    ]);

    // Page 2: C3 newly visible, C1 departed, C2 still rendered — only
    // the delta is sent (no frame for C2, no subscribe for unrendered).
    latestFakeSocket().sent.length = 0;
    service.setInboxPage([C2, C3]);

    frames = sentFrames(latestFakeSocket());
    expect(frames).toEqual([
      { event: 'unsubscribe.conversation', data: C1 },
      { event: 'subscribe.conversation', data: C3 },
    ]);
  });

  it('caps the inbox interest at INBOX_INTEREST_LIMIT (the list page size)', () => {
    const ids = Array.from({ length: INBOX_INTEREST_LIMIT + 5 }, (_, i) => `conv-${i}`);
    service.setInboxPage(ids);

    const subscribes = sentFrames(latestFakeSocket()).filter(
      (frame) => frame.event === 'subscribe.conversation',
    );
    expect(subscribes).toHaveLength(INBOX_INTEREST_LIMIT);
    // The cap holds by id, not by count alone: only the first N render.
    expect(subscribes.map((frame) => frame.data)).toEqual(ids.slice(0, INBOX_INTEREST_LIMIT));
  });

  it('releases the inbox interest on navigation except the active conversation', () => {
    service.setInboxPage([C1, C2, C3]);
    ackAllSubscribes();
    latestFakeSocket().sent.length = 0;

    // inbox → detail on C1: the page ids are released except the one
    // staying open (no unsubscribe for C1).
    service.setActive(C1);

    expect(sentFrames(latestFakeSocket())).toEqual([
      { event: 'unsubscribe.conversation', data: C2 },
      { event: 'unsubscribe.conversation', data: C3 },
    ]);

    // The inbox page then destroys: releasing the (now empty) set is a
    // no-op — C1 stays subscribed for the detail.
    latestFakeSocket().sent.length = 0;
    service.releaseInbox();
    expect(sentFrames(latestFakeSocket())).toHaveLength(0);
  });

  it('releases the whole inbox interest when leaving the inbox with no active detail', () => {
    service.setInboxPage([C1, C2]);
    ackAllSubscribes();
    latestFakeSocket().sent.length = 0;

    service.releaseInbox();

    expect(sentFrames(latestFakeSocket())).toEqual([
      { event: 'unsubscribe.conversation', data: C1 },
      { event: 'unsubscribe.conversation', data: C2 },
    ]);
  });

  it('never subscribes ids that were not rendered (the cap is a hard ceiling)', () => {
    // 2× the page size offered — only the bounded slice may ever reach
    // the wire, and re-reporting the same page sends nothing.
    const ids = Array.from({ length: INBOX_INTEREST_LIMIT * 2 }, (_, i) => `conv-${i}`);
    service.setInboxPage(ids);
    const afterFirst = latestFakeSocket().sent.length;

    service.setInboxPage(ids.slice(0, INBOX_INTEREST_LIMIT)); // same rendered page
    expect(latestFakeSocket().sent.length).toBe(afterFirst);
  });

  // ---------------------------------------------------------------------------
  // AC-3 — idempotent reconnect re-subscription (connect$ seam only)
  // ---------------------------------------------------------------------------

  it('re-subscribes the interest set once per successful (re)open, idempotently', async () => {
    vi.useFakeTimers();
    service.setActive(C1);
    service.setInboxPage([C2]);
    ackAllSubscribes();

    // Drop the live connection — the app-owned ladder walks (R1
    // semantics untouched from this service's side).
    latestFakeSocket().close();
    await vi.advanceTimersByTimeAsync(WS_RECONNECT_DELAYS_MS[0]);
    const reconnected = latestFakeSocket();
    reconnected.open();

    // Exactly one fresh subscribe per interest room on the new session.
    expect(frameIndexes(reconnected, 'subscribe.conversation', C1)).toHaveLength(1);
    expect(frameIndexes(reconnected, 'subscribe.conversation', C2)).toHaveLength(1);
    expect(frameIndexes(reconnected, 'unsubscribe.conversation', C1)).toHaveLength(0);

    // Spurious connect-side churn (no new open) never re-subscribes.
    service.setInboxPage([C2]);
    expect(frameIndexes(reconnected, 'subscribe.conversation', C2)).toHaveLength(1);
  });

  it('does not re-subscribe without a new open', () => {
    service.setActive(C1);
    ackAllSubscribes();
    const sendsAfterFirstOpen = latestFakeSocket().sent.length;

    // Interest unchanged + same open socket: no frames.
    service.setInboxPage([]);
    service.setInboxPage([]);
    expect(latestFakeSocket().sent.length).toBe(sendsAfterFirstOpen);
  });

  it('leaves the R1 ladder, heartbeat and backlog paths untouched (no calls, no timers)', async () => {
    vi.useFakeTimers();
    const retryNowSpy = vi.spyOn(client, 'retryNow');
    const beats: unknown[] = [];
    client.on$('system.heartbeat').subscribe((payload) => beats.push(payload));

    service.setActive(C1);
    latestFakeSocket().message(
      wsFrame('system.heartbeat', { type: 'heartbeat', timestamp: 'hb-1' }, 'hb-1'),
    );

    latestFakeSocket().close();
    await vi.advanceTimersByTimeAsync(WS_RECONNECT_DELAYS_MS[0]);
    latestFakeSocket().open();
    latestFakeSocket().message(
      wsFrame('system.backlog.replay.started', { type: 'backlog_replay', timestamp: 't' }),
    );
    latestFakeSocket().message(wsFrame('system.error', { type: 'error', timestamp: 't' }));

    // The subscription service never touches the manual-retry seam, the
    // heartbeat liveness keeps flowing, and no reconnect timer leaked.
    expect(retryNowSpy).not.toHaveBeenCalled();
    expect(beats).toHaveLength(1);
    expect(client.lastHeartbeatAt()).toBe('hb-1');
    expect(client.nextRetryAt()).toBeNull(); // connected — no pending rung
    // The full ladder still exhausts exactly as R1 pins it.
    for (let attempt = 0; attempt <= WS_MAX_RECONNECT_ATTEMPTS; attempt += 1) {
      latestFakeSocket().close();
      await vi.advanceTimersByTimeAsync(WS_RECONNECT_DELAYS_MS[4]);
    }
    expect(client.isExhausted()).toBe(true);
    expect(retryNowSpy).not.toHaveBeenCalled();
  });

  it('resets every row on reset() (session-scoped interest — logout)', async () => {
    vi.useFakeTimers();
    service.setActive(C1);
    service.setInboxPage([C2]);
    ackAllSubscribes();

    service.reset();

    expect(service.isActive(C1)).toBe(false);
    // The next successful open re-subscribes nothing: the interest was
    // cleared with the session (no inherited rooms under a new identity).
    latestFakeSocket().close();
    await vi.advanceTimersByTimeAsync(WS_RECONNECT_DELAYS_MS[0]);
    latestFakeSocket().open();
    expect(latestFakeSocket().sent).toHaveLength(0);
  });

  it('sends nothing while the transport is down (frames need an OPEN socket)', () => {
    service.setActive(C1);
    const sockets = [...FakeRealtimeSocket.instances];
    const sentBefore = sockets.map((socket) => socket.sent.length);
    latestFakeSocket().close(); // drop — socket nulled, ladder pending

    service.setActive(C2);
    service.setInboxPage([C3]);

    // No socket gains frames while the transport is down.
    sockets.forEach((socket, index) => {
      expect(socket.sent.length).toBe(sentBefore[index]);
    });
    expect(service.isActive(C2)).toBe(true);
  });
});
