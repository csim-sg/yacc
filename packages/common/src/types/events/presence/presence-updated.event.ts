/**
 * Presence Updated Event
 *
 * Fired when a user's online/offline status changes.
 *
 * @module @yacc/common/types/events/presence
 * @see .docs/02-api-and-data-model.md Section 6 - WebSocket Events
 */

import type { BaseEvent } from '../base.event';

/**
 * User presence status values
 */
export type PresenceStatus = 'online' | 'offline' | 'idle';

/**
 * Payload for presence.updated event
 *
 * @example
 * ```json
 * {
 *   "userId": "550e8400-e29b-41d4-a716-446655440000",
 *   "status": "online",
 *   "previousStatus": "offline",
 *   "timestamp": "2026-01-16T10:00:00Z"
 * }
 * ```
 */
export interface PresenceUpdatedPayload {
  /** UUID of the user whose presence changed */
  userId: string;
  /** New presence status */
  status: PresenceStatus;
  /** Previous presence status (for UI transitions) */
  previousStatus?: PresenceStatus;
  /** ISO8601 timestamp when the presence changed */
  timestamp: string;
}

/**
 * Presence Updated Event
 *
 * Emitted when a user's presence status changes (login, logout, idle).
 * Frontend should use this to show online/offline indicators for team members.
 *
 * @example
 * ```typescript
 * // Type narrowing with discriminated union
 * if (event.event === 'presence.updated') {
 *   const { userId, status } = event.payload;
 *   updateUserPresence(userId, status);
 *   if (status === 'online') {
 *     showNotification(`${getUserName(userId)} is now online`);
 *   }
 * }
 * ```
 */
export type PresenceUpdatedEvent = BaseEvent<
  'presence.updated',
  PresenceUpdatedPayload
>;
