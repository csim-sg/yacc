/**
 * Connector Event Map Type
 *
 * Events emitted by connectors
 */

export type ConnectorEventMap = {
  connected: [];
  disconnected: [];
  message: [any];
  error: [Error];
};
