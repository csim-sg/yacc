# Phase 2 Architecture Review: Question-by-Question Decisions

NOTE: This document predates the current phase naming. It covers Week 2 / Phase 1.4 (messaging + real-time), not Phase 2 (collaboration + rules).

**Date**: February 9, 2026  
**Status**: ✅ APPROVED  
**Scope**: Addresses all 7 questions from architecture review request

---

## Question 1: BE-009/010 - Message Send/Receive

### Q: Message model—add `status` column + `errorDetails` JSON?

#### ✅ DECISION: YES to both

**`status` column** (VARCHAR):
- Values: `pending`, `sent`, `failed`
- Tracks message lifecycle
- Indexed for quick queries
- Updated atomically with dispatch result

**`error_details` JSON column** (JSONB):
```sql
ALTER TABLE messages ADD COLUMN error_details JSONB DEFAULT NULL;
```

**Structure** (when populated):
```json
{
  "message": "Telegram API returned 429 Too Many Requests",
  "code": "RATE_LIMIT_ERROR",
  "details": {
    "statusCode": 429,
    "platform": "telegram",
    "endpoint": "/sendMessage",
    "retryAfter": 30
  },
  "timestamp": "2026-02-09T10:30:00Z"
}
```

**Null when**: Status is `sent` (no error to store)

**Querying**: Find failed messages:
```sql
SELECT * FROM messages WHERE status = 'failed' AND error_details IS NOT NULL;
```

---

### Q: Connector abstraction—how to dispatch without tight coupling?

#### ✅ DECISION: Use Provider interface pattern

**Interface** (decouples service from platform specifics):
```typescript
export interface ConnectorProvider {
  sendMessage(payload: SendMessagePayload): Promise<{ id: string }>;
}

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
```

**Benefits**:
- ✅ Service doesn't know platform details
- ✅ Easy to test (mock connector)
- ✅ Easy to add platforms (implement interface)
- ✅ No circular dependencies

**Usage** (in MessageService):
```typescript
const connector = getConnector(conversation.channel);
const result = await connector.sendMessage(payload);
```

---

### Q: For Phase 2 MVP—use mock/stub connectors or in-memory dispatch?

#### ✅ DECISION: Stub connectors (return mock success, can inject failure)

**Why stubs over in-memory**:
- More realistic (simulates platform call)
- Easier to test failure scenarios
- Can be switched to real implementation in Phase 3
- Clear separation between Phase 2 (scaffold) and Phase 3 (integration)

**Stub Implementation** (Phase 2):
```typescript
// src/connectors/telegram-stub.ts
export class TelegramConnector implements ConnectorProvider {
  async sendMessage(payload: SendMessagePayload): Promise<{ id: string }> {
    // Mock success (Phase 2)
    logger.info({ payload }, 'TelegramConnector.sendMessage (STUB)');
    return { id: 'stub-' + Math.random().toString(36).substr(2, 9) };
  }
}

// src/connectors/irc-stub.ts
export class IrcConnector implements ConnectorProvider {
  async sendMessage(payload: SendMessagePayload): Promise<{ id: string }> {
    // Mock success (Phase 2)
    logger.info({ payload }, 'IrcConnector.sendMessage (STUB)');
    return { id: 'stub-' + Math.random().toString(36).substr(2, 9) };
  }
}
```

**Real Implementation** (Phase 3):
```typescript
export class TelegramConnector implements ConnectorProvider {
  async sendMessage(payload: SendMessagePayload): Promise<{ id: string }> {
    // Real implementation using Telegram Bot API
    const response = await axios.post(
      `https://api.telegram.org/bot${this.token}/sendMessage`,
      {
        chat_id: payload.externalThreadId,
        text: payload.body,
      }
    );
    return { id: response.data.result.message_id };
  }
}
```

**For Testing** (inject failure):
```typescript
// In tests, can mock failure behavior
const failingConnector = new TelegramConnector();
failingConnector.sendMessage = jest.fn().mockRejectedValue(
  new Error('RATE_LIMIT_ERROR')
);

