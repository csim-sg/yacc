/**
 * Message Events
 *
 * Message-related WebSocket event types
 */

export const MESSAGE_RECEIVED = 'message.received' as const;
export const MESSAGE_SENT = 'message.sent' as const;
export const MESSAGE_FAILED = 'message.failed' as const;

export const MessageEvents = {
  MESSAGE_RECEIVED,
  MESSAGE_SENT,
  MESSAGE_FAILED,
} as const;

export type MessageEventType = typeof MessageEvents[keyof typeof MessageEvents];
