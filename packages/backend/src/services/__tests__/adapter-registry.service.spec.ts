/**
 * Adapter Registry Service Tests
 *
 * Unit tests for the AdapterRegistry service.
 *
 * @see GPA-004 - AdapterRegistry Service
 */

// Set environment variables before any imports
process.env.DATABASE_URL = 'postgresql://yacc_user:yacc_password@localhost:5432/yacc_inbox';
process.env.BETTER_AUTH_SECRET = 'test-secret-key-for-better-auth-12345';
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-12345';
process.env.CLOUDFLARE_R2_ENDPOINT = 'https://test.r2.cloudflarestorage.com';
process.env.CLOUDFLARE_R2_ACCESS_KEY = 'test-access-key';
process.env.CLOUDFLARE_R2_SECRET_KEY = 'test-secret-key';
process.env.CLOUDFLARE_R2_BUCKET = 'yacc-test';
process.env.APP_FRONTEND_URL = 'http://localhost:3000';
process.env.RESET_PASSWORD_URL = 'http://localhost:3000/reset-password';
process.env.NODE_ENV = 'test';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  BaseAdapterConfig,
  HealthCheckResultEnhanced,
  PlatformAdapter,
  AdapterMetadata,
} from '../../infrastructure/types/adapter.interface';
import type { SendResult } from '../../types/gateway.types';
import { AdapterRegistry } from '../adapter-registry.service';
import { gatewayHooks } from '../gateway-hooks';

/**
 * Mock adapter for testing
 */
function createMockAdapter(
  platformType: 'telegram' | 'irc',
  options: { initialStatus?: 'disconnected' | 'connected'; connectShouldFail?: boolean; configureShouldFail?: boolean } = {}
): PlatformAdapter {
  const { initialStatus = 'disconnected', connectShouldFail = false, configureShouldFail = false } = options;

  let status: 'disconnected' | 'connected' | 'connecting' | 'error' = initialStatus;

  const metadata: AdapterMetadata = {
    platform: platformType,
    displayName: platformType === 'telegram' ? 'Telegram' : 'IRC',
    version: '1.0.0',
    capabilities: platformType === 'telegram'
      ? ['send_text', 'receive_text', 'delete_message', 'update_message']
      : ['send_text', 'receive_text'],
  };

  const mockImpl = {
    get metadata() {
      return metadata;
    },
    get platform() {
      return platformType;
    },
    get status() {
      return status;
    },
    configure: vi.fn((_config: BaseAdapterConfig) => {
      if (configureShouldFail) {
        return false;
      }
      return true;
    }),
    connect: vi.fn(async () => {
      if (connectShouldFail) {
        status = 'error';
        throw new Error('Connection failed');
      }
      status = 'connected';
    }),
    disconnect: vi.fn(async () => {
      status = 'disconnected';
    }),
    healthCheck: vi.fn(async (): Promise<HealthCheckResultEnhanced> => ({
      healthy: status === 'connected',
      lastCheck: new Date(),
    })),
    send: vi.fn(async (): Promise<SendResult> => ({
      success: true,
      timestamp: new Date(),
    })),
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
    addListener: vi.fn(),
    once: vi.fn(),
    removeListener: vi.fn(),
    removeAllListeners: vi.fn(),
    setMaxListeners: vi.fn(),
    getMaxListeners: vi.fn(),
    listeners: vi.fn(() => []),
    rawListeners: vi.fn(() => []),
    eventNames: vi.fn(() => []),
    listenerCount: vi.fn(() => 0),
    prependListener: vi.fn(),
    prependOnceListener: vi.fn(),
  };

  return mockImpl as unknown as PlatformAdapter;
}

