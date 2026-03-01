# 07. Gateway Hooks Reference

**YACC - Gateway Adapter Plugin System Hook Definitions**

---

## Overview

The YACC Gateway uses a middleware-style hook system for adapter integration. This provides a clear contract between the core gateway and platform adapters.

**Single unified API:**
- `gatewayHooks.on(hook, handler)` - Subscribe to a hook
- `gatewayHooks.do(hook, payload, context)` - Fire a hook
- `await` determines if you wait for results or fire-and-forget

**Bidirectional:** Both core gateway AND adapters/plugins can:
- Register handlers for existing hooks
- Define and fire new hooks
- Subscribe to hooks defined by other plugins

---

## Core Hooks

### Lifecycle Hooks

| Hook Name | When Fired | Payload | Context | Use Case |
|-----------|------------|---------|---------|----------|
| `gateway:init` | Gateway starting up | `{ adapters: PlatformAdapter[] }` | `{}` | Plugin initialization, resource setup |
| `gateway:shutdown` | Gateway shutting down | `{ reason: string }` | `{}` | Cleanup resources, close connections |

### Adapter Hooks

| Hook Name | When Fired | Payload | Context | Use Case |
|-----------|------------|---------|---------|----------|
| `adapter:registered` | After adapter registers | `{ platform: PlatformType, adapter: PlatformAdapter }` | `{}` | Logging, metrics, health tracking |
| `adapter:connected` | Adapter connected to platform | `{ platform: PlatformType, config: BaseAdapterConfig }` | `{}` | Status updates, reset failure counters |
| `adapter:disconnected` | Adapter disconnected | `{ platform: PlatformType, reason: string }` | `{}` | Reconnect logic, alerting |
| `adapter:error` | Adapter error occurred | `{ platform: PlatformType, error: Error }` | `{}` | Error tracking, circuit breaker |

### Message Hooks

| Hook Name | When Fired | Payload | Context | Use Case |
|-----------|------------|---------|---------|----------|
| `message:received` | Inbound message from platform | `{ platform: PlatformType, event: InboundMessageEvent }` | `{ adapter: PlatformAdapter }` | Core ingestion flow |
| `message:beforePersist` | Before saving message to DB | `{ message: Message, conversation: Conversation }` | `{ platform: PlatformType }` | Sanitize, transform, validate |
| `message:persisted` | Message saved to database | `{ messageId: string, conversationId: string, direction: 'inbound' \| 'outbound' }` | `{ platform: PlatformType }` | Notifications, rules engine |
| `message:send` | Request to send outbound message | `{ messageId: string, conversationId: string, body: string, platform: PlatformType }` | `{ adapter: PlatformAdapter }` | Adapter handles send |
| `message:sent` | Outbound message delivered | `{ messageId: string, conversationId: string, externalMessageId: string }` | `{ platform: PlatformType }` | Status updates, confirmation |
| `message:failed` | Outbound message failed | `{ messageId: string, conversationId: string, error: SendError, retryable: boolean }` | `{ platform: PlatformType }` | Retry queue, DLQ logic |
| `message:deleted` | Message deleted | `{ messageId: string, externalMessageId: string }` | `{ platform: PlatformType }` | Sync state, audit |
| `message:updated` | Message edited | `{ messageId: string, externalMessageId: string, newBody: string }` | `{ platform: PlatformType }` | Sync state, audit |

### Conversation Hooks

| Hook Name | When Fired | Payload | Context | Use Case |
|-----------|------------|---------|---------|----------|
| `conversation:created` | New conversation created | `{ conversationId: string, platform: PlatformType, externalThreadId: string }` | `{}` | Rules engine, auto-assignment |
| `conversation:reopened` | Resolved conversation reopened | `{ conversationId: string, messageId: string }` | `{}` | Notifications, status tracking |

---

## Hook API

### Registering Handlers

