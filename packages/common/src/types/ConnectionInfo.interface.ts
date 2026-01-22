import type { ConnectorStatus } from './ConnectorStatus.type';

export interface ConnectionInfo {
  status: ConnectorStatus;
  lastConnectedAt?: Date;
  lastDisconnectedAt?: Date;
  reconnectAttempts: number;
  errorMessage?: string;
}