// Service catches error and enqueues retry
const message = await messageService.sendMessage(payload);
expect(message.status).toBe('failed');
expect(message.error_details.code).toBe('RATE_LIMIT_ERROR');
```

---

## Question 2: BE-014 - Exponential Backoff

### Q: Redis + BullMQ setup—already exists or need to add?

#### ✅ DECISION: Already exists! 70% complete, enhance in Phase 2

**Current State** (in codebase):
- ✅ `infrastructure/redis.client.ts` - Redis connection
- ✅ `infrastructure/queues.client.ts` - BullMQ queue initialization
- ✅ `services/message-queue.service.ts` - Queue operations
- ✅ `services/message-queue-processor.ts` - Job processor
- ✅ `services/message-queue-dlq.service.ts` - DLQ management
- ✅ `types/message-queue.types.ts` - Type definitions
- ✅ `workers/messageRetryWorker.ts` - Worker implementation
- ✅ `enums/messageStatus.enum.ts` - Status enum

**What's Missing**:
- ⏳ DLQ table in Postgres (currently service-only)
- ⏳ Audit log integration (log each retry)
- ⏳ Monitoring/alerting (detect stuck queues)

---

### Q: Worker pattern—background job processor or inline with service?

#### ✅ DECISION: Background job processor (already implemented)

**Why separate workers**:
- ✅ Non-blocking (message save doesn't wait for delivery)
- ✅ Scalable (can run on separate workers)
- ✅ Resilient (job survives process restart)
- ✅ Auditable (track retry attempts)

**Current Pattern** (already in code):
```typescript
// Service saves message + enqueues job (non-blocking)
const message = await db.messages.create({...});
await enqueueRetry({ messageId: message.id, ... });

// Separate worker picks up job
messageRetryQueue.process(async (job: Job<SendMessageJobPayload>) => {
  const message = await db.messages.findUnique({...});
  const connector = getConnector(message.platform);
  await connector.sendMessage({...});
});
```

**Configuration** (already set):
```typescript
export const RETRY_CONFIG = {
  MAX_ATTEMPTS: 3,
  BACKOFF_DELAYS: [60000, 300000, 1800000], // 1m, 5m, 30m
  QUEUE_NAMES: { MESSAGE_QUEUE: 'message-queue', DLQ: 'dlq' },
};
```

---

### Q: DLQ table design—simple `failed_messages` with messageId + error + timestamp?

#### ✅ DECISION: Yes, plus metadata for ops

**Schema**:
```sql
CREATE TABLE dead_letter_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES conversations(id),
  original_payload JSONB NOT NULL,      -- Full job payload for reprocessing
  failure_reason VARCHAR(100) NOT NULL, -- max_retries_exceeded, platform_error, etc.
  last_error TEXT,                      -- Last error message
  total_attempts INT NOT NULL,          -- How many times we tried
  first_attempt_at TIMESTAMP NOT NULL,  -- When we first tried
  last_attempt_at TIMESTAMP NOT NULL,   -- When we last tried
  resolved_at TIMESTAMP,                -- When ops manually resolved
  resolved_by UUID REFERENCES users(id), -- User who resolved
  resolution_notes TEXT,                 -- Why/how it was resolved
  created_at TIMESTAMP DEFAULT NOW(),
  
  INDEX(conversation_id),
  INDEX(created_at DESC),
  INDEX(message_id),
  INDEX(failure_reason)
);
```

**Queries**:
```sql
-- Find all failed messages
SELECT * FROM dead_letter_queue WHERE resolved_at IS NULL ORDER BY created_at DESC;

-- Find by failure reason
SELECT * FROM dead_letter_queue WHERE failure_reason = 'max_retries_exceeded';

-- Count by conversation
SELECT conversation_id, COUNT(*) as failed_count FROM dead_letter_queue GROUP BY conversation_id;
```

**Ops Workflow**:
1. Run report: `SELECT conversation_id, COUNT(*) FROM dead_letter_queue WHERE resolved_at IS NULL`
2. Investigate via Slack/admin panel
3. Manually mark resolved: `UPDATE dead_letter_queue SET resolved_at = NOW(), resolved_by = user_id, resolution_notes = '...' WHERE id = ...`

---

## Question 3: BE-017/018/019 - WebSocket Events

### Q: Socket-controllers already migrated (BE-206)—where to trigger events?

#### ✅ DECISION: In service layer after DB commit

**Architecture**:
```
Service Layer
  ↓ (updates DB)
  ↓ (emits event)
EventEmitter
  ↓ (event listener)
Socket Controller
  ↓ (broadcasts to clients)
Client
```

**Implementation**:
```typescript
// Service emits
export class MessageService extends EventEmitter {
  async sendMessage(payload: SendMessagePayload): Promise<Message> {
    // ... business logic ...
    
    // After DB commit
    this.emit('message.sent', { conversationId, message });
  }
}

