/**
 * Presence WebSocket Events
 *
 * Events related to user presence and typing indicators
 *
 * @module @yacc/common/websocket/constants
 */

/** User presence status updated (online/offline/away) */
export const PRESENCE_UPDATED = 'presence.updated';

/** User started typing in a conversation */
export const TYPING_STARTED = 'typing.started';

/** User stopped typing in a conversation */
export const TYPING_STOPPED = 'typing.stopped';

/** User came online */
export const USER_ONLINE = 'user.online';

/** User went offline */
export const USER_OFFLINE = 'user.offline';
