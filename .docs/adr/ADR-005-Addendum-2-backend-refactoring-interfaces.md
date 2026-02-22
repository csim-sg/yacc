# ADR-005 Addendum-2: Backend Refactoring - Interface Definitions & Architectural Decisions

**Date**: 2026-02-22  
**Status**: APPROVED  
**Authors**: Enterprise Architect  
**Related**: ADR-005 (Config vs Infrastructure Pattern), GOV-030 (Governance Log)

---

## Overview

This addendum captures architectural decisions and interface definitions for backend refactoring tasks **DEV-002 through DEV-006**. These tasks refactor the messaging architecture to align with ADR-005 (flat folder structure, config vs infrastructure pattern) and improve separation of concerns.

**Context**: After completing BE-003 (Telegram integration) and BE-004 (IRC integration), technical debt analysis revealed:
- Service layer confusion (4 auth services, unclear boundaries)
- Connector/adapter duplication (violates flat structure)
- No unified gateway for inbound/outbound orchestration
- Inconsistent event patterns between platforms

**Goal**: Establish clear interfaces, event patterns, and service boundaries for maintainable, testable messaging architecture.

---

## Decisions

### Decision 1: Event-Driven Pattern

**Choice**: **Node.js EventEmitter** (Standard Library)

**Rationale**:
- **KISS Principle**: Built-in, zero dependencies, widely understood pattern
- **Sufficient for MVP**: No backpressure concerns with current scale (2 platforms, single-tenant)
- **Team Familiarity**: Standard Node.js pattern, low learning curve
- **Testability**: Easy to mock/spy with Jest/Vitest
- **Migration Path**: If Phase 2 multi-tenant requires backpressure handling, migrate to RxJS with minimal interface changes

**Rejected Alternatives**:
- ❌ **RxJS Observables**: Adds dependency + complexity without clear MVP benefit
- ❌ **Custom Observer Pattern**: Maintenance burden without compelling advantage

**Implementation**:
```typescript
// infrastructure/telegram.adapter.ts
export class TelegramAdapter extends EventEmitter implements PlatformAdapter {
  private handleIncomingMessage(rawMessage: TelegramMessage) {
    const event: InboundMessageEvent = this.transformToEvent(rawMessage);
    this.emit('message:inbound', event);
  }
}

// gateway-exchange.ts
export class GatewayExchange {
  registerAdapter(adapter: PlatformAdapter) {
    adapter.on('message:inbound', (event) => this.handleInbound(event));
    adapter.on('adapter:error', (error) => this.handleAdapterError(error));
    adapter.on('adapter:connected', () => logger.info(`${adapter.platform} connected`));
    adapter.on('adapter:disconnected', ({ reason }) => logger.warn(`${adapter.platform} disconnected: ${reason}`));
  }
}
```

**Event Catalog** (Emitted by PlatformAdapter):
- `message:inbound` → `(event: InboundMessageEvent)` - New message received from platform
- `adapter:connected` → `void` - Adapter successfully connected
- `adapter:disconnected` → `{ reason: string }` - Adapter disconnected (expected or error)
- `adapter:error` → `(error: Error)` - Non-fatal error (e.g., failed to fetch updates)

---

### Decision 2: ConnectorManager Scope

**Choice**: **Delete `connectors/` folder entirely**

**Rationale**:
- **ADR-005 Compliance**: Flat folder structure mandates no nested layers (`connectors/` violates this)
- **Eliminates Duplication**: Current `connectors/*.connector.ts` duplicates adapter logic
- **Clear Separation**: `infrastructure/` for singleton clients (adapters), `services/` for business logic
- **Single Source of Truth**: All platform-specific code in `infrastructure/*.adapter.ts`

**Rejected Alternatives**:
- ❌ **Keep `connectors/` as thin wrappers**: Violates flat structure, adds unnecessary indirection
- ❌ **Rename to `adapters/`**: Just renames the problem, doesn't align with infrastructure pattern

**Migration Plan** (DEV-004):
1. Move logic from `connectors/irc.connector.ts` → `infrastructure/irc.adapter.ts`
2. Move logic from `connectors/telegram.connector.ts` → `infrastructure/telegram.adapter.ts`
3. Update imports in:
   - `services/message.service.ts`
   - `workers/outboundMessageRetry.worker.ts`
   - `gateway-exchange.ts` (new file in DEV-003)
4. Delete `src/connectors/` folder
5. Update tests to reference new paths

**Backward Compatibility**: None needed (internal refactoring, no API changes)

---

