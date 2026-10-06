import { Injectable, signal } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { Observable, Subject } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  WS_CONNECTION_TIMEOUT_MS,
  WS_CORRELATION_HEADER,
  WS_MAX_RECONNECTION_ATTEMPTS,
  WS_RECONNECTION_DELAYS_MS,
  WS_TRANSPORTS,
} from '../contracts/ws/connection';
import {
  ConversationReopenedEvent,
  ConversationUpdatedEvent,
  ConnectionEstablishedEvent,
  MessageFailedEvent,
  MessageReceivedEvent,
  MessageRetryScheduledEvent,
  MessageSentEvent,
  NotificationReceivedEvent,
  PresenceUpdatedEvent,
  QueueMessageDlqEvent,
  TypingStartedEvent,
  TypingStoppedEvent,
  WsEventPayloadMap,
  WsServerEventName,
} from '../contracts/ws/events.schema';

/**
 * Connection state of the single socket entry (mirrors the React
 * `ConnectionState` set minus the store-only `offline` value).
 */
export type SocketConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'error';

/**
 * The single Socket.io entry point (ARCH-005 boundary 2; SPEC-003 FR-02).
 *
 * Wraps the retained `socket.io-client` dependency 1:1 with the React
 * client (`lib/socket.ts`): same URL source (environment `wsUrl`), same
 * handshake (`auth: { token }` — empty on the live path today, T3 §5.4;
 * capture semantics U6 → ANG-004), same native reconnection parameters,
 * same per-connection `X-Request-ID` correlation header, same effective
 * state mapping (React's socket-level `reconnect_attempt` listener never
 * fires in socket.io v4 — that event is Manager-level — so the
 * `reconnecting` state comes from the in-window disconnect branch only).
 *
 * Server→client events fan out through per-event Subjects (T2 §3.4);
 * payloads are typed by the per-event wire contracts in
 * `contracts/ws/events.schema.ts`. Inbound-only by construction: there is
 * no `emit` — the frontend sends nothing over the socket (verified live
 * behavior, T2 B14 / T3-G10). A second socket stack must never be
 * introduced; ANG-006 builds the real-time binding/handler layer on top
 * of this service.
 */
@Injectable({ providedIn: 'root' })
export class WebSocketClientService {
  private socket: Socket | null = null;

  private readonly connectionStateSignal = signal<SocketConnectionState>('disconnected');

  /** Read-only connection state for indicators/guards (ReconnectingIndicator parity). */
  readonly connectionState = this.connectionStateSignal.asReadonly();

  /**
   * Per-event event streams (one Subject per verified server→client event,
   * `contracts/ws/events.schema.ts`). Subscribable any time; delivery
   * starts once `connect()` has been called and the server emits.
   */
  private readonly eventSubjects: {
    [K in WsServerEventName]: Subject<WsEventPayloadMap[K]>;
  } = {
    'conversation.updated': new Subject<ConversationUpdatedEvent>(),
    'message.received': new Subject<MessageReceivedEvent>(),
    'message.sent': new Subject<MessageSentEvent>(),
    'message.failed': new Subject<MessageFailedEvent>(),
    'connection.established': new Subject<ConnectionEstablishedEvent>(),
    'presence.updated': new Subject<PresenceUpdatedEvent>(),
    'notification.received': new Subject<NotificationReceivedEvent>(),
    'conversation.reopened': new Subject<ConversationReopenedEvent>(),
    'message.retry.scheduled': new Subject<MessageRetryScheduledEvent>(),
    'queue.message.dlq': new Subject<QueueMessageDlqEvent>(),
    'typing.started': new Subject<TypingStartedEvent>(),
    'typing.stopped': new Subject<TypingStoppedEvent>(),
  };

