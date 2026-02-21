/**
 * Conversation WebSocket Events
 *
 * Events related to conversation lifecycle: updated, reopened
 *
 * @module @yacc/common/websocket/constants
 */

/** Conversation was updated (status/priority/assignment changes) */
export const CONVERSATION_UPDATED = 'conversation.updated';

/** Conversation was reopened (status changed from resolved) */
export const CONVERSATION_REOPENED = 'conversation.reopened';