```typescript
import { gatewayHooks } from '../services/gateway-hooks';

// Register a handler
gatewayHooks.on('message:persisted', async (payload, ctx) => {
  console.log(`Message ${payload.messageId} persisted`);
  
  // Do async work
  await sendNotification(payload.conversationId);
  
  // Return result
  return {
    data: { notified: true },
    source: 'notification-plugin',
  };
});

// Register with priority (higher = earlier, default = 10)
gatewayHooks.on('message:send', handler, { priority: 20 });
```

### Firing Hooks

```typescript
import { gatewayHooks } from '../services/gateway-hooks';

// Fire and wait for results
const { results, errors } = await gatewayHooks.do('message:beforePersist', 
  { message, conversation }, 
  { platform: 'telegram' }
);

// Fire and continue (don't wait)
gatewayHooks.do('message:persisted', { messageId, conversationId, direction: 'inbound' }, {});
// Next line runs immediately
```

### Removing Handlers

```typescript
// Define handler function
const myHandler = async (payload, ctx) => { /* ... */ };

// Register (on() returns void - keep reference to handler if needed for removal)
gatewayHooks.on('message:sent', myHandler);

// Later, remove using off()
gatewayHooks.off('message:sent', myHandler);
```

---

## Handler Return Shape

All handlers return the same shape:

```typescript
interface HookResult<T = unknown> {
  /** Return data - platform/plugin specific */
  data: T;
  /** Which adapter/plugin produced this result */
  source: string;
}
```

**Example:**

```typescript
gatewayHooks.on('message:send', async (payload, ctx) => {
  const result = await telegramApi.sendMessage(payload.body);
  
  return {
    data: {
      externalMessageId: result.message_id,
      sentAt: new Date(),
    },
    source: 'telegram-adapter',
  };
});
```

**On error:** Throw an exception. Errors are caught, logged, and collected in `errors` array.

```typescript
gatewayHooks.on('config:validate', async (payload, ctx) => {
  if (!payload.botToken) {
    throw new Error('botToken is required');
  }
  
  return { data: payload, source: 'telegram-adapter' };
});
```

---

## Aggregated Results

When awaiting `gatewayHooks.do()`:

```typescript
interface HookResults<T = unknown> {
  /** All successful results */
  results: HookResult<T>[];
  /** Errors from failed handlers */
  errors: Array<{ source?: string; error: Error }>;
}
```

**Example:**

```typescript
const { results, errors } = await gatewayHooks.do('message:send', payload, ctx);

// Check results
for (const result of results) {
  console.log(`${result.source} returned:`, result.data);
}

// Check errors
if (errors.length > 0) {
  console.warn(`${errors.length} handlers failed`);
}

// Get last result (common pattern for transforms)
const finalData = results.at(-1)?.data ?? payload;
```

---

## Adapter Implementation Example

```typescript
import { EventEmitter } from 'events';
import { gatewayHooks } from '../services/gateway-hooks';
import type { PlatformAdapter, TelegramAdapterConfig } from './types/adapter.interface';

export class TelegramAdapter extends EventEmitter implements PlatformAdapter {
  readonly metadata = {
    platform: 'telegram' as const,
    displayName: 'Telegram',
    version: '1.0.0',
    capabilities: ['send_text', 'send_attachments', 'receive_text', 'delete_message'],
  };
  
  status: AdapterStatus = 'disconnected';
  private config: TelegramAdapterConfig | null = null;

  constructor() {
    super();
    this.registerHooks();
  }

  private registerHooks(): void {
    // Handle send requests
    gatewayHooks.on('message:send', async (payload, ctx) => {
      if (payload.platform !== 'telegram') {
        return { data: null, source: 'telegram-adapter' }; // Not for us
      }
      
      const result = await this.sendToTelegram(payload);
      
      // Update message status
      await db.update(messages).set({ 
        status: 'sent', 
        externalMessageId: result.message_id 
      });
      
      // Fire sent hook
      gatewayHooks.do('message:sent', {
        messageId: payload.messageId,
        conversationId: payload.conversationId,
        externalMessageId: result.message_id,
      }, { platform: 'telegram' });
      
      return {
        data: { externalMessageId: result.message_id },
        source: 'telegram-adapter',
      };
    });

    // Handle shutdown
    gatewayHooks.on('gateway:shutdown', async () => {
      await this.disconnect();
      return { data: { disconnected: true }, source: 'telegram-adapter' };
    });
  }

  configure(config: TelegramAdapterConfig): boolean {
    if (!config.botToken) return false;
    this.config = config;
    return true;
  }

  async connect(): Promise<boolean> {
    // Fire custom hook - other plugins can subscribe
    gatewayHooks.do('telegram:beforeConnect', { config: this.config }, {});
    
    const success = await this.doConnect();
    this.status = success ? 'connected' : 'error';
    
    return success;
  }

  async disconnect(): Promise<boolean> {
    this.status = 'disconnected';
    return true;
  }

  // ... rest of implementation
}
```

