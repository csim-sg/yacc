import { Injectable, InjectionToken, inject, signal } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import type { ZodType } from 'zod';

import { environment } from '../../environments/environment';
import {
  WS_CONNECTION_TIMEOUT_MS,
  WS_MAX_RECONNECT_ATTEMPTS,
  WS_RECONNECT_DELAYS_MS,
} from '../contracts/ws/connection';
import {
  ConversationReopenedPayloadSchema,
  ConversationUpdatedPayloadSchema,
  MessageFailedPayloadSchema,
  MessageReceivedPayloadSchema,
  MessageSentPayloadSchema,
  NotificationPayloadSchema,
  PresenceUpdatedPayloadSchema,
  SystemPayloadSchema,
  TypingStartedPayloadSchema,
  TypingStoppedPayloadSchema,
  WsEnvelopeSchema,
  WsEventPayloadMap,
  WsServerEventName,
} from '../contracts/ws/events.schema';
import { WebSocketStateService } from './websocket-state.service';

/**
 * Socket factory seam — the ONLY place a browser `WebSocket` is
 * constructed (single socket entry, ARCH-005 boundary 2). Unit specs
 * override this token; production uses the native constructor.
 */
export const WS_SOCKET_FACTORY = new InjectionToken<(url: string) => WebSocket>(
  'raw WebSocket factory',
  { factory: () => (url: string) => new WebSocket(url) },
);

/**
 * Connection state of the single raw-WebSocket entry.
 *
 * `reconnecting` = the connection dropped and the application-owned
 * ladder is scheduling/executing attempts; `disconnected` is also the
 * terminal state after the attempt budget is spent (manual retry — W19 —
 * is the way back). No socket.io Manager semantics exist.
 */
export type SocketConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'error';

/**
 * The single raw-WebSocket entry point (ARCH-005 boundary 2; SPEC-003
 * FR-05/TR-01; §Java Baseline Approval AD-2/R1).
 *
 * Transport is the browser-native `WebSocket` against the Java raw
 * Spring WS endpoint (`environment.wsUrl` → `/ws`), JSON text frames
 * only. There is no Socket.io client library, no STOMP/SockJS, and no
 * SSE/`EventSource`/long-poll fallback (ADR-026). INBOUND-ONLY by
 * construction: this service never sends a frame — the verified
 * frontend surface emits nothing (T2 B14 / T3-G10), so there is no
 * `send`/`emit` on this seam and no `eventId` dependency.
 *
 * Wire conformance (AC-ANG-006-3): every inbound text frame is parsed
 * against the frozen `{event, data, timestamp}` envelope
 * (`schemas/envelope.schema.json`), then the envelope `data` is
 * validated against the per-channel frozen schema
 * (`asyncapi.yaml` → `contracts/ws/events.schema.ts`). Invalid or
 * unknown frames are dropped — never crash, never reach the stores. One
 * event router exists (the `routes` map); exactly one connection exists
 * at runtime (idempotent `connect()`).
 *
 * Reconnect is application-owned (no socket.io Manager): the captured
 * ladder 1s/2s/4s/8s/30s × 10 attempts (`contract-canonicalization.md`
 * §3 / WS-BHV-012; `contracts/ws/connection.ts`), a 10s handshake
 * timeout, and a terminal `disconnected` state on exhaustion — the
 * divergent React `useReconnectionLogic` schedule (1s..60s × 5 with
 * jitter) is deliberately NOT ported. `retryNow()` is the manual retry
 * (W19). Liveness rides the server's 60s `system.heartbeat`
 * (`lastHeartbeatAt`).
 *
 * The ANG-005 `WebSocketStateService` boundary is KEPT IN SYNC (state,
 * attempts, last connect time, last error) — it remains the shared
 * client-state row; the reconnect TIMING signals here are the single
 * source the `ReconnectingIndicator` reads.
 */
@Injectable({ providedIn: 'root' })
export class WebSocketClientService {
  private readonly socketFactory = inject(WS_SOCKET_FACTORY);
  private readonly websocketState = inject(WebSocketStateService);

