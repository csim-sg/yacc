# Phase 2 Technical Architecture Review
## YACC MVP: Messages, WebSocket, Retry Queue, Attachments

NOTE: This document predates the current phase naming. It covers Week 2 / Phase 1.4 (messaging + real-time), not Phase 2 (collaboration + rules).

**Status**: ✅ APPROVED FOR IMPLEMENTATION  
**Review Date**: February 9, 2026  
**Architect**: Enterprise Architect (Claude Code)  
**Scope**: BE-009/010 (Messages), BE-011 (Status), BE-014 (Retry), BE-017/018/019 (WebSocket), FE components  

---

## Executive Summary

Phase 2 technical architecture is **sound and ready for implementation**. Key decisions are:

1. ✅ **Message Send/Receive**: Connector abstraction with provider-agnostic dispatch (Phase 3 full impl, Phase 2 stub connectors)
2. ✅ **Exponential Backoff**: Redis + BullMQ + DLQ table (already partially implemented in codebase)
3. ✅ **WebSocket Events**: Trigger after DB commit, emit from service layer
4. ✅ **Attachments**: R2 storage in Phase 2, multipart upload endpoint
5. ✅ **Auth Endpoint Prefix**: Defer `/api` global prefix (use route-level prefixes only)
6. ✅ **Error Handling**: IETF Problem Details format + structured Pino logs

**No blocking issues identified**. Proceed with implementation.

---

## Table of Contents

