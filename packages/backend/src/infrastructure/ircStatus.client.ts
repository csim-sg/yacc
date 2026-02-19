/**
 * IRC Connection Status Singleton
 *
 * Tracks IRC connection state in runtime memory.
 * Provides centralized status tracking for INT-005 and INT-009.
 *
 * Architecture:
 * - Singleton pattern: single instance per process
 * - Runtime memory storage: no DB persistence for MVP
 * - Status transitions managed by IRC connector
 * - Exposed via /integrations/irc/status endpoint
 */

import type { IRCConnectionStatusModel, IRCConnectionStatus } from '@yacc/common/types/irc-integration.types';

export class IRCStatusClient {
  private static instance: IRCStatusClient;

  // In-memory status storage
  private status: IRCConnectionStatusModel;

  // ==========================================
  // Singleton Pattern
  // ==========================================

  private constructor() {
    this.status = {
      status: 'disconnected',
      attemptCount: 0,
      lastChangedAt: new Date().toISOString(),
      lastConnectedAt: null,
      lastError: null,
    };
  }

  public static getInstance(): IRCStatusClient {
    if (!IRCStatusClient.instance) {
      IRCStatusClient.instance = new IRCStatusClient();
    }
    return IRCStatusClient.instance;
  }

  // ==========================================
  // Public API
  // ==========================================

  /**
   * Get current IRC connection status
   */
  public getStatus(): IRCConnectionStatusModel {
    return { ...this.status };
  }

  /**
   * Update connection status (called by IRC connector on state changes)
   *
   * @param newStatus - New connection state
   * @param error - Sanitized error message (if any)
   * @param reconnectIncidentId - Stable incident ID for retry sequence
   */
  public setStatus(
    newStatus: IRCConnectionStatus,
    error: string | null = null,
    reconnectIncidentId?: string
  ): void {
    this.status = {
      status: newStatus,
      attemptCount: this.calculateAttemptCount(newStatus),
      lastChangedAt: new Date().toISOString(),
      lastConnectedAt: newStatus === 'connected' ? new Date().toISOString() : this.status.lastConnectedAt,
      lastError: error || null,
      reconnectIncidentId: reconnectIncidentId || this.status.reconnectIncidentId,
    };
  }

  /**
   * Update reconnection attempt count
   * Called when IRC connector enters a new retry attempt
   *
   * @param attemptCount - Current attempt number (1-5)
   * @param reconnectIncidentId - Unique identifier for this incident
   */
  public setAttemptCount(attemptCount: number, reconnectIncidentId: string): void {
    this.status = {
      ...this.status,
      attemptCount,
      reconnectIncidentId,
      lastChangedAt: new Date().toISOString(),
    };
  }

  /**
   * Set status to 'retrying' with attemptCount=0 (manual connect reset)
   * Used for INT-007 manual connect endpoint to force clean retry sequence
   * Ignores any prior attempt count, always sets to 0
   */
  public setManualRetrying(): void {
    this.status = {
      status: 'retrying',
      attemptCount: 0,
      lastChangedAt: new Date().toISOString(),
      lastConnectedAt: this.status.lastConnectedAt,
      lastError: null,
      reconnectIncidentId: this.status.reconnectIncidentId,
    };
  }

  /**
   * Mark max reconnection attempts exhausted
   * Transitions status from 'retrying' to 'failed'
   */
  public markMaxAttemptsExhausted(): void {
    this.status = {
      ...this.status,
      status: 'failed',
      lastChangedAt: new Date().toISOString(),
    };
  }

  /**
   * Reset status to disconnected (clears attempt count and incident ID)
   * Called when manual reconnect is triggered or config changes
   */
  public reset(): void {
    this.status = {
      status: 'disconnected',
      attemptCount: 0,
      lastChangedAt: new Date().toISOString(),
      lastConnectedAt: this.status.lastConnectedAt,
      lastError: null,
      // Keep incident ID for audit trail
    };
  }

  // ==========================================
  // Private Helpers
  // ==========================================

  /**
   * Calculate attempt count based on status
   * Returns 0 for connected/disconnected, preserves value for retrying/failed
   */
  private calculateAttemptCount(newStatus: IRCConnectionStatus): number {
    if (newStatus === 'connected') {
      return 0;
    }
    if (newStatus === 'disconnected') {
      return 0;
    }
    // For 'retrying' and 'failed', preserve current count
    return this.status.attemptCount;
  }
}

/**
 * Exported singleton instance
 * Use: ircStatusClient.getStatus(), ircStatusClient.setStatus(), etc.
 */
export const ircStatusClient = IRCStatusClient.getInstance();