### Decision 3: Auth Service Consolidation

**Choice**: **Thin Wrapper Pattern** (`authentication.service.ts`)

**Rationale**:
- **KISS Principle**: Minimal refactoring, low risk, MVP-focused
- **Single Entry Point**: Controllers call one service instead of four (login, passwordReset, users, passwordValidation)
- **Preserves Tested Logic**: Existing services (`login.service.ts`, `passwordReset.service.ts`) remain intact
- **Future-Proof**: Easy to add 2FA/passkeys in Phase 2 without re-architecting

**Rejected Alternatives**:
- ❌ **Session Orchestrator**: Over-engineers for MVP (no complex auth workflows yet)
- ❌ **Auth Facade**: Unnecessary abstraction (no 2FA/passkeys in MVP)

**Service Scope**:
```typescript
// services/authentication.service.ts
import { LoginService } from './login.service';
import { PasswordResetService } from './passwordReset.service';
import { UsersService } from './users.service';

export class AuthenticationService {
  constructor(
    private loginService: LoginService,
    private passwordResetService: PasswordResetService,
    private usersService: UsersService
  ) {}

  // Login/logout operations
  async login(email: string, password: string): Promise<Session> {
    return this.loginService.login(email, password);
  }

  async logout(sessionId: string): Promise<void> {
    return this.loginService.logout(sessionId);
  }

  // Password reset operations
  async initiatePasswordReset(email: string): Promise<void> {
    return this.passwordResetService.initiateReset(email);
  }

  async completePasswordReset(token: string, newPassword: string): Promise<void> {
    return this.passwordResetService.completeReset(token, newPassword);
  }

  // User retrieval (for session validation)
  async getCurrentUser(userId: string): Promise<User> {
    return this.usersService.findById(userId);
  }
}
```

**Files to Keep/Refactor**:
- ✅ **KEEP**: `services/login.service.ts` (internal logic unchanged)
- ✅ **KEEP**: `services/passwordReset.service.ts` (internal logic unchanged)
- ✅ **KEEP**: `services/passwordValidation.service.ts` (dependency of passwordReset)
- ✅ **KEEP**: `services/users.service.ts` (used by multiple services)
- ✅ **CREATE**: `services/authentication.service.ts` (new thin wrapper)
- ✅ **UPDATE**: All auth controllers to import `AuthenticationService`

**Controller Changes**:
```typescript
// Before (BE-001):
import { LoginService } from '../services/login.service';
import { PasswordResetService } from '../services/passwordReset.service';

// After (DEV-002):
import { AuthenticationService } from '../services/authentication.service';
```

---

### Decision 4: Event Ordering Guarantees

**Choice**: **Best-Effort Ordering** (with safeguards)

**Rationale**:
- **KISS Principle**: Direct event handling, no per-conversation queuing complexity
- **MVP Traffic**: Single-tenant, 2 platforms, low message volume → race conditions unlikely
- **Database Guarantees**: PostgreSQL ACID transactions ensure write consistency
- **UI Resilience**: Frontend sorts by `receivedAt` timestamp (handles out-of-order display)
- **Idempotency**: Duplicate detection via `externalMessageId` prevents double-processing

**Rejected Alternatives**:
- ❌ **FIFO per conversation**: Adds queuing complexity not justified by MVP scale
- ❌ **Global FIFO**: Creates bottleneck, unacceptable for real-time application

**Safeguards**:
1. **Database Indexing**: `messages.received_at` indexed for fast sorting
2. **UI Sorting**: Frontend always orders by `receivedAt` (not `created_at`)
3. **Idempotency Check**: Before inserting message, check if `externalMessageId` exists
4. **Transaction Atomicity**: Conversation + message creation in single DB transaction

**Implementation**:
```typescript
// gateway-exchange.ts
async handleInbound(event: InboundMessageEvent): Promise<void> {
  // Direct processing (no queueing)
  await db.transaction(async (tx) => {
    // Idempotency check
    const existing = await tx.messages.findByExternalId(event.externalThreadId, event.sender.externalUserId);
    if (existing) {
      logger.warn('Duplicate message detected, skipping', { event });
      return;
    }
    
    // Atomic write
    const conversation = await tx.conversations.createOrUpdate(event);
    const message = await tx.messages.create(event, conversation.id);
    
    // Async notifications (non-blocking)
    await this.websocketService.broadcast('conversation_updated', conversation);
    await this.auditService.log('message.received', { conversation, message });
  });
}
```

**Migration Path**: If Phase 2 multi-tenant shows race conditions, add BullMQ per-conversation queues.

