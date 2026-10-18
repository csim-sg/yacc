import { Injectable, computed, signal } from '@angular/core';

/**
 * Connection state of the socket boundary (mirrors the React
 * `websocket.store` field set; the store-only `offline` value is not
 * reproducible here — the Angular socket client's state machine has no
 * `offline` state, T3 §5.4).
 */
export type SocketConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'error';

/** Presence status of a user (React `presence.store` mechanism, folded in). */
export type PresenceStatus = 'online' | 'offline' | 'away' | 'unknown';

/** One typing user inside a conversation (auto-clear is the handler's job). */
export interface TypingUser {
  userId: string;
  userName: string;
  /** Epoch ms when the typing event arrived (5s auto-clear computes on this). */
  startedAt: number;
}

/** One user's presence entry. */
export interface UserPresence {
  status: PresenceStatus;
  lastSeen: string;
  /** Epoch ms of the last activity update. */
  lastActivity: number;
}

/**
 * Live client-state boundary of the socket (T2 §3.2 `websocket.store` +
 * `presence.store` rows): connection health, per-conversation
 * subscriptions, typing users, presence, and event-id dedup — identical
 * field boundaries as the React Zustand store, as signals.
 *
 * ANG-006's `WebSocketClientService`/handler services READ and FEED this
 * boundary; nothing here touches socket.io. No localStorage persistence:
 * typing/presence/event-ids/connection state have no cross-reload value
 * (T2 surfaced simplification; final U7 confirmation is ANG-006's).
 */
@Injectable({ providedIn: 'root' })
export class WebSocketStateService {
  /** Max reconnect attempts (React store constant). */
  readonly maxReconnectAttempts = 5;

  private readonly connectionStateSignal = signal<SocketConnectionState>('disconnected');
  /** Current socket connection state. */
  readonly connectionState = this.connectionStateSignal.asReadonly();

  private readonly lastConnectTimeSignal = signal<string | null>(null);
  /** ISO timestamp of the last successful connect. */
  readonly lastConnectTime = this.lastConnectTimeSignal.asReadonly();

  private readonly lastErrorMessageSignal = signal<string | null>(null);
  /** Last socket error message (cleared on any non-error state). */
  readonly lastErrorMessage = this.lastErrorMessageSignal.asReadonly();

  private readonly reconnectAttemptsSignal = signal(0);
  /** Reconnect attempts since the connection dropped. */
  readonly reconnectAttempts = this.reconnectAttemptsSignal.asReadonly();

  private readonly subscribedSignal = signal<ReadonlySet<string>>(new Set());
  /** Conversation ids the UI asked to follow. */
  readonly subscribedConversationIds = this.subscribedSignal.asReadonly();

  private readonly typingSignal = signal<ReadonlyMap<string, ReadonlyMap<string, TypingUser>>>(new Map());
  /** Per-conversation typing users, keyed by conversation then user id. */
  readonly typingUsers = this.typingSignal.asReadonly();

  private readonly presenceSignal = signal<ReadonlyMap<string, UserPresence>>(new Map());
  /** Presence entries keyed by user id. */
  readonly userPresence = this.presenceSignal.asReadonly();

  private readonly processedSignal = signal<ReadonlySet<string>>(new Set());
  /** Processed event ids (dedup ring; the backend sends none today, T3-G10). */
  readonly processedEventIds = this.processedSignal.asReadonly();

  /** Whether the socket is currently connected. */
  readonly isConnected = computed(() => this.connectionStateSignal() === 'connected');

  /** Transition the connection state (`error` keeps the error message). */
  setConnectionState(state: SocketConnectionState): void {
    this.connectionStateSignal.set(state);
    if (state !== 'error') {
      this.lastErrorMessageSignal.set(null);
    }
  }

  setLastConnectTime(time: string): void {
    this.lastConnectTimeSignal.set(time);
  }

  setLastErrorMessage(message: string | null): void {
    this.lastErrorMessageSignal.set(message);
  }

  setReconnectAttempts(attempts: number): void {
    this.reconnectAttemptsSignal.set(attempts);
  }

  /** Follow a conversation (subscription registry for the handlers). */
  subscribe(conversationId: string): void {
    const next = new Set(this.subscribedSignal());
    next.add(conversationId);
    this.subscribedSignal.set(next);
  }

  /** Stop following a conversation; its typing users are cleaned up. */
  unsubscribe(conversationId: string): void {
    const next = new Set(this.subscribedSignal());
    next.delete(conversationId);
    this.subscribedSignal.set(next);
    this.clearTypingUsers(conversationId);
  }

  addTypingUser(conversationId: string, userId: string, userName: string): void {
    const conversation = new Map(this.typingSignal().get(conversationId) ?? []);
    conversation.set(userId, { userId, userName, startedAt: Date.now() });
    const next = new Map(this.typingSignal());
    next.set(conversationId, conversation);
    this.typingSignal.set(next);
  }

  removeTypingUser(conversationId: string, userId: string): void {
    const current = this.typingSignal().get(conversationId);
    if (!current?.has(userId)) {
      return;
    }
    const conversation = new Map(current);
    conversation.delete(userId);
    const next = new Map(this.typingSignal());
    if (conversation.size === 0) {
      next.delete(conversationId);
    } else {
      next.set(conversationId, conversation);
    }
    this.typingSignal.set(next);
  }

  clearTypingUsers(conversationId: string): void {
    if (!this.typingSignal().has(conversationId)) {
      return;
    }
    const next = new Map(this.typingSignal());
    next.delete(conversationId);
    this.typingSignal.set(next);
  }

  setUserPresence(userId: string, status: PresenceStatus, lastSeen?: string): void {
    const next = new Map(this.presenceSignal());
    next.set(userId, {
      status,
      lastSeen: lastSeen ?? new Date().toISOString(),
      lastActivity: Date.now(),
    });
    this.presenceSignal.set(next);
  }

  clearUserPresence(userId: string): void {
    if (!this.presenceSignal().has(userId)) {
      return;
    }
    const next = new Map(this.presenceSignal());
    next.delete(userId);
    this.presenceSignal.set(next);
  }

  /** Record an event id as processed (dedup — handlers ask before applying). */
  markEventProcessed(eventId: string): void {
    const next = new Set(this.processedSignal());
    next.add(eventId);
    this.processedSignal.set(next);
  }

  /** Whether an event id was already applied (dedup check). */
  isEventProcessed(eventId: string): boolean {
    return this.processedSignal().has(eventId);
  }
}