---

## Plugin-Defined Hooks

Plugins can define and fire their own hooks. No registration required - hooks are created on first use.

**Naming convention:**
- Core hooks: `{entity}:{action}` (e.g., `message:sent`)
- Platform hooks: `{platform}:{action}` (e.g., `telegram:rateLimit`)
- Plugin hooks: `{plugin}:{action}` (e.g., `analytics:tracked`)

**Example - Analytics plugin:**

```typescript
// analytics.plugin.ts

class AnalyticsPlugin {
  register(): void {
    // Subscribe to core hooks
    gatewayHooks.on('message:sent', async (payload, ctx) => {
      await this.track('message_sent', payload);
      
      // Fire plugin-specific hook
      gatewayHooks.do('analytics:tracked', { 
        event: 'message_sent', 
        messageId: payload.messageId 
      }, {});
      
      return { data: { tracked: true }, source: 'analytics-plugin' };
    });

    // Subscribe to platform-specific hooks
    gatewayHooks.on('telegram:rateLimit', async (payload, ctx) => {
      await this.track('rate_limit_hit', { platform: 'telegram', ...payload });
      return { data: {}, source: 'analytics-plugin' };
    });
  }
}

// Other plugins can subscribe to analytics hooks
gatewayHooks.on('analytics:tracked', async (payload, ctx) => {
  console.log(`Event tracked: ${payload.event}`);
  return { data: {}, source: 'logging-plugin' };
});
```

---

## Execution Behavior

### Parallel Execution
All handlers for a hook run in parallel via `Promise.all`. Order is not guaranteed for completion, but handlers are invoked in priority order.

### Error Handling
- Errors are caught and logged
- Other handlers continue to run
- Errors collected in `errors` array
- Throwing is the correct way to indicate failure

### Priority
- Higher number = earlier execution (runs first)
- Default priority is 10
- Use priority to ensure handler order when needed

```typescript
// Runs first (priority 20 - highest)
gatewayHooks.on('message:send', validateHandler, { priority: 20 });

// Runs second (priority 15)
gatewayHooks.on('message:send', formatHandler, { priority: 15 });

// Runs last (priority 1 - lowest)
gatewayHooks.on('message:send', sendHandler, { priority: 1 });
```

---

## Hook Lifecycle Guarantees

### Registration Guarantees

| Guarantee | Description |
|-----------|-------------|
| **Idempotent Registration** | Registering the same handler multiple times creates multiple entries (use `off()` first if needed) |
| **Immediate Availability** | Handlers are available immediately after `on()` returns |
| **Manual Unsubscribe** | Use `off(handler)` to remove handlers; `on()` returns void |
| **Source Tracking** | Each handler can specify a `source` for debugging and error attribution |

### Execution Guarantees

