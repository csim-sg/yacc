/**
 * Mock adapter for testing Gateway Exchange and message flow
 */

import { EventEmitter } from 'events';
import type {
  AdapterMetadata,
  BaseAdapterConfig,
  PlatformAdapter,
} from '../../src/infrastructure/types/adapter.interface';
import type {
  HealthCheckResult,
  InboundMessageEvent,
  OutboundMessagePayload,
  SendResult,
} from '../../src/types/gateway.types';

/**
 * Mock adapter for testing
 */
export class MockAdapter extends EventEmitter implements PlatformAdapter {
  readonly platform = 'irc';
  status: 'disconnected' | 'connecting' | 'connected' | 'error' = 'disconnected';

  /**
   * Adapter metadata for testing
   */
  readonly metadata: AdapterMetadata = {
    platform: 'irc',
    displayName: 'Mock IRC',
    version: '1.0.0-test',
    capabilities: ['send_text', 'receive_text'],
  };

  private sendResult: SendResult = { success: true, timestamp: new Date() };

  setSendResult(result: SendResult): void {
    this.sendResult = result;
  }

  /**
   * Configure adapter (optional interface method)
   */
  configure(_config: BaseAdapterConfig): boolean {
    return true;
  }

  async connect(): Promise<void> {
    this.status = 'connecting';
    this.status = 'connected';
    this.emit('adapter:connected');
  }

  async disconnect(): Promise<void> {
    this.status = 'disconnected';
    this.emit('adapter:disconnected', { reason: 'manual' });
  }

  async healthCheck(): Promise<HealthCheckResult> {
    return { healthy: this.status === 'connected' };
  }

  async send(_message: OutboundMessagePayload): Promise<SendResult> {
    return this.sendResult;
  }

  // Helper to simulate inbound message
  simulateInboundMessage(event: InboundMessageEvent): void {
    this.emit('message:inbound', event);
  }
}
