/**
 * System WebSocket Events
 *
 * Events related to connection lifecycle and system operations
 *
 * @module @yacc/common/websocket/constants
 */

/** WebSocket connection established */
export const CONNECTION_ESTABLISHED = 'system.connection.established';

/** Reconnection attempt started */
export const RECONNECTION_STARTED = 'system.reconnection.started';

/** Reconnection failed after max attempts */
export const RECONNECTION_FAILED = 'system.reconnection.failed';

/** Heartbeat received from server */
export const HEARTBEAT_RECEIVED = 'system.heartbeat';

/** System error occurred */
export const ERROR_OCCURRED = 'system.error';

/** Backlog replay started (for missed events) */
export const BACKLOG_REPLAY_STARTED = 'system.backlog.replay.started';

/** Backlog replay completed */
export const BACKLOG_REPLAY_COMPLETED = 'system.backlog.replay.completed';
