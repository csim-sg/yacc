/**
 * Connection Info Interface
 *
 * Information about a platform connector's connection state
 */

export interface ConnectionInfo {
  platform: string;
  status: string;
  connectedAt?: Date;
  disconnectedAt?: Date;
  lastActivityAt?: Date;
  error?: string | null;
  reconnectAttempts?: number;
}
