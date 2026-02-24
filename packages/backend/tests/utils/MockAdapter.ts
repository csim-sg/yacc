/**
 * Mock adapter for testing Gateway Exchange and message flow
 */

import { EventEmitter } from 'events';
import type { PlatformAdapter } from '../../src/infrastructure/types/adapter.interface';
import type {
  InboundMessageEvent,
  OutboundMessagePayload,
  Platform,
  SendResult,
} from '../../src/types/gateway.types';

/**
 * Mock adapter for testing
 */
export class MockAdapter extends EventEmitter implements PlatformAdapter {
  readonly platform: Platform = 'irc';
  status: 'disconnected' | 'connecting' | 'connected' | 'error' = 'disconnected';
  private sendResult: SendResult = { success: true, timestamp: new Date() };

  setSendResult(result: SendResult): void {
    this.sendResult = result;
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

  async healthCheck(): Promise<{ healthy: boolean; details?: string }> {
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
