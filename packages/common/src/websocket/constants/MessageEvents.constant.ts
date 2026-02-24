/**
 * Message WebSocket Events
 *
 * Events related to message lifecycle: received, sent, failed
 *
 * @module @yacc/common/websocket/constants
 */

/** Message received from external platform (Telegram, IRC) */
export const MESSAGE_RECEIVED = 'message.received';

/** Message sent successfully to external platform */
export const MESSAGE_SENT = 'message.sent';

/** Message failed to send to external platform */
export const MESSAGE_FAILED = 'message.failed';