---

### Decision 5: Error Handling Strategy

**Choice**: **Hybrid - DLQ + Simplified Circuit Breaker**

**Rationale**:
- **Prevents Infinite Loops**: Failed events logged to DLQ, not retried immediately
- **Manual Recovery**: Ops reviews DLQ, fixes root cause, replays messages
- **Circuit Breaker Safety**: If 5+ consecutive failures, adapter disconnects (prevents cascade)
- **Audit Trail**: All failures logged with full context (`correlationId`, `rawPayload`)

**Rejected Alternatives**:
- ❌ **Immediate Retry**: Risks infinite loops without exponential backoff
- ❌ **Full Circuit Breaker (Hystrix-style)**: Over-engineers for MVP

**Error Handling Flow**:
```typescript
// gateway-exchange.ts
private errorCounts: Map<string, number> = new Map();

async handleInbound(event: InboundMessageEvent): Promise<void> {
  try {
    await this.processInbound(event);
    this.errorCounts.set(event.platform, 0); // Reset on success
  } catch (error) {
    // Log to DLQ (database table)
    await this.deadLetterQueue.insert({
      platform: event.platform,
      event_payload: event,
      error_message: error.message,
      error_stack: error.stack,
      correlation_id: event.correlationId,
    });
    
    // Increment error counter
    const count = (this.errorCounts.get(event.platform) || 0) + 1;
    this.errorCounts.set(event.platform, count);
    
    // Circuit breaker: disconnect after 5 consecutive failures
    if (count >= 5) {
      logger.error(`Circuit breaker triggered for ${event.platform}`, { count });
      await this.adapters.get(event.platform)?.disconnect();
      // Requires manual ops intervention to reconnect
    }
  }
}
```

**DLQ Schema**:
```sql
CREATE TABLE dead_letter_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform VARCHAR(20) NOT NULL,
  event_payload JSONB NOT NULL, -- Full InboundMessageEvent
  error_message TEXT NOT NULL,
  error_stack TEXT,
  correlation_id VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW(),
  replayed_at TIMESTAMP, -- NULL until manually replayed
  replay_status VARCHAR(20) -- 'pending' | 'success' | 'failed'
);
CREATE INDEX idx_dlq_platform_created ON dead_letter_queue(platform, created_at DESC);
```

**Recovery Process** (Manual in MVP):
1. Ops reviews DLQ via SQL query: `SELECT * FROM dead_letter_queue WHERE replay_status IS NULL`
2. Ops fixes root cause (e.g., missing user, schema issue)
3. Ops replays event: `UPDATE dead_letter_queue SET replay_status = 'pending' WHERE id = ?`
4. Cron job or manual script calls `gateway.handleInbound(event_payload)`
5. Status updated to `'success'` or `'failed'` with new error

**Future Enhancement** (Phase 2): Admin UI for DLQ review + replay button.

---

## Interface Definitions

### InboundMessageEvent

**Purpose**: Unified structure for all inbound messages from external platforms (Telegram, IRC).

**Usage**: Emitted by `PlatformAdapter` via `message:inbound` event, consumed by `GatewayExchange.handleInbound()`.

```typescript
interface InboundMessageEvent {
  platform: 'telegram' | 'irc';
  externalThreadId: string; // Required: unique identifier per platform (Telegram group ID, IRC channel name)
  sender: {
    externalUserId: string; // Platform-specific user ID
    displayName: string;    // Human-readable name
  };
  body: string; // Message text content
  attachments?: Array<{
    url: string;   // Platform-provided URL (will be re-hosted to R2)
    type: string;  // MIME type (e.g., 'image/png', 'application/pdf')
    name: string;  // Original filename
    size?: number; // File size in bytes (for 5MB validation)
  }>;
  receivedAt: Date; // Platform timestamp (or adapter receipt time if unavailable)
  rawPayload: unknown; // Required: Full platform response (for R2 storage per ADR-004)
  correlationId?: string; // Optional: For distributed tracing
}
```

**Validation Rules**:
- `platform`: Must be one of registered platforms
- `externalThreadId`: Non-empty string
- `sender.externalUserId`: Non-empty string
- `body`: Non-empty string (max 10,000 characters per product spec)
- `attachments[].size`: If provided, must be ≤ 5MB (5,242,880 bytes)
- `rawPayload`: Must be serializable to JSON (for R2 storage)

