/**
 * Presence Events
 *
 * Presence and typing-related WebSocket event types
 */

export const PRESENCE_UPDATED = 'presence.updated' as const;
export const TYPING_STARTED = 'typing.started' as const;
export const TYPING_STOPPED = 'typing.stopped' as const;

export const PresenceEvents = {
  PRESENCE_UPDATED,
  TYPING_STARTED,
  TYPING_STOPPED,
} as const;

export type PresenceEventType = typeof PresenceEvents[keyof typeof PresenceEvents];
