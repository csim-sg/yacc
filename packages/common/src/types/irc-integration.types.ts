/**
 * IRC Integration Status Types
 *
 * Type definitions for IRC connection status tracking.
 * Used by INT-005 (status model) and INT-009 (status endpoint).
 */

/**
 * IRC Connection Status States
 *
 * - `connected`: Successfully connected to IRC server
 * - `retrying`: Attempting to reconnect after disconnection (exponential backoff)
 * - `disconnected`: Not connected, awaiting retry or manual intervention
 * - `failed`: Max reconnection attempts exhausted (5 attempts per incident)
 */
export type IRCConnectionStatus = 'connected' | 'retrying' | 'disconnected' | 'failed';

/**
 * IRC Connection Status Model
 *
 * Tracks the real-time state of IRC connection.
 * Stored in runtime memory (no DB persistence for MVP).
 * Exposed via GET /integrations/irc/status endpoint.
 */
export interface IRCConnectionStatusModel {
  /**
   * Current connection state
   */
  status: IRCConnectionStatus;

  /**
   * Number of reconnection attempts in current incident (0-5)
   * Resets to 0 on successful connection
   */
  attemptCount: number;

  /**
   * ISO-8601 timestamp of last status change
   */
  lastChangedAt: string;

  /**
   * ISO-8601 timestamp of last successful connection
   * Null if never connected
   */
  lastConnectedAt: string | null;

  /**
   * Sanitized error message (no secrets exposed)
   * Null if no error
   */
  lastError: string | null;

  /**
   * Unique identifier for the current reconnection incident
   * Stable across attempts 1-5 of the same disconnection event
   * Reset when connection succeeds
   * Optional (only present when status = 'retrying' or 'failed')
   */
  reconnectIncidentId?: string;
}