**Example** (Telegram):
```typescript
{
  platform: 'telegram',
  externalThreadId: '-1001234567890', // Telegram group chat ID
  sender: {
    externalUserId: '987654321',
    displayName: 'John Doe'
  },
  body: 'Hello from Telegram!',
  attachments: [{
    url: 'https://api.telegram.org/file/bot.../photo.jpg',
    type: 'image/jpeg',
    name: 'photo.jpg',
    size: 245678
  }],
  receivedAt: new Date('2026-02-22T10:30:00Z'),
  rawPayload: { /* Full Telegram Update object */ },
  correlationId: 'tg-msg-123456'
}
```

---

### OutboundMessagePayload

**Purpose**: Unified structure for all outbound messages sent to external platforms.

**Usage**: Created by `message.service.ts`, passed to `PlatformAdapter.send()`, enqueued by BullMQ retry worker.

```typescript
interface OutboundMessagePayload {
  conversationId: string; // YACC conversation UUID
  body: string;           // Message text to send
  attachments?: Array<{
    url: string;  // R2 URL from frontend upload
    type: string; // MIME type
    name: string; // Filename
  }>;
  userId: string; // YACC user ID (for audit logging)
  idempotencyKey?: string; // Optional: For safe retries (prevents duplicate sends)
  metadata?: Record<string, unknown>; // Platform-specific data (e.g., { parse_mode: 'Markdown' })
}
```

**Validation Rules**:
- `conversationId`: Must exist in database
- `body`: Non-empty string (max 10,000 characters)
- `userId`: Must exist in database
- `attachments[].url`: Must be valid R2 URL (HTTPS)
- `idempotencyKey`: If provided, must be unique per conversation

**Example** (IRC):
```typescript
{
  conversationId: '550e8400-e29b-41d4-a716-446655440000',
  body: 'Thanks for reaching out!',
  attachments: [{
    url: 'https://r2.yacc.example.com/attachments/file-abc123.pdf',
    type: 'application/pdf',
    name: 'document.pdf'
  }],
  userId: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
  idempotencyKey: 'msg-2026-02-22-10-30-00-abc',
  metadata: { /* IRC-specific fields if needed */ }
}
```

---

### SendResult

**Purpose**: Result object returned by `PlatformAdapter.send()` indicating success/failure.

**Usage**: Consumed by `message.service.ts` to update message status, BullMQ worker for retry logic.

```typescript
interface SendResult {
  success: boolean;
  externalMessageId?: string; // Platform-specific ID (required if success=true, optional if false)
  error?: {
    code: string;      // Error code (e.g., 'RATE_LIMIT', 'INVALID_CREDENTIALS', 'NETWORK_ERROR')
    message: string;   // Human-readable error
    retryable: boolean; // Should BullMQ retry this message?
  };
  timestamp: Date; // When send attempt occurred (for audit correlation)
}
```

**Error Codes** (Standard):
- `RATE_LIMIT`: Platform rate limit exceeded (retryable)
- `INVALID_CREDENTIALS`: Auth failure (not retryable, requires ops intervention)
- `NETWORK_ERROR`: Temporary network issue (retryable)
- `MESSAGE_TOO_LONG`: Body exceeds platform limit (not retryable)
- `ATTACHMENT_TOO_LARGE`: File exceeds platform limit (not retryable)
- `UNKNOWN_ERROR`: Unexpected failure (retryable with caution)

**Example** (Success):
```typescript
{
  success: true,
  externalMessageId: 'msg_abc123xyz', // Telegram message ID
  timestamp: new Date('2026-02-22T10:30:05Z')
}
```

**Example** (Retryable Failure):
```typescript
{
  success: false,
  error: {
    code: 'RATE_LIMIT',
    message: 'Telegram rate limit: retry after 30 seconds',
    retryable: true
  },
  timestamp: new Date('2026-02-22T10:30:05Z')
}
```

**Example** (Non-Retryable Failure):
```typescript
{
  success: false,
  error: {
    code: 'INVALID_CREDENTIALS',
    message: 'IRC authentication failed: invalid password',
    retryable: false
  },
  timestamp: new Date('2026-02-22T10:30:05Z')
}
```

---

### PlatformAdapter

**Purpose**: Unified interface for all platform integrations (Telegram, IRC, future platforms).

**Responsibilities**:
- **Inbound**: Receive messages from platform, emit `InboundMessageEvent` via EventEmitter
- **Outbound**: Send messages to platform, return `SendResult`
- **Lifecycle**: Connect/disconnect, health monitoring
- **Error Handling**: Emit errors via `adapter:error` event

