import { z } from 'zod';

/**
 * Raw WebSocket wire contracts (R1 target — FROZEN contract, ADR-023).
 *
 * Encoded 1:1 from the frozen `.docs/migration/asyncapi.yaml` +
 * `.docs/migration/schemas/*.json` (GOV-038 — the frozen files are
 * read-only; this local contract layer mirrors them, never redefines):
 *
 * - EVERY server→client frame carries the frozen `{event, data,
 *   timestamp}` envelope (`schemas/envelope.schema.json`; ADR-026). The
 *   Node-baseline flat/enveloped duality (T3-G5 / U3) is SUPERSEDED as
 *   wire truth by SPEC-003 §Java Baseline Approval R1 — there is one
 *   frame shape, and the per-channel `data` payload is what the frozen
 *   per-event schemas describe.
 * - The canonical subscribe-side listener set = the 9 channels the
 *   verified React frontend consumed (T3 §5.1 / `socketListeners.ts`) +
 *   the 7 `system.*` channels the frozen target wires (ADR-026
 *   application-level resilience; `contract-canonicalization.md` §4.3).
 * - Frozen dispositions mirrored, never resolved here:
 *   `notification.deleted` / `notification.read` /
 *   `notification.dismissed` are `retained-no-emitter`
 *   (parity-of-absence — no listener is registered and no coverage is
 *   claimed; wiring them is a founder decision, U1). `conversation.
 *   reopened` (U2) is a declared frozen channel with no pinned payload
 *   shape — its known members are encoded optional. The queue channels
 *   (`message.retry.scheduled`, `queue.message.dlq`) stay unconsumed
 *   (verified React baseline consumed neither).
 * - No `eventId` field exists on the wire (T3-G10) and none is depended
 *   on. There are NO client→server contracts here: the real-time surface
 *   is inbound-only (T2 B14 / T3-G10; ARCH-005 boundary 2) — the client
 *   sends nothing.
 * - `presence.updated` data is the MIG-003 canonical shape
 *   `{userId, status: online|offline, lastSeen}` — the retired
 *   `{userId, isOnline, timestamp}` disconnect variant and the richer
 *   React listener type (T3-G4) are NOT encoded.
 */

// ---------------------------------------------------------------------------
// Frozen envelope (schemas/envelope.schema.json)
// ---------------------------------------------------------------------------

/** The ONE server→client frame shape: `{event, data, timestamp}`. */
export const WsEnvelopeSchema = z.object({
  event: z.string(),
  data: z.unknown(),
  timestamp: z.string(),
});

export type WsEnvelope = z.infer<typeof WsEnvelopeSchema>;

// ---------------------------------------------------------------------------
// Per-channel `data` payloads (frozen schemas/*.json, verbatim members)
// ---------------------------------------------------------------------------

/** `conversation.updated` data (schemas/conversation-updated.schema.json). */
export const ConversationUpdatedPayloadSchema = z.object({
  conversationId: z.string().uuid(),
  updatedFields: z.record(z.string(), z.unknown()),
  changedBy: z.string(),
  changedAt: z.string(),
});
export type ConversationUpdatedPayload = z.infer<typeof ConversationUpdatedPayloadSchema>;

/**
 * `conversation.reopened` data (frozen payload: `additionalProperties:
 * true`, no required members — the shape is NOT pinned; U2 emitter
 * decision is open). The declared members are encoded optional so the
 * frozen "no required fields" truth holds while known members stay
 * visible; the handler consumes `conversationId` only when present.
 */
export const ConversationReopenedPayloadSchema = z
  .object({
    conversationId: z.string().uuid(),
    reason: z.string(),
  })
  .partial()
  .passthrough();
export type ConversationReopenedPayload = z.infer<typeof ConversationReopenedPayloadSchema>;

/** `message.received` data (schemas/message-received.schema.json). */
export const MessageReceivedPayloadSchema = z.object({
  messageId: z.string().uuid(),
  conversationId: z.string().uuid(),
  platform: z.enum(['telegram', 'irc']),
  senderId: z.string().min(1),
  senderName: z.string().min(1),
  body: z.string().min(1),
  timestamp: z.string(),
  attachments: z
    .array(z.object({ url: z.string(), type: z.string(), name: z.string() }))
    .optional(),
});
export type MessageReceivedPayload = z.infer<typeof MessageReceivedPayloadSchema>;

/** `message.sent` data (schemas/message-sent.schema.json). */
export const MessageSentPayloadSchema = z.object({
  messageId: z.string().uuid(),
  conversationId: z.string().uuid(),
  status: z.literal('sent'),
  sentAt: z.string(),
});
export type MessageSentPayload = z.infer<typeof MessageSentPayloadSchema>;

