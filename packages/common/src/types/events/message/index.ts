/**
 * Message Event Types
 *
 * WebSocket events related to message lifecycle:
 * - message.received: New inbound message arrives
 * - message.sent: Outbound message successfully delivered
 * - message.failed: Outbound message delivery failed
 *
 * @module @yacc/common/types/events/message
 */

export type { MessageReceivedEvent, MessageReceivedPayload } from './message-received.event';
export type { MessageSentEvent, MessageSentPayload } from './message-sent.event';
export type { MessageFailedEvent, MessageFailedPayload } from './message-failed.event';
