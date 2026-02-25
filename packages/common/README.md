# @yacc/common

Shared types, schemas, and constants for the YACC (Yet Another Chat Client) application.

## Installation

```bash
pnpm install
```

## Usage

### Import Patterns

This package uses domain-specific export paths for better tree-shaking and organization.

#### ✅ DO: Import from domain-specific paths

```typescript
// Entity types
import type { User, Conversation, Message } from '@yacc/common/types/entities';

// API types (requests/responses)
import type { LoginRequest, SendMessageRequest } from '@yacc/common/types/api';
import { BaseListRequest, BaseListResponse } from '@yacc/common/types/api';

// WebSocket events
import type { WebSocketEvent, MessageReceivedEvent } from '@yacc/common/types/events';
import { isMessageEvent, isConversationEvent } from '@yacc/common/types/events';

// Zod schemas
import { LoginRequestSchema, TagSchema } from '@yacc/common/schemas';

// Constants
import { Roles, ConversationStatuses, Channels } from '@yacc/common/constants';
```

#### ✅ DO: Import from main entry point for commonly used items

```typescript
// Main entry point exports commonly used types and classes
import { BaseListRequest, BaseListResponse } from '@yacc/common';
import type { User, Conversation, Message, Tag } from '@yacc/common';
import type { WebSocketEvent } from '@yacc/common';
```

#### ❌ DON'T: Import from individual type files (breaks tree-shaking)

```typescript
// Bad - imports entire type file
import type { User } from '@yacc/common/types/User.interface';
```

#### ❌ DON'T: Use barrel exports for general imports

```typescript
// Bad - defeats tree-shaking
import * as Types from '@yacc/common/types/entities';
```

### Type-Only Imports

For types that are only used at compile time, use `import type`:

```typescript
import type { User, Conversation } from '@yacc/common/types/entities';
```

### Runtime Imports

For classes and functions that have runtime behavior, use regular imports:

```typescript
import { BaseListRequest } from '@yacc/common/types/api';
import { LoginRequestSchema } from '@yacc/common/schemas';
import { isMessageEvent } from '@yacc/common/types/events';
```

## Available Export Paths

| Path | Description |
|------|-------------|
| `@yacc/common` | Main entry point with commonly used exports |
| `@yacc/common/types/entities` | Core domain entity types (User, Conversation, Message, etc.) |
| `@yacc/common/types/api` | API request/response types and pagination classes |
| `@yacc/common/types/events` | WebSocket event types and type guards |
| `@yacc/common/schemas` | Zod validation schemas |
| `@yacc/common/constants` | Application constants and enums |
| `@yacc/common/requests` | Request type classes |
| `@yacc/common/responses` | Response type classes |

## Domain-Specific Indices

### types/entities

Core domain entity types:

- `User`, `UserStatus`
- `Conversation`, `ConversationStatus`
- `Message`, `MessageStatus`, `MessageDirection`
- `Tag`, `Note`, `Notification`
- `Attachment`, `Participant`
- `RoutingRule`, `RuleCondition`, `RuleAction`
- `AuditLog`, `BulkAction`, `Assignment`
- Connector types, IRC types, Auth types

### types/api

API communication types:

- All request types (LoginRequest, SendMessageRequest, etc.)
- All response types (UserResponse, ConversationResponse, etc.)
- `BaseListRequest` - Pagination request base class
- `BaseListResponse<T>` - Pagination response wrapper

### types/events

WebSocket event types:

- `WebSocketEvent` - Discriminated union of all events
- Message events: `MessageReceivedEvent`, `MessageSentEvent`, `MessageFailedEvent`
- Conversation events: `ConversationUpdatedEvent`, `ConversationReopenedEvent`
- Notification events: `NotificationReceivedEvent`
- Presence events: `PresenceUpdatedEvent`, `TypingStartedEvent`, `TypingStoppedEvent`
- Type guards: `isMessageEvent()`, `isConversationEvent()`, `isNotificationEvent()`, `isPresenceEvent()`

### schemas

Zod validation schemas for runtime validation:

```typescript
import { LoginRequestSchema } from '@yacc/common/schemas';

// Validate at runtime
const validated = LoginRequestSchema.parse(input);

// Infer type from schema
type LoginInput = z.infer<typeof LoginRequestSchema>;
```

### constants

Application constants:

- `Roles` - User role values
- `ConversationStatuses` - Conversation status values
- `MessageStatuses` - Message status values
- `Priorities` - Priority levels
- `Channels` - Communication channels
- Error codes and messages

## Architecture

This package follows ADR-005 (Simple Infrastructure and Config Pattern):

- **Flat folder structure** - No nested domain/infrastructure folders
- **One definition per file** - Each type/interface/class in its own file
- **Index aggregators** - Domain-specific index files for library wiring (ADR-012)
- **No barrel exports** - Direct imports preferred over centralized re-exports

## Development

```bash
# Run tests
pnpm test

# Run tests with coverage
pnpm test:coverage

# Type check
pnpm type-check

# Build
pnpm build
```

## Related Documentation

- [ADR-005: Infrastructure and Config Pattern](../../.docs/adr/ADR-005-infrastructure-config-pattern.md)
- [ADR-012: Index Aggregator Allowance](../../.docs/adr/ADR-012-index-aggregator-allowance.md)
- [ADR-020: Zod Schema as Source of Truth](../../.docs/adr/ADR-020-zod-schema-source-of-truth.md)
- [API and Data Model](../../.docs/02-api-and-data-model.md)
