/**
 * WebSocket Event Types for YACC Real-Time Communication
 *
 * Type definitions for all WebSocket events between client and server
 * Organized by event direction (server → client, client → server)
 */

// ============================================================================
// Connection State Types
// ============================================================================

export type ConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'error'
  | 'offline';

// ============================================================================
// Server → Client Events (Server emits these to clients)
// ============================================================================

/**
 * Conversation was updated (message added, status changed, etc.)
 */
export interface ConversationUpdatedEvent {
  conversationId: string;
  conversation: any; // TODO: Import from @yacc/common when exported
  changedFields: string[];
  timestamp: string; // ISO8601
  eventId: string; // For deduplication
}

/**
 * Message was sent successfully
 */
export interface MessageSentEvent {
  conversationId: string;
  messageId: string;
  serverId?: string; // Map from tempId to actual ID
  status: 'sent';
  timestamp: string; // ISO8601
  eventId: string;
}

/**
 * Message failed to send
 */
export interface MessageFailedEvent {
  conversationId: string;
  messageId: string;
  status: 'failed';
  error: string;
  canRetry: boolean;
  timestamp: string; // ISO8601
  eventId: string;
}

/**
 * User started typing
 */
export interface TypingStartedEvent {
  conversationId: string;
  userId: string;
  userName: string;
  timestamp: string; // ISO8601
  eventId: string;
}

/**
 * User stopped typing
 */
export interface TypingStoppedEvent {
  conversationId: string;
  userId: string;
  timestamp: string; // ISO8601
  eventId: string;
}

/**
 * User presence changed
 */
export interface PresenceUpdatedEvent {
  userId: string;
  userName: string;
  status: 'online' | 'offline' | 'away';
  lastSeen?: string; // ISO8601
  timestamp: string; // ISO8601
  eventId: string;
}

/**
 * Notification received
 */
export interface NotificationReceivedEvent {
  notification: {
    id: string;
    userId: string;
    type: 'assignment' | 'mention' | 'unread';
    conversationId: string;
    actorId?: string;
    actorName?: string;
    message: string;
    isRead: boolean;
    createdAt: string; // ISO8601
  };
  timestamp: string; // ISO8601
  eventId: string;
}

/**
 * Conversation reopened (status changed from resolved)
 */
export interface ConversationReopenedEvent {
  conversationId: string;
  reason: string;
  timestamp: string; // ISO8601
  eventId: string;
}

/**
 * Backlog sync response
 */
export interface BacklogSyncEvent {
  events: Array<
    | ConversationUpdatedEvent
    | MessageSentEvent
    | MessageFailedEvent
    | TypingStartedEvent
    | TypingStoppedEvent
    | PresenceUpdatedEvent
  >;
  hasMore: boolean;
  nextCursor?: string; // For pagination
  timestamp: string; // ISO8601
}

/**
 * Union type for all server events
 */
export type ServerEvent =
  | ConversationUpdatedEvent
  | MessageSentEvent
  | MessageFailedEvent
  | TypingStartedEvent
  | TypingStoppedEvent
  | PresenceUpdatedEvent
  | NotificationReceivedEvent
  | ConversationReopenedEvent
  | BacklogSyncEvent;

// ============================================================================
// Client → Server Events (Clients emit these to server)
// ============================================================================

/**
 * User started typing
 */
export interface TypingStartEvent {
  conversationId: string;
}

/**
 * User stopped typing
 */
export interface TypingStopEvent {
  conversationId: string;
}

/**
 * Presence heartbeat
 */
export interface PresencePingEvent {
  timestamp: string; // ISO8601
}

/**
 * Request backlog of missed events
 */
export interface BacklogRequestEvent {
  since: string; // ISO8601
  limit?: number;
  cursor?: string;
}

/**
 * Union type for all client events
 */
export type ClientEvent =
  | TypingStartEvent
  | TypingStopEvent
  | PresencePingEvent
  | BacklogRequestEvent;