```typescript
import { EventEmitter } from 'events';

interface PlatformAdapter extends EventEmitter {
  readonly platform: 'telegram' | 'irc';
  readonly status: 'disconnected' | 'connecting' | 'connected' | 'error';
  
  // Lifecycle methods
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  healthCheck(): Promise<{
    healthy: boolean;
    details?: string;      // Error details if unhealthy
    lastMessageAt?: Date;  // For staleness detection
  }>;
  
  // Outbound messaging (inbound handled via events)
  send(message: OutboundMessagePayload): Promise<SendResult>;
  
  // Events emitted (typed in implementation):
  // - 'message:inbound' → (event: InboundMessageEvent)
  // - 'adapter:connected' → void
  // - 'adapter:disconnected' → { reason: string }
  // - 'adapter:error' → (error: Error)
}
```

**Status Lifecycle**:
1. `disconnected`: Initial state, or after explicit `disconnect()`
2. `connecting`: `connect()` called, awaiting platform confirmation
3. `connected`: Successfully connected, receiving messages
4. `error`: Connection lost unexpectedly (emits `adapter:error`, may auto-reconnect)

**Health Check Contract**:
- Returns `{ healthy: true }` if adapter can send/receive messages
- Returns `{ healthy: false, details: 'error message' }` if degraded
- `lastMessageAt` tracks last inbound message (used to detect stale connections)

**Implementation Notes**:
- Adapters must call `this.emit('message:inbound', event)` for each received message
- Adapters must handle reconnection logic internally (e.g., IRC auto-reconnect, Telegram long-polling restart)
- Adapters must NOT throw errors in `send()` (return `SendResult` with `success: false`)

**Example Implementation** (Telegram):
```typescript
export class TelegramAdapter extends EventEmitter implements PlatformAdapter {
  readonly platform = 'telegram' as const;
  status: PlatformAdapter['status'] = 'disconnected';
  
  async connect(): Promise<void> {
    this.status = 'connecting';
    // Start long-polling...
    this.status = 'connected';
    this.emit('adapter:connected');
  }
  
  async send(message: OutboundMessagePayload): Promise<SendResult> {
    try {
      const result = await this.telegramClient.sendMessage(...);
      return {
        success: true,
        externalMessageId: result.message_id.toString(),
        timestamp: new Date()
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: this.mapErrorCode(error),
          message: error.message,
          retryable: this.isRetryable(error)
        },
        timestamp: new Date()
      };
    }
  }
  
  // ... (healthCheck, disconnect, etc.)
}
```

---

## Implementation Requirements

### DEV-002: Consolidate Auth Services

**Scope**: Create `authentication.service.ts` as single entry point for all auth operations.

**Acceptance Criteria**:
1. ✅ Create `src/services/authentication.service.ts` implementing thin wrapper pattern
2. ✅ Delegate to existing services: `login.service.ts`, `passwordReset.service.ts`, `users.service.ts`
3. ✅ Update all auth controllers to import `AuthenticationService` (not individual services)
4. ✅ No changes to internal logic of existing services (preserve tested behavior)
5. ✅ Unit tests for `authentication.service.ts` (mock dependencies, 85%+ coverage)
6. ✅ Integration tests confirm controllers still work (login, logout, password reset flows)
7. ✅ No breaking changes to API endpoints or response shapes

**Files to Create**:
- `src/services/authentication.service.ts`

**Files to Update**:
- `src/controllers/auth.controller.ts` (or equivalent)
- `src/controllers/passwordReset.controller.ts` (if separate)

**Files to Keep Unchanged**:
- `src/services/login.service.ts`
- `src/services/passwordReset.service.ts`
- `src/services/passwordValidation.service.ts`
- `src/services/users.service.ts`

**Test Requirements**:
- Unit: Mock all dependencies, verify delegation works
- Integration: Full login/logout/password reset E2E via API
- Coverage: ≥85% for `authentication.service.ts`

---

### DEV-003: Create Gateway-Exchange

**Scope**: Create `gateway-exchange.ts` to orchestrate inbound/outbound message flows.

**Acceptance Criteria**:
1. ✅ Create `src/gateway-exchange.ts` implementing `GatewayExchange` class
2. ✅ Implement `registerAdapter(adapter: PlatformAdapter)` to subscribe to events
3. ✅ Implement `handleInbound(event: InboundMessageEvent)` with:
   - Database transaction (conversation + message creation)
   - Idempotency check via `externalMessageId`
   - WebSocket broadcast (`conversation_updated`)
   - Audit logging (`message.received`)
   - DLQ logging on error
