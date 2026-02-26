# ADR-022: Gateway Adapter Plugin Architecture

**Date:** 2026-02-25  
**Status:** Approved  
**Deciders:** Enterprise Architect, Product Owner  
**Type:** Architecture

---

## Context

YACC integrates with external messaging platforms (Telegram, IRC, and future platforms like WhatsApp, Slack, Discord). The current implementation has:

1. **`PlatformAdapter` interface** - Basic contract for adapters
2. **`GatewayExchange` service** - Central orchestration for message flow
3. **Platform-specific adapters** - `TelegramAdapter`, `IRCAdapter`

### Problems with Current Approach

1. **Tight coupling**: Adding new platforms requires modifying core gateway code
2. **No plugin extensibility**: Third-party platforms can't be added without forking
3. **Inconsistent event handling**: Each adapter implements events differently
4. **No configuration contract**: Adapters handle config validation ad-hoc
5. **Limited inter-plugin communication**: Adapters can't interact with each other

### Requirements

1. Generic interface for adding/removing message platforms
2. Plugin-style architecture - adapters implement common interface
3. Event-driven communication (like WordPress hooks)
4. Adapters define their own config schema, DB stores JSON
5. Support both sync and async operations
6. Clear interface boundaries (in-process, no isolation needed)

---

## Decision

Implement a **Gateway Adapter Plugin System** with:

### 1. Unified Hook System

Single method API inspired by WordPress hooks but adapted for async JavaScript:

```typescript
// Subscribe to a hook
gatewayHooks.on(hook, handler, options?);

// Fire a hook
gatewayHooks.do(hook, payload, context);

// Remove handler
gatewayHooks.off(hook, handler);
```

**Key design decisions:**
- Single `do()` method - `await` determines if caller waits for results
- All handlers are async (`Promise<HookResult<T>>`)
- Handlers run in parallel (priority determines invocation order)
- Errors are caught and collected, don't block other handlers
- Bidirectional: Both core and plugins can define/fire hooks

### 2. Enhanced Adapter Interface

```typescript
interface BaseAdapterConfig {
  id: string;           // Database UUID
  name: string;         // Human-readable name
  key: string;          // Unique key (e.g., 'telegram-main')
  type: PlatformType;   // Platform type enum
  enabled: boolean;     // Enable/disable
}

interface PlatformAdapter<TConfig extends BaseAdapterConfig> extends EventEmitter {
  readonly metadata: AdapterMetadata;
  readonly status: AdapterStatus;
  
  configure(config: TConfig): boolean;
  connect(): Promise<boolean>;
  disconnect(): Promise<boolean>;
  healthCheck(): Promise<HealthCheckResult>;
  send(message: OutboundMessagePayload): Promise<SendResult>;
  deleteMessage?(externalMessageId: string): Promise<boolean>;
  updateMessage?(externalMessageId: string, newBody: string): Promise<boolean>;
}

interface AdapterMetadata {
  platform: PlatformType;
  displayName: string;
  version: string;
  capabilities: AdapterCapability[];
}

type AdapterCapability = 
  | 'send_text' | 'send_attachments' | 'receive_text' | 'receive_attachments'
  | 'delete_message' | 'update_message' | 'typing_indicator' | 'read_receipts'
  | 'reactions' | 'threads' | 'presence';
```

### 3. Adapter Registry

Manages adapter lifecycle and routes to correct adapter by platform type:

```typescript
class AdapterRegistry {
  register(adapter: PlatformAdapter): void;
  connect(config: BaseAdapterConfig): Promise<boolean>;
  disconnect(type: PlatformType): Promise<boolean>;
  get(type: PlatformType): PlatformAdapter | undefined;
  getByKey(key: string): PlatformAdapter | undefined;
  getAll(): PlatformAdapter[];
  getConnected(): PlatformAdapter[];
  shutdown(): Promise<void>;
}
```

### 4. Hook Result Shape

```typescript
interface HookResult<T = unknown> {
  data: T;        // Platform-specific return data
  source: string; // Which adapter/plugin produced this
}

interface HookResults<T = unknown> {
  results: HookResult<T>[];
  errors: Array<{ source?: string; error: Error }>;
}
```

---

## Core Hooks Defined

### Lifecycle
- `gateway:init` - Gateway starting up
- `gateway:shutdown` - Gateway shutting down

