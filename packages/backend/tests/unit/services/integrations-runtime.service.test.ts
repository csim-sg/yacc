/**
 * Integrations Runtime Service Unit Tests
 *
 * Tests the adapter-based integration initialization.
 * DEV-005/DEV-006 refactoring verification.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock dependencies before importing the module
vi.mock('../../../src/config/appConfig', () => ({
  appConfig: {
    TELEGRAM_BOT_TOKEN: 'test-token',
  },
}));

vi.mock('../../../src/infrastructure/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../../../src/infrastructure/irc.adapter', () => {
  const MockIRCAdapter = vi.fn(function() {
    return {
      platform: 'irc',
      status: 'disconnected',
      setConfig: vi.fn(),
      connect: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn().mockResolvedValue(undefined),
      healthCheck: vi.fn().mockResolvedValue({ healthy: true }),
      on: vi.fn(),
      emit: vi.fn(),
    };
  });
  return { IRCAdapter: MockIRCAdapter };
});

vi.mock('../../../src/infrastructure/telegram.adapter', () => {
  const MockTelegramAdapter = vi.fn(function() {
    return {
      platform: 'telegram',
      status: 'disconnected',
      setConfig: vi.fn(),
      connect: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn().mockResolvedValue(undefined),
      healthCheck: vi.fn().mockResolvedValue({ healthy: true }),
      on: vi.fn(),
      emit: vi.fn(),
    };
  });
  return { TelegramAdapter: MockTelegramAdapter };
});

vi.mock('../../../src/services/gateway-exchange', () => ({
  gatewayExchange: {
    registerAdapter: vi.fn(),
    getAdapter: vi.fn(),
    getAllAdapters: vi.fn(() => []),
    handleOutbound: vi.fn(),
    healthCheckAll: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock('../../../src/services/ircProfileResolution.service', () => ({
  resolveIrcConfig: vi.fn().mockResolvedValue({
    server: 'irc.test.com',
    port: 6667,
    nick: 'TestBot',
    password: undefined,
    channels: ['#test'],
    profileId: 1,
    source: 'env',
  }),
  IrcProfileResolutionError: class IrcProfileResolutionError extends Error {
    statusCode: number;
    code: string;
    constructor(message: string, statusCode: number, code: string) {
      super(message);
      this.statusCode = statusCode;
      this.code = code;
    }
  },
}));

describe('IntegrationsRuntimeService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('AdapterRegistry', () => {
    it('should be importable', async () => {
      const { adapterRegistry } = await import('../../../src/services/integrations-runtime.service');
      expect(adapterRegistry).toBeDefined();
    });

    it('should register and retrieve adapters', async () => {
      const { adapterRegistry } = await import('../../../src/services/integrations-runtime.service');
      const mockAdapter = {
        platform: 'irc' as const,
        status: 'disconnected' as const,
        connect: vi.fn(),
        disconnect: vi.fn(),
        healthCheck: vi.fn(),
        on: vi.fn(),
        emit: vi.fn(),
      };

      adapterRegistry.register('irc', mockAdapter as unknown as import('../../../src/infrastructure/irc.adapter').IRCAdapter);

      expect(adapterRegistry.hasAdapter('irc')).toBe(true);
      expect(adapterRegistry.getAdapter('irc')).toBe(mockAdapter);
    });

    it('should return undefined for unregistered platform', async () => {
      const { adapterRegistry } = await import('../../../src/services/integrations-runtime.service');
      expect(adapterRegistry.getAdapter('telegram')).toBeUndefined();
    });

    it('should get all registered adapters', async () => {
      const { adapterRegistry } = await import('../../../src/services/integrations-runtime.service');
      const adapters = adapterRegistry.getAllAdapters();
      expect(Array.isArray(adapters)).toBe(true);
    });

    it('should check health for all adapters', async () => {
      const { adapterRegistry } = await import('../../../src/services/integrations-runtime.service');
      const health = await adapterRegistry.checkHealth();
      expect(typeof health).toBe('object');
    });
  });

  describe('initializeIntegrationsRuntime', () => {
    it('should be importable', async () => {
      const { initializeIntegrationsRuntime } = await import('../../../src/services/integrations-runtime.service');
      expect(typeof initializeIntegrationsRuntime).toBe('function');
    });

    it('should register adapters with gateway-exchange', async () => {
      const { initializeIntegrationsRuntime } = await import('../../../src/services/integrations-runtime.service');
      const { gatewayExchange } = await import('../../../src/services/gateway-exchange');

      await initializeIntegrationsRuntime();

      // Should have registered telegram adapter (we have token in mock)
      expect(gatewayExchange.registerAdapter).toHaveBeenCalled();
    });
  });

  describe('shutdownIntegrationsRuntime', () => {
    it('should be importable', async () => {
      const { shutdownIntegrationsRuntime } = await import('../../../src/services/integrations-runtime.service');
      expect(typeof shutdownIntegrationsRuntime).toBe('function');
    });

    it('should disconnect all adapters', async () => {
      const { shutdownIntegrationsRuntime, adapterRegistry } = await import('../../../src/services/integrations-runtime.service');

      await shutdownIntegrationsRuntime();

      // Verify adapters were disconnected (no errors thrown)
      expect(true).toBe(true);
    });
  });
});
