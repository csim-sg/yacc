/**
 * IRC Integration Service
 *
 * Handles IRC-specific operations and status retrieval.
 * Used by INT-009 endpoint to expose connection status.
 */

import type { IRCConnectionStatusModel } from '@yacc/common/types/irc-integration.types';
import { ircStatusClient } from '../infrastructure/ircStatus.client';
import { logger } from '../infrastructure/logger';

export class IRCIntegrationService {
  /**
   * Get current IRC connection status
   *
   * Returns the in-memory status from IRC status client.
   * Works even when IRC is unconfigured (returns meaningful validation result).
   *
   * @returns Current IRC connection status model
   */
  public getConnectionStatus(): IRCConnectionStatusModel {
    try {
      const status = ircStatusClient.getStatus();
      logger.debug(
        { platform: 'irc', status: status.status, attemptCount: status.attemptCount },
        'Retrieved IRC connection status'
      );
      return status;
    } catch (error) {
      logger.error(
        { error, platform: 'irc' },
        'Failed to retrieve IRC connection status'
      );
      // Return default disconnected status on error
      return {
        status: 'disconnected',
        attemptCount: 0,
        lastChangedAt: new Date().toISOString(),
        lastConnectedAt: null,
        lastError: 'Failed to retrieve status',
      };
    }
  }
}

/**
 * Exported singleton service instance
 * Use: ircIntegrationService.getConnectionStatus()
 */
export const ircIntegrationService = new IRCIntegrationService();
