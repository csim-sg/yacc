import { z } from 'zod';

/**
 * Socket.io server→client event contracts (T3 §5.1/§5.2 — verified wire).
 *
 * Per-event schemas encoding each event's ACTUAL wire format — there is
 * deliberately NO single envelope assumption:
 * - `conversation.updated` / `message.received` — RAW FLAT payloads,
 *   room-scoped (`conversation:{id}`) via `WebSocketServer.emitToConversation`.
 * - `message.sent` / `message.failed` — `{ event, data, timestamp }`
 *   ENVELOPE, global broadcast, emitted only by the legacy
 *   `wsGateway.emitGlobally` path (T3-G5, decision U3: the frontend
 *   encodes this wire truth; backend unification is a post-gate founder
 *   decision — NOT fixed frontend-side).
 * - `notification.received` / `conversation.reopened` — DECLARED, no
 *   backend emitter exists (T3-G2/G3); schemas encode the declared
 *   frontend shape so an emitter appearing becomes a visible change.
 * - `presence.updated` — raw `{ userId, isOnline, timestamp }` global
 *   broadcast (wire truth; the richer React listener type is NOT
 *   replicated — T3-G4, parity = same absence).
 * - `message.retry.scheduled` / `queue.message.dlq` — legacy-gateway
 *   envelopes, not listened to by the frontend (LIVE, unconsumed).
 * - No `eventId` field is ever sent by the backend (T3-G10) — declared
 *   `eventId` fields are optional and never depended on.
 * - There are NO client→server event contracts: the real-time surface is
 *   inbound-only (T2 B14/G10; ARCH-005 boundary 2).
 */

// ---------------------------------------------------------------------------
// Shared envelope
// ---------------------------------------------------------------------------

/** Legacy-gateway envelope: `{ event, data, timestamp }` (T3-G5). */
function wsEnvelopeSchema<E extends string, T extends z.ZodTypeAny>(eventName: E, data: T) {
  return z.object({
    event: z.literal(eventName),
    data,
    timestamp: z.string(),
  });
}

// ---------------------------------------------------------------------------
// conversation.updated — flat payload, conversation room
// ---------------------------------------------------------------------------

export const ConversationUpdatedEventSchema = z.object({
  conversationId: z.string().uuid(),
  updatedFields: z.record(z.string(), z.unknown()),
  changedBy: z.string(),
  changedAt: z.string(),
});

export type ConversationUpdatedEvent = z.infer<typeof ConversationUpdatedEventSchema>;

// ---------------------------------------------------------------------------
// message.received — flat payload, conversation room (IRC/connector ingestion)
// ---------------------------------------------------------------------------

export const MessageReceivedEventSchema = z.object({
  messageId: z.string(),
  conversationId: z.string().uuid(),
  platform: z.enum(['telegram', 'irc']),
  senderId: z.string(),
  body: z.string(),
  senderName: z.string(),
  timestamp: z.string(),
  /** Declared by the React listener type; not sent by any verified producer. */
  attachments: z
    .array(z.object({ url: z.string(), type: z.string(), name: z.string() }))
    .optional(),
});

export type MessageReceivedEvent = z.infer<typeof MessageReceivedEventSchema>;

// ---------------------------------------------------------------------------
// message.sent / message.failed — ENVELOPE, global broadcast (T3-G5)
// ---------------------------------------------------------------------------

export const MessageSentPayloadSchema = z.object({
  messageId: z.string(),
  conversationId: z.string(),
  status: z.literal('sent'),
  platformMessageId: z.string(),
  timestamp: z.string(),
});

export const MessageSentEventSchema = wsEnvelopeSchema('message.sent', MessageSentPayloadSchema);

export type MessageSentEvent = z.infer<typeof MessageSentEventSchema>;

export const MessageFailedPayloadSchema = z.object({
  messageId: z.string(),
  conversationId: z.string(),
  status: z.enum(['failed', 'pending']),
  attempt: z.number().int(),
  maxAttempts: z.number().int(),
  error: z.string(),
  nextRetryTime: z.string().optional(),
  isFinal: z.boolean(),
});

export const MessageFailedEventSchema = wsEnvelopeSchema(
  'message.failed',
  MessageFailedPayloadSchema
);

export type MessageFailedEvent = z.infer<typeof MessageFailedEventSchema>;

// ---------------------------------------------------------------------------
// connection.established — raw, on connect (unconsumed by the frontend)
// ---------------------------------------------------------------------------

export const ConnectionEstablishedEventSchema = z.object({
  socketId: z.string(),
  timestamp: z.string(),
});

export type ConnectionEstablishedEvent = z.infer<typeof ConnectionEstablishedEventSchema>;

// ---------------------------------------------------------------------------
// presence.updated — raw `{ userId, isOnline, timestamp }`, global (T3-G4)
// ---------------------------------------------------------------------------

export const PresenceUpdatedEventSchema = z.object({
  userId: z.string(),
  isOnline: z.boolean(),
  timestamp: z.string(),
});