  private socket: WebSocket | null = null;
  /** The socket of the live connection attempt — stale-socket guards. */
  private activeSocket: WebSocket | null = null;
  private authToken: string | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private connectTimeoutTimer: ReturnType<typeof setTimeout> | null = null;
  /** Whether the current drop may reconnect (manual disconnect clears). */
  private manualClose = false;

  private readonly connectionStateSignal = signal<SocketConnectionState>('disconnected');
  /** Read-only connection state (indicator/guards parity). */
  readonly connectionState = this.connectionStateSignal.asReadonly();

  private readonly reconnectAttemptSignal = signal(0);
  /** Reconnect attempts executed since the current drop (0 while connected). */
  readonly reconnectAttempt = this.reconnectAttemptSignal.asReadonly();

  private readonly nextRetryAtSignal = signal<number | null>(null);
  /** Epoch ms of the scheduled next reconnect attempt (countdown source). */
  readonly nextRetryAt = this.nextRetryAtSignal.asReadonly();

  private readonly exhaustedSignal = signal(false);
  /** True once the ladder is spent and only a manual retry remains. */
  readonly isExhausted = this.exhaustedSignal.asReadonly();

  private readonly lastHeartbeatAtSignal = signal<string | null>(null);
  /** ISO timestamp of the last `system.heartbeat` frame (server liveness). */
  readonly lastHeartbeatAt = this.lastHeartbeatAtSignal.asReadonly();

  /** Emits on every successful (re)connect — cache invalidation hook. */
  private readonly connectSubject = new Subject<void>();
  readonly connect$ = this.connectSubject.asObservable();

  /** Max attempts of the application-owned ladder (indicator display). */
  get maxReconnectAttempts(): number {
    return WS_MAX_RECONNECT_ATTEMPTS;
  }

  /**
   * Per-channel inbound streams (one Subject per frozen listener
   * channel, `contracts/ws/events.schema.ts`). Subscribable any time;
   * delivery starts once frames arrive on a connected socket.
   */
  private readonly eventSubjects: {
    [K in WsServerEventName]: Subject<WsEventPayloadMap[K]>;
  } = {
    'conversation.updated': new Subject(),
    'conversation.reopened': new Subject(),
    'message.received': new Subject(),
    'message.sent': new Subject(),
    'message.failed': new Subject(),
    'typing.started': new Subject(),
    'typing.stopped': new Subject(),
    'presence.updated': new Subject(),
    'notification.received': new Subject(),
    'system.connection.established': new Subject(),
    'system.reconnection.started': new Subject(),
    'system.reconnection.failed': new Subject(),
    'system.heartbeat': new Subject(),
    'system.error': new Subject(),
    'system.backlog.replay.started': new Subject(),
    'system.backlog.replay.completed': new Subject(),
  };

  /**
   * The ONE event router: frozen channel name → envelope-`data`
   * validation + typed publish. Frames whose event is not in this fixed
   * set are dropped — the unconsumed frozen channels (queue events,
   * retained-no-emitter notifications, retired raw literals) and any
   * unknown name share this parity-of-absence path (see
   * `contracts/manifest.md`).
   */
  private readonly routes: Readonly<Record<string, (data: unknown) => void>> = {
    'conversation.updated': (data) =>
      this.publish('conversation.updated', ConversationUpdatedPayloadSchema, data),
    'conversation.reopened': (data) =>
      this.publish('conversation.reopened', ConversationReopenedPayloadSchema, data),
    'message.received': (data) =>
      this.publish('message.received', MessageReceivedPayloadSchema, data),
    'message.sent': (data) => this.publish('message.sent', MessageSentPayloadSchema, data),
    'message.failed': (data) => this.publish('message.failed', MessageFailedPayloadSchema, data),
    'typing.started': (data) => this.publish('typing.started', TypingStartedPayloadSchema, data),
    'typing.stopped': (data) => this.publish('typing.stopped', TypingStoppedPayloadSchema, data),
    'presence.updated': (data) =>
      this.publish('presence.updated', PresenceUpdatedPayloadSchema, data),
    'notification.received': (data) =>
      this.publish('notification.received', NotificationPayloadSchema, data),
    'system.connection.established': (data) =>
      this.publish('system.connection.established', SystemPayloadSchema, data),
    'system.reconnection.started': (data) =>
      this.publish('system.reconnection.started', SystemPayloadSchema, data),
    'system.reconnection.failed': (data) =>
      this.publish('system.reconnection.failed', SystemPayloadSchema, data),
    'system.heartbeat': (data) => this.publish('system.heartbeat', SystemPayloadSchema, data),
    'system.error': (data) => this.publish('system.error', SystemPayloadSchema, data),
    'system.backlog.replay.started': (data) =>
      this.publish('system.backlog.replay.started', SystemPayloadSchema, data),
    'system.backlog.replay.completed': (data) =>
      this.publish('system.backlog.replay.completed', SystemPayloadSchema, data),
  };

