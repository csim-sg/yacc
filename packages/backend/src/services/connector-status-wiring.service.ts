/**
 * Connector Status Wiring Service
 *
 * Connects connector events (from connectorManager) to ircStatusClient
 * Ensures GET /api/integrations/irc/status reflects real connector state
 *
 * Idempotent: Safe to call multiple times; prevents duplicate event listeners
 */

import { ircStatusClient } from '../infrastructure/ircStatus.client';
import { logger } from '../infrastructure/logger';
import { connectorManager } from './connector-manager';

/**
 * Track if wiring has already been done (prevent duplicate listeners)
 */
let isWired = false;

export function wireConnectorStatusEvents(): void {
  // Idempotent: skip if already wired
  if (isWired) {
    logger.debug({ platform: 'irc' }, 'Connector status wiring already applied');
    return;
  }

  const ircConnector = connectorManager.getConnector('irc');
  if (!ircConnector) {
    logger.debug({ platform: 'irc' }, 'IRC connector not registered yet; wiring deferred');
    return;
  }

  // Wire 'connected' event
  ircConnector.on('connected', () => {
    logger.info({ platform: 'irc' }, 'IRC connector connected - updating status');
    ircStatusClient.setStatus('connected', null, undefined);
  });

  // Wire 'disconnected' event
  ircConnector.on('disconnected', () => {
    logger.info({ platform: 'irc' }, 'IRC connector disconnected - updating status');
    ircStatusClient.setStatus('disconnected', null, undefined);
  });

  // Wire error event
  ircConnector.on('error', (error: Error) => {
    logger.error(
      { platform: 'irc', error: error.message },
      'IRC connector error - updating status to failed'
    );
    // Sanitize error message to avoid exposing sensitive data
    const sanitizedMessage = error.message.substring(0, 100);
    ircStatusClient.setStatus('failed', sanitizedMessage, undefined);
  });

  isWired = true;
  logger.info({ platform: 'irc' }, 'Connector status events wired to ircStatusClient');
}

export const connectorStatusWiring = {
  wire: wireConnectorStatusEvents,
};
