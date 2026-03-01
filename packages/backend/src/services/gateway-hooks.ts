/**
 * GatewayHooks Service
 *
 * Provides a plugin architecture for extending message flow
 * with custom handlers at key lifecycle points.
 *
 * Features:
 * - Parallel hook execution with error isolation
 * - Priority-based handler ordering (higher = earlier)
 * - Correlation ID propagation for tracing
 * - Structured logging with LOG_LEVEL control
 *
 * @see GPA-002 - Gateway Hooks Service Implementation
 * @see ADR-022 - Gateway Plugin Architecture
 */

import { appConfig } from '../config/appConfig';
import { logger } from '../infrastructure/logger';
import type {
  GatewayHook,
  HookContext,
  HookHandler,
  HookHandlerEntry,
  HookHandlerMap,
  HookOptions,
  HookResult,
  HookResults,
} from '../types/gateway-hooks.types';


/**
 * GatewayHooks Service
 *
 * Manages registration and execution of hook handlers.
 * Supports parallel execution with error collection.
 *
 * @example
 * ```typescript
 * const hooks = new GatewayHooks();
 *
 * // Register a handler
 * hooks.on('message:received', async (payload, context) => {
 *   return { data: payload, source: 'my-plugin' };
 * }, { priority: 20 });
 *
 * // Fire the hook
 * const results = await hooks.do('message:received', message, {
 *   correlationId: 'abc123',
 *   timestamp: Date.now(),
 * });
 * ```
 */
export class GatewayHooks {
  private handlers: HookHandlerMap = new Map();
  private logLevel: 'debug' | 'info' | 'warn' | 'error';

  /**
   * Create a GatewayHooks instance
   *
   * @param options - Optional configuration
   * @param options.logLevel - Log level override (default: from appConfig.LOG_LEVEL)
   */
  constructor(options?: { logLevel?: 'debug' | 'info' | 'warn' | 'error' }) {
    // Use provided log level or default from appConfig (lowercase, matches Zod schema)
    this.logLevel = options?.logLevel ?? appConfig.LOG_LEVEL;
  }

  /**
   * Register a hook handler
   *
   * @param hook - Hook name to listen for
   * @param handler - Async handler function
   * @param options - Optional configuration (priority: number, default: 10)
   *
   * @example
   * ```typescript
   * hooks.on('message:received', handler, { priority: 20 });
   * ```
   */
  on<T>(hook: GatewayHook, handler: HookHandler<T>, options?: HookOptions): void {
    if (!this.handlers.has(hook)) {
      this.handlers.set(hook, []);
    }

    const priority = options?.priority ?? 10;
    const handlers = this.handlers.get(hook);

    if (handlers) {
      handlers.push({ handler: handler as HookHandler, priority });
      // Sort by priority descending (higher = earlier)
      handlers.sort((a, b) => b.priority - a.priority);
    }

    if (this.logLevel === 'debug') {
      logger.debug(
        { hook, priority, handlerCount: handlers?.length },
        `Registered hook handler for ${hook} (priority: ${priority})`
      );
    }
  }

  /**
   * Remove a hook handler
   *
   * @param hook - Hook name
   * @param handler - Handler function to remove
   * @returns true if handler was found and removed, false otherwise
   *
   * @example
   * ```typescript
   * const wasRemoved = hooks.off('message:received', myHandler);
   * ```
   */
  off<T>(hook: GatewayHook, handler: HookHandler<T>): boolean {
    const handlers = this.handlers.get(hook);
    if (!handlers) {
      return false;
    }

    const index = handlers.findIndex((h) => h.handler === handler);
    if (index === -1) {
      return false;
    }

    handlers.splice(index, 1);

    // Clean up empty arrays
    if (handlers.length === 0) {
      this.handlers.delete(hook);
    }

    if (this.logLevel === 'debug') {
      logger.debug({ hook }, `Removed hook handler for ${hook}`);
    }

    return true;
  }

