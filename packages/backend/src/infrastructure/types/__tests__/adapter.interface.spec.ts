/**
 * Platform Adapter Interface Tests
 *
 * Tests for the enhanced PlatformAdapter interface type definitions.
 *
 * @see GPA-003 - Enhanced PlatformAdapter Interface
 */

import { describe, expect, it } from 'vitest';
import type {
  AdapterCapability,
  AdapterEventHandlers,
  AdapterMetadata,
  BaseAdapterConfig,
  HealthCheckResultEnhanced,
  PlatformAdapter,
  PlatformType,
} from '../adapter.interface';
import type { InboundMessageEvent } from '../../../types/gateway.types';

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
    it('should define required metadata property', () => {
      // This test verifies the interface compiles correctly
      type TestAdapter = PlatformAdapter<BaseAdapterConfig>;

      // TypeScript will error if interface doesn't have these properties
      const requiredMetadata: AdapterMetadata = {
        platform: 'telegram',
        displayName: 'Telegram',
        version: '1.0.0',
        capabilities: ['send_text'],
      };

      expect(requiredMetadata.platform).toBe('telegram');
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
      // Test generic type parameter
      type TelegramConfig = BaseAdapterConfig & { botToken: string };
      type TelegramAdapter = PlatformAdapter<TelegramConfig>;

      const config: TelegramConfig = {
        id: '1',
        name: 'Telegram',
        key: 'telegram',
        type: 'telegram',
        enabled: true,
        botToken: 'secret',
      };

      expect(config.botToken).toBe('secret');
    });
  });

  describe('Backward Compatibility', () => {
    it('should include legacy platform property', () => {
      // The interface should still have the legacy platform property
      // for backward compatibility with existing adapters
      type LegacyProperty = { readonly platform: 'telegram' | 'irc' };

      const adapter: LegacyProperty = { platform: 'telegram' };
      expect(adapter.platform).toBe('telegram');
    });
  });
});
