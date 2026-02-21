/**
 * System Payload Types
 *
 * Type definitions for system-related WebSocket event payloads
 *
 * @module @yacc/common/websocket/types
 */

/** System event type */
export type SystemEventType = 
  | 'heartbeat' 
  | 'connection_established' 
  | 'reconnection' 
  | 'error' 
  | 'backlog_replay';

/** Error details for system errors */
export interface SystemError {
  code: string;
  message: string;
}

/**
 * System payload for WebSocket events
 *
 * Used for:
 * - system.heartbeat: Server heartbeat
 * - system.connection.established: Connection confirmed
 * - system.reconnection.*: Reconnection lifecycle events
 * - system.error: System-level errors
 * - system.backlog.replay.*: Backlog replay events
 */
export interface SystemPayload {
  /** Type of system event */
  type: SystemEventType;

  /** ISO 8601 timestamp of event */
  timestamp: string;

  /** Optional event data */
  data?: Record<string, unknown>;

  /** Error details if type is 'error' */
  error?: SystemError;
}