### Adapter
- `adapter:registered` - Adapter registered with gateway
- `adapter:connected` - Adapter connected to platform
- `adapter:disconnected` - Adapter disconnected
- `adapter:error` - Adapter error occurred

### Message
- `message:received` - Inbound message from platform
- `message:beforePersist` - Before saving to DB (transform opportunity)
- `message:persisted` - Message saved to database
- `message:send` - Request to send outbound message
- `message:sent` - Outbound message delivered
- `message:failed` - Outbound message failed
- `message:deleted` - Message deleted
- `message:updated` - Message edited

### Conversation
- `conversation:created` - New conversation created
- `conversation:reopened` - Resolved conversation reopened

See `.docs/07-hooks.md` for full hook reference.

---

## Consequences

### Pros

1. **Extensibility**: New platforms added by implementing `PlatformAdapter` interface
2. **Loose coupling**: Core gateway doesn't need modification for new platforms
3. **Plugin communication**: Adapters can define hooks for other plugins
4. **Simple API**: Single `do()` method with `await` for control flow
5. **Type safety**: Generic config types, typed hook payloads
6. **Testability**: Hooks can be mocked, adapters tested in isolation
7. **Feature detection**: Capabilities array enables runtime feature checks

### Cons

1. **Learning curve**: Developers must understand hook system
2. **Debugging complexity**: Async parallel execution harder to trace
3. **No schema enforcement**: DB stores JSON, validation at adapter level
4. **In-process only**: No process isolation for untrusted plugins

### Mitigations

1. Comprehensive documentation in `.docs/07-hooks.md`
2. Logging with correlation IDs for hook execution
3. Adapters throw on invalid config during `configure()`
4. MVP scope is internal adapters only (trusted code)

---

## Implementation Plan

### Phase 1: Core Infrastructure
1. Create `types/gateway-hooks.types.ts` - Type definitions
2. Create `services/gateway-hooks.ts` - Hook system implementation
3. Create `infrastructure/types/adapter.interface.ts` - Enhanced interface
4. Create `services/adapter-registry.ts` - Registry implementation

### Phase 2: Migrate Existing Adapters
1. Update `TelegramAdapter` to new interface
2. Update `IRCAdapter` to new interface
3. Update `GatewayExchange` to use hooks instead of direct calls
4. Add hook calls at appropriate points in message flow

### Phase 3: Testing & Documentation
1. Unit tests for hook system
2. Integration tests for adapter registration
3. Update existing adapter tests
4. Document migration guide for existing code

---

## Files Changed

### New Files
- `packages/backend/src/types/gateway-hooks.types.ts`
- `packages/backend/src/services/gateway-hooks.ts`
- `packages/backend/src/services/adapter-registry.ts`
- `.docs/07-hooks.md`

### Modified Files
- `packages/backend/src/infrastructure/types/adapter.interface.ts`
- `packages/backend/src/infrastructure/telegram.adapter.ts`
- `packages/backend/src/infrastructure/irc.adapter.ts`
- `packages/backend/src/services/gateway-exchange.ts`
- `packages/backend/src/types/gateway.types.ts`

---

## Alternatives Considered

### 1. Keep Current EventEmitter Pattern
- **Rejected**: Adapters emit events, gateway subscribes - inverts control
- Current pattern makes adding new platforms require gateway changes

### 2. Separate Action/Filter Methods (WordPress-style)
- **Rejected**: Two methods (`doAction`, `applyFilters`) add complexity
- Single `do()` with `await` is simpler and more JavaScript-idiomatic

### 3. External Plugin System (npm packages)
- **Rejected**: Over-engineering for MVP
- May consider post-MVP if third-party adapters needed

### 4. Message Queue Between Adapters
- **Rejected**: Adds infrastructure complexity
- In-process hooks sufficient for single-tenant MVP

---

## Related Documents

- `.docs/07-hooks.md` - Hook reference documentation
- `.docs/03-implementation-guide.md` - Gateway architecture
- `ADR-005-Addendum-2` - Platform adapters in infrastructure folder

---

## Approval

**Architect Approval:**
- Name: Enterprise/Solution Architect
- Date: 2026-02-25
- Status: ✅ APPROVED

**Product Owner Approval:**
- Name: Product Owner
- Date: 2026-02-25
- Status: ✅ APPROVED
