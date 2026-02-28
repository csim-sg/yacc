/**
 * Gateway Hooks Types Tests
 *
 * Tests for type definitions to ensure proper TypeScript inference.
 *
 * @see GPA-001 - Gateway Hooks Type Definitions
 */

import { describe, it, expect } from 'vitest';
import type {
  GatewayHook,
  HookContext,
  HookHandler,
  HookHandlerEntry,
  HookHandlerMap,
  HookOptions,
  HookResult,
  HookResults,
} from '../gateway-hooks.types';

describe('Gateway Hooks Types', () => {
  describe('HookResult', () => {
    it('should accept valid HookResult with required fields', () => {
      const result: HookResult<string> = {
        data: 'test data',
        source: 'telegram-adapter',
      };
      expect(result.data).toBe('test data');
      expect(result.source).toBe('telegram-adapter');
    });

    it('should accept HookResult with optional timestamp', () => {
      const result: HookResult<number> = {
        data: 42,
        source: 'test',
        timestamp: Date.now(),
      };
      expect(result.timestamp).toBeDefined();
    });

    it('should infer generic type correctly', () => {
      type MessageData = { id: string; body: string };
      const result: HookResult<MessageData> = {
        data: { id: '123', body: 'Hello' },
        source: 'irc',
      };
      expect(result.data.id).toBe('123');
      expect(result.data.body).toBe('Hello');
    });
  });

  describe('HookResults', () => {
    it('should accept valid HookResults with results and errors', () => {
      const results: HookResults<string> = {
        results: [
          { data: 'result1', source: 'adapter1' },
          { data: 'result2', source: 'adapter2' },
        ],
        errors: [{ source: 'adapter3', error: new Error('Failed') }],
      };
      expect(results.results).toHaveLength(2);
      expect(results.errors).toHaveLength(1);
    });

    it('should accept empty results and errors', () => {
      const results: HookResults<unknown> = {
        results: [],
        errors: [],
      };
      expect(results.results).toHaveLength(0);
      expect(results.errors).toHaveLength(0);
    });

    it('should allow errors without source', () => {
      const results: HookResults<string> = {
        results: [],
        errors: [{ error: new Error('Unknown error') }],
      };
      expect(results.errors[0]?.source).toBeUndefined();
    });
  });

  describe('HookHandler', () => {
    it('should be a valid async function signature', async () => {
      const handler: HookHandler<string> = async (payload, context) => {
        return {
          data: payload.toUpperCase(),
          source: context.source || 'unknown',
        };
      };

      const context: HookContext = {
        correlationId: 'test-123',
        timestamp: Date.now(),
        source: 'test',
      };

      const result = await handler('hello', context);
      expect(result.data).toBe('HELLO');
    });
  });

  describe('HookContext', () => {
    it('should require correlationId and timestamp', () => {
      const context: HookContext = {
        correlationId: 'abc-123',
        timestamp: Date.now(),
      };
      expect(context.correlationId).toBe('abc-123');
      expect(context.timestamp).toBeDefined();
    });

    it('should accept optional fields', () => {
      const context: HookContext = {
        correlationId: 'abc-123',
        timestamp: Date.now(),
        source: 'telegram',
        metadata: { userId: 'user-1', priority: 'high' },
      };
      expect(context.source).toBe('telegram');
      expect(context.metadata?.userId).toBe('user-1');
    });
  });

  describe('GatewayHook', () => {
    it('should accept gateway lifecycle hooks', () => {
      const hooks: GatewayHook[] = ['gateway:init', 'gateway:shutdown'];
      expect(hooks).toHaveLength(2);
    });

    it('should accept adapter lifecycle hooks', () => {
      const hooks: GatewayHook[] = [
        'adapter:registered',
        'adapter:connected',
        'adapter:disconnected',
        'adapter:error',
      ];
      expect(hooks).toHaveLength(4);
    });

    it('should accept message flow hooks', () => {
      const hooks: GatewayHook[] = [
        'message:received',
        'message:beforePersist',
        'message:persisted',
        'message:send',
        'message:sent',
        'message:failed',
      ];
      expect(hooks).toHaveLength(6);
    });

    it('should accept conversation flow hooks', () => {
      const hooks: GatewayHook[] = ['conversation:created', 'conversation:reopened'];
      expect(hooks).toHaveLength(2);
    });

    it('should have all expected hook names', () => {
      const allHooks: GatewayHook[] = [
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
      expect(allHooks).toHaveLength(14);
    });

    it('should be a string type', () => {
      const hook: GatewayHook = 'message:received';
      expect(typeof hook).toBe('string');
    });
  });

  describe('HookOptions', () => {
    it('should accept priority option', () => {
      const options: HookOptions = { priority: 20 };
      expect(options.priority).toBe(20);
    });

    it('should accept empty options', () => {
      const options: HookOptions = {};
      expect(options.priority).toBeUndefined();
    });
  });

  describe('HookHandlerEntry', () => {
    it('should contain handler and priority', () => {
      const handler: HookHandler<unknown> = async (payload) => ({
        data: payload,
        source: 'test',
      });
      const entry: HookHandlerEntry = {
        handler,
        priority: 10,
      };
      expect(entry.priority).toBe(10);
      expect(entry.handler).toBe(handler);
    });
  });

  describe('HookHandlerMap', () => {
    it('should be a Map with GatewayHook keys', () => {
      const map: HookHandlerMap = new Map();
      expect(map).toBeInstanceOf(Map);
      expect(map.size).toBe(0);
    });

    it('should store HookHandlerEntry arrays', () => {
      const map: HookHandlerMap = new Map();
      const handler: HookHandler<unknown> = async (payload) => ({
        data: payload,
        source: 'test',
      });
      const entries: HookHandlerEntry[] = [{ handler, priority: 10 }];
      map.set('message:received', entries);
      expect(map.get('message:received')).toEqual(entries);
    });
  });
});
