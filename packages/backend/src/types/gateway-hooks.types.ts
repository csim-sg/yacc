/**
 * Gateway Hooks Type Definitions
 *
 * Type definitions for the gateway hook system.
 * Provides a plugin architecture for extending message flow
 * with custom handlers at key lifecycle points.
 *
 * @see GPA-001 - Gateway Hooks Type Definitions
 */

/**
 * Single handler result from a hook execution
 */
export type HookResult<T = unknown> = {
  /** Data returned by the handler */
  data: T;
  /** Adapter or source identifier */
  source: string;
  /** Optional timestamp when result was created */
  timestamp?: number;
};

/**
 * Aggregated results from all handlers for a hook
 */
export type HookResults<T = unknown> = {
  /** Successful results from handlers */
  results: HookResult<T>[];
  /** Errors collected during execution */
  errors: Array<{ source?: string; error: Error }>;
};

/**
 * Function signature for hook handlers
 */
export type HookHandler<T = unknown> = (
  payload: T,
  context: HookContext
) => Promise<HookResult<T>>;

/**
 * Runtime context passed to hook handlers
 */
export type HookContext = {
  /** Unique identifier for tracing the hook execution */
  correlationId: string;
  /** Timestamp when the hook was fired */
  timestamp: number;
  /** Source adapter or service that fired the hook */
  source?: string;
  /** Additional metadata for the hook execution */
  metadata?: Record<string, unknown>;
};

/**
 * Gateway Hook Names
 *
 * All supported hooks in the gateway system.
 * Organized by category: gateway lifecycle, adapter lifecycle, message flow, conversation flow.
 */
export type GatewayHook =
  // Gateway lifecycle
  | 'gateway:init'
  | 'gateway:shutdown'
  // Adapter lifecycle
  | 'adapter:registered'
  | 'adapter:connected'
  | 'adapter:disconnected'
  | 'adapter:error'
  // Message flow
  | 'message:received'
  | 'message:beforePersist'
  | 'message:persisted'
  | 'message:send'
  | 'message:sent'
  | 'message:failed'
  // Conversation flow
  | 'conversation:created'
  | 'conversation:reopened';

/**
 * Options for registering a hook handler
 */
export type HookOptions = {
  /** Priority for handler execution (higher = earlier, default: 10) */
  priority?: number;
};

/**
 * Internal registry entry for a hook handler
 */
export type HookHandlerEntry = {
  /** The handler function */
  handler: HookHandler;
  /** Priority for execution order */
  priority: number;
};

/**
 * Internal registry structure mapping hook names to handlers
 */
export type HookHandlerMap = Map<GatewayHook, HookHandlerEntry[]>;
