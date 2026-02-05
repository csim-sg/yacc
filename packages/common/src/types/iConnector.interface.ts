/**
 * IConnector Interface
 *
 * Contract for platform connectors
 */

import type { ConnectorStatus } from './connectorStatus.type';
import type { Platform } from './platform.type';
import type { SendMessageRequest } from './sendMessageRequest.interface';
import type { SendMessageResponse } from './sendMessageResponse.interface';

export interface IConnector<T extends Platform = Platform> {
  platform: T;
  status: ConnectorStatus;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  sendMessage(request: SendMessageRequest): Promise<SendMessageResponse>;
  getConnectionInfo(): any;
  validateConfig(config: any): Promise<any>;
}