  /**
   * Open the raw-WebSocket connection. Idempotent: a live or in-flight
   * connection is never duplicated. `authToken` rides the upgrade's
   * `token` query parameter (the raw-WS handshake auth; browsers cannot
   * set headers on an upgrade). Empty/absent token → no connection
   * attempt: the server rejects unauthenticated upgrades fail-closed, so
   * guaranteed-failure churn is not entered.
   */
  connect(authToken: string): void {
    if (this.socket || !authToken) {
      return;
    }

    this.authToken = authToken;
    this.manualClose = false;
    this.setConnectionState('connecting');
    this.openSocket();
  }

  /**
   * Disconnect deliberately (logout parity): closes the socket, cancels
   * any pending reconnect work and the stored handshake token. Terminal
   * until a fresh `connect()`.
   */
  disconnect(): void {
    this.manualClose = true;
    this.clearReconnectTimer();
    this.clearConnectTimeout();
    this.authToken = null;
    this.reconnectAttemptSignal.set(0);
    this.websocketState.setReconnectAttempts(0);
    this.nextRetryAtSignal.set(null);
    this.exhaustedSignal.set(false);

    const socket = this.socket;
    this.socket = null;
    this.activeSocket = null;
    if (socket) {
      socket.close();
    }
    this.setConnectionState('disconnected');
  }

  /**
   * Manual retry (W19): cancel any pending ladder timer, reset the
   * attempt budget and reconnect immediately with the stored handshake
   * token. No-op while a connection is live/in-flight or when no token
   * is held (never connected, or deliberately disconnected).
   */
  retryNow(): void {
    if (this.socket || !this.authToken) {
      return;
    }
    this.clearReconnectTimer();
    this.reconnectAttemptSignal.set(0);
    this.websocketState.setReconnectAttempts(0);
    this.nextRetryAtSignal.set(null);
    this.exhaustedSignal.set(false);
    this.setConnectionState('connecting');
    this.openSocket();
  }

  /** True only when the transport reports a live connection. */
  isConnected(): boolean {
    return this.connectionStateSignal() === 'connected' && this.socket !== null;
  }

  /** Typed inbound stream for one frozen channel (the event router's fan-out). */
  on$<K extends WsServerEventName>(eventName: K): Observable<WsEventPayloadMap[K]> {
    return this.eventSubjects[eventName].asObservable();
  }

  // -------------------------------------------------------------------------
  // Transport lifecycle (application-owned)
  // -------------------------------------------------------------------------

