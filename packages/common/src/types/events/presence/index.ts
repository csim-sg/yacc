/**
 * Presence Event Types
 *
 * WebSocket events related to user presence and activity:
 * - presence.updated: User logs in/out or goes idle
 * - typing.started: User starts typing in a conversation
 * - typing.stopped: User stops typing (after 5 second inactivity)
 *
 * @module @yacc/common/types/events/presence
 */

export type {
  PresenceUpdatedEvent,
  PresenceUpdatedPayload,
  PresenceStatus,
} from './presence-updated.event';
export type {
  TypingStartedEvent,
  TypingStartedPayload,
} from './typing-started.event';
export type {
  TypingStoppedEvent,
  TypingStoppedPayload,
} from './typing-stopped.event';
