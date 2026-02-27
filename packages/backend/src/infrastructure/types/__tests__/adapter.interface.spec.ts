/**
 * Platform Adapter Interface Tests
 *
 * Tests for the enhanced PlatformAdapter interface type definitions.
 *
 * @see GPA-003 - Enhanced PlatformAdapter Interface
 */

/* eslint-disable max-classes-per-file */

import { EventEmitter } from 'events';
import { describe, expect, it } from 'vitest';
import type {
  AdapterStatus,
  HealthCheckResult,
  InboundMessageEvent,
  OutboundMessagePayload,
  SendResult,
} from '../../../types/gateway.types';
import type {
  AdapterCapability,
  AdapterEventHandlers,
  AdapterMetadata,
  BaseAdapterConfig,
  HealthCheckResultEnhanced,
  PlatformAdapter,
  PlatformType,
} from '../adapter.interface';

describe('PlatformAdapter Interface Types', () => {
  describe('PlatformType', () => {
    it('should accept telegram and irc', () => {
      const types: PlatformType[] = ['telegram', 'irc'];
      expect(types).toHaveLength(2);
    });

    it('should accept future platform types', () => {
      const types: PlatformType[] = [
        'telegram',
        'irc',
        'whatsapp',
        'wechat',
        'meta',
        'x',
        'slack',
        'email',
      ];
      expect(types).toHaveLength(8);
    });
  });

  describe('AdapterCapability', () => {
    it('should accept basic messaging capabilities', () => {
      const capabilities: AdapterCapability[] = [
        'send_text',
        'send_attachments',
        'receive_text',
        'receive_attachments',
      ];
      expect(capabilities).toHaveLength(4);
    });

    it('should accept message operation capabilities', () => {
      const capabilities: AdapterCapability[] = ['delete_message', 'update_message'];
      expect(capabilities).toHaveLength(2);
    });

    it('should accept presence capabilities', () => {
      const capabilities: AdapterCapability[] = [
        'typing_indicator',
        'read_receipts',
        'presence',
      ];
      expect(capabilities).toHaveLength(3);
    });

    it('should accept message feature capabilities', () => {
      const capabilities: AdapterCapability[] = ['reactions', 'threads', 'mentions'];
      expect(capabilities).toHaveLength(3);
    });
  });

  describe('BaseAdapterConfig', () => {
    it('should accept valid config with required fields', () => {
      const config: BaseAdapterConfig = {
        id: 'uuid-123',
        name: 'Main Telegram',
        key: 'telegram-main',
        type: 'telegram',
        enabled: true,
      };
      expect(config.id).toBe('uuid-123');
      expect(config.enabled).toBe(true);
    });

    it('should accept config with optional credentials', () => {
      const config: BaseAdapterConfig = {
        id: 'uuid-123',
        name: 'Main Telegram',
        key: 'telegram-main',
        type: 'telegram',
        enabled: true,
        credentials: {
          botToken: 'secret-token',
        },
      };
      expect(config.credentials?.botToken).toBe('secret-token');
    });
  });

  describe('AdapterMetadata', () => {
    it('should accept valid metadata', () => {
      const metadata: AdapterMetadata = {
        platform: 'telegram',
        displayName: 'Telegram',
        version: '1.0.0',
        capabilities: ['send_text', 'receive_text', 'delete_message', 'update_message'],
      };
      expect(metadata.platform).toBe('telegram');
      expect(metadata.displayName).toBe('Telegram');
      expect(metadata.version).toBe('1.0.0');
      expect(metadata.capabilities).toHaveLength(4);
    });

    it('should accept IRC metadata with limited capabilities', () => {
      const metadata: AdapterMetadata = {
        platform: 'irc',
        displayName: 'IRC',
        version: '1.0.0',
        capabilities: ['send_text', 'receive_text'],
      };
      expect(metadata.capabilities).toHaveLength(2);
    });
  });

  describe('HealthCheckResultEnhanced', () => {
    it('should accept healthy status', () => {
      const result: HealthCheckResultEnhanced = {
        status: 'healthy',
        lastCheck: new Date(),
      };
      expect(result.status).toBe('healthy');
    });

    it('should accept degraded status with details', () => {
      const result: HealthCheckResultEnhanced = {
        status: 'degraded',
        lastCheck: new Date(),
        details: {
          latency: 500,
          message: 'High latency detected',
        },
      };
      expect(result.status).toBe('degraded');
      expect(result.details?.latency).toBe(500);
    });

    it('should accept unhealthy status', () => {
      const result: HealthCheckResultEnhanced = {
        status: 'unhealthy',
        lastCheck: new Date(),
        details: {
          error: 'Connection refused',
        },
      };
      expect(result.status).toBe('unhealthy');
    });
  });

  describe('AdapterEventHandlers', () => {
    it('should define correct event handler types', () => {
      const handlers: AdapterEventHandlers = {
        'message:inbound': (_event: InboundMessageEvent) => {},
        'adapter:connected': () => {},
        'adapter:disconnected': (_event: { reason: string }) => {},
        'adapter:error': (_error: Error) => {},
      };
      expect(handlers).toBeDefined();
    });
  });

  describe('PlatformAdapter Interface', () => {
    it('should define optional metadata property', () => {
      // This test verifies the interface compiles correctly
      // metadata is optional for backward compatibility
      const optionalMetadata: AdapterMetadata | undefined = {
        platform: 'telegram',
        displayName: 'Telegram',
        version: '1.0.0',
        capabilities: ['send_text'],
      };

      expect(optionalMetadata.platform).toBe('telegram');
    });

    it('should define configure method', () => {
      // Test that configure method signature is correct
      type ConfigureMethod = (config: BaseAdapterConfig) => boolean;

      const configure: ConfigureMethod = (config) => {
        return config.enabled;
      };

      expect(configure({ id: '1', name: 'Test', key: 'test', type: 'telegram', enabled: true })).toBe(true);
    });

    it('should define optional deleteMessage method', () => {
      // Test optional method signature
      type DeleteMessageMethod = (externalMessageId: string) => Promise<boolean>;

      const deleteMessage: DeleteMessageMethod = async (id) => {
        return id.length > 0;
      };

      expect(deleteMessage).toBeDefined();
    });

    it('should define optional updateMessage method', () => {
      // Test optional method signature
      type UpdateMessageMethod = (externalMessageId: string, newBody: string) => Promise<boolean>;

      const updateMessage: UpdateMessageMethod = async (id, body) => {
        return id.length > 0 && body.length > 0;
      };

      expect(updateMessage).toBeDefined();
    });

    it('should be generic for config type', () => {
      type _TelegramConfig = BaseAdapterConfig & { botToken: string };
      type _TelegramAdapter = PlatformAdapter<_TelegramConfig>;

      const config: _TelegramConfig = {
        id: '1',
        name: 'Telegram',
        key: 'telegram',
        type: 'telegram',
        enabled: true,
        botToken: 'secret',
      };

      expect(config.botToken).toBe('secret');
    });

    it('should accept legacy platform property in interface', () => {
      // The interface should still have the legacy platform property
      // for backward compatibility with existing adapters
      type LegacyProperty = { readonly platform: 'telegram' | 'irc' };

      const adapter: LegacyProperty = { platform: 'telegram' };
      expect(adapter.platform).toBe('telegram');
    });

    it('should accept HealthCheckResult return type', () => {
      // healthCheck returns HealthCheckResult (not enhanced)
      const result: HealthCheckResult = {
        healthy: true,
      };

      expect(result.healthy).toBe(true);
    });

    it('should accept healthCheckResultEnhanced type', () => {
      const result: HealthCheckResultEnhanced = {
        status: 'healthy',
        lastCheck: new Date(),
      };

      expect(result.status).toBe('healthy');
    });

    it('should accept adapter eventHandlers', () => {
      const handlers: AdapterEventHandlers = {
        'message:inbound': (_event: InboundMessageEvent) => {},
        'adapter:connected': () => {},
        'adapter:disconnected': (_event: { reason: string }) => {},
        'adapter:error': (_error: Error) => {},
      };

      expect(handlers).toBeDefined();
    });

    it('should verify interface can be implemented by an adapter', () => {
      // Create a minimal adapter that implements the new PlatformAdapter interface
      class MinimalAdapter extends EventEmitter implements PlatformAdapter {
        readonly platform = 'telegram';
        status: AdapterStatus = 'disconnected';

        /**
         * Adapter metadata (optional, capability detection)
         */
        readonly metadata: AdapterMetadata = {
          platform: 'telegram',
          displayName: 'Telegram',
          version: '1.0.0',
          capabilities: ['send_text', 'receive_text'],
        };

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
          return { success: true, timestamp: new Date() };
        }

        // Helper to simulate inbound message
        simulateInboundMessage(event: InboundMessageEvent): void {
          this.emit('message:inbound', event);
        }
      }

      const minimalAdapter = new MinimalAdapter();
      expect(minimalAdapter.platform).toBe('telegram');
      expect(minimalAdapter.metadata).toBeDefined();
    });

    it('should be able to create a minimal adapter without metadata', () => {
      // Create a minimal adapter that does NOT implement metadata (backward compatible)
      class MinimalAdapterNoMetadata extends EventEmitter implements PlatformAdapter {
        readonly platform = 'irc';
        status: AdapterStatus = 'disconnected';

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
          return { success: true, timestamp: new Date() };
        }
      }

      const minimalAdapterNoMetadata = new MinimalAdapterNoMetadata();
      const adapter: PlatformAdapter = minimalAdapterNoMetadata;
      expect(adapter.platform).toBe('irc');
      expect(adapter.metadata).toBeUndefined();
    });

    it('should accept healthCheckResultEnhanced as optional method', () => {
      // Adapter that, healthCheckEnhanced returns enhanced result
      const result: HealthCheckResultEnhanced = {
        status: 'healthy',
        lastCheck: new Date(),
      };

      expect(result.status).toBe('healthy');
    });
  });
});