1. [Detailed Decisions](#detailed-decisions)
2. [Data Model Changes](#data-model-changes)
3. [Architecture Patterns](#architecture-patterns)
4. [Error Handling Standardization](#error-handling-standardization)
5. [Implementation Roadmap](#implementation-roadmap)
6. [ADR Recommendations](#adr-recommendations)
7. [Stability & Cost Analysis](#stability--cost-analysis)

---

## Detailed Decisions

### 1. BE-009/010: Message Send/Receive Dispatch Strategy

#### Architecture Decision

**Message Send/Receive shall use a connector abstraction pattern with provider-agnostic dispatch.**

| Aspect | Decision | Rationale |
|--------|----------|-----------|
| **Abstraction** | Provider interface with `sendMessage()` + `receiveMessage()` | Loose coupling, testable, extensible for Phase 2+ platforms |
| **Phase 2 Implementation** | Stub/mock connectors for Telegram + IRC | Full integration deferred to Phase 3 |
| **Dispatch Location** | Service layer (`MessageService.sendMessage()`) | Controller calls service, service dispatches to connector |
| **Error Handling** | Try-catch in service, enqueue DLQ on failure, emit WebSocket event | Transactional consistency: DB saved THEN dispatch |
| **Status Column** | `pending` → `sent` (on success) or `failed` (on error) | Tracks message lifecycle |

#### Code Pattern

```typescript
// Provider interface (loose coupling)
export interface ConnectorProvider {
  sendMessage(payload: SendMessagePayload): Promise<{ id: string }>;
  receiveMessage(payload: ReceivedMessagePayload): Promise<void>;
}

// Connector factory (provider lookup)
export function getConnector(platformType: string): ConnectorProvider {
  switch (platformType) {
    case 'telegram':
      return new TelegramConnector(); // Stub in Phase 2
    case 'irc':
      return new IrcConnector();      // Stub in Phase 2
    default:
      throw new Error(`Unknown platform: ${platformType}`);
  }
}

// Service dispatch (transactional)
export class MessageService {
  async sendMessage(
    conversationId: string,
    body: string,
    userId: string
  ): Promise<Message> {
    const conversation = await db.conversations.findUnique({ where: { id: conversationId } });
    
    // 1. Save to DB with status: pending
    const message = await db.messages.create({
      data: {
        conversation_id: conversationId,
        sender_id: userId,
        body,
        direction: 'outbound',
        status: 'pending',
      },
    });

    // 2. Dispatch to platform (async, non-blocking)
    try {
      const connector = getConnector(conversation.channel);
      const result = await connector.sendMessage({
        conversationId,
        messageId: message.id,
        body,
        externalThreadId: conversation.external_thread_id,
      });

      // 3a. Success: update status
      await db.messages.update({
        where: { id: message.id },
        data: { status: 'sent' },
      });

      // 4a. Emit WebSocket event
      await io.to(`conversation:${conversationId}`).emit('message.sent', {
        conversationId,
        message: { ...message, status: 'sent' },
      });

    } catch (error) {
      // 3b. Failure: mark as failed, enqueue retry
      await db.messages.update({
        where: { id: message.id },
        data: { 
          status: 'failed',
          error_details: { message: error.message, code: error.code },
        },
      });

      // 4b. Enqueue DLQ
      await enqueueRetry({
        messageId: message.id,
        conversationId,
        platformType: conversation.channel,
        // ... more fields
      });

      // 4b. Emit WebSocket event
      await io.to(`conversation:${conversationId}`).emit('message.failed', {
        conversationId,
        message: { ...message, status: 'failed' },
        canRetry: true,
      });
    }

    return message;
  }
}
```

#### Implementation Timeline

**Phase 2 (Week 2)**:
- Stub connectors (return mock success/failure)
- Service layer + DB dispatch
- Error handling + WebSocket events
- Unit tests (85%+ coverage)

**Phase 3 (Week 3)**:
- Implement real Telegram connector (webhook + API)
- Implement real IRC connector (socket connection)
- Integration tests with mock platforms

---

### 2. BE-014: Exponential Backoff Queue Architecture

#### Status: Partially Implemented ✅

BullMQ queue infrastructure already exists in codebase:
- `infrastructure/queues.client.ts` - Queue initialization
- `services/message-queue.service.ts` - Queue operations
- `services/message-queue-processor.ts` - Job processor
- `services/message-queue-dlq.service.ts` - DLQ management

#### Architecture Decision

**Use Redis + BullMQ for outbound message retry with exponential backoff (1m, 5m, 30m; 3 attempts max).**

| Component | Implementation | Status |
|-----------|-----------------|---------|
| **Redis Connection** | Singleton in `infrastructure/redis.client.ts` | ✅ Exists |
| **Queue Configuration** | BullMQ with exponential backoff config | ✅ Exists |
| **Job Processor** | Worker picks up failed messages, retries | ✅ Exists |
| **DLQ Table** | `dead_letter_queue` table in Postgres | ⏳ Needs schema migration |
| **DLQ Service** | Move to service layer (already implemented) | ✅ Exists |
| **Event Logging** | Each retry logged to audit trail | ⏳ Needs implementation |

#### DLQ Design

**Table**: `dead_letter_queue`

```sql
CREATE TABLE dead_letter_queue (
  id UUID PRIMARY KEY,
  message_id UUID NOT NULL REFERENCES messages(id),
  conversation_id UUID NOT NULL REFERENCES conversations(id),
  original_payload JSONB NOT NULL,      -- Full message job payload
  failure_reason VARCHAR(100) NOT NULL, -- max_retries_exceeded, platform_error, validation_error, etc.
  last_error TEXT,                      -- Last error message
  total_attempts INT NOT NULL,
  first_attempt_at TIMESTAMP NOT NULL,
  last_attempt_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  
  INDEX(conversation_id),
  INDEX(created_at DESC),
  INDEX(message_id)
);
```

**Rationale**:
- Stores all failed message details for ops review
- Simple query: `SELECT * FROM dead_letter_queue ORDER BY created_at DESC`
- Audit trail: Who accessed, when (separate audit log entry)

#### BullMQ Configuration

**Retry Schedule** (already configured in codebase):
```
Attempt 1: Immediate
Attempt 2: Wait 1 minute, retry
Attempt 3: Wait 5 minutes, retry (total: 6 minutes)
Attempt 4: Wait 30 minutes, retry (total: 36 minutes)
→ On failure after 4th attempt: Move to DLQ
```

**Key Config** (in `infrastructure/queues.client.ts`):
```typescript
export const RETRY_CONFIG = {
  MAX_ATTEMPTS: 3,
  BACKOFF_DELAYS: [60000, 300000, 1800000], // 1m, 5m, 30m
};
```

#### Event Logging

**Audit Trail Entries**:
```typescript
// When message first fails
await createAuditLog({
  action: 'message.failed',
  entity_id: message.id,
  metadata: { reason: 'platform_error', error: '...' },
});

// When retry enqueued
await createAuditLog({
  action: 'message.retry',
  entity_id: message.id,
  metadata: { attempt: 2, nextRetryAt: '...' },
});

// When moved to DLQ
await createAuditLog({
  action: 'message.dlq',
  entity_id: message.id,
  metadata: { reason: 'max_retries_exceeded' },
});
```

---

### 3. BE-017/018/019: WebSocket Event Triggering

#### Architecture Decision

**WebSocket events shall be emitted from service layer AFTER database commit. Use socket-controllers pattern (already approved ADR-012).**

| Event | Trigger | Handler | Payload |
|-------|---------|---------|---------|
| `message.sent` | Message status updated to `sent` in DB | MessageService | `{ conversationId, message }` |
| `message.failed` | Message status updated to `failed` + enqueued for retry | MessageService | `{ conversationId, message, canRetry: true }` |
| `conversation.updated` | Status/priority/assignment changed | ConversationService | `{ conversation }` |
| `conversation.reopened` | Resolved conversation gets inbound msg, auto-opens | MessageService | `{ conversation, reason: 'new_inbound_message' }` |
| `presence.updated` | User login/logout/idle | AuthService + WebSocket listener | `{ userId, status, timestamp }` |
| `typing.started` | User emits `typing.started` | Socket.io handler (already in place) | `{ conversationId, userId }` |
| `typing.stopped` | 5-second inactivity timeout | Socket.io handler (already in place) | `{ conversationId, userId }` |
| `notification.received` | Assignment or @mention created | NotificationService | `{ notification }` |

#### Implementation Pattern

**Service layer emits, socket-controller listens (already implemented ADR-012)**:

```typescript
// Service layer (emits after DB commit)
export class MessageService {
  async sendMessage(...): Promise<Message> {
    const message = await db.messages.create({...});
    
    try {
      await connector.sendMessage(...);
      
      // Update DB
      await db.messages.update({
        where: { id: message.id },
        data: { status: 'sent' },
      });
      
      // Emit event (listener pattern)
      this.eventEmitter.emit('message.sent', {
        conversationId: message.conversation_id,
        message,
      });
      
    } catch (error) {
      // Similar pattern for failure
    }
  }
}

// Socket controller listens to service events (already implemented)
@SocketController()
export class MessageController {
  constructor(private messageService: MessageService) {
    this.messageService.on('message.sent', (data) => {
      io.to(`conversation:${data.conversationId}`).emit('message.sent', data);
    });
  }
}
```

**Benefits** (over direct WebSocket emit from controller):
- ✅ Separation of concerns (service = business logic, socket = events)
- ✅ Testable (service can be tested without WebSocket)
- ✅ Reusable (other parts of app can listen to same events)

#### Message Backlog (1 Hour)

**Requirement**: On reconnect, client receives missed events from last 1 hour.

**Implementation** (already in schema):
1. Store events in `websocket_backlog` table when emitted
2. On client reconnect, query backlog for user
3. Send backlog events to client
4. Auto-delete backlog older than 1 hour

```sql
CREATE TABLE websocket_backlog (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  event_type VARCHAR(100),       -- message.sent, conversation.updated, etc.
  payload JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  
  INDEX(user_id, created_at),
  INDEX(created_at) -- for deletion
);

-- Auto-delete backlog older than 1 hour
DELETE FROM websocket_backlog WHERE created_at < NOW() - INTERVAL '1 hour';
```

---

### 4. FE-010: Reply Composer + File Upload

#### Architecture Decision

**Phase 2 shall support single file upload to Cloudflare R2 with progress tracking. Multipart support deferred to Phase 3.**

| Feature | Phase 2 | Phase 3+ |
|---------|---------|----------|
| **Single file upload** | ✅ Implement | - |
| **Drag & drop** | ✅ Implement | - |
| **Image preview** | ✅ Implement | - |
| **File size validation** | ✅ 5 MB limit | - |
| **Multiple file upload** | ⏳ Deferred | Phase 3 |
| **Multipart upload** | ⏳ Deferred | Phase 3 |
| **Video upload** | ⏳ Deferred | Phase 3 |
| **Batch uploads** | ⏳ Deferred | Phase 3 |

#### Endpoint Design

**`POST /conversations/:id/attachments`**

```typescript
// Controller
@Post('/:id/attachments')
@UseInterceptors(FileInterceptor('file'))
async uploadAttachment(
  @Param('id') conversationId: string,
  @UploadedFile() file: Express.Multer.File,
  @Req() req: AuthRequest
): Promise<{ data: Attachment }> {
  // Validation
  if (file.size > 5 * 1024 * 1024) {
    throw new BadRequestException('File exceeds 5 MB limit');
  }
  
  // Allowed MIME types
  const ALLOWED_TYPES = [
    'image/png', 'image/jpeg', 'image/gif', 'image/webp',
    'application/pdf', 'text/plain'
  ];
  
  if (!ALLOWED_TYPES.includes(file.mimetype)) {
    throw new BadRequestException(`Unsupported file type: ${file.mimetype}`);
  }
  
  // Service handles R2 upload
  const attachment = await attachmentService.uploadToR2({
    conversationId,
    file: file.buffer,
    fileName: file.originalname,
    mimeType: file.mimetype,
    uploadedBy: req.user.id,
  });
  
  return { data: attachment };
}
```

#### R2 Upload Flow

```typescript
// Service layer
export class AttachmentService {
  async uploadToR2(payload: UploadPayload): Promise<Attachment> {
    const storageKey = `attachments/${payload.conversationId}/${Date.now()}_${sanitize(payload.fileName)}`;
    
    // Upload to R2
    const result = await s3Client.send(new PutObjectCommand({
      Bucket: process.env.CLOUDFLARE_R2_BUCKET,
      Key: storageKey,
      Body: payload.file,
      ContentType: payload.mimeType,
    }));
    
    // Save to DB
    const attachment = await db.attachments.create({
      data: {
        conversation_id: payload.conversationId,
        url: `${process.env.CLOUDFLARE_CDN_URL}/${storageKey}`,
        storage_key: storageKey,
        type: payload.mimeType,
        name: payload.fileName,
        size: payload.file.length,
        uploaded_by: payload.uploadedBy,
      },
    });
    
    // Audit log
    await createAuditLog({
      action: 'attachment.uploaded',
      entity_id: attachment.id,
      metadata: { fileSize: attachment.size },
    });
    
    return attachment;
  }
}
```

#### Frontend Implementation

```typescript
// React component (TanStack Start)
export function ReplyComposer({ conversationId }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    
    if (selectedFile && selectedFile.size > 5 * 1024 * 1024) {
      alert('File exceeds 5 MB limit');
      return;
    }
    
    setFile(selectedFile || null);
  };

  const handleUpload = async () => {
    if (!file) return;
    
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      const response = await fetch(
        `/conversations/${conversationId}/attachments`,
        { method: 'POST', body: formData }
      );
      
      const { data } = await response.json();
      
      // Use attachment in reply
      setAttachmentIds([data.id]);
      setFile(null);
      
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <input type="file" onChange={handleFileSelect} accept="image/*,.pdf,.txt" />
      {file && <button onClick={handleUpload} disabled={uploading}>
        {uploading ? `Uploading... ${progress}%` : 'Upload'}
      </button>}
    </div>
  );
}
```

---

### 5. Auth Endpoint Prefix & Global API Prefix

#### Architecture Decision

**Phase 2 shall NOT introduce global `/api` prefix. Individual routes add prefix only when needed.**

| Decision | Rationale |
|----------|-----------|
| **Auth endpoints**: `/auth/*` (no `/api` prefix) | Simpler, fewer imports, easier to test |
| **Other endpoints**: `/conversations`, `/messages`, etc. (no `/api` prefix) | RESTful design doesn't require prefix |
| **Global prefix deferral**: ⏳ Defer to Phase 2+ if needed | Adds complexity without clear benefit for MVP |

**Why defer?**
- MVP has single API, no versioning needed
- No conflicts (auth vs. other endpoints use different paths)
- Easier routing in `routing-controllers`
- Can add later if multi-API architecture needed

#### Example Routes (Phase 2)

```typescript
// Auth
POST /auth/login
POST /auth/logout
POST /auth/forgot-password
POST /auth/reset-password

// Conversations
GET /conversations
GET /conversations/:id
PATCH /conversations/:id
POST /conversations/bulk

// Messages
GET /conversations/:id/messages
POST /conversations/:id/messages
POST /conversations/:id/messages/:msgId/retry

// Tags
GET /tags
POST /tags
POST /conversations/:id/tags

// Attachments
POST /conversations/:id/attachments
GET /attachments/:id

// WebSocket
WS /socket.io
```

---

## Data Model Changes

### Schema Migrations Required

#### 1. Add `error_details` JSON Column to Messages

```sql
ALTER TABLE messages
ADD COLUMN error_details JSONB DEFAULT NULL;

-- Index for performance
CREATE INDEX idx_messages_with_errors ON messages(id) WHERE error_details IS NOT NULL;
```

**Structure** (for `error_details`):
```json
{
  "message": "Platform API returned 503 Service Unavailable",
  "code": "PLATFORM_ERROR",
  "details": {
    "statusCode": 503,
    "platform": "telegram",
    "endpoint": "/sendMessage"
  },
  "timestamp": "2026-02-09T10:30:00Z"
}
```

#### 2. Create Dead-Letter Queue Table

```sql
CREATE TABLE dead_letter_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  original_payload JSONB NOT NULL,
  failure_reason VARCHAR(100) NOT NULL,
    -- Values: max_retries_exceeded, platform_error, validation_error, network_error, unknown
  last_error TEXT,
  total_attempts INT NOT NULL,
  first_attempt_at TIMESTAMP NOT NULL,
  last_attempt_at TIMESTAMP NOT NULL,
  resolved_at TIMESTAMP,                  -- When ops manually resolved
  resolved_by UUID REFERENCES users(id),  -- User who resolved
  resolution_notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  
  INDEX(conversation_id),
  INDEX(created_at DESC),
  INDEX(message_id),
  INDEX(failure_reason)
);
```

#### 3. Create WebSocket Backlog Table (Optional, Can Use Redis)

**Option A: PostgreSQL** (for durability)
```sql
CREATE TABLE websocket_backlog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_type VARCHAR(100) NOT NULL,
  event_data JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  
  INDEX(user_id, created_at DESC),
  INDEX(created_at)
);

-- Auto-cleanup: DELETE FROM websocket_backlog WHERE created_at < NOW() - INTERVAL '1 hour';
```

**Option B: Redis** (for performance, already available)
```
Key: backlog:user:{userId}
Value: Array of events (serialized JSON)
TTL: 3600 seconds (1 hour)
```

**Recommendation**: Use **Redis** (Option B) for backlog
- Already running (required for message queue)
- Faster than Postgres for time-series data
- Auto-expiry via TTL
- No schema migration needed

#### 4. Add Audit Log Columns (Already Exists)

Schema already has `audit_logs` table. No changes needed.

### Migration Execution Order

1. ✅ Phase 1 complete (auth, inbox, conversation)
2. ⏳ Phase 2 Week 1 (messages schema changes)
   - Add `error_details` to messages
   - Create `dead_letter_queue` table
   - WebSocket backlog in Redis (no migration)
3. ⏳ Phase 2 Week 2 (attachment support)
   - Attachments table already exists
   - No changes needed

### Using Drizzle for Migrations

```typescript
// packages/common/src/db/migrations/add-message-error-details.ts
import { sql } from 'drizzle-orm';

export async function up(db: any) {
  await db.schema.alterTable('messages').addColumn(
    'error_details',
    sql`jsonb default null`
  );
  
  await db.schema.createIndex('idx_messages_with_errors').on('messages').where(
    sql`error_details is not null`
  );
}

export async function down(db: any) {
  await db.schema.alterTable('messages').dropColumn('error_details');
  await db.schema.dropIndex('idx_messages_with_errors');
}
```

---

## Architecture Patterns

### Service Layer Patterns (Phase 2)

#### Pattern 1: Message Service with Transactional Consistency

```typescript
export class MessageService {
  async sendMessage(payload: SendMessagePayload): Promise<Message> {
    // 1. Get conversation (for platform info)
    const conversation = await this.getConversation(payload.conversationId);
    
    // 2. Save message with status: pending
    const message = await db.messages.create({
      data: {
        conversation_id: payload.conversationId,
        sender_id: payload.userId,
        body: payload.body,
        direction: 'outbound',
        status: 'pending',
      },
    });
    
    // 3. Attempt platform dispatch (async, non-blocking)
    try {
      const connector = getConnector(conversation.channel);
      const result = await connector.sendMessage({
        conversationId: conversation.id,
        messageId: message.id,
        body: payload.body,
        externalThreadId: conversation.external_thread_id,
      });
      
      // 4a. Success: update status
      await db.messages.update({
        where: { id: message.id },
        data: { status: 'sent' },
      });
      
      // 5a. Emit event
      this.eventEmitter.emit('message.sent', {
        conversationId: conversation.id,
        message: { ...message, status: 'sent' },
      });
      
      // 6a. Audit log
      await createAuditLog({
        action: 'message.sent',
        entity_id: message.id,
        metadata: { platform: conversation.channel },
      });
      
    } catch (error) {
      // 4b. Failure: mark as failed, extract error
      const errorDetails = {
        message: error.message,
        code: error.code || 'UNKNOWN_ERROR',
        timestamp: new Date().toISOString(),
      };
      
      await db.messages.update({
        where: { id: message.id },
        data: {
          status: 'failed',
          error_details: errorDetails,
        },
      });
      
      // 5b. Enqueue for retry
      await enqueueRetry({
        messageId: message.id,
        conversationId: conversation.id,
        platformType: conversation.channel,
        // ... more fields
      });
      
      // 5c. Emit event
      this.eventEmitter.emit('message.failed', {
        conversationId: conversation.id,
        message: { ...message, status: 'failed', error_details: errorDetails },
        canRetry: true,
      });
      
      // 6b. Audit log
      await createAuditLog({
        action: 'message.failed',
        entity_id: message.id,
        metadata: {
          reason: error.code,
          message: error.message,
        },
      });
    }
    
    return message;
  }
}
```

#### Pattern 2: Event Emitter Pattern (for WebSocket)

```typescript
export class MessageService extends EventEmitter {
  // In constructor or as class property
  private eventEmitter = new EventEmitter();
  
  // Emit events
  async sendMessage(...): Promise<Message> {
    // ... business logic ...
    this.eventEmitter.emit('message.sent', data);
  }
  
  // Listen for events (in socket controller)
  subscribe(listener: EventListener) {
    this.eventEmitter.on('message.sent', listener);
  }
}

// Socket controller listens
@SocketController()
export class MessageController {
  constructor(private messageService: MessageService) {
    this.messageService.subscribe((data) => {
      io.to(`conversation:${data.conversationId}`).emit('message.sent', data);
    });
  }
}
```

#### Pattern 3: Connector Provider Pattern

```typescript
// Base interface
export interface ConnectorProvider {
  sendMessage(payload: SendMessagePayload): Promise<SendMessageResult>;
  receiveMessage(payload: ReceivedMessagePayload): Promise<void>;
}

// Implementation (stub in Phase 2)
export class TelegramConnector implements ConnectorProvider {
  async sendMessage(payload: SendMessagePayload): Promise<SendMessageResult> {
    // Phase 2: Stub (return mock success)
    logger.info('TelegramConnector.sendMessage (STUB)', { payload });
    return { id: 'mock-' + Math.random().toString(36).substr(2, 9) };
  }
}

// Factory
export function getConnector(platformType: string): ConnectorProvider {
  switch (platformType) {
    case 'telegram':
      return new TelegramConnector();
    case 'irc':
      return new IrcConnector();
    default:
      throw new Error(`Unknown platform: ${platformType}`);
  }
}

// Usage
const connector = getConnector(conversation.channel);
const result = await connector.sendMessage(payload);
```

---

## Error Handling Standardization

### Error Response Format (IETF Problem Details RFC 7807)

```typescript
// Standard error response
interface ErrorResponse {
  code: string;           // Error code (e.g., 'invalid_credentials', 'conversation_not_found')
  message: string;        // User-friendly message
  details?: Record<string, unknown>; // Additional context
  timestamp?: string;     // ISO-8601 timestamp
  correlationId?: string; // For tracing
}

// HTTP status codes
200 OK           - Successful request
201 Created      - Resource created
400 Bad Request  - Validation error
401 Unauthorized - Missing/invalid auth
403 Forbidden    - Auth OK, but permission denied
404 Not Found    - Resource not found
409 Conflict     - State conflict (e.g., already sent)
422 Unprocessable Entity - Semantic error
500 Internal Server Error - Server error
```

### Error Handling in Services

```typescript
// In service method
async sendMessage(...): Promise<Message> {
  try {
    // Business logic
    const connector = getConnector(conversation.channel);
    const result = await connector.sendMessage(payload);
    
  } catch (error) {
    // Classify error
    if (error instanceof ValidationError) {
      // Validation error - client fault
      logger.warn({
        correlationId: req.id,
        error: error.message,
      }, 'Validation error in sendMessage');
      
      throw new BadRequestException({
        code: 'invalid_message_body',
        message: 'Message body is invalid',
        details: { field: 'body', reason: error.message },
      });
      
    } else if (error instanceof PlatformError) {
      // Platform error - infrastructure issue
      logger.error({
        correlationId: req.id,
        error: error.message,
        platform: conversation.channel,
      }, 'Platform error in sendMessage');
      
      // Don't throw; let job queue handle retry
      return { ...message, status: 'failed', error_details: {...} };
      
    } else {
      // Unknown error - server fault
      logger.error({
        correlationId: req.id,
        error: error instanceof Error ? error.stack : String(error),
      }, 'Unexpected error in sendMessage');
      
      throw new InternalServerErrorException({
        code: 'internal_error',
        message: 'An unexpected error occurred',
        details: { correlationId: req.id },
      });
    }
  }
}
```

### Error Logging (Structured Pino Logs)

```typescript
// Pino logger (via infrastructure/logger.ts)
import { pino } from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
    },
  },
});

// Usage
logger.error({
  correlationId: req.id,
  userId: req.user.id,
  conversationId,
  error: error instanceof Error ? error.message : String(error),
  errorStack: error instanceof Error ? error.stack : undefined,
  errorCode: error.code,
}, 'Failed to send message');

// Output (JSON)
{
  "level": "ERROR",
  "correlationId": "req-123",
  "userId": "user-456",
  "conversationId": "conv-789",
  "error": "Connection refused",
  "errorCode": "ECONNREFUSED",
  "timestamp": "2026-02-09T10:30:00.000Z"
}
```

### Error Codes (Phase 2)

| Error Code | HTTP Status | Meaning | Recovery |
|------------|-------------|---------|----------|
| `invalid_credentials` | 401 | Email or password incorrect | Retry login |
| `user_disabled` | 403 | User account is disabled | Contact admin |
| `conversation_not_found` | 404 | Conversation doesn't exist | Check ID |
| `invalid_message_body` | 400 | Message validation failed | Fix message |
| `file_too_large` | 413 | Attachment exceeds 5 MB | Reduce file size |
| `unsupported_file_type` | 415 | File type not allowed | Use supported format |
| `platform_error` | 503 | Platform unavailable | Auto-retry via queue |
| `network_error` | 503 | Network unreachable | Auto-retry via queue |
| `max_retries_exceeded` | 422 | Message failed after 4 attempts | Manual retry or ops review |
| `internal_error` | 500 | Unexpected server error | Contact support |

---

## Implementation Roadmap

### Week 2 (Feb 9-16) - Phase 2 Kickoff

#### Monday-Tuesday (Feb 9-10): Message Infrastructure

**Backend Tasks**:
- [ ] BE-009: Message Retrieval (GET /conversations/:id/messages)
- [ ] BE-010: Message Send (POST /conversations/:id/messages)
  - Stub connectors for Telegram + IRC
  - DB save + dispatch pattern
  - Error handling + DLQ
- [ ] Schema migration: Add `error_details` to messages
- [ ] Schema migration: Create `dead_letter_queue` table
- [ ] Unit tests (85%+ coverage)

**Frontend Tasks**:
- [ ] FE-008/009: API Integration (fetch conversations + messages)
- [ ] FE-010: Reply Composer Component
  - Text input + send button
  - Stub attachment upload

**QA Tasks**:
- [ ] Integration tests: Message CRUD
- [ ] Unit tests: Service layer

#### Wednesday-Thursday (Feb 11-12): Status Tracking + Retry Queue

**Backend Tasks**:
- [ ] BE-011: Message Status Tracking
  - `pending` → `sent` / `failed` transitions
  - Status in DB + WebSocket events
- [ ] BE-014: Exponential Backoff Integration
  - Enqueue on failure
  - Implement job processor
  - DLQ management
- [ ] BE-012: Manual Retry Endpoint (POST /conversations/:id/messages/:msgId/retry)

**Frontend Tasks**:
- [ ] FE-010: Attachment Upload (single file)
  - Multipart form upload to R2
  - File preview + error handling

**QA Tasks**:
- [ ] Queue integration tests
- [ ] Retry scenario tests (success + failure)

#### Friday (Feb 13-16): WebSocket Events + Polish

**Backend Tasks**:
- [ ] BE-017/018/019: WebSocket Events
  - `message.sent` / `message.failed`
  - `conversation.updated`
  - `conversation.reopened` (auto-reopen on inbound)
  - Backlog on reconnect (Redis)
- [ ] Integration tests (WebSocket + queue)

**Frontend Tasks**:
- [ ] FE-013/014/015: WebSocket Listeners
  - Listen for `message.sent` / `message.failed`
  - Update UI in real-time
  - Display message status (pending/sent/failed)

**QA Tasks**:
- [ ] E2E tests: Message send + receive
- [ ] Real-time scenario tests
- [ ] Stress tests: High message volume

**Target**: MVP completion (send/receive messages with real-time updates)

---

## ADR Recommendations

### New ADRs Required (Phase 2)

#### ADR-014: Message Send/Receive Connector Pattern

**Status**: Draft (this document provides foundation)

**Content**:
- Provider interface pattern for loose coupling
- Stub vs. real implementation split
- Error classification (validation vs. platform vs. network)
- Retry strategy integration

**Owner**: Enterprise Architect
**Target Approval**: Before implementation starts

#### ADR-015: WebSocket Event Architecture

**Status**: Draft

**Content**:
- Service → EventEmitter → Socket controller flow
- Event envelope format
- Message backlog strategy (Redis vs. DB)
- Reconnection handling

**Owner**: Enterprise Architect
**Target Approval**: Before WS implementation starts

#### ADR-016: Error Handling Standardization

**Status**: Draft

**Content**:
- IETF Problem Details format (RFC 7807)
- HTTP status code mapping
- Error classification (client vs. server vs. platform)
- Structured logging with Pino
- Correlation ID propagation

**Owner**: Enterprise Architect
**Target Approval**: Before coding

### Existing ADRs (Confirmed for Phase 2)

| ADR | Title | Status | Phase 2 Impact |
|-----|-------|--------|----------------|
| ADR-005 | Infrastructure/Config Pattern | ✅ Approved | Use for queues, connectors |
| ADR-006 | Auth Client Implementation | ✅ Approved | No change |
| ADR-007 | Jest → Vitest Migration | ✅ Approved | Use for Phase 2 tests |
| ADR-012 | Socket-Controllers Adoption | ✅ Approved | Use for WebSocket events |

---

## Stability & Cost Analysis

### Stability Impact

#### Zero Breaking Changes
- ✅ Existing API contracts unchanged
- ✅ Database schema additions only (backward compatible)
- ✅ Service layer isolation (no controller refactoring)

#### Risk Factors
| Risk | Mitigation | Severity |
|------|-----------|----------|
| Retry queue gets stuck | Redis monitoring + DLQ alerts | Medium |
| WebSocket reconnect storms | Exponential backoff already configured | Low |
| Large file uploads | 5 MB limit enforced, multipart deferred | Low |
| Connector dispatch hangs | Timeout on platform calls + circuit breaker (Phase 3) | Medium |

#### Testing Requirements
- ✅ 85%+ code coverage required
- ✅ Integration tests for queue processing
- ✅ E2E tests for message flow (send + receive)
- ✅ Load tests for WebSocket (100+ concurrent users)

### Cost Impact

#### Deployment Cost
- ✅ No infrastructure changes (Redis + Postgres already running)
- ✅ Cloudflare R2 storage cost (estimated: $0.15/GB → minimal for MVP)
- ✅ No database scaling expected (message volume modest in MVP)

#### Development Cost
- ⏳ 4 developers × 1 week = 40 hours
- ✅ Clear scope (no ambiguity)
- ✅ 70% code already scaffolded (queues, WebSocket)

#### Maintenance Cost
- ✅ Low (proven patterns: BullMQ, Pino, Drizzle)
- ✅ DLQ ops workflow simple (UI + alert notifications)
- ⚠️ Connector integration testing required (Phase 3)

---

## Sign-Off

### Architect Approval

**Name**: Enterprise Architect (Claude Code)  
**Date**: February 9, 2026  
**Status**: ✅ **APPROVED FOR IMPLEMENTATION**

**Comments**:
- Solid architecture with proven patterns
- Zero blocking issues
- BullMQ + Pino infrastructure already in place
- Phase 2 scope is clear and achievable
- Proceed with implementation

### Product Owner Approval

**Name**: _________________  
**Date**: _________________  
**Status**: ⏳ Pending  

### Implementation Lead Approval

**Name**: _________________  
**Date**: _________________  
**Status**: ⏳ Pending  

---

## Appendix: Quick Reference

### Schema Migrations Required

```sql
-- 1. Add error_details to messages
ALTER TABLE messages ADD COLUMN error_details JSONB DEFAULT NULL;
CREATE INDEX idx_messages_with_errors ON messages(id) WHERE error_details IS NOT NULL;

-- 2. Create dead_letter_queue table
CREATE TABLE dead_letter_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES messages(id),
  conversation_id UUID NOT NULL REFERENCES conversations(id),
  original_payload JSONB NOT NULL,
  failure_reason VARCHAR(100) NOT NULL,
  last_error TEXT,
  total_attempts INT NOT NULL,
  first_attempt_at TIMESTAMP NOT NULL,
  last_attempt_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  INDEX(conversation_id, created_at DESC)
);
```

### Key Files to Create/Modify

**Backend**:
- `src/connectors/base.ts` - ConnectorProvider interface
- `src/connectors/telegram-stub.ts` - Stub Telegram connector
- `src/connectors/irc-stub.ts` - Stub IRC connector
- `src/services/message.service.ts` - Enhanced with send logic
- `src/services/message-queue-processor.ts` - Already exists, enhance
- `src/services/dead-letter-queue.service.ts` - Already exists, enhance
- `src/socket-controllers/message.controller.ts` - Event listening
- Schema migrations - `error_details`, `dead_letter_queue` table

**Frontend**:
- `src/components/ReplyComposer.tsx` - Text + file upload
- `src/hooks/useWebSocket.ts` - Event listeners
- `src/stores/inboxStore.ts` - Update on WebSocket events

**Tests**:
- `src/services/__tests__/message.service.spec.ts`
- `src/workers/__tests__/message-retry.spec.ts`
- `src/socket-controllers/__tests__/message.controller.spec.ts`
- `packages/frontend/e2e/send-receive-message.spec.ts`

---

**Version**: 1.0  
**Last Updated**: February 9, 2026  
**Status**: ✅ Ready for Implementation  
**Next Review**: After Phase 2 completion (Feb 16, 2026)