  /**
   * Connect to the socket server. Skips when a connection already exists
   * (same guard as the React client). The token value is the handshake
   * auth payload; the live baseline passes `''` (T3 §5.4, U6 → ANG-004).
   */
  connect(authToken: string = ''): void {
    if (this.socket) {
      return;
    }

    this.connectionStateSignal.set('connecting');

    const socket = io(environment.wsUrl, {
      reconnection: true,
      reconnectionDelay: WS_RECONNECTION_DELAYS_MS[0],
      reconnectionAttempts: WS_MAX_RECONNECTION_ATTEMPTS,
      timeout: WS_CONNECTION_TIMEOUT_MS,
      transports: [...WS_TRANSPORTS],
      forceNew: true,
      auth: { token: authToken },
      extraHeaders: {
        [WS_CORRELATION_HEADER]: this.generateCorrelationId(),
      },
    });

    this.socket = socket;
    this.registerBuiltInListeners(socket);
    this.registerEventForwarding(socket);
  }

  /** Disconnect and drop the socket (called on logout; App.tsx parity). */
  disconnect(): void {
    if (!this.socket) {
      return;
    }

    this.socket.disconnect();
    this.socket = null;
    this.connectionStateSignal.set('disconnected');
  }

  /** True only when the underlying client reports a live connection. */
  isConnected(): boolean {
    return this.connectionStateSignal() === 'connected' && this.socket?.connected === true;
  }

  /** Typed stream for one server→client event (T2 §3.4 events$ model). */
  on$<K extends WsServerEventName>(eventName: K): Observable<WsEventPayloadMap[K]> {
    return this.eventSubjects[eventName].asObservable();
  }

  /**
   * Built-in socket.io lifecycle listeners mapped to the connection-state
   * signal — the effective transitions of the React client (connect →
   * connected; disconnect while attempts remain → reconnecting; exhausted
   * attempts → disconnected; connect_error → error).
   */
  private registerBuiltInListeners(socket: Socket): void {
    let reconnectionAttempts = 0;

    socket.on('connect', () => {
      reconnectionAttempts = 0;
      this.connectionStateSignal.set('connected');
    });

    socket.on('disconnect', () => {
      if (reconnectionAttempts < WS_MAX_RECONNECTION_ATTEMPTS) {
        reconnectionAttempts++;
        this.connectionStateSignal.set('reconnecting');
      } else {
        this.connectionStateSignal.set('disconnected');
      }
    });

    socket.on('connect_error', () => {
      this.connectionStateSignal.set('error');
    });
  }

  /**
   * Forward every verified event to its typed Subject. The socket is the
   * default-map client (`io()` is non-generic in socket.io-client 4.8), so
   * each listener annotates its payload with the contract type — the wire
   * truth stays enforced at the fan-out boundary.
   */
  private registerEventForwarding(socket: Socket): void {
    socket.on('conversation.updated', (payload: ConversationUpdatedEvent) =>
      this.eventSubjects['conversation.updated'].next(payload)
    );
    socket.on('message.received', (payload: MessageReceivedEvent) =>
      this.eventSubjects['message.received'].next(payload)
    );
    socket.on('message.sent', (payload: MessageSentEvent) =>
      this.eventSubjects['message.sent'].next(payload)
    );
    socket.on('message.failed', (payload: MessageFailedEvent) =>
      this.eventSubjects['message.failed'].next(payload)
    );
    socket.on('connection.established', (payload: ConnectionEstablishedEvent) =>
      this.eventSubjects['connection.established'].next(payload)
    );
    socket.on('presence.updated', (payload: PresenceUpdatedEvent) =>
      this.eventSubjects['presence.updated'].next(payload)
    );
    socket.on('notification.received', (payload: NotificationReceivedEvent) =>
      this.eventSubjects['notification.received'].next(payload)
    );
    socket.on('conversation.reopened', (payload: ConversationReopenedEvent) =>
      this.eventSubjects['conversation.reopened'].next(payload)
    );
    socket.on('message.retry.scheduled', (payload: MessageRetryScheduledEvent) =>
      this.eventSubjects['message.retry.scheduled'].next(payload)
    );
    socket.on('queue.message.dlq', (payload: QueueMessageDlqEvent) =>
      this.eventSubjects['queue.message.dlq'].next(payload)
    );
    socket.on('typing.started', (payload: TypingStartedEvent) =>
      this.eventSubjects['typing.started'].next(payload)
    );
    socket.on('typing.stopped', (payload: TypingStoppedEvent) =>
      this.eventSubjects['typing.stopped'].next(payload)
    );
  }

  /** Per-connection correlation id — same format as the React client. */
  private generateCorrelationId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  }
}
