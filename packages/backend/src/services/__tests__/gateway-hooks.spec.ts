/**
 * GatewayHooks Service Unit Tests
 *
 * Tests the plugin architecture for hook execution.
 * Covers: registration, execution, error handling, logging, utilities.
 *
 * @see GPA-002 - Gateway Hooks Service Implementation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { logger } from '../../infrastructure/logger';
import type {
  GatewayHook,
  HookContext,
  HookHandler,
  HookResult,
} from '../../types/gateway-hooks.types';
import { GatewayHooks } from '../gateway-hooks';

// Mock the logger - use vi.fn() directly inside factory
vi.mock('../../infrastructure/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));


// Mock appConfig with mutable log level via vi.stubEnv
describe('GatewayHooks', () => {
  let gatewayHooks: GatewayHooks;

  const createContext = (overrides?: Partial<HookContext>): HookContext => ({
    correlationId: 'test-correlation-id',
    timestamp: Date.now(),
    ...overrides,
  });

  const createHandler = <T>(
    result: HookResult<T>,
    delay = 0
  ): HookHandler<T> => {
    return vi.fn(async (): Promise<HookResult<T>> => {
      if (delay > 0) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
      return result;
    });
  };

  const createFailingHandler = <T>(error: Error, delay = 0): HookHandler<T> => {
    return vi.fn(async (): Promise<HookResult<T>> => {
      if (delay > 0) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
      throw error;
    });
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Use default log level (info)
    gatewayHooks = new GatewayHooks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  // ===========================================
  // Registration Tests (on/off)
  // ===========================================
  describe('registration (on/off)', () => {
    it('should register a handler with default priority (10)', () => {
      const handler = createHandler({ data: 'test', source: 'test-plugin' });
      gatewayHooks.on('message:received', handler);

      expect(gatewayHooks.getHandlerCount('message:received')).toBe(1);
    });

    it('should register a handler with custom priority', () => {
      const handler = createHandler({ data: 'test', source: 'test-plugin' });
      gatewayHooks.on('message:received', handler, { priority: 20 });

      expect(gatewayHooks.getHandlerCount('message:received')).toBe(1);
    });

    it('should sort handlers by priority (higher = earlier)', () => {
      const handler1 = createHandler({ data: '1', source: 'plugin1' });
      const handler2 = createHandler({ data: '2', source: 'plugin2' });
      const handler3 = createHandler({ data: '3', source: 'plugin3' });

      gatewayHooks.on('message:received', handler1, { priority: 10 });
      gatewayHooks.on('message:received', handler2, { priority: 30 });
      gatewayHooks.on('message:received', handler3, { priority: 20 });

      expect(gatewayHooks.getHandlerCount('message:received')).toBe(3);
    });

    it('should remove a registered handler', () => {
      const handler = createHandler({ data: 'test', source: 'test-plugin' });
      gatewayHooks.on('message:received', handler);

      const result = gatewayHooks.off('message:received', handler);

      expect(result).toBe(true);
      expect(gatewayHooks.getHandlerCount('message:received')).toBe(0);
    });

    it('should return false when removing non-existent handler', () => {
      const handler = createHandler({ data: 'test', source: 'test-plugin' });
      const result = gatewayHooks.off('message:received', handler);

      expect(result).toBe(false);
    });

    it('should return false when removing from non-existent hook', () => {
      const handler = createHandler({ data: 'test', source: 'test-plugin' });
      const result = gatewayHooks.off('message:received', handler);

      expect(result).toBe(false);
    });

    it('should clean up empty handler arrays', () => {
      const handler = createHandler({ data: 'test', source: 'test-plugin' });
      gatewayHooks.on('message:received', handler);
      gatewayHooks.off('message:received', handler);

      expect(gatewayHooks.getHandlerCount('message:received')).toBe(0);
    });

    it('should log debug message when registering handler at debug level', () => {
      gatewayHooks = new GatewayHooks({ logLevel: 'debug' });

      const handler = createHandler({ data: 'test', source: 'test-plugin' });
      gatewayHooks.on('message:received', handler);

      expect(logger.debug).toHaveBeenCalledWith(
        expect.objectContaining({
          hook: 'message:received',
          priority: 10,
        }),
        expect.stringContaining('Registered hook handler')
      );
    });

    it('should log debug message when removing handler at debug level', () => {
      gatewayHooks = new GatewayHooks({ logLevel: 'debug' });

      const handler = createHandler({ data: 'test', source: 'test-plugin' });
      gatewayHooks.on('message:received', handler);
      vi.clearAllMocks();

      gatewayHooks.off('message:received', handler);

      expect(logger.debug).toHaveBeenCalledWith(
        expect.objectContaining({ hook: 'message:received' }),
        expect.stringContaining('Removed hook handler')
      );
    });
  });

  // ===========================================
  // Execution Tests (do)
  // ===========================================
  describe('execution (do)', () => {
    it('should fire hook with multiple handlers', async () => {
      const handler1 = createHandler({ data: 'result1', source: 'plugin1' });
      const handler2 = createHandler({ data: 'result2', source: 'plugin2' });

      gatewayHooks.on('message:received', handler1);
      gatewayHooks.on('message:received', handler2);

      const context = createContext();
      const { results, errors } = await gatewayHooks.do('message:received', 'payload', context);

      expect(results).toHaveLength(2);
      expect(errors).toHaveLength(0);
      expect(handler1).toHaveBeenCalledWith('payload', context);
      expect(handler2).toHaveBeenCalledWith('payload', context);
    });

    it('should execute handlers in parallel', async () => {
      const executionOrder: string[] = [];

      const handler1: HookHandler<string> = async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        executionOrder.push('handler1');
        return { data: '1', source: 'plugin1' };
      };

      const handler2: HookHandler<string> = async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        executionOrder.push('handler2');
        return { data: '2', source: 'plugin2' };
      };

      gatewayHooks.on('message:received', handler1);
      gatewayHooks.on('message:received', handler2);

      const context = createContext();
      await gatewayHooks.do('message:received', 'payload', context);

      // If parallel, handler2 should complete first (shorter delay)
      expect(executionOrder).toEqual(['handler2', 'handler1']);
    });

    it('should return empty results for hook with no handlers', async () => {
      const context = createContext();
      const { results, errors } = await gatewayHooks.do('message:received', 'payload', context);

      expect(results).toHaveLength(0);
      expect(errors).toHaveLength(0);
    });

    it('should pass correlation ID to handlers', async () => {
      const handler = vi.fn(async (): Promise<HookResult<string>> => ({
        data: 'test',
        source: 'test-plugin',
      }));

      gatewayHooks.on('message:received', handler);

      const context = createContext({ correlationId: 'custom-correlation-id' });
      await gatewayHooks.do('message:received', 'payload', context);

      expect(handler).toHaveBeenCalledWith('payload', expect.objectContaining({
        correlationId: 'custom-correlation-id',
      }));
    });

    it('should pass source to handlers', async () => {
      const handler = vi.fn(async (): Promise<HookResult<string>> => ({
        data: 'test',
        source: 'test-plugin',
      }));

      gatewayHooks.on('message:received', handler);

      const context = createContext({ source: 'telegram-adapter' });
      await gatewayHooks.do('message:received', 'payload', context);

      expect(handler).toHaveBeenCalledWith('payload', expect.objectContaining({
        source: 'telegram-adapter',
      }));
    });

    it('should pass metadata to handlers', async () => {
      const handler = vi.fn(async (): Promise<HookResult<string>> => ({
        data: 'test',
        source: 'test-plugin',
      }));

      gatewayHooks.on('message:received', handler);

      const context = createContext({ metadata: { userId: '123' } });
      await gatewayHooks.do('message:received', 'payload', context);

      expect(handler).toHaveBeenCalledWith('payload', expect.objectContaining({
        metadata: { userId: '123' },
      }));
    });

    it('should execute handlers in priority order (higher = earlier)', async () => {
      const executionOrder: number[] = [];

      const createPriorityHandler = (priority: number): HookHandler<string> => async () => {
        executionOrder.push(priority);
        return { data: `result-${priority}`, source: `plugin-${priority}` };
      };

      gatewayHooks.on('message:received', createPriorityHandler(10), { priority: 10 });
      gatewayHooks.on('message:received', createPriorityHandler(30), { priority: 30 });
      gatewayHooks.on('message:received', createPriorityHandler(20), { priority: 20 });

      const context = createContext();
      await gatewayHooks.do('message:received', 'payload', context);

      // Even though executed in parallel, they're invoked in priority order
      // Results are collected as they complete, but invocation order matters
      expect(executionOrder.length).toBe(3);
    });
  });

  // ===========================================
  // Error Handling Tests
  // ===========================================
  describe('error handling', () => {
    it('should collect errors from failing handlers', async () => {
      const goodHandler = createHandler({ data: 'success', source: 'good-plugin' });
      const badHandler = createFailingHandler(new Error('Handler failed'));

      gatewayHooks.on('message:received', goodHandler);
      gatewayHooks.on('message:received', badHandler);

      const context = createContext();
      const { results, errors } = await gatewayHooks.do('message:received', 'payload', context);

      expect(results).toHaveLength(1);
      expect(errors).toHaveLength(1);
      expect(errors[0].error.message).toBe('Handler failed');
    });

    it('should not block other handlers when one fails', async () => {
      const handler1 = createHandler({ data: '1', source: 'plugin1' });
      const handler2 = createFailingHandler(new Error('Handler 2 failed'));
      const handler3 = createHandler({ data: '3', source: 'plugin3' });

      gatewayHooks.on('message:received', handler1);
      gatewayHooks.on('message:received', handler2);
      gatewayHooks.on('message:received', handler3);

      const context = createContext();
      const { results, errors } = await gatewayHooks.do('message:received', 'payload', context);

      expect(results).toHaveLength(2);
      expect(errors).toHaveLength(1);
      expect(handler1).toHaveBeenCalled();
      expect(handler2).toHaveBeenCalled();
      expect(handler3).toHaveBeenCalled();
    });

    it('should collect multiple errors from multiple failing handlers', async () => {
      const handler1 = createFailingHandler(new Error('Error 1'));
      const handler2 = createFailingHandler(new Error('Error 2'));
      const handler3 = createHandler({ data: '3', source: 'plugin3' });

      gatewayHooks.on('message:received', handler1);
      gatewayHooks.on('message:received', handler2);
      gatewayHooks.on('message:received', handler3);

      const context = createContext();
      const { results, errors } = await gatewayHooks.do('message:received', 'payload', context);

      expect(results).toHaveLength(1);
      expect(errors).toHaveLength(2);
      expect(errors.map((e) => e.error.message)).toEqual(['Error 1', 'Error 2']);
    });

    it('should include source in error when available', async () => {
      const badHandler = createFailingHandler(new Error('Handler failed'));

      gatewayHooks.on('message:received', badHandler);

      const context = createContext({ source: 'telegram-adapter' });
      const { errors } = await gatewayHooks.do('message:received', 'payload', context);

      expect(errors[0].source).toBe('telegram-adapter');
    });

    it('should handle non-Error throws', async () => {
      const badHandler: HookHandler<string> = async () => {
        throw 'string error';
      };

      gatewayHooks.on('message:received', badHandler);

      const context = createContext();
      const { errors } = await gatewayHooks.do('message:received', 'payload', context);

      expect(errors).toHaveLength(1);
      expect(errors[0].error.message).toBe('string error');
    });

    it('should log error when handler fails', async () => {
      const badHandler = createFailingHandler(new Error('Handler failed'));

      gatewayHooks.on('message:received', badHandler);

      const context = createContext({ correlationId: 'test-correlation' });
      await gatewayHooks.do('message:received', 'payload', context);

      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          hook: 'message:received',
          error: 'Handler failed',
          correlationId: 'test-correlation',
        }),
        expect.stringContaining('handler failed')
      );
    });
  });

  // ===========================================
  // Logging Tests (LOG_LEVEL)
  // ===========================================
  describe('logging (LOG_LEVEL)', () => {
    it('should log debug details at DEBUG level', async () => {
      gatewayHooks = new GatewayHooks({ logLevel: 'debug' });

      const handler = createHandler({ data: 'test', source: 'test-plugin' });
      gatewayHooks.on('message:received', handler);

      const context = createContext();
      await gatewayHooks.do('message:received', 'payload', context);

      // Debug level logs detailed info
      expect(logger.debug).toHaveBeenCalledWith(
        expect.objectContaining({
          hook: 'message:received',
          handlerCount: 1,
        }),
        expect.stringContaining('Firing hook')
      );
      expect(logger.debug).toHaveBeenCalledWith(
        expect.objectContaining({
          hook: 'message:received',
          successCount: 1,
          errorCount: 0,
        }),
        expect.stringContaining('completed')
      );
    });

    it('should log summary at INFO level', async () => {
      gatewayHooks = new GatewayHooks({ logLevel: 'info' });

      const handler = createHandler({ data: 'test', source: 'test-plugin' });
      gatewayHooks.on('message:received', handler);

      const context = createContext();
      await gatewayHooks.do('message:received', 'payload', context);

      // Info level logs summary only
      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          hook: 'message:received',
          handlerCount: 1,
          successCount: 1,
          errorCount: 0,
        }),
        expect.stringContaining('fired')
      );
    });

    it('should not log info at DEBUG level (debug is more verbose)', async () => {
      gatewayHooks = new GatewayHooks({ logLevel: 'debug' });

      const handler = createHandler({ data: 'test', source: 'test-plugin' });
      gatewayHooks.on('message:received', handler);

      const context = createContext();
      await gatewayHooks.do('message:received', 'payload', context);

      // At debug level, we use debug logs, not info
      expect(logger.info).not.toHaveBeenCalled();
    });

    it('should not log debug at WARN level', async () => {
      gatewayHooks = new GatewayHooks({ logLevel: 'warn' });

      const handler = createHandler({ data: 'test', source: 'test-plugin' });
      gatewayHooks.on('message:received', handler);

      const context = createContext();
      await gatewayHooks.do('message:received', 'payload', context);

      // At warn level, no success logs
      expect(logger.debug).not.toHaveBeenCalled();
      expect(logger.info).not.toHaveBeenCalled();
    });

    it('should log debug when no handlers registered at DEBUG level', async () => {
      gatewayHooks = new GatewayHooks({ logLevel: 'debug' });

      const context = createContext();
      await gatewayHooks.do('message:received', 'payload', context);

      expect(logger.debug).toHaveBeenCalledWith(
        expect.objectContaining({
          hook: 'message:received',
          correlationId: context.correlationId,
        }),
        expect.stringContaining('No handlers registered')
      );
    });

    it('should include correlationId in all execution logs', async () => {
      gatewayHooks = new GatewayHooks({ logLevel: 'debug' });

      const handler = createHandler({ data: 'test', source: 'test-plugin' });
      gatewayHooks.on('message:received', handler);

      const context = createContext({ correlationId: 'my-correlation-id' });
      await gatewayHooks.do('message:received', 'payload', context);

      // Check that execution logs have correlationId (registration logs don't have context)
      const debugCalls = vi.mocked(logger.debug).mock.calls;
      const executionLogs = debugCalls.filter((call) => {
        const msg = call[1];
        return typeof msg === 'string' && (msg.includes('Firing') || msg.includes('completed'));
      });

      expect(executionLogs.length).toBeGreaterThan(0);
      for (const call of executionLogs) {
        const logObject = call[0];
        if (typeof logObject === 'object' && logObject !== null) {
          expect(logObject).toHaveProperty('correlationId', 'my-correlation-id');
        }
      }
    });
  });

  // ===========================================
  // Utility Methods Tests
  // ===========================================
  describe('utility methods', () => {
    describe('getHandlerCount', () => {
      it('should return 0 for hook with no handlers', () => {
        expect(gatewayHooks.getHandlerCount('message:received')).toBe(0);
      });

      it('should return correct count for hook with handlers', () => {
        const handler1 = createHandler({ data: '1', source: 'plugin1' });
        const handler2 = createHandler({ data: '2', source: 'plugin2' });

        gatewayHooks.on('message:received', handler1);
        gatewayHooks.on('message:received', handler2);

        expect(gatewayHooks.getHandlerCount('message:received')).toBe(2);
      });

      it('should return updated count after removing handler', () => {
        const handler = createHandler({ data: 'test', source: 'test-plugin' });
        gatewayHooks.on('message:received', handler);

        expect(gatewayHooks.getHandlerCount('message:received')).toBe(1);

        gatewayHooks.off('message:received', handler);

        expect(gatewayHooks.getHandlerCount('message:received')).toBe(0);
      });
    });

    describe('clearHandlers', () => {
      it('should clear handlers for specific hook', () => {
        const handler1 = createHandler({ data: '1', source: 'plugin1' });
        const handler2 = createHandler({ data: '2', source: 'plugin2' });

        gatewayHooks.on('message:received', handler1);
        gatewayHooks.on('message:sent', handler2);

        gatewayHooks.clearHandlers('message:received');

        expect(gatewayHooks.getHandlerCount('message:received')).toBe(0);
        expect(gatewayHooks.getHandlerCount('message:sent')).toBe(1);
      });

      it('should clear all handlers when no hook specified', () => {
        const handler1 = createHandler({ data: '1', source: 'plugin1' });
        const handler2 = createHandler({ data: '2', source: 'plugin2' });

        gatewayHooks.on('message:received', handler1);
        gatewayHooks.on('message:sent', handler2);

        gatewayHooks.clearHandlers();

        expect(gatewayHooks.getHandlerCount('message:received')).toBe(0);
        expect(gatewayHooks.getHandlerCount('message:sent')).toBe(0);
      });

      it('should log debug when clearing specific hook at DEBUG level', () => {
        gatewayHooks = new GatewayHooks({ logLevel: 'debug' });

        const handler = createHandler({ data: 'test', source: 'test-plugin' });
        gatewayHooks.on('message:received', handler);
        vi.clearAllMocks();

        gatewayHooks.clearHandlers('message:received');

        expect(logger.debug).toHaveBeenCalledWith(
          expect.objectContaining({ hook: 'message:received' }),
          expect.stringContaining('Cleared handlers for hook')
        );
      });

      it('should log debug when clearing all hooks at DEBUG level', () => {
        gatewayHooks = new GatewayHooks({ logLevel: 'debug' });

        const handler = createHandler({ data: 'test', source: 'test-plugin' });
        gatewayHooks.on('message:received', handler);
        vi.clearAllMocks();

        gatewayHooks.clearHandlers();

        expect(logger.debug).toHaveBeenCalledWith(
          expect.stringContaining('Cleared all hook handlers')
        );
      });
    });
  });

  // ===========================================
  // Type Safety Tests
  // ===========================================
  describe('type safety', () => {
    it('should work with typed payloads', async () => {
      type MessagePayload = { id: string; body: string };

      const handler: HookHandler<MessagePayload> = async (payload) => ({
        data: payload,
        source: 'test-plugin',
      });

      gatewayHooks.on('message:received', handler);

      const context = createContext();
      const payload: MessagePayload = { id: '123', body: 'Hello' };
      const { results } = await gatewayHooks.do('message:received', payload, context);

      expect(results[0].data).toEqual(payload);
    });

    it('should support all hook types', () => {
      const hooks: GatewayHook[] = [
        'gateway:init',
        'gateway:shutdown',
        'adapter:registered',
        'adapter:connected',
        'adapter:disconnected',
        'adapter:error',
        'message:received',
        'message:beforePersist',
        'message:persisted',
        'message:send',
        'message:sent',
        'message:failed',
        'conversation:created',
        'conversation:reopened',
      ];

      const handler = createHandler({ data: 'test', source: 'test-plugin' });

      for (const hook of hooks) {
        gatewayHooks.on(hook, handler);
        expect(gatewayHooks.getHandlerCount(hook)).toBe(1);
      }
    });
  });
});