4. ✅ Implement `handleOutbound(payload: OutboundMessagePayload)` with:
   - Adapter lookup by conversation platform
   - Call `adapter.send(payload)`
   - Update message status based on `SendResult`
   - Enqueue to BullMQ retry queue if `success: false` and `retryable: true`
5. ✅ Implement error handling with circuit breaker (5 consecutive failures → disconnect adapter)
6. ✅ Unit tests (mock adapters, services, 85%+ coverage)
7. ✅ Integration tests (real PostgreSQL, mock platform APIs)

**Files to Create**:
- `src/gateway-exchange.ts`

**Files to Update**:
- `src/index.ts` (or app bootstrap) to initialize `GatewayExchange` and register adapters

**Dependencies**:
- `conversation.service.ts` (for conversation creation/update)
- `message.service.ts` (for message creation/status update)
- `websocket.service.ts` (for broadcasting events)
- `audit.service.ts` (for logging)
- PostgreSQL database (transactions)

**Test Requirements**:
- Unit: Mock all dependencies, verify orchestration logic
- Integration: Real database, mock Telegram/IRC APIs, verify full flow
- Coverage: ≥85% for `gateway-exchange.ts`

---

### DEV-004: Move Platform Adapters

**Scope**: Migrate platform logic from `connectors/` to `infrastructure/`, implement `PlatformAdapter` interface.

**Acceptance Criteria**:
1. ✅ Create `src/infrastructure/telegram.adapter.ts` implementing `PlatformAdapter`
   - Extend `EventEmitter`
   - Implement `connect()`, `disconnect()`, `send()`, `healthCheck()`
   - Emit `message:inbound` for each received message
   - Transform Telegram updates to `InboundMessageEvent`
2. ✅ Create `src/infrastructure/irc.adapter.ts` implementing `PlatformAdapter`
   - Same requirements as Telegram
   - Handle IRC-specific reconnection logic
3. ✅ Delete `src/connectors/` folder entirely
4. ✅ Update imports in:
   - `src/gateway-exchange.ts`
   - `src/services/message.service.ts`
   - `src/workers/outboundMessageRetry.worker.ts`
5. ✅ Update tests to reference new paths
6. ✅ Verify compiler has zero errors (no `any` types)
7. ✅ Unit tests for both adapters (mock platform APIs, 85%+ coverage)
8. ✅ Integration tests verify adapters work with real credentials (local dev only)

**Files to Create**:
- `src/infrastructure/telegram.adapter.ts`
- `src/infrastructure/irc.adapter.ts`

**Files to Delete**:
- `src/connectors/irc.connector.ts`
- `src/connectors/telegram.connector.ts`
- Entire `src/connectors/` folder

**Files to Update**:
- `src/gateway-exchange.ts`
- `src/services/message.service.ts`
- `src/workers/outboundMessageRetry.worker.ts`
- All related tests

**Test Requirements**:
- Unit: Mock platform clients (TelegramBot, IRC library), verify event emission
- Integration: Real credentials, verify send/receive (local dev environment)
- Coverage: ≥85% for both adapters

---

### DEV-005: Refactor Inbound Pipeline

**Scope**: Update adapters to emit events, integrate with `GatewayExchange`.

**Acceptance Criteria**:
1. ✅ Telegram adapter emits `message:inbound` with `InboundMessageEvent` structure
2. ✅ IRC adapter emits `message:inbound` with `InboundMessageEvent` structure
3. ✅ Both adapters handle attachments (download, include in event)
4. ✅ Both adapters include `rawPayload` (full platform response)
5. ✅ `GatewayExchange.registerAdapter()` subscribes to `message:inbound` events
6. ✅ Inbound messages flow: Platform → Adapter → Gateway → Database → WebSocket
7. ✅ Idempotency prevents duplicate message insertion
8. ✅ Unit tests verify event emission (mock platform updates)
9. ✅ Integration tests verify full inbound flow (mock platform → real DB)

**Files to Update**:
- `src/infrastructure/telegram.adapter.ts`
- `src/infrastructure/irc.adapter.ts`
- `src/gateway-exchange.ts` (ensure `handleInbound` is called)

**Test Requirements**:
- Unit: Mock platform updates, verify `InboundMessageEvent` structure
- Integration: Simulate inbound message, verify database insertion + WebSocket broadcast
- Coverage: ≥85% for inbound logic paths

---

### DEV-006: Standardize Adapter Registration

**Scope**: Create adapter registry pattern, update outbound dispatch to use registry.