/** `message.failed` data (schemas/message-failed.schema.json). */
export const MessageFailedPayloadSchema = z.object({
  messageId: z.string().uuid(),
  conversationId: z.string().uuid(),
  status: z.literal('failed'),
  error: z.string(),
  retryAt: z.string(),
  attempt: z.number().int().min(1).max(3),
});
export type MessageFailedPayload = z.infer<typeof MessageFailedPayloadSchema>;

/**
 * `presence.updated` data (schemas/presence-updated.schema.json — the
 * MIG-003 canonical shape, incl. the disconnect path).
 */
export const PresenceUpdatedPayloadSchema = z.object({
  userId: z.string().uuid(),
  status: z.enum(['online', 'offline']),
  lastSeen: z.string(),
});
export type PresenceUpdatedPayload = z.infer<typeof PresenceUpdatedPayloadSchema>;

/** `typing.started` data (schemas/typing-started.schema.json — `name`). */
export const TypingStartedPayloadSchema = z.object({
  conversationId: z.string().uuid(),
  userId: z.string().uuid(),
  name: z.string().min(1),
});
export type TypingStartedPayload = z.infer<typeof TypingStartedPayloadSchema>;

/** `typing.stopped` data (schemas/typing-stopped.schema.json). */
export const TypingStoppedPayloadSchema = z.object({
  conversationId: z.string().uuid(),
  userId: z.string().uuid(),
});
export type TypingStoppedPayload = z.infer<typeof TypingStoppedPayloadSchema>;

/**
 * `notification.received` data (schemas/notification.schema.json — wire
 * enum `assignment|mention|system`). The sibling channels
 * `notification.deleted` / `notification.read` /
 * `notification.dismissed` are `retained-no-emitter` (frozen
 * `x-disposition`): no schema is encoded here because no listener exists
 * (parity-of-absence, U1).
 */
export const NotificationPayloadSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  type: z.enum(['assignment', 'mention', 'system']),
  conversationId: z.string().uuid(),
  actorId: z.string(),
  actorName: z.string(),
  message: z.string(),
  isRead: z.boolean(),
  createdAt: z.string(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type NotificationPayload = z.infer<typeof NotificationPayloadSchema>;

/**
 * `system.*` data (schemas/system-payload.schema.json) — shared by the
 * seven wired system channels.
 */
export const SystemPayloadSchema = z.object({
  type: z.enum(['heartbeat', 'connection_established', 'reconnection', 'error', 'backlog_replay']),
  timestamp: z.string(),
  data: z.record(z.string(), z.unknown()).optional(),
  error: z.object({ code: z.string(), message: z.string() }).optional(),
});
export type SystemPayload = z.infer<typeof SystemPayloadSchema>;

// ---------------------------------------------------------------------------
// Listener registry (the fixed inbound surface) + typed fan-out map
// ---------------------------------------------------------------------------

/** Every channel the raw-WS event router recognizes (the fixed set). */
export const WS_SERVER_EVENTS = {
  conversationUpdated: 'conversation.updated',
  conversationReopened: 'conversation.reopened',
  messageReceived: 'message.received',
  messageSent: 'message.sent',
  messageFailed: 'message.failed',
  typingStarted: 'typing.started',
  typingStopped: 'typing.stopped',
  presenceUpdated: 'presence.updated',
  notificationReceived: 'notification.received',
  systemConnectionEstablished: 'system.connection.established',
  systemReconnectionStarted: 'system.reconnection.started',
  systemReconnectionFailed: 'system.reconnection.failed',
  systemHeartbeat: 'system.heartbeat',
  systemError: 'system.error',
  systemBacklogReplayStarted: 'system.backlog.replay.started',
  systemBacklogReplayCompleted: 'system.backlog.replay.completed',
} as const;

export type WsServerEventName = (typeof WS_SERVER_EVENTS)[keyof typeof WS_SERVER_EVENTS];

/** Channel name → envelope `data` payload type (frozen per-channel shape). */
export interface WsEventPayloadMap {
  'conversation.updated': ConversationUpdatedPayload;
  'conversation.reopened': ConversationReopenedPayload;
  'message.received': MessageReceivedPayload;
  'message.sent': MessageSentPayload;
  'message.failed': MessageFailedPayload;
  'typing.started': TypingStartedPayload;
  'typing.stopped': TypingStoppedPayload;
  'presence.updated': PresenceUpdatedPayload;
  'notification.received': NotificationPayload;
  'system.connection.established': SystemPayload;
  'system.reconnection.started': SystemPayload;
  'system.reconnection.failed': SystemPayload;
  'system.heartbeat': SystemPayload;
  'system.error': SystemPayload;
  'system.backlog.replay.started': SystemPayload;
  'system.backlog.replay.completed': SystemPayload;
}
