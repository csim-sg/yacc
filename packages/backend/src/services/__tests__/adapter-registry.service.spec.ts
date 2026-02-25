/**
 * Adapter Registry Service Tests
 *
 * Unit tests for the AdapterRegistry service.
 *
 * @see GPA-004 - AdapterRegistry Service
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  BaseAdapterConfig,
  HealthCheckResultEnhanced,
  PlatformAdapter,
  AdapterMetadata,
} from '../../infrastructure/types/adapter.interface';
import type { SendResult } from '../../types/gateway.types';
import { AdapterRegistry } from '../adapter-registry.service';

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
      status: status === 'connected' ? 'healthy' : 'unhealthy',
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

  beforeEach(() => {
    registry = new AdapterRegistry();
  });

  afterEach(() => {
    registry.clear();
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
  });

  describe('clear()', () => {
    it('should clear all adapters', () => {
      registry.register(createMockAdapter('telegram'));
      registry.register(createMockAdapter('irc'));

      registry.clear();

      expect(registry.getAdapterCount()).toBe(0);
    });
  });
});