// ============================================================================
// Zustand Store Types
// ============================================================================

/**
 * Typing state for a conversation
 */
export interface TypingState {
  userId: string;
  userName: string;
  startedAt: number; // Timestamp for timeout management
}

/**
 * Presence state for a user
 */
export interface PresenceState {
  status: 'online' | 'offline' | 'away' | 'unknown';
  lastSeen: string; // ISO8601
  lastActivity: number; // Timestamp for away calculation
}

/**
 * WebSocket Store State
 */
export interface WebSocketState {
  // Connection State
  connectionState: ConnectionState;
  lastConnectTime: string | null;
  lastErrorMessage: string | null;
  reconnectAttempts: number;
  maxReconnectAttempts: number;

  // Subscriptions
  subscribedConversationIds: Set<string>;

  // Typing (per conversation)
  typingUsers: Map<string, Map<string, TypingState>>; // conversationId → userId → TypingState

  // Presence (per user)
  userPresence: Map<string, PresenceState>; // userId → PresenceState

  // Events tracking
  processedEventIds: Set<string>; // For deduplication

  // Actions
  setConnectionState: (state: ConnectionState) => void;
  setLastConnectTime: (time: string) => void;
  setLastErrorMessage: (message: string | null) => void;
  setReconnectAttempts: (attempts: number) => void;

  subscribe: (conversationId: string) => void;
  unsubscribe: (conversationId: string) => void;

  addTypingUser: (conversationId: string, userId: string, userName: string) => void;
  removeTypingUser: (conversationId: string, userId: string) => void;
  clearTypingUsers: (conversationId: string) => void;

  setUserPresence: (userId: string, status: PresenceState['status'], lastSeen?: string) => void;
  clearUserPresence: (userId: string) => void;

  markEventProcessed: (eventId: string) => void;
  isEventProcessed: (eventId: string) => boolean;
  clearOldEvents: () => void;
}

// ============================================================================
// Offline Queue Types
// ============================================================================

/**
 * Offline message in queue
 */
export interface OfflineMessage {
  tempId: string; // UUID for optimistic updates
  conversationId: string;
  body: string;
  timestamp: number; // Milliseconds since epoch
  status: 'pending' | 'syncing' | 'failed';
  error?: string;
}

/**
 * Offline Queue Store State
 */
export interface OfflineQueueState {
  // Queue State
  messages: OfflineMessage[];
  syncing: boolean;
  syncError: string | null;
  lastSyncTime: number | null;

  // Actions
  addMessage: (message: Omit<OfflineMessage, 'status' | 'timestamp'>) => void;
  removeMessage: (tempId: string) => void;
  clearQueue: () => void;
  setSyncing: (syncing: boolean) => void;
  setSyncError: (error: string | null) => void;
  setLastSyncTime: (time: number) => void;
  updateMessageStatus: (tempId: string, status: OfflineMessage['status'], error?: string) => void;
}

// ============================================================================
// Notifications Types
// ============================================================================

/**
 * Notification
 */
export interface Notification {
  id: string;
  userId: string;
  type: 'assignment' | 'mention' | 'unread';
  conversationId: string;
  actorId?: string;
  actorName?: string;
  message: string;
  isRead: boolean;
  createdAt: string; // ISO8601
}

/**
 * Notifications Store State
 */
export interface NotificationsState {
  // State
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  error: string | null;

  // Actions
  addNotification: (notification: Notification) => void;
  removeNotification: (id: string) => void;
  markAsRead: (id: string) => void;
  clearAll: () => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setNotifications: (notifications: Notification[]) => void;
}

// ============================================================================
// Backlog Sync Types
// ============================================================================

/**
 * Backlog sync state
 */
export interface BacklogSyncState {
  syncing: boolean;
  progress: number; // 0-100
  totalEvents: number;
  syncedEvents: number;
  error: string | null;
  lastSyncTime: string | null;
}