| Guarantee | Description |
|-----------|-------------|
| **Parallel Execution** | All handlers for a hook run in parallel (Promise.all) |
| **Error Isolation** | One handler throwing does not prevent other handlers from running |
| **Result Collection** | All successful results are collected in `results` array |
| **Error Collection** | All errors are collected in `errors` array with source attribution |
| **Non-Blocking Fire** | Calling `do()` without `await` allows fire-and-forget pattern |

### Ordering Guarantees

| Guarantee | Description |
|-----------|-------------|
| **Priority Order** | Handlers are invoked in priority order (higher = earlier) |
| **Default Priority** | Handlers without explicit priority use default of 10 |
| **Same Priority** | Order among handlers with same priority is not guaranteed |
| **Invocation vs Completion** | Invocation order follows priority; completion order is not guaranteed |

### Memory Guarantees

| Guarantee | Description |
|-----------|-------------|
| **No Handler Leaks** | Use `off()`, `clearHook()`, or `clearAll()` to remove handlers |
| **Manual Reference** | Keep handler reference if you need to remove it later with `off()` |

---

## Hook Naming Convention

### Convention Table

| Category | Pattern | Examples | Owner |
|----------|---------|----------|-------|
| **Core Lifecycle** | `gateway:{action}` | `gateway:init`, `gateway:shutdown` | Core System |
| **Core Adapter** | `adapter:{action}` | `adapter:registered`, `adapter:connected`, `adapter:disconnected`, `adapter:error` | Core System |
| **Core Message** | `message:{action}` | `message:received`, `message:beforePersist`, `message:persisted`, `message:send`, `message:sent`, `message:failed`, `message:deleted`, `message:updated` | Core System |
| **Core Conversation** | `conversation:{action}` | `conversation:created`, `conversation:reopened` | Core System |
| **Platform-Specific** | `{platform}:{action}` | `telegram:rateLimit`, `irc:nickTaken`, `telegram:webhook` | Platform Adapter |
| **Plugin-Specific** | `{plugin}:{action}` | `analytics:tracked`, `metrics:recorded`, `audit:logged` | Plugin Owner |

### Naming Rules

1. **Use lowercase with colons**: `entity:action` not `entity/action` or `Entity:Action`
2. **Use camelCase for multi-word actions**: `message:beforePersist` not `message:before-persist`
3. **Be specific**: `message:beforePersist` not `message:preSave`
4. **Use present tense for events**: `message:sent` not `message:sendComplete`
5. **Use past tense for completed actions**: `message:persisted` not `message:persist`

### Reserved Namespaces

| Namespace | Reserved For | Notes |
|-----------|--------------|-------|
| `gateway:*` | Core system lifecycle | Do not use in adapters/plugins |
| `adapter:*` | Core adapter lifecycle | Extended by adapters for custom events |
| `message:*` | Message flow | Core message processing pipeline |
| `conversation:*` | Conversation lifecycle | Core conversation management |
| `telegram:*` | Telegram adapter | Telegram-specific events |
| `irc:*` | IRC adapter | IRC-specific events |

---

## Multi-Profile Key Policy

### Overview

The AdapterRegistry supports multiple configuration profiles per platform through a key-based lookup system. This enables scenarios like:
- Multiple IRC network connections (e.g., Libera, OFTC)
- Multiple Telegram bots for different purposes
- Per-tenant adapter instances (future multi-tenant support)

### Key Resolution Policy

| Scenario | Resolution Strategy | Example |
|----------|---------------------|---------|
| **No key specified** | Use platform default adapter | `registry.get('telegram')` |
| **Key specified** | Look up adapter by key | `registry.getByKey('telegram-sales-bot')` |
| **Key not found** | Returns `undefined` (no fallback) | `registry.getByKey('unknown-key')` → `undefined` |

### Key Format Requirements

```typescript
interface BaseAdapterConfig {
  id: string;        // UUID from database
  name: string;      // Human-readable name
  key?: string;      // Unique key for multi-profile support
  type: PlatformType;
  enabled: boolean;
}
```