  private openSocket(): void {
    const socket = this.socketFactory(this.buildUrl(this.authToken ?? ''));
    this.socket = socket;
    this.activeSocket = socket;

    socket.onopen = () => {
      if (this.activeSocket !== socket) {
        return;
      }
      this.clearConnectTimeout();
      this.reconnectAttemptSignal.set(0);
      this.websocketState.setReconnectAttempts(0);
      this.nextRetryAtSignal.set(null);
      this.exhaustedSignal.set(false);
      this.setConnectionState('connected');
      this.websocketState.setLastConnectTime(new Date().toISOString());
      this.connectSubject.next();
    };

    socket.onmessage = (event: MessageEvent) => {
      if (this.activeSocket !== socket) {
        return;
      }
      this.routeFrame(event.data);
    };

    socket.onerror = () => {
      if (this.activeSocket !== socket) {
        return;
      }
      // The `error` state is only meaningful on the initial attempt — a
      // mid-ladder failure stays `reconnecting` (exhaustion is the
      // ladder's terminal transition, not an error state).
      if (this.connectionStateSignal() === 'connecting') {
        this.setConnectionState('error');
        this.websocketState.setLastErrorMessage('WebSocket connection failed');
      }
    };

    socket.onclose = () => {
      if (this.activeSocket !== socket) {
        return;
      }
      this.socket = null;
      this.activeSocket = null;
      this.clearConnectTimeout();
      if (this.manualClose) {
        this.setConnectionState('disconnected');
        return;
      }
      this.scheduleReconnect();
    };

    // Handshake timeout: an upgrade that never opens is closed so the
    // ladder takes over (the captured Socket.io `timeout` semantics).
    this.connectTimeoutTimer = setTimeout(() => {
      if (this.activeSocket === socket && socket.readyState !== WebSocket.OPEN) {
        socket.close();
      }
    }, WS_CONNECTION_TIMEOUT_MS);
  }

  /** App-owned backoff: schedule the next ladder attempt. */
  private scheduleReconnect(): void {
    const attempts = this.reconnectAttemptSignal();
    if (attempts >= WS_MAX_RECONNECT_ATTEMPTS) {
      // Ladder spent — terminal until a manual retry (W19).
      this.nextRetryAtSignal.set(null);
      this.exhaustedSignal.set(true);
      this.setConnectionState('disconnected');
      this.websocketState.setLastErrorMessage('WebSocket reconnection attempts exhausted');
      return;
    }

    this.setConnectionState('reconnecting');
    const delay = WS_RECONNECT_DELAYS_MS[Math.min(attempts, WS_RECONNECT_DELAYS_MS.length - 1)];
    this.nextRetryAtSignal.set(Date.now() + delay);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.nextRetryAtSignal.set(null);
      this.reconnectAttemptSignal.set(attempts + 1);
      this.websocketState.setReconnectAttempts(attempts + 1);
      this.openSocket();
    }, delay);
  }

  /** Build the upgrade URL: frozen endpoint + `token` query parameter. */
  private buildUrl(authToken: string): string {
    const base = environment.wsUrl;
    const separator = base.includes('?') ? '&' : '?';
    return `${base}${separator}token=${encodeURIComponent(authToken)}`;
  }

  // -------------------------------------------------------------------------
  // Event router (the ONE router — envelope → channel → typed Subject)
  // -------------------------------------------------------------------------

  private routeFrame(raw: unknown): void {
    if (typeof raw !== 'string') {
      return; // JSON text frames only (frozen transport); binary dropped.
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return; // Malformed JSON — dropped.
    }

    const frame = WsEnvelopeSchema.safeParse(parsed);
    if (!frame.success) {
      return; // Not the frozen {event, data, timestamp} frame — dropped.
    }

    const route = this.routes[frame.data.event];
    if (!route) {
      return; // Channel outside the fixed listener set — dropped.
    }

    route(frame.data.data);

    if (frame.data.event === 'system.heartbeat') {
      this.lastHeartbeatAtSignal.set(frame.data.timestamp);
    }
  }

  /** Validate one envelope `data` against the frozen channel schema and publish. */
  private publish<K extends WsServerEventName>(
    eventName: K,
    schema: ZodType<WsEventPayloadMap[K]>,
    data: unknown,
  ): void {
    const result = schema.safeParse(data);
    if (result.success) {
      this.eventSubjects[eventName].next(result.data);
    }
  }

  // -------------------------------------------------------------------------
  // Shared-state sync + teardown helpers (no leaked sockets/timers)
  // -------------------------------------------------------------------------

  private setConnectionState(state: SocketConnectionState): void {
    this.connectionStateSignal.set(state);
    this.websocketState.setConnectionState(state);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private clearConnectTimeout(): void {
    if (this.connectTimeoutTimer !== null) {
      clearTimeout(this.connectTimeoutTimer);
      this.connectTimeoutTimer = null;
    }
  }
}
