import { inject } from '@angular/core';
import { ConversationsStore } from '../services/conversations.store';
import { MessagesStore } from '../services/messages.store';
import { NotificationsStore } from '../services/notifications.store';
import { WebSocketClientService } from '../services/websocket-client.service';
import { WebSocketStateService } from '../services/websocket-state.service';

/**
 * Dev-only real-time observation seam (ANG-006 W19/W20/W21 E2E evidence).
 *
 * The real-time stores (presence/typing rows, message cache patches,
 * heartbeat liveness) have no feature UI yet (ANG-007/008 own the inbox
 * and timeline surfaces), so the shared Playwright harness has no DOM to
 * assert store behavior on. In development builds (`ng serve` /
 * `ngDevMode`) this installer exposes the ROOT real-time services on
 * `window.__yaccRealtimeDevtools` with snapshot-only accessors so the
 * harness can assert live client behavior against the Java `/ws` service
 * (R1 evidence model) without mocking any part of the client.
 *
 * NOT a production surface: the whole block is dead-code-eliminated from
 * production builds (`ngDevMode` is a build-time constant there) and the
 * install call is a no-op outside dev mode. Read-only snapshots + the
 * W19 `retryNow()` affordance only — no state mutation, no second socket
 * entry (ARCH-005 boundary 2 is untouched).
 */

/** Snapshot accessors installed on `window.__yaccRealtimeDevtools` (dev builds). */
export interface RealtimeDevtoolsApi {
  /** WebSocketClientService state snapshot (ladder, heartbeat liveness). */
  client(): {
    connectionState: string;
    isConnected: boolean;
    reconnectAttempt: number;
    maxReconnectAttempts: number;
    isExhausted: boolean;
    nextRetryAt: number | null;
    lastHeartbeatAt: string | null;
  };
  /** Manual retry affordance — the W19 indicator button's exact call. */
  retryNow(): void;
  /** WebSocketStateService snapshot (presence/typing rows, last error). */
  websocketState(): {
    connectionState: string;
    lastConnectTime: string | null;
    lastErrorMessage: string | null;
    reconnectAttempts: number;
    typingUsers: Record<string, Record<string, unknown>>;
    userPresence: Record<string, unknown>;
  };
  /** Load the conversations list cache through the store (real HTTP). */
  conversationsLoad(params?: Record<string, unknown>): Promise<unknown>;
  /** Snapshot of the conversations list cache entry, if loaded. */
  conversationsListSnapshot(): unknown;
  /** Load one conversation's message list cache through the store (real HTTP). */
  messagesLoad(conversationId: string): Promise<unknown>;
  /** The store's real send path (server-confirmed append; real HTTP). */
  messagesSend(conversationId: string, body: string): Promise<{ id: string }>;
  /** Snapshot of one conversation's message list cache entry, if loaded. */
  messagesSnapshot(conversationId: string): unknown;
  /** NotificationsStore snapshot (the `notification.received` sink). */
  notifications(): { items: unknown[]; unreadCount: number };
}

/** The dev-window binding (declared here so specs/consumers stay typed). */
declare global {
  interface Window {
    __yaccRealtimeDevtools?: RealtimeDevtoolsApi;
  }
}

/**
 * Angular's build-time dev-mode flag — `true` in dev builds, replaced with
 * `false` by the production build optimizer (which then eliminates this
 * whole installer body).
 */
declare const ngDevMode: boolean | undefined;

/**
 * Install the dev seam. Must run in an injection context (the root
 * `App` constructor). No-op outside development builds.
 */
export function installRealtimeDevtools(): void {
  if (typeof ngDevMode === 'undefined' || !ngDevMode) {
    return;
  }

  const client = inject(WebSocketClientService);
  const websocketState = inject(WebSocketStateService);
  const conversations = inject(ConversationsStore);
  const messages = inject(MessagesStore);
  const notifications = inject(NotificationsStore);

  window.__yaccRealtimeDevtools = {
    client: () => ({
      connectionState: client.connectionState(),
      isConnected: client.isConnected(),
      reconnectAttempt: client.reconnectAttempt(),
      maxReconnectAttempts: client.maxReconnectAttempts,
      isExhausted: client.isExhausted(),
      nextRetryAt: client.nextRetryAt(),
      lastHeartbeatAt: client.lastHeartbeatAt(),
    }),
    retryNow: () => client.retryNow(),
    websocketState: () => ({
      connectionState: websocketState.connectionState(),
      lastConnectTime: websocketState.lastConnectTime(),
      lastErrorMessage: websocketState.lastErrorMessage(),
      reconnectAttempts: websocketState.reconnectAttempts(),
      typingUsers: Object.fromEntries(
        [...websocketState.typingUsers().entries()].map(([conversation, users]) => [
          conversation,
          Object.fromEntries(users.entries()),
        ]),
      ),
      userPresence: Object.fromEntries(websocketState.userPresence().entries()),
    }),
    conversationsLoad: (params: Record<string, unknown> = {}) =>
      conversations.loadList(params).then(() => conversations.listSnapshot(params) ?? null),
    conversationsListSnapshot: () => conversations.listSnapshot({}) ?? null,
    messagesLoad: (conversationId: string) =>
      messages.loadMessages(conversationId).then(() => messages.listSnapshot(conversationId) ?? null),
    messagesSend: (conversationId: string, body: string) =>
      messages.send(conversationId, { body }),
    messagesSnapshot: (conversationId: string) => messages.listSnapshot(conversationId) ?? null,
    notifications: () => ({
      items: notifications.notifications(),
      unreadCount: notifications.unreadCount(),
    }),
  };
}