// Socket controller listens
@SocketController()
export class MessageController {
  constructor(private messageService: MessageService) {
    this.messageService.on('message.sent', (data) => {
      io.to(`conversation:${data.conversationId}`).emit('message.sent', data);
    });
  }
}
```

**Benefits** (vs. service calling socket directly):
- ✅ Service doesn't know about WebSocket
- ✅ Multiple listeners possible (future: analytics, logging)
- ✅ Service testable without socket dependency

---

### Q: Event backlog—1-hour message history already in DB or need to add?

#### ✅ DECISION: Use Redis, no DB migration needed

**Why Redis** (not Postgres):
- ✅ Better performance (in-memory)
- ✅ Auto-expiry via TTL (1 hour)
- ✅ Redis already running (for queue)
- ✅ No schema migration needed
- ❌ DB approach is slower + requires cleanup job

**Implementation** (Redis):
```typescript
// When event emitted
export async function storeBacklogEvent(userId: string, event: WebSocketEvent): Promise<void> {
  const key = `backlog:user:${userId}`;
  await redisClient.lpush(key, JSON.stringify(event)); // Add to list
  await redisClient.expire(key, 3600); // Expire after 1 hour
}

// On client reconnect
export async function getBacklogEvents(userId: string): Promise<WebSocketEvent[]> {
  const key = `backlog:user:${userId}`;
  const events = await redisClient.lrange(key, 0, -1);
  await redisClient.del(key); // Clear after retrieval
  return events.map(e => JSON.parse(e));
}
```

**Client Flow**:
```typescript
// On reconnect
socket.on('connect', async () => {
  // Server sends backlog events
  const backlog = await getBacklogEvents(userId);
  
  // Client processes each event
  backlog.forEach(event => {
    handleWebSocketEvent(event);
  });
});
```

---

## Question 4: FE-010 - Reply Composer + File Upload

### Q: Attachment storage—R2 in Phase 2 or mock/local?

#### ✅ DECISION: Real R2 in Phase 2

**Why not mock**:
- ✅ MVP should be production-ready
- ✅ R2 is free tier available
- ✅ Minimal cost ($0.15/GB, MVP is small)
- ✅ Same as production (no surprises)

**Configuration** (already available):
```env
CLOUDFLARE_R2_ENDPOINT=https://r2.example.com
CLOUDFLARE_R2_ACCESS_KEY=...
CLOUDFLARE_R2_SECRET_KEY=...
CLOUDFLARE_R2_BUCKET=omni-inbox
CLOUDFLARE_CDN_URL=https://cdn.example.com
```

---

### Q: File upload endpoint—multipart POST /conversations/:id/attachments?

#### ✅ DECISION: Yes, single file, multipart form

**Endpoint**:
```typescript
@Post('/:id/attachments')
@UseInterceptors(FileInterceptor('file'))  // Multer middleware
async uploadAttachment(
  @Param('id') conversationId: string,
  @UploadedFile() file: Express.Multer.File,
  @Req() req: AuthRequest
): Promise<{ data: Attachment }> {
  // Validation
  if (file.size > 5 * 1024 * 1024) {
    throw new BadRequestException('File exceeds 5 MB limit');
  }
  
  // Service handles upload
  const attachment = await attachmentService.uploadToR2({
    conversationId,
    file: file.buffer,
    fileName: file.originalname,
    mimeType: file.mimetype,
  });
  
  return { data: attachment };
}
```

**Frontend**:
```typescript
const formData = new FormData();
formData.append('file', file);

const response = await fetch(`/conversations/${conversationId}/attachments`, {
  method: 'POST',
  body: formData,
});

const { data } = await response.json();
// Use data.id in message.attachmentIds
```

**Multiple files**: ⏳ Deferred to Phase 3 (multipart form for multiple, batch processing)

---

### Q: For MVP—support images + PDFs only or all file types?

#### ✅ DECISION: Images + PDFs + plain text for MVP

**Allowed MIME types**:
```typescript
const ALLOWED_TYPES = [
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'application/pdf',
  'text/plain',
];
```

**Why this set**:
- Images: Most common for customer service (screenshots, product photos)
- PDFs: Invoices, documentation
- Plain text: Logs, configs

**Rejected** (Phase 2):
- Video (encoding issues, large files)
- MS Office (compatibility concerns)
- Archives (security)
- Executables (security)

**Phase 3+**: Expand based on customer feedback

**Validation**:
```typescript
if (!ALLOWED_TYPES.includes(file.mimetype)) {
  throw new BadRequestException(
    `Unsupported file type: ${file.mimetype}`
  );
}
```

---

## Question 5: Architecture Decisions Pending (PR #227 Blockers)

### Q: Auth endpoint prefix (currently `/auth`, should this change?)

#### ✅ DECISION: Keep `/auth`, no change needed

**Current endpoints**:
```
POST /auth/login
POST /auth/logout
POST /auth/forgot-password
POST /auth/reset-password
```

**Status**: ✅ Working in PR #227, no issues

**Future options** (Phase 2+):
- Add global `/api` prefix? → No, deferred (complicates routing)
- Add version prefix (e.g., `/v1`)? → No, not needed for MVP

**Why defer global `/api` prefix**:
- MVP has single API (no versioning)
- No route conflicts (auth != conversations != messages)
- Simpler controller definitions
- Can add route-level prefixes if needed

---

### Q: Global `/api` prefix (recommendation—defer)?

#### ✅ DECISION: Defer to Phase 2+ if needed

**Status**: Phase 1 didn't add global prefix (correct decision)

**When to add** (Phase 2+):
- Multiple API versions exist (v1, v2)
- Multi-tenant API isolation needed
- Client libraries generate routes (need standard prefix)
- Proxy/gateway requires standard routing

**How to add** (when needed, Phase 3+):
```typescript
// Option A: Global prefix in routing-controllers
useExpressServer(app, {
  routePrefix: '/api/v1',  // Global prefix
  controllers: [...],
});

