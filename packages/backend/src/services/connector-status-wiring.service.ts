/**
 * Connector Status Wiring Service
 *
 * Connects connector events (from connectorManager) to ircStatusClient
 * Ensures GET /api/integrations/irc/status reflects real connector state
 */

import { connectorManager } from './connector-manager';
import { ircStatusClient } from '../infrastructure/ircStatus.client';
import { logger } from '../infrastructure/logger';

export function wireConnectorStatusEvents(): void {
  const ircConnector = connectorManager.getConnector('irc');
  if (!ircConnector) {
    logger.debug({ platform: 'irc' }, 'IRC connector not registered yet');
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

  logger.info({ platform: 'irc' }, 'Connector status events wired to ircStatusClient');
}

export const connectorStatusWiring = {
  wire: wireConnectorStatusEvents,
};
