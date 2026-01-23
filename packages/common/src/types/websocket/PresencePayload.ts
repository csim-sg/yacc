/**
 * Presence Payloads
 *
 * WebSocket event payload types for presence and typing-related events
 */

/**
 * Payload for presence.updated event
 */
export interface PresenceUpdatedPayload {
  userId: string;
  status: 'online' | 'offline';
  updatedAt: string;
}

/**
 * Payload for typing.started event
 */
export interface TypingStartedPayload {
  userId: string;
  conversationId: string;
  userName: string;
}

/**
 * Payload for typing.stopped event
 */
export interface TypingStoppedPayload {
  userId: string;
  conversationId: string;
}