// Option B: Route-level (simpler)
@Controller('/api/v1/conversations')
export class ConversationsController {...}
```

**For Phase 2**: Keep routes as-is, no prefix change

---

### Q: Confirm these decisions locked for Phase 2?

#### ✅ DECISION: Confirmed locked

**Locked Decisions** (no changes in Phase 2):
- ✅ Auth endpoints: `/auth/*` (no change)
- ✅ No global `/api` prefix
- ✅ Keep flat route structure

**Why lock these**:
- Already working in PR #227
- Changing would break Phase 1 work
- No clear benefit in Phase 2
- Can defer to Phase 3 if needed

---

## Question 6: Data Model Changes & Schema Migrations

### Q: Need any schema migrations for Phase 2?

#### ✅ DECISION: Two migrations required

**Migration 1: Add error_details to messages**
```sql
ALTER TABLE messages ADD COLUMN error_details JSONB DEFAULT NULL;
CREATE INDEX idx_messages_with_errors ON messages(id) WHERE error_details IS NOT NULL;
```

**Migration 2: Create dead_letter_queue table**
```sql
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

**WebSocket backlog** (no migration):
- Use Redis (already running)
- No schema changes needed

---

### Q: Migration strategy—Drizzle migrations before dev or inline?

#### ✅ DECISION: Drizzle migrations BEFORE dev starts

**Workflow**:
```bash
# 1. Create migration files
pnpm --filter @yacc/backend db:create-migration add-message-error-details
pnpm --filter @yacc/backend db:create-migration create-dead-letter-queue

# 2. Implement migration logic (in migration files)
# - Write up() function
# - Write down() function

# 3. Test migration locally
docker-compose up -d # Start fresh DB
pnpm --filter @yacc/backend db:migrate

# 4. Commit migrations
git add packages/backend/src/migrations/
git commit -m "BE-009/010: Add message status + DLQ table migrations"

# 5. Start development
# Schema is now ready for Phase 2 code
```

**Rationale**:
- ✅ Clean DB state
- ✅ All developers use same schema
- ✅ No surprises (schema exists before code)
- ✅ Easy rollback if needed

---

## Question 7: Error Handling & Logging

### Q: Correlation ID propagation to WebSocket events?

#### ✅ DECISION: Yes, include in event envelope

**HTTP Correlation ID** (already implemented):
```typescript
// Middleware generates on each request
export function correlationIdMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const correlationId = req.headers['x-correlation-id'] || generateUUID();
  req.id = correlationId;
  res.setHeader('x-correlation-id', correlationId);
  next();
}
```

**WebSocket Correlation ID** (extend to socket):
```typescript
@SocketController()
export class MessageController {
  @OnConnect()
  onConnect(socket: Socket) {
    socket.data.correlationId = generateUUID();
  }

  @OnMessage('subscribe.conversation')
  async onSubscribe(socket: Socket, conversationId: string) {
    const correlationId = socket.data.correlationId;
    socket.emit('subscribed', {
      conversationId,
      correlationId,  // Include in response
    });
  }
}
```

**Event Envelope** (includes correlation ID):
```json
{
  "type": "message.sent",
  "payload": { "conversationId": "...", "message": {...} },
  "timestamp": "2026-02-09T10:30:00Z",
  "correlationId": "req-123"
}
```

**Benefit**: Track event through system (HTTP → WebSocket → DB → logs)

---

### Q: Failed message logging—structured JSON via Pino (ADR-004)?

#### ✅ DECISION: Yes, structured Pino logs

**Already configured** (in ADR-004):
- Pino logger via `infrastructure/logger.ts`
- Structured JSON output
- Correlation ID propagation
- Performance optimized

**Usage** (for failed messages):
```typescript
logger.error({
  correlationId: req.id,
  userId: req.user.id,
  conversationId: message.conversation_id,
  messageId: message.id,
  platform: conversation.channel,
  error: error.message,
  errorCode: error.code,
  errorStack: error.stack,
}, 'Failed to send message');

// Output (JSON)
{
  "level": "ERROR",
  "correlationId": "req-123",
  "userId": "user-456",
  "conversationId": "conv-789",
  "messageId": "msg-101",
  "platform": "telegram",
  "error": "RATE_LIMIT_ERROR",
  "errorCode": "RATE_LIMIT",
  "errorStack": "Error: ...",
  "timestamp": "2026-02-09T10:30:00.000Z"
}
```

**Benefits**:
- ✅ Structured (easy to parse/query)
- ✅ Searchable (ELK/Datadog/Grafana)
- ✅ Correlation ID for tracing
- ✅ No sensitive data (passwords, tokens)

---

### Q: Error codes for API responses—use IETF Problem Details?

#### ✅ DECISION: Yes, RFC 7807 format

**Standard Error Response**:
```json
{
  "code": "invalid_message_body",
  "message": "Message body is invalid",
  "details": {
    "field": "body",
    "reason": "Message cannot be empty"
  },
  "timestamp": "2026-02-09T10:30:00Z",
  "correlationId": "req-123"
}
```

**Error Codes** (Phase 2):
| Code | HTTP | Meaning | Recovery |
|------|------|---------|----------|
| `invalid_message_body` | 400 | Validation failed | Fix message |
| `file_too_large` | 413 | File > 5 MB | Reduce size |
| `unsupported_file_type` | 415 | File type rejected | Change format |
| `platform_error` | 503 | Platform unavailable | Auto-retry |
| `network_error` | 503 | Network down | Auto-retry |
| `max_retries_exceeded` | 422 | Failed after 4 attempts | Manual intervention |
| `internal_error` | 500 | Server error | Contact support |

**Implementation**:
```typescript
// Custom exception
export class PlatformException extends HttpException {
  constructor(message: string, code: string, details?: unknown) {
    super(
      {
        code,
        message,
        details,
        timestamp: new Date().toISOString(),
      },
      HttpStatus.SERVICE_UNAVAILABLE
    );
  }
}

// Usage
throw new PlatformException(
  'Telegram API returned 503 Service Unavailable',
  'platform_error',
  { platform: 'telegram', statusCode: 503 }
);
```

---

## Summary: All Questions Answered ✅

| # | Question | Decision | Status |
|---|----------|----------|--------|
| 1 | Message model (status + errorDetails) | Add both columns to DB | ✅ Approved |
| 2 | Connector abstraction | Provider interface pattern | ✅ Approved |
| 3 | Phase 2 connectors | Stub implementation | ✅ Approved |
| 4 | BullMQ setup | Exists, enhance for Phase 2 | ✅ Approved |
| 5 | Worker pattern | Background job processor | ✅ Approved |
| 6 | DLQ design | Postgres table + ops workflow | ✅ Approved |
| 7 | WebSocket events | Service → EventEmitter → socket-controllers | ✅ Approved |
| 8 | Event backlog | Redis (1-hour TTL) | ✅ Approved |
| 9 | Attachment storage | Real R2 in Phase 2 | ✅ Approved |
| 10 | File upload endpoint | Multipart `/conversations/:id/attachments` | ✅ Approved |
| 11 | File types | Images + PDFs + text (Phase 2) | ✅ Approved |
| 12 | Auth prefix | Keep `/auth` (no change) | ✅ Approved |
| 13 | Global `/api` prefix | Defer to Phase 2+ if needed | ✅ Approved |
| 14 | Lock Phase 2 decisions | Yes, confirmed locked | ✅ Approved |
| 15 | Schema migrations | Two migrations required | ✅ Approved |
| 16 | Migration strategy | Drizzle before dev | ✅ Approved |
| 17 | Correlation ID to WebSocket | Yes, include in envelope | ✅ Approved |
| 18 | Failed message logging | Structured Pino JSON | ✅ Approved |
| 19 | Error codes | IETF Problem Details (RFC 7807) | ✅ Approved |

---

**For Implementation**: See `.docs/PHASE-2-TECHNICAL-ARCHITECTURE-REVIEW.md` (full details + code examples)

**Next Steps**:
1. ✅ Architect approval: Done
2. ⏳ Product owner approval: Pending
3. ⏳ Implementation team kickoff: Monday Feb 9, 9am