  /**
   * Fire a hook (parallel execution with error collection)
   *
   * All handlers execute in parallel regardless of individual failures.
   * Errors are collected and returned, not thrown.
   *
   * @param hook - Hook name to fire
   * @param payload - Data passed to all handlers
   * @param context - Execution context (correlationId, timestamp, etc.)
   * @returns Promise resolving to results and errors from all handlers
   *
   * @example
   * ```typescript
   * const { results, errors } = await hooks.do('message:received', message, {
   *   correlationId: 'abc123',
   *   timestamp: Date.now(),
   *   source: 'telegram-adapter',
   * });
   * ```
   */
  async do<T>(hook: GatewayHook, payload: T, context: HookContext): Promise<HookResults<T>> {
    const handlers = this.handlers.get(hook);
    const results: HookResult<T>[] = [];
    const errors: Array<{ source?: string; error: Error }> = [];

    // No handlers registered
    if (!handlers || handlers.length === 0) {
      if (this.logLevel === 'debug') {
        logger.debug({ hook, correlationId: context.correlationId }, `No handlers registered for hook ${hook}`);
      }
      return { results: [], errors: [] };
    }

    if (this.logLevel === 'debug') {
      const priorities = handlers.map((h) => h.priority);
      logger.debug(
        {
          hook,
          handlerCount: handlers.length,
          priorities,
          correlationId: context.correlationId,
        },
        `Firing hook ${hook} with ${handlers.length} handlers`
      );
    }

    // Execute all handlers in parallel
    const promises = handlers.map(async (entry: HookHandlerEntry) => {
      const startTime = Date.now();
      try {
        const result = await entry.handler(payload, context);
        const duration = Date.now() - startTime;

        if (this.logLevel === 'debug') {
          logger.debug(
            {
              hook,
              priority: entry.priority,
              source: result.source,
              duration,
              correlationId: context.correlationId,
            },
            `Hook ${hook} handler completed in ${duration}ms (source: ${result.source})`
          );
        }

        results.push(result as HookResult<T>);
      } catch (err) {
        const duration = Date.now() - startTime;
        const error = err instanceof Error ? err : new Error(String(err));

        logger.error(
          {
            hook,
            priority: entry.priority,
            error: error.message,
            stack: error.stack,
            duration,
            correlationId: context.correlationId,
            source: context.source,
          },
          `Hook ${hook} handler failed: ${error.message}`
        );

        errors.push({
          source: context.source,
          error,
        });
      }
    });

    // Wait for all handlers to complete
    await Promise.all(promises);

    // Log summary
    if (this.logLevel === 'debug') {
      logger.debug(
        {
          hook,
          successCount: results.length,
          errorCount: errors.length,
          correlationId: context.correlationId,
        },
        `Hook ${hook} completed (${results.length} success, ${errors.length} errors)`
      );
    } else if (this.logLevel === 'info') {
      logger.info(
        {
          hook,
          handlerCount: handlers.length,
          successCount: results.length,
          errorCount: errors.length,
          correlationId: context.correlationId,
        },
        `Hook ${hook} fired (${handlers.length} handlers, ${results.length} success, ${errors.length} errors)`
      );
    }

    return { results, errors };
  }

  /**
   * Get the number of handlers registered for a hook
   *
   * @param hook - Hook name
   * @returns Number of registered handlers
   */
  getHandlerCount(hook: GatewayHook): number {
    return this.handlers.get(hook)?.length ?? 0;
  }

  /**
   * Clear handlers for a specific hook or all hooks
   *
   * @param hook - Optional hook name. If omitted, clears all handlers.
   *
   * @example
   * ```typescript
   * hooks.clearHandlers('message:received'); // Clear specific hook
   * hooks.clearHandlers(); // Clear all hooks
   * ```
   */
  clearHandlers(hook?: GatewayHook): void {
    if (hook) {
      this.handlers.delete(hook);
      if (this.logLevel === 'debug') {
        logger.debug({ hook }, `Cleared handlers for hook ${hook}`);
      }
    } else {
      this.handlers.clear();
      if (this.logLevel === 'debug') {
        logger.debug('Cleared all hook handlers');
      }
    }
  }

  /**
   * Clear all handlers (alias for clearHandlers())
   *
   * Convenience method for clearing all handlers.
   */
  clearAll(): void {
    this.clearHandlers();
  }
}

/**
 * Singleton instance for use across the application
 */
export const gatewayHooks = new GatewayHooks();