**Key naming convention:**
- Use kebab-case: `telegram-sales-bot` not `telegram_sales_bot`
- Include platform prefix: `irc-libera`, `telegram-support`
- Be descriptive: `irc-production` not `irc1`

### Hook Integration with Keys

When adapters are connected with a key, the hook payloads include the key for traceability:

```typescript
// adapter:connected payload includes key
{
  platform: 'telegram',
  config: {
    id: 'uuid-123',
    name: 'Sales Bot',
    key: 'telegram-sales-bot',  // Included for multi-profile
    type: 'telegram',
    enabled: true,
  }
}

// adapter:error payload includes key
{
  platform: 'telegram',
  error: new Error('Connection failed'),
  key: 'telegram-sales-bot',  // Included for multi-profile
}
```

### Multi-Profile Best Practices

1. **Always use keys for multiple profiles**: Don't rely on platform default when multiple profiles exist
2. **Document key usage**: Log the key when connecting adapters for debugging
3. **Handle key not found**: Implement fallback logic when `getByKey()` returns undefined
4. **Clean up on disconnect**: Remove keys from `adaptersByKey` map when adapters are disconnected

### Example: Multiple IRC Networks

```typescript
// Register IRC adapter (shared instance)
registry.register(new IRCAdapter());

// Connect to multiple networks with different keys
await registry.connect({
  id: 'uuid-1',
  name: 'Libera Chat',
  key: 'irc-libera',
  type: 'irc',
  enabled: true,
  credentials: { server: 'irc.libera.chat', ... },
});

await registry.connect({
  id: 'uuid-2', 
  name: 'OFTC',
  key: 'irc-oftc',
  type: 'irc',
  enabled: true,
  credentials: { server: 'irc.oftc.net', ... },
});

// Look up specific network
const liberaAdapter = registry.getByKey('irc-libera');
const oftcAdapter = registry.getByKey('irc-oftc');
```

---

## Type System Alignment

The hook type definitions in `packages/backend/src/types/gateway-hooks.types.ts` must stay synchronized with this documentation.

### Key Types

```typescript
// All valid hook names (union type)
type HookName = 
  | 'gateway:init' | 'gateway:shutdown'
  | 'adapter:registered' | 'adapter:connected' | 'adapter:disconnected' | 'adapter:error'
  | 'message:received' | 'message:beforePersist' | 'message:persisted' 
  | 'message:send' | 'message:sent' | 'message:failed' | 'message:deleted' | 'message:updated'
  | 'conversation:created' | 'conversation:reopened';

// Handler function signature
type HookHandler<TPayload = unknown, TResult = unknown> = (
  payload: TPayload,
  context: HookContext
) => Promise<HookResult<TResult>>;

// Handler return shape
interface HookResult<T = unknown> {
  data: T;
  source: string;
}

// Aggregated results from do()
interface HookResults<T = unknown> {
  results: HookResult<T>[];
  errors: Array<{ source?: string; error: Error }>;
}
```

### Adding New Hook Types

When adding a new hook, update in this order:

1. **Add to HookName union** in `types/gateway-hooks.types.ts`
2. **Add payload type** if needed (e.g., `MessageDeletedPayload`)
3. **Add to HookPayloadMap** for type-safe firing
4. **Update this documentation** with the new hook
5. **Add tests** for the new hook behavior

---

## Adding New Hooks

When adding new hooks:

1. Add hook definition to this document (table + description)
2. Add TypeScript types to `types/gateway-hooks.types.ts`
3. Document in ADR if hook changes architectural behavior
4. Notify existing adapters if hook is required

---

## Related Documents

- `.docs/02-api-and-data-model.md` - Message and conversation data models
- `.docs/03-implementation-guide.md` - Gateway architecture overview
- `.docs/adr/ADR-022-gateway-adapter-plugin-architecture.md` - Architecture decision record

---

**Last Updated**: 2026-02-25  
**Status**: Approved  
**Owner**: Enterprise Architect