**Acceptance Criteria**:
1. ✅ `GatewayExchange` maintains `Map<string, PlatformAdapter>` (keyed by platform name)
2. ✅ `registerAdapter(adapter)` adds adapter to map, subscribes to events
3. ✅ `handleOutbound(payload)` looks up adapter via `conversations.platform` field
4. ✅ If adapter not found, throw error (logged to DLQ)
5. ✅ `message.service.ts` updated to call `gateway.handleOutbound(payload)` instead of direct connector
6. ✅ BullMQ retry worker updated to call `gateway.handleOutbound(payload)` on retry
7. ✅ Unit tests verify registry lookup (mock adapters)
8. ✅ Integration tests verify outbound flow: Service → Gateway → Adapter → Platform

**Files to Update**:
- `src/gateway-exchange.ts` (add registry logic)
- `src/services/message.service.ts` (call gateway instead of connector)
- `src/workers/outboundMessageRetry.worker.ts` (call gateway instead of connector)

**Test Requirements**:
- Unit: Mock adapters, verify registry lookup + send delegation
- Integration: Real database + mock platform APIs, verify outbound message sent
- Coverage: ≥85% for outbound logic paths

---

## Testing Strategy

### Unit Tests (Per Task)
- **Isolation**: Mock all dependencies (database, platform APIs, services)
- **Coverage**: ≥85% for all new/modified code
- **Framework**: Vitest (18.8% faster than Jest per project standard)
- **Mocking**: Use Vitest mocks for EventEmitter, database, HTTP clients

**Example** (DEV-003):
```typescript
// gateway-exchange.test.ts
describe('GatewayExchange', () => {
  it('should handle inbound event and create conversation + message', async () => {
    const mockConversationService = { createOrUpdate: vi.fn() };
    const mockMessageService = { create: vi.fn() };
    const gateway = new GatewayExchange(mockConversationService, mockMessageService, ...);
    
    const event: InboundMessageEvent = { /* ... */ };
    await gateway.handleInbound(event);
    
    expect(mockConversationService.createOrUpdate).toHaveBeenCalledWith(event);
    expect(mockMessageService.create).toHaveBeenCalledWith(expect.objectContaining({ body: event.body }));
  });
});
```

### Integration Tests (Per Task)
- **Real Database**: Use Docker Compose PostgreSQL (test database)
- **Mock Platforms**: Use nock or similar to mock Telegram/IRC HTTP responses
- **E2E Flows**: Simulate full inbound/outbound message lifecycle
- **Cleanup**: Rollback transactions or truncate tables after each test

**Example** (DEV-005):
```typescript
// inbound-pipeline.integration.test.ts
describe('Inbound Pipeline (Telegram)', () => {
  it('should receive Telegram message and store in database', async () => {
    // Mock Telegram webhook payload
    const telegramUpdate = { /* ... */ };
    
    // Simulate webhook call
    const response = await request(app).post('/webhooks/telegram').send(telegramUpdate);
    
    expect(response.status).toBe(200);
    
    // Verify database insertion
    const messages = await db.messages.findByExternalThreadId(telegramUpdate.message.chat.id);
    expect(messages).toHaveLength(1);
    expect(messages[0].body).toBe(telegramUpdate.message.text);
  });
});
```

### Regression Tests
- **Existing Features**: Run full regression suite (12 tests per QA doc) after each task
- **No Breaking Changes**: All existing API endpoints must return same responses
- **Performance**: No degradation (measure response times before/after)

### Coverage Threshold
- **Minimum**: 85% per file (enforced by Vitest config)
- **Exclusions**: Config files (simple const objects), type definitions
- **CI/CD**: Coverage check must pass before PR merge

---

## Backward Compatibility

### Breaking Changes: NONE

All changes are internal refactoring. No API endpoint changes, no database schema changes (except DLQ table addition).

### API Contract Stability
- **Endpoints**: All existing endpoints unchanged (`/api/auth/login`, `/api/messages`, etc.)
- **Response Shapes**: No changes to JSON response structures
- **WebSocket Events**: Existing events (`conversation_updated`, `message.sent`, etc.) unchanged

### Database Migration
- **New Table**: `dead_letter_queue` (for error handling)
- **Existing Tables**: No schema changes to `conversations`, `messages`, `users`, etc.
- **Migration Script**: Drizzle migration file to create `dead_letter_queue` table

