import type { Platform } from './Platform.type';
import type { ConnectorConfig } from './ConnectorConfig.type';
import type { ConnectionInfo } from './ConnectionInfo.interface';
import type { SendMessageRequest } from './SendMessageRequest.interface';
import type { SendMessageResponse } from './SendMessageResponse.interface';
import type { ValidationError } from './ValidationError.interface';

export interface IConnector<T extends Platform = Platform> {
  platform: T;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  sendMessage(request: SendMessageRequest): Promise<SendMessageResponse>;
  getConnectionStatus(): ConnectionInfo;
  validateConfig(config: ConnectorConfig<T>): Promise<ValidationError[]>;
}