export type PresenceUpdatedEvent = z.infer<typeof PresenceUpdatedEventSchema>;

// ---------------------------------------------------------------------------
// notification.received — DECLARED, no backend emitter (T3-G2)
// ---------------------------------------------------------------------------

export const NotificationReceivedEventSchema = z.object({
  notification: z.object({
    id: z.string(),
    userId: z.string(),
    type: z.enum(['assignment', 'mention', 'unread']),
    conversationId: z.string(),
    actorId: z.string().optional(),
    actorName: z.string().optional(),
    message: z.string(),
    isRead: z.boolean(),
    createdAt: z.string(),
  }),
  timestamp: z.string(),
  /** Never sent by the backend (T3-G10). */
  eventId: z.string().optional(),
});

export type NotificationReceivedEvent = z.infer<typeof NotificationReceivedEventSchema>;

// ---------------------------------------------------------------------------
// conversation.reopened — DECLARED, no backend emitter (T3-G3)
// ---------------------------------------------------------------------------

export const ConversationReopenedEventSchema = z.object({
  conversationId: z.string().uuid(),
  reason: z.string(),
  timestamp: z.string(),
  /** Never sent by the backend (T3-G10). */
  eventId: z.string().optional(),
});

export type ConversationReopenedEvent = z.infer<typeof ConversationReopenedEventSchema>;

// ---------------------------------------------------------------------------
// Queue / delivery pipeline — legacy-gateway envelopes, unconsumed (§5.1)
// ---------------------------------------------------------------------------

export const MessageRetryScheduledEventSchema = wsEnvelopeSchema(
  'message.retry.scheduled',
  z.object({
    messageId: z.string(),
    conversationId: z.string(),
    attempt: z.number().int(),
    nextRetryTime: z.string().optional(),
    timestamp: z.string(),
  })
);

export type MessageRetryScheduledEvent = z.infer<typeof MessageRetryScheduledEventSchema>;

export const QueueMessageDlqEventSchema = wsEnvelopeSchema(
  'queue.message.dlq',
  z.object({
    messageId: z.string(),
    conversationId: z.string(),
    failureReason: z.string(),
    totalAttempts: z.number().int(),
    lastError: z.string(),
    correlationId: z.string().optional(),
    requiresReview: z.boolean(),
    timestamp: z.string(),
  })
);

export type QueueMessageDlqEvent = z.infer<typeof QueueMessageDlqEventSchema>;

// ---------------------------------------------------------------------------
// typing.started / typing.stopped — UNWIRED producer (§5.1); declared shapes
// ---------------------------------------------------------------------------

export const TypingStartedEventSchema = z.object({
  conversationId: z.string().uuid(),
  userId: z.string(),
  userName: z.string(),
  timestamp: z.string(),
  /** Never sent by the backend (T3-G10). */
  eventId: z.string().optional(),
});

export type TypingStartedEvent = z.infer<typeof TypingStartedEventSchema>;

export const TypingStoppedEventSchema = z.object({
  conversationId: z.string().uuid(),
  userId: z.string(),
  timestamp: z.string(),
  /** Never sent by the backend (T3-G10). */
  eventId: z.string().optional(),
});

export type TypingStoppedEvent = z.infer<typeof TypingStoppedEventSchema>;

// ---------------------------------------------------------------------------
// Event-name registry + typed payload map (the single socket surface)
// ---------------------------------------------------------------------------

/** Every server→client event name on the verified baseline (T3 §5.1). */
export const WS_SERVER_EVENTS = {
  conversationUpdated: 'conversation.updated',
  messageReceived: 'message.received',
  messageSent: 'message.sent',
  messageFailed: 'message.failed',
  connectionEstablished: 'connection.established',
  presenceUpdated: 'presence.updated',
  notificationReceived: 'notification.received',
  conversationReopened: 'conversation.reopened',
  messageRetryScheduled: 'message.retry.scheduled',
  queueMessageDlq: 'queue.message.dlq',
  typingStarted: 'typing.started',
  typingStopped: 'typing.stopped',
} as const;

export type WsServerEventName = (typeof WS_SERVER_EVENTS)[keyof typeof WS_SERVER_EVENTS];

/** Event name → wire payload type (flat or envelope per the schemas above). */
export interface WsEventPayloadMap {
  'conversation.updated': ConversationUpdatedEvent;
  'message.received': MessageReceivedEvent;
  'message.sent': MessageSentEvent;
  'message.failed': MessageFailedEvent;
  'connection.established': ConnectionEstablishedEvent;
  'presence.updated': PresenceUpdatedEvent;
  'notification.received': NotificationReceivedEvent;
  'conversation.reopened': ConversationReopenedEvent;
  'message.retry.scheduled': MessageRetryScheduledEvent;
  'queue.message.dlq': QueueMessageDlqEvent;
  'typing.started': TypingStartedEvent;
  'typing.stopped': TypingStoppedEvent;
}
