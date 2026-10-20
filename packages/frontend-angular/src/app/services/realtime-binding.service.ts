import { Injectable, effect, inject, untracked } from '@angular/core';
import { Subscription } from 'rxjs';

import { AuthService } from './auth.service';
import { TokenStorageService } from './token-storage.service';
import { WebSocketClientService } from './websocket-client.service';
import { ConversationEventsService } from './conversation-events.service';
import { MessageEventsService } from './message-events.service';
import { NotificationEventsService } from './notification-events.service';
import { PresenceEventsService } from './presence-events.service';
import { SystemEventsService } from './system-events.service';
import { ConversationsStore } from './conversations.store';
import { MessagesStore } from './messages.store';

/**
 * The real-time binding (the React `useWebSocketCache` +
 * `registerSocketListeners` port, ANG-006): registers the FIXED inbound
 * listener set once (one connection + one event router at runtime) and
 * owns the refetch wiring.
 *
 * - Fixed listener set (exactly the verified live surface + the frozen
 *   `system.*` target channels): conversation/messsage/notification/
 *   presence+typing/system per-domain handler services. Unconsumed
 *   frozen channels (queue events, retained-no-emitter notifications)
 *   are registered nowhere (parity-of-absence,
 *   `contracts/manifest.md`).
 * - `connect$` (every successful connect or reconnect) invalidates the
 *   conversations family and the message lists — after a gap the caches
 *   refetch over HTTP (AC-ANG-006-2).
 * - Handshake token (U6 → ANG-004): the bearer access token is read
 *   from `TokenStorageService` and handed to the client. With no stored
 *   token no connection is attempted — the Java upgrade is
 *   fail-closed (401), so a guaranteed-failure ladder is never entered.
 *   The binding starts once per app, and the auth/session transition is
 *   bound here (AC-ANG-007-8, React `WebSocketInitializer` parity): a
 *   real sign-in without a page reload reaches a live raw-WS connection
 *   and logout/session expiry disconnects — through the idempotent
 *   `ensureConnected()`/`client.disconnect()` edges only. The transport
 *   (socket, envelope/router, ladder/backoff, handlers) stays
 *   ANG-006's (`websocket-client.service.ts` untouched).
 */
@Injectable({ providedIn: 'root' })
export class RealtimeBindingService {
  private readonly client = inject(WebSocketClientService);
  private readonly tokenStorage = inject(TokenStorageService);
  private readonly auth = inject(AuthService);
  private readonly conversations = inject(ConversationsStore);
  private readonly messages = inject(MessagesStore);
  private readonly conversationEvents = inject(ConversationEventsService);
  private readonly messageEvents = inject(MessageEventsService);
  private readonly notificationEvents = inject(NotificationEventsService);
  private readonly presenceEvents = inject(PresenceEventsService);
  private readonly systemEvents = inject(SystemEventsService);

  private started = false;
  private listenersSubscription: Subscription | null = null;
  private connectSubscription: Subscription | null = null;
  /** Last observed auth state (AC-ANG-007-8 transition detection). */
  private lastAuthenticated: boolean | null = null;

  constructor() {
    // Boot observation is synchronous: `start()` owns the with-token
    // connect for a restored session, so the initial value only seeds the
    // transition detector (effects flush lazily — the first scheduled run
    // must never swallow a transition that already happened).
    this.lastAuthenticated = this.auth.isAuthenticated();

    // AC-ANG-007-8 (the one bounded additive auth/session-transition
    // binding; the transport client/backoff/handlers are untouched): one
    // effect over the delivered `AuthService.isAuthenticated` signal.
    // - false → true (real sign-in without a reload, or the boot session
    //   restore): idempotent `ensureConnected()` — a live/in-flight
    //   connection is never duplicated (the client no-ops).
    // - true → false (logout / session expiry): deliberate
    //   `client.disconnect()`.
    effect(() => {
      const authenticated = this.auth.isAuthenticated();
      untracked(() => this.onAuthTransition(authenticated));
    });
  }

  /**
   * AC-ANG-007-8: connect the single raw-WS client from the CURRENTLY
   * stored access token, idempotently — the transport's `connect()` already
   * no-ops on a live or in-flight connection, so a restored-session boot
   * (already connected by `start()`) never opens a second socket. With no
   * stored token this is a no-op (fail-closed server — no doomed attempt).
   */
  ensureConnected(): void {
    const accessToken = this.tokenStorage.getAccessToken();
    if (accessToken) {
      this.client.connect(accessToken);
    }
  }

  /** Auth-transition reducer (no-op when the observed state is unchanged). */
  private onAuthTransition(authenticated: boolean): void {
    if (this.lastAuthenticated === authenticated) {
      return;
    }
    this.lastAuthenticated = authenticated;
    if (authenticated) {
      this.ensureConnected();
    } else {
      this.client.disconnect();
    }
  }

  /**
   * Start the real-time binding: register the fixed listener set, wire
   * `connect$` → cache invalidation, and connect when a session token
   * exists. Idempotent (one connection, one router, once per app).
   */
  start(): void {
    if (this.started) {
      return;
    }
    this.started = true;

    this.listenersSubscription = new Subscription();
    this.listenersSubscription.add(this.conversationEvents.bind());
    this.listenersSubscription.add(this.messageEvents.bind());
    this.listenersSubscription.add(this.notificationEvents.bind());
    this.listenersSubscription.add(this.presenceEvents.bind());
    this.listenersSubscription.add(this.systemEvents.bind());

    this.connectSubscription = this.client.connect$.subscribe(() => {
      this.conversations.invalidate();
      this.messages.invalidate();
    });

    const accessToken = this.tokenStorage.getAccessToken();
    if (accessToken) {
      this.client.connect(accessToken);
    }
  }

  /** Stop the binding (listener teardown; the client socket is not forced). */
  stop(): void {
    this.listenersSubscription?.unsubscribe();
    this.listenersSubscription = null;
    this.connectSubscription?.unsubscribe();
    this.connectSubscription = null;
    this.started = false;
  }

  /** Manual retry passthrough (W19 indicator affordance). */
  retryNow(): void {
    this.client.retryNow();
  }
}