**Migration File** (DEV-003):
```typescript
// migrations/YYYY-MM-DD-create-dead-letter-queue.ts
export async function up(db: Database) {
  await db.schema.createTable('dead_letter_queue', (table) => {
    table.uuid('id').primaryKey().defaultRandom();
    table.varchar('platform', 20).notNullable();
    table.jsonb('event_payload').notNullable();
    table.text('error_message').notNullable();
    table.text('error_stack');
    table.varchar('correlation_id', 100);
    table.timestamp('created_at').defaultNow();
    table.timestamp('replayed_at');
    table.varchar('replay_status', 20);
    table.index(['platform', 'created_at']);
  });
}

export async function down(db: Database) {
  await db.schema.dropTable('dead_letter_queue');
}
```

### Deprecation Schedule
- **Connectors Folder**: Deleted immediately in DEV-004 (no deprecation period, internal only)
- **Auth Services**: Old services kept for now, may deprecate in Phase 2 if unused

---

## Risks & Mitigations

### Risk 1: Event Ordering Race Conditions
**Likelihood**: Low (MVP single-tenant, low volume)  
**Impact**: Medium (out-of-order messages confuse users)  
**Mitigation**:
- Idempotency check prevents duplicate insertion
- UI sorts by `receivedAt` timestamp (not insertion order)
- Monitor in production, add per-conversation queuing if needed

### Risk 2: Circuit Breaker False Positives
**Likelihood**: Medium (transient network issues could trigger)  
**Impact**: High (adapter disconnects, messages lost until manual restart)  
**Mitigation**:
- Set threshold to 5 consecutive failures (not total failures)
- Log all circuit breaker triggers for ops review
- Phase 2: Add auto-recovery after cooldown period

### Risk 3: DLQ Storage Growth
**Likelihood**: Low (if code quality is high)  
**Impact**: Low (disk space, query performance)  
**Mitigation**:
- Auto-delete DLQ entries older than 30 days
- Monitor DLQ size, alert if > 1000 entries
- Phase 2: Admin UI to review + purge DLQ

### Risk 4: Adapter Registration Timing
**Likelihood**: Low (synchronous registration on app start)  
**Impact**: Medium (messages sent before adapter registered → error)  
**Mitigation**:
- Register all adapters before starting HTTP server
- Health check endpoint verifies all adapters connected
- Return 503 if any adapter unhealthy

---

## Success Criteria

### Functional
- ✅ All 6 tasks (DEV-002 to DEV-006) complete with ACs met
- ✅ All existing features still work (regression suite passes)
- ✅ No API breaking changes (contract stability verified)

### Technical
- ✅ Zero `any` types in new/modified code (TypeScript strict mode)
- ✅ ≥85% test coverage for all new code
- ✅ Flat folder structure compliance (no `connectors/` folder)
- ✅ All adapters implement `PlatformAdapter` interface
- ✅ All events use standardized interface (`InboundMessageEvent`, etc.)

### Performance
- ✅ No degradation in message latency (< 500ms inbound, < 2s outbound)
- ✅ No database query performance regression (monitored via logs)
- ✅ WebSocket broadcast latency unchanged (< 100ms)

### Documentation
- ✅ ADR-005 Addendum-2 approved (this document)
- ✅ GOV-030 governance log created
- ✅ All GitHub issues updated with refined ACs
- ✅ Code comments added for complex logic (event handling, circuit breaker)

---

## Related Documents

- **ADR-005**: Config vs Infrastructure Pattern (original decision)
- **GOV-030**: Governance log entry for DEV-002-006 decisions
- **`.docs/03-implementation-guide.md`**: Tech stack decisions
- **`.docs/plans/00-INDEX.md`**: Task tracking and status
- **GitHub Issues**: #277 (DEV-002), #278 (DEV-003), #279 (DEV-004), #280 (DEV-005), #292 (DEV-006)

---

## Appendix: Decision Summary Table

| Decision | Choice | Rationale | Impact |
|----------|--------|-----------|--------|
| **Event Pattern** | Node.js EventEmitter | KISS, sufficient for MVP, standard pattern | Low complexity, easy to test |
| **Connector Scope** | Delete entirely | ADR-005 compliance (flat structure) | Clean architecture, single source of truth |
| **Auth Services** | Thin wrapper | Minimal refactoring, low risk, MVP-focused | Single entry point, future-proof |
| **Event Ordering** | Best-effort | Simple, database handles consistency | Low complexity, UI resilient |
| **Error Handling** | DLQ + Circuit Breaker | Prevents loops, manual recovery, safety net | Ops overhead, robust system |

---

**Approval**: Enterprise Architect ✅  
**Status**: APPROVED  
**Next Steps**: Product Owner review → FullStack Developer handoff → DEV-002 implementation start