describe('AdapterRegistry Service', () => {
  let registry: AdapterRegistry;
  let doSpy: ReturnType<typeof vi.spyOn>;
  let onSpy: ReturnType<typeof vi.spyOn>;
  let offSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    registry = new AdapterRegistry();
    // Clear all hooks before each test
    gatewayHooks.clearAll();
    // Create spies on the real methods
    doSpy = vi.spyOn(gatewayHooks, 'do');
    onSpy = vi.spyOn(gatewayHooks, 'on');
    offSpy = vi.spyOn(gatewayHooks, 'off');
  });

  afterEach(() => {
    registry.clear();
    gatewayHooks.clearAll();
    doSpy.mockRestore();
    onSpy.mockRestore();
    offSpy.mockRestore();
  });

  describe('register()', () => {
    it('should register an adapter', () => {
      const adapter = createMockAdapter('telegram');
      registry.register(adapter);

      expect(registry.getAdapterCount()).toBe(1);
      expect(registry.get('telegram')).toBe(adapter);
    });

    it('should register multiple adapters', () => {
      const telegramAdapter = createMockAdapter('telegram');
      const ircAdapter = createMockAdapter('irc');

      registry.register(telegramAdapter);
      registry.register(ircAdapter);

      expect(registry.getAdapterCount()).toBe(2);
      expect(registry.get('telegram')).toBe(telegramAdapter);
      expect(registry.get('irc')).toBe(ircAdapter);
    });

    it('should overwrite existing adapter with warning', () => {
      const adapter1 = createMockAdapter('telegram');
      const adapter2 = createMockAdapter('telegram');

      registry.register(adapter1);
      registry.register(adapter2);

      expect(registry.getAdapterCount()).toBe(1);
      expect(registry.get('telegram')).toBe(adapter2);
    });

    it('should fire adapter:registered hook with correct payload', () => {
      const adapter = createMockAdapter('telegram');
      registry.register(adapter);

      expect(gatewayHooks.do).toHaveBeenCalledWith('adapter:registered', {
        platform: 'telegram',
        adapter,
        key: undefined,
      }, expect.objectContaining({
        metadata: { adapter },
      }));
    });
  });

  describe('connect()', () => {
    it('should connect an adapter with valid config', async () => {
      const adapter = createMockAdapter('telegram');
      registry.register(adapter);

      const config: BaseAdapterConfig = {
        id: 'uuid-123',
        name: 'Main Telegram',
        key: 'telegram-main',
        type: 'telegram',
        enabled: true,
      };

      const result = await registry.connect(config);

      expect(result).toBe(true);
      expect(adapter.configure).toHaveBeenCalledWith(config);
      expect(adapter.connect).toHaveBeenCalled();
    });

    it('should return false if adapter not registered', async () => {
      const config: BaseAdapterConfig = {
        id: 'uuid-123',
        name: 'Main Telegram',
        key: 'telegram-main',
        type: 'telegram',
        enabled: true,
      };

      const result = await registry.connect(config);

      expect(result).toBe(false);
    });

    it('should return false if configure fails', async () => {
      const adapter = createMockAdapter('telegram', { configureShouldFail: true });
      registry.register(adapter);

      const config: BaseAdapterConfig = {
        id: 'uuid-123',
        name: 'Main Telegram',
        key: 'telegram-main',
        type: 'telegram',
        enabled: true,
      };

      const result = await registry.connect(config);

      expect(result).toBe(false);
      expect(adapter.connect).not.toHaveBeenCalled();
    });

    it('should return false if connect throws', async () => {
      const adapter = createMockAdapter('telegram', { connectShouldFail: true });
      registry.register(adapter);

      const config: BaseAdapterConfig = {
        id: 'uuid-123',
        name: 'Main Telegram',
        key: 'telegram-main',
        type: 'telegram',
        enabled: true,
      };

      const result = await registry.connect(config);

      expect(result).toBe(false);
    });

    it('should store adapter by key', async () => {
      const adapter = createMockAdapter('telegram');
      registry.register(adapter);

      const config: BaseAdapterConfig = {
        id: 'uuid-123',
        name: 'Main Telegram',
        key: 'telegram-main',
        type: 'telegram',
        enabled: true,
      };

      await registry.connect(config);

      expect(registry.getByKey('telegram-main')).toBe(adapter);
    });

    it('should fire adapter:connected hook with correct payload on success', async () => {
      const adapter = createMockAdapter('telegram');
      registry.register(adapter);

      const config: BaseAdapterConfig = {
        id: 'uuid-123',
        name: 'Main Telegram',
        key: 'telegram-main',
        type: 'telegram',
        enabled: true,
      };

      await registry.connect(config);

      expect(gatewayHooks.do).toHaveBeenCalledWith('adapter:connected', {
        platform: 'telegram',
        config: {
          id: 'uuid-123',
          name: 'Main Telegram',
          key: 'telegram-main',
          type: 'telegram',
          enabled: true,
        },
      }, expect.objectContaining({
        metadata: { adapter },
      }));
    });

    it('should fire adapter:error hook with correct payload on failure', async () => {
      const adapter = createMockAdapter('telegram', { connectShouldFail: true });
      registry.register(adapter);

      const config: BaseAdapterConfig = {
        id: 'uuid-123',
        name: 'Main Telegram',
        key: 'telegram-main',
        type: 'telegram',
        enabled: true,
      };

      await registry.connect(config);

      expect(gatewayHooks.do).toHaveBeenCalledWith('adapter:error', {
        platform: 'telegram',
        error: expect.any(Error),
        key: 'telegram-main',
      }, { adapter });
    });

    it('should return accurate boolean from connect', async () => {
      // Success case
      const successAdapter = createMockAdapter('telegram');
      registry.register(successAdapter);
      const successConfig: BaseAdapterConfig = {
        id: 'uuid-1',
        name: 'Success',
        key: 'success',
        type: 'telegram',
        enabled: true,
      };
      const successResult = await registry.connect(successConfig);
      expect(successResult).toBe(true);

      registry.clear();

      // Failure case
      const failAdapter = createMockAdapter('irc', { connectShouldFail: true });
      registry.register(failAdapter);
      const failConfig: BaseAdapterConfig = {
        id: 'uuid-2',
        name: 'Fail',
        key: 'fail',
        type: 'irc',
        enabled: true,
      };
      const failResult = await registry.connect(failConfig);
      expect(failResult).toBe(false);
    });
  });

  describe('disconnect()', () => {
    it('should disconnect a connected adapter', async () => {
      const adapter = createMockAdapter('telegram', { initialStatus: 'connected' });
      registry.register(adapter);

      const result = await registry.disconnect('telegram');

      expect(result).toBe(true);
      expect(adapter.disconnect).toHaveBeenCalled();
    });

    it('should return false if adapter not registered', async () => {
      const result = await registry.disconnect('telegram');

      expect(result).toBe(false);
    });

    it('should fire adapter:disconnected hook with correct payload', async () => {
      const adapter = createMockAdapter('telegram', { initialStatus: 'connected' });
      registry.register(adapter);

      await registry.disconnect('telegram', 'test_reason');

      expect(gatewayHooks.do).toHaveBeenCalledWith('adapter:disconnected', {
        platform: 'telegram',
        reason: 'test_reason',
      }, { adapter });
    });

    it('should fire adapter:error hook when disconnect throws', async () => {
      const adapter = createMockAdapter('telegram');
      adapter.disconnect = vi.fn(async () => {
        throw new Error('Disconnect failed');
      });
      registry.register(adapter);

      await registry.disconnect('telegram');

      expect(gatewayHooks.do).toHaveBeenCalledWith('adapter:error', {
        platform: 'telegram',
        error: expect.any(Error),
      }, { adapter });
    });

    it('should return accurate boolean from disconnect', async () => {
      // Success case
      const successAdapter = createMockAdapter('telegram', { initialStatus: 'connected' });
      registry.register(successAdapter);
      const successResult = await registry.disconnect('telegram');
      expect(successResult).toBe(true);

      registry.clear();

      // Failure case - not registered
      const failResult = await registry.disconnect('irc');
      expect(failResult).toBe(false);
    });
  });

  describe('get()', () => {
    it('should return adapter by type', () => {
      const adapter = createMockAdapter('telegram');
      registry.register(adapter);

      expect(registry.get('telegram')).toBe(adapter);
    });

    it('should return undefined for unregistered type', () => {
      expect(registry.get('telegram')).toBeUndefined();
    });
  });

  describe('getByPlatform()', () => {
    it('should return adapter by legacy platform type', () => {
      const adapter = createMockAdapter('telegram');
      registry.register(adapter);

      expect(registry.getByPlatform('telegram')).toBe(adapter);
    });

    it('should return undefined for unregistered platform', () => {
      expect(registry.getByPlatform('telegram')).toBeUndefined();
    });
  });

  describe('getByKey()', () => {
    it('should return adapter by key after connect', async () => {
      const adapter = createMockAdapter('telegram');
      registry.register(adapter);

      const config: BaseAdapterConfig = {
        id: 'uuid-123',
        name: 'Main Telegram',
        key: 'telegram-main',
        type: 'telegram',
        enabled: true,
      };

      await registry.connect(config);

      expect(registry.getByKey('telegram-main')).toBe(adapter);
    });

    it('should return undefined for unknown key', () => {
      expect(registry.getByKey('unknown-key')).toBeUndefined();
    });
  });

  describe('getAll()', () => {
    it('should return all registered adapters', () => {
      const telegramAdapter = createMockAdapter('telegram');
      const ircAdapter = createMockAdapter('irc');

      registry.register(telegramAdapter);
      registry.register(ircAdapter);

      const all = registry.getAll();

      expect(all).toHaveLength(2);
      expect(all).toContain(telegramAdapter);
      expect(all).toContain(ircAdapter);
    });

    it('should return empty array when no adapters registered', () => {
      expect(registry.getAll()).toHaveLength(0);
    });
  });

  describe('getConnected()', () => {
    it('should return only connected adapters', () => {
      const connectedAdapter = createMockAdapter('telegram', { initialStatus: 'connected' });
      const disconnectedAdapter = createMockAdapter('irc', { initialStatus: 'disconnected' });

      registry.register(connectedAdapter);
      registry.register(disconnectedAdapter);

      const connected = registry.getConnected();

      expect(connected).toHaveLength(1);
      expect(connected).toContain(connectedAdapter);
    });

    it('should return empty array when no adapters connected', () => {
      const adapter = createMockAdapter('telegram', { initialStatus: 'disconnected' });
      registry.register(adapter);

      expect(registry.getConnected()).toHaveLength(0);
    });
  });

  describe('getAdapterCount()', () => {
    it('should return correct count', () => {
      expect(registry.getAdapterCount()).toBe(0);

      registry.register(createMockAdapter('telegram'));
      expect(registry.getAdapterCount()).toBe(1);

      registry.register(createMockAdapter('irc'));
      expect(registry.getAdapterCount()).toBe(2);
    });
  });

  describe('has()', () => {
    it('should return true for registered adapter', () => {
      registry.register(createMockAdapter('telegram'));
      expect(registry.has('telegram')).toBe(true);
    });

    it('should return false for unregistered adapter', () => {
      expect(registry.has('telegram')).toBe(false);
    });
  });

  describe('getConfig()', () => {
    it('should return config for connected adapter', async () => {
      const adapter = createMockAdapter('telegram');
      registry.register(adapter);

      const config: BaseAdapterConfig = {
        id: 'uuid-123',
        name: 'Main Telegram',
        key: 'telegram-main',
        type: 'telegram',
        enabled: true,
      };

      await registry.connect(config);

      expect(registry.getConfig('telegram')).toEqual(config);
    });

    it('should return undefined for unconnected adapter', () => {
      registry.register(createMockAdapter('telegram'));
      expect(registry.getConfig('telegram')).toBeUndefined();
    });
  });

  describe('shutdown()', () => {
    it('should disconnect all adapters', async () => {
      const telegramAdapter = createMockAdapter('telegram');
      const ircAdapter = createMockAdapter('irc');

      registry.register(telegramAdapter);
      registry.register(ircAdapter);

      await registry.shutdown();

      expect(telegramAdapter.disconnect).toHaveBeenCalled();
      expect(ircAdapter.disconnect).toHaveBeenCalled();
    });

    it('should continue disconnecting other adapters on error', async () => {
      const failingAdapter = createMockAdapter('telegram');
      failingAdapter.disconnect = vi.fn(async () => {
        throw new Error('Disconnect failed');
      });

      const successAdapter = createMockAdapter('irc');

      registry.register(failingAdapter);
      registry.register(successAdapter);

      await registry.shutdown();

      expect(failingAdapter.disconnect).toHaveBeenCalled();
      expect(successAdapter.disconnect).toHaveBeenCalled();
    });

    it('should clear all maps after shutdown', async () => {
      const adapter = createMockAdapter('telegram');
      registry.register(adapter);

      const config: BaseAdapterConfig = {
        id: 'uuid-123',
        name: 'Main Telegram',
        key: 'telegram-main',
        type: 'telegram',
        enabled: true,
      };

      await registry.connect(config);
      await registry.shutdown();

      expect(registry.getConfig('telegram')).toBeUndefined();
      expect(registry.getByKey('telegram-main')).toBeUndefined();
    });

    it('should fire adapter:disconnected hooks for each adapter', async () => {
      const telegramAdapter = createMockAdapter('telegram');
      const ircAdapter = createMockAdapter('irc');

      registry.register(telegramAdapter);
      registry.register(ircAdapter);

      await registry.shutdown();

      // Each disconnect call fires the hook
      expect(gatewayHooks.do).toHaveBeenCalledWith('adapter:disconnected', {
        platform: 'telegram',
        reason: 'manual_disconnect',
      }, { adapter: telegramAdapter });

      expect(gatewayHooks.do).toHaveBeenCalledWith('adapter:disconnected', {
        platform: 'irc',
        reason: 'manual_disconnect',
      }, { adapter: ircAdapter });
    });
  });

  describe('unregister()', () => {
    it('should unregister an adapter', () => {
      const adapter = createMockAdapter('telegram');
      registry.register(adapter);

      const result = registry.unregister('telegram');

      expect(result).toBe(true);
      expect(registry.has('telegram')).toBe(false);
    });

    it('should return false if adapter not found', () => {
      const result = registry.unregister('telegram');

      expect(result).toBe(false);
    });

    it('should remove from key map', async () => {
      const adapter = createMockAdapter('telegram');
      registry.register(adapter);

      const config: BaseAdapterConfig = {
        id: 'uuid-123',
        name: 'Main Telegram',
        key: 'telegram-main',
        type: 'telegram',
        enabled: true,
      };

      await registry.connect(config);
      registry.unregister('telegram');

      expect(registry.getByKey('telegram-main')).toBeUndefined();
    });

    it('should remove from connected configs', async () => {
      const adapter = createMockAdapter('telegram');
      registry.register(adapter);

      const config: BaseAdapterConfig = {
        id: 'uuid-123',
        name: 'Main Telegram',
        key: 'telegram-main',
        type: 'telegram',
        enabled: true,
      };

      await registry.connect(config);
      registry.unregister('telegram');

      expect(registry.getConfig('telegram')).toBeUndefined();
    });
  });

  describe('clear()', () => {
    it('should clear all adapters', () => {
      registry.register(createMockAdapter('telegram'));
      registry.register(createMockAdapter('irc'));

      registry.clear();

      expect(registry.getAdapterCount()).toBe(0);
    });

    it('should clear all maps', async () => {
      const adapter = createMockAdapter('telegram');
      registry.register(adapter);

      const config: BaseAdapterConfig = {
        id: 'uuid-123',
        name: 'Main Telegram',
        key: 'telegram-main',
        type: 'telegram',
        enabled: true,
      };

      await registry.connect(config);
      registry.clear();

      expect(registry.getAdapterCount()).toBe(0);
      expect(registry.getByKey('telegram-main')).toBeUndefined();
      expect(registry.getConfig('telegram')).toBeUndefined();
    });
  });

  describe('Multi-Profile Key Support', () => {
    it('should support multiple keys for the same platform type', async () => {
      // Note: In the current design, each platform type has ONE adapter instance
      // but can be looked up by multiple keys if connected multiple times
      const adapter = createMockAdapter('irc');
      registry.register(adapter);

      // First connection with key1
      const config1: BaseAdapterConfig = {
        id: 'uuid-1',
        name: 'IRC Libera',
        key: 'irc-libera',
        type: 'irc',
        enabled: true,
      };

      await registry.connect(config1);
      expect(registry.getByKey('irc-libera')).toBe(adapter);

      // Disconnect and reconnect with different key
      await registry.disconnect('irc');

      const config2: BaseAdapterConfig = {
        id: 'uuid-2',
        name: 'IRC OFTC',
        key: 'irc-oftc',
        type: 'irc',
        enabled: true,
      };

      await registry.connect(config2);
      expect(registry.getByKey('irc-oftc')).toBe(adapter);
    });

    it('should clean up key map on disconnect', async () => {
      const adapter = createMockAdapter('telegram');
      registry.register(adapter);

      const config: BaseAdapterConfig = {
        id: 'uuid-123',
        name: 'Main Telegram',
        key: 'telegram-main',
        type: 'telegram',
        enabled: true,
      };

      await registry.connect(config);
      expect(registry.getByKey('telegram-main')).toBe(adapter);

      await registry.disconnect('telegram');
      expect(registry.getByKey('telegram-main')).toBeUndefined();
    });

    it('should clean up key map on unregister', async () => {
      const adapter = createMockAdapter('telegram');
      registry.register(adapter);

      const config: BaseAdapterConfig = {
        id: 'uuid-123',
        name: 'Main Telegram',
        key: 'telegram-main',
        type: 'telegram',
        enabled: true,
      };

      await registry.connect(config);
      expect(registry.getByKey('telegram-main')).toBe(adapter);

      registry.unregister('telegram');
      expect(registry.getByKey('telegram-main')).toBeUndefined();
    });
  });

  describe('Hook Payload/Context Alignment', () => {
    it('should pass correct context with adapter reference for adapter:connected', async () => {
      const adapter = createMockAdapter('telegram');
      registry.register(adapter);

      const config: BaseAdapterConfig = {
        id: 'uuid-123',
        name: 'Main Telegram',
        key: 'telegram-main',
        type: 'telegram',
        enabled: true,
      };

      await registry.connect(config);

      // Verify the hook was called with correct context
      const calls = vi.mocked(gatewayHooks.do).mock.calls;
      const connectedCall = calls.find(
        (call) => call[0] === 'adapter:connected'
      );
      expect(connectedCall).toBeDefined();
      expect(connectedCall![2]).toEqual(expect.objectContaining({
        metadata: { adapter },
      }));
    });

    it('should pass correct context with adapter reference for adapter:disconnected', async () => {
      const adapter = createMockAdapter('telegram');
      registry.register(adapter);

      await registry.disconnect('telegram');

      // Verify the hook was called with correct context
      const calls = vi.mocked(gatewayHooks.do).mock.calls;
      const disconnectedCall = calls.find(
        (call) => call[0] === 'adapter:disconnected'
      );
      expect(disconnectedCall).toBeDefined();
      // adapter:disconnected passes { adapter } directly (not wrapped in metadata)
      expect(disconnectedCall![2]).toEqual({ adapter });
    });

    it('should pass correct context with adapter reference for adapter:error', async () => {
      const adapter = createMockAdapter('telegram', { connectShouldFail: true });
      registry.register(adapter);

      const config: BaseAdapterConfig = {
        id: 'uuid-123',
        name: 'Main Telegram',
        key: 'telegram-main',
        type: 'telegram',
        enabled: true,
      };

      await registry.connect(config);

      // Verify the hook was called with correct context
      const calls = vi.mocked(gatewayHooks.do).mock.calls;
      const errorCall = calls.find(
        (call) => call[0] === 'adapter:error'
      );
      expect(errorCall).toBeDefined();
      expect(errorCall![2]).toEqual({ adapter });
    });

    it('should include key in adapter:connected payload', async () => {
      const adapter = createMockAdapter('telegram');
      registry.register(adapter);

      const config: BaseAdapterConfig = {
        id: 'uuid-123',
        name: 'Main Telegram',
        key: 'telegram-main',
        type: 'telegram',
        enabled: true,
      };

      await registry.connect(config);

      const calls = doSpy.mock.calls;
      const connectedCall = calls.find(
        (call) => call[0] === 'adapter:connected'
      );
      expect(connectedCall).toBeDefined();
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect((connectedCall![1] as { config: { key?: string } }).config.key).toBe('telegram-main');
    });

    it('should include key in adapter:error payload', async () => {
      const adapter = createMockAdapter('telegram', { connectShouldFail: true });
      registry.register(adapter);

      const config: BaseAdapterConfig = {
        id: 'uuid-123',
        name: 'Main Telegram',
        key: 'telegram-main',
        type: 'telegram',
        enabled: true,
      };

      await registry.connect(config);

      const calls = doSpy.mock.calls;
      const errorCall = calls.find(
        (call) => call[0] === 'adapter:error'
      );
      expect(errorCall).toBeDefined();
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect((errorCall![1] as { key?: string }).key).toBe('telegram-main');
    });
  });
});
