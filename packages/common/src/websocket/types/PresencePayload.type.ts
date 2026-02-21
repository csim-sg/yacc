/**
 * Presence Payload Types
 *
 * Type definitions for presence and typing-related WebSocket event payloads
 *
 * @module @yacc/common/websocket/types
 */

/** User presence status */
export type PresenceStatus = 'online' | 'offline' | 'away';

/**
 * Presence payload for WebSocket events
 *
 * Used for:
 * - presence.updated: User's online status changed
 * - user.online: User came online
 * - user.offline: User went offline
 */
export interface PresencePayload {
  /** User ID */
  userId: string;

  /** User display name */
  userName: string;

  /** Current presence status */
  status: PresenceStatus;

  /** ISO 8601 timestamp when user was last seen */
  lastSeenAt: string;

  /** Conversation ID if user is currently typing */
  typingIn?: string;
}
