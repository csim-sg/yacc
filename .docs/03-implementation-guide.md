# 03. Implementation Guide & Technical Deep Dive

**YACC - Architecture, Technical Decisions, & Code Examples**

---

## Table of Contents

1. [System Architecture](#1-system-architecture)
2. [Technology Stack](#2-technology-stack)
3. [Core Components Guide](#3-core-components-guide)
4. [Architecture Diagrams](#4-architecture-diagrams)
5. [Implementation Phases](#5-implementation-phases)
6. [Configuration & Environment](#6-configuration--environment)
7. [Key Technical Decisions](#7-key-technical-decisions)

---

## 1. System Architecture

**Execution Status Reference**: See `.docs/plans/00-INDEX.md` for the current project status.

### High-Level Overview

```
┌─────────────────────────────────────────────────────────────────┐
│ Frontend (TanStack Start SPA)                                   │
│ ├─ Inbox UI (filters, search, bulk actions)                    │
│ ├─ Conversation View (messages, attachments, timeline)         │
│ ├─ Right Panel (tags, notes, assignment, status)              │
│ ├─ Admin Panel (users, integrations, rules, audit logs)       │
│ └─ Notification Center                                          │
└─────────────┬───────────────────────────────────────────────────┘
              │ REST + WebSocket
              ▼
┌─────────────────────────────────────────────────────────────────┐
│ API Server (Node.js + Express)                                   │
├─────────────────────────────────────────────────────────────────┤
│ • REST Endpoints (auth, inbox, messages, rules, etc.)          │
│ • WebSocket Gateway (real-time events, notifications)          │
│ • Rules Engine (evaluate conditions, apply actions)            │
│ • Search Service (full-text search on PostgreSQL)              │
│ • Notification Engine (creation, delivery via WS)              │
│ • Audit Logger (log all actions)                               │
│ • Connector Manager (Telegram, IRC dispatchers)                │
└─────────────┬──────────┬──────────┬──────────────┬──────────────┘
              │          │          │              │
              ▼          ▼          ▼              ▼
     ┌──────────────┐ ┌─────┐ ┌─────────┐  ┌─────────────┐
     │ PostgreSQL   │ │ R2  │ │Redis +  │  │ Connectors  │
     │ (data)       │ │(CDN)│ │BullMQ   │  │ (Telegram,  │
     │              │ │     │ │(queues) │  │  IRC)       │
     └──────────────┘ └─────┘ └─────────┘  └─────────────┘
```

### Data Flow

**Inbound Message**:
```
Platform (Telegram/IRC)
  → Connector (webhook/polling)
  → API POST /messages/inbound
  → Store raw payload on R2
  → Download & store attachments on R2
  → Save message + conversation to Postgres
  → Index for search (PostgreSQL FTS)
  → Evaluate routing rules
  → Create notifications (if applicable)
  → Emit WebSocket events (conversation.updated, message.received)
  → Push to connected clients
```

**Outbound Message (Reply)**:
```
User submits reply in UI
  → API POST /conversations/:id/messages
  → Validate role (user/manager)
  → Save attachment(s) to R2
  → Save message to Postgres (status: pending)
  → Dispatch to connector
  → Success: update status to sent
  → Failure: enqueue retry (Redis + BullMQ)
  → Emit WebSocket event (message.sent or message.failed)
```

**Rule Execution**:
```
After message stored:
  → Rules Engine evaluates all active rules (priority order)
  → First matching rule applies actions
  → Log execution in audit trail + RoutingRuleExecution table
  → Update conversation (assign, tag, priority)
  → Emit WebSocket update
```

---

## 2. Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | TanStack Start (React) | SPA for inbox UI, real-time updates |
| **Frontend Auth** | BetterAuth | Session management, JWT |
| **Frontend State** | Zustand + TanStack Query | Client-side state & data fetching |
| **Frontend Styling** | Tailwind CSS | Utility-first CSS |
| **Backend** | Node.js 18+ | Runtime |
| **Backend Framework** | Express + routing-controllers | MVC, REST API |
| **Backend Auth** | BetterAuth | Email/password, session/JWT |
| **Database** | PostgreSQL 14+ | Primary data store |
| **Database ORM** | Drizzle | Type-safe SQL |
| **Real-Time** | Socket.io | WebSocket for inbox updates, notifications |
| **Search** | PostgreSQL FTS | Full-text search (future: Elasticsearch) |
| **Message Queue** | Redis + BullMQ | Outbound message retry queue |
| **File Storage** | Cloudflare R2 | Raw payloads, attachments, re-hosted files |
| **Email** | Nodemailer / SendGrid | Password reset emails |
| **Hosting** | K3s + Helm (single-tenant MVP) | Backend runs on K3s; deploy via Helm; dependencies via Helm |
| **Testing** | Playwright | E2E testing |
| **Testing** | Vitest | Unit & integration tests (native ESM, 18.8% faster) |
| **Package Manager** | pnpm | Monorepo management with workspaces (Bun migration tracked separately) |

---

## 2.1 Package Manager: pnpm

YACC uses **pnpm** for efficient monorepo management with workspaces.

### Why pnpm?

- **Efficient disk usage**: Content-addressable storage uses symlinks (vs npm's copy-everything approach)
- **Better dependency resolution**: Strict mode prevents phantom dependencies (implicit parent dependencies)
- **Native workspace support**: Built-in monorepo support without external plugins
- **Performance**: 2-3x faster than npm, significantly lower memory footprint
- **Package compatibility**: Works with all Node.js packages (npm/yarn compatible)

### Installation

```bash
# Install pnpm globally
npm install -g pnpm@9

# Verify installation
pnpm --version  # Should output v9.x
```

### Common Commands

| Command | Purpose | Example |
|---------|---------|---------|
| `pnpm install` | Install all workspace dependencies | `pnpm install` |
| `pnpm add <pkg>` | Add package to root workspace | `pnpm add lodash` |
| `pnpm add <pkg> -w` | Add package to root (workspace flag) | `pnpm add typescript -w -D` |
| `pnpm add <pkg> -D` | Add dev dependency to root | `pnpm add vitest -D` |
| `pnpm dev` | Run all dev servers (Turborepo) | `pnpm dev` |
| `pnpm build` | Build all packages (Turborepo) | `pnpm build` |
| `pnpm test` | Run tests across all packages | `pnpm test` |
| `pnpm lint` | Run linter across all packages | `pnpm lint` |

### Workspace Filtering (--filter)

The `--filter` flag targets specific workspaces:

```bash
# Run backend tests only
pnpm --filter @yacc/backend test

# Start frontend dev server
pnpm --filter @yacc/frontend dev

# Run linter in common package
pnpm --filter @yacc/common lint

# Add dependency to specific package
pnpm --filter @yacc/backend add axios

# Run script in multiple packages
pnpm --filter '@yacc/{backend,frontend}' build
```

### Turborepo Integration

**Turborepo** (`turbo.json`) orchestrates task execution across workspaces for efficiency:

```bash
# These use Turborepo for task scheduling:
pnpm dev              # Runs all dev tasks in dependency order
pnpm build            # Builds all packages in correct order
pnpm test             # Runs all tests, respecting dependencies

# Turborepo features:
# - Caching: Skips unchanged packages
# - Parallelization: Runs independent tasks concurrently
# - Dependency order: Respects package dependency graph
```

### Workspace Structure

```yaml
# pnpm-workspace.yaml defines workspaces
packages:
  - packages/backend    # @yacc/backend
  - packages/frontend   # @yacc/frontend
  - packages/common     # @yacc/common
```

Each workspace:
- Has its own `package.json`
- Can depend on other workspaces
- Can have its own dependencies
- Shares root `node_modules` via pnpm hoisting

---

## 3. Core Components Guide

### 3.1 Message Retry Queue & DLQ (Redis + BullMQ)

**When to use**: Outbound message fails to deliver to platform

**Flow**:
```
Message send fails
  → Enqueue job: { messageId, conversationId, providerId }
  → Job schedule: wait 1 minute (attempt 1)
  → Worker picks up job, attempts delivery
  → Success: mark message status = sent
  → Failure: retry with backoff (5 min, 30 min)
  → After 3 failures: move to DLQ for ops review
  → Ops retry or delete via DLQ API
```

**Configuration**:
```env
REDIS_HOST=localhost
REDIS_PORT=6379
MESSAGE_RETRY_ATTEMPTS=3
MESSAGE_RETRY_BASE_DELAY_MS=60000  # 1 minute
MESSAGE_RETRY_BACKOFF_MULTIPLIER=5  # 1m, 5m, 30m
```

**Key Code**:
```typescript
// Enqueue retry on failure
await messageRetryQueue.add(
  { messageId, conversationId, providerId },
  { attempts: 3, backoff: { type: 'exponential', delay: 60000 } }
);

// Process retry
messageRetryQueue.process(async (job) => {
  const { messageId, providerId } = job.data;
  const message = await db.message.findUnique({ where: { id: messageId } });
  const connector = getConnector(providerId);
  await connector.sendMessage(...);
});
```

### 3.1.1 DLQ (Dead Letter Queue) Contract

**Message ID Contract**:
- `messageId` is always a UUID and references `messages.id`
- External job/platform IDs are **never** used as messageId
- Enforced by dlqService.moveToDLQ() validation

**Example** (moving failed Telegram message to DLQ):
```typescript
// ✅ CORRECT: UUID messageId, external ID in metadata
await dlqService.moveToDLQ(
  'a1b2c3d4-e5f6-47a8-9b10-c1d2e3f4a5b6',  // UUID FK
  conversationId,
  payload,
  'api_error',
  'Failed to send to Telegram',
  {
    metadata: {
      jobId: 'msg-payload-abc123',           // BullMQ job ID
      externalMessageId: 'tg-msg-9876543'    // Telegram message ID
    }
  }
);
```

**Traceability Fields** (for ops investigation):
- `correlationId`: End-to-end trace ID (search logs with this)
- `ircProfileId`: IRC profile ID (integer, if applicable)
- `externalThreadType`: Platform (telegram_group, irc_channel)
- `externalThreadId`: Specific thread (tg-group-123, #general)
- `metadata`: Job ID, external message ID, custom data

**RBAC Policy** (ops access control):
- **manager**: LIST, STATS (read-only, oversight)
- **admin**: LIST, STATS, RE-QUEUE (ops can retry)
- **super_admin**: LIST, STATS, RE-QUEUE, DELETE (full access)
- **user**: NO ACCESS (restricted)

**Ops Workflow**:
1. Ops views DLQ: `GET /api/dlq`
2. Ops checks failed message: `SELECT * FROM messages WHERE id = '{messageId}'`
3. Ops investigates root cause (check logs with correlationId)
4. Ops retries: `POST /api/dlq/:id/re-queue` (admin+)
5. Ops deletes after resolution: `DELETE /api/dlq/:id` (super_admin only)

---

### 3.2 Full-Text Search (PostgreSQL FTS)

**When to use**: User searches inbox by message content or sender name

**Flow**:
```
User types "urgent" in search
  → Query: SELECT * FROM messages WHERE search_vector @@ to_tsquery('urgent')
  → Results ranked by relevance + recency
  → Combine with filters (channel, tag, assignee, status)
  → Return paginated results (20 per page)
```

**Configuration**:
```sql
-- Create full-text search index on messages
CREATE INDEX idx_messages_search_vector ON messages USING gin(search_vector);

-- Auto-update search_vector on insert/update
CREATE TRIGGER trigger_update_message_search_vector
BEFORE INSERT OR UPDATE ON messages
FOR EACH ROW
EXECUTE FUNCTION update_message_search_vector();
```

**Key Code**:
```typescript
// Search endpoint
export async function searchConversations(
  query: string,
  filters: { channel?, tag?, assignee?, status?, dateFrom?, dateTo? },
  page: number
) {
  const tsQuery = query.split(/\s+/).join(' & ');  // AND logic
  const results = await db.$queryRaw`
    SELECT DISTINCT c.id, m.body, ts_rank(...) as relevance_score
    FROM conversations c
    LEFT JOIN messages m ON c.id = m.conversation_id
    WHERE m.search_vector @@ to_tsquery('english', ${tsQuery})
    ${channel ? `AND c.channel = '${channel}'` : ''}
    ORDER BY relevance_score DESC, m.created_at DESC
    LIMIT 20 OFFSET ${(page - 1) * 20}
  `;
  return results;
}
```

**Performance**: <1 second for typical queries with GIN index

**Future**: Migrate to Elasticsearch for scale (>1M messages)

---

### 3.3 Notification Engine

**When to use**: User assigned, @mentioned, or has unread messages

**Flow**:
```
Trigger 1: User assigned conversation
  → Create notification: type='assignment', user_id=assignee
  → Emit WebSocket: user:${userId}:notifications (event: notification.received)
  → Frontend receives, shows notification bell + increments badge

Trigger 2: User @mentioned in note
  → Parse note body for @username
  → Create notification: type='mention', user_id=mentioned_user
  → Same WebSocket flow

Trigger 3: New unread message
  → Badge only (no notification object)
  → Unread count incremented in conversation
```

**Database**:
```sql
-- No duplicates: unique(user_id, conversation_id, type)
CREATE UNIQUE INDEX idx_notifications_dedup
  ON notifications(user_id, conversation_id, type)
  WHERE dismissed_at IS NULL;
```

**Key Code**:
```typescript
// Create notification
export async function createNotification(
  userId: string,
  type: 'assignment' | 'mention',
  conversationId: string,
  actorId: string
) {
  const notification = await db.notification.upsert({
    where: { unique_key: `${userId}_${conversationId}_${type}` },
    update: { created_at: new Date() },  // Refresh
    create: {
      user_id: userId,
      type,
      conversation_id: conversationId,
      actor_id: actorId,
    },
  });

  // Emit WebSocket
  await ws.publish(`user:${userId}:notifications`, {
    type: 'notification.received',
    payload: { notification },
  });

  return notification;
}

// Parse @mentions in notes
const mentionRegex = /@(\w+)/g;
const mentions = [...noteBody.matchAll(mentionRegex)].map(m => m[1]);
for (const mention of mentions) {
  const user = await db.user.findFirst({ where: { email: { contains: mention } } });
  if (user) {
    await createNotification(user.id, 'mention', conversationId, noteAuthorId);
  }
}
```

---

### 3.4 Attachment Handling (Cloudflare R2)

**When to use**: Download/re-host inbound attachments, upload outbound attachments

**Inbound Flow**:
```
Telegram/IRC message with attachment
  → Connector downloads file (validate: <5 MB)
  → Upload to R2: PUT /attachments/{conversationId}/{uuid}_{filename}
  → Save to DB: { message_id, url, storage_key, type, name, size }
  → Return CDN URL: https://cdn.example.com/attachments/...
  → Display inline in message timeline
```

**Outbound Flow**:
```
User uploads file in reply composer
  → Validate: <5 MB, MIME type in whitelist
  → Upload to R2 (same as inbound)
  → Save to DB: { message_id, uploaded_by, uploaded_at }
  → Send with message to platform
```

**Configuration**:
```env
CLOUDFLARE_R2_ENDPOINT=https://r2.example.com
CLOUDFLARE_R2_ACCESS_KEY=...
CLOUDFLARE_R2_SECRET_KEY=...
CLOUDFLARE_R2_BUCKET=omni-inbox
CLOUDFLARE_CDN_URL=https://cdn.example.com
ATTACHMENT_MAX_SIZE_MB=5
```

**Key Code**:
```typescript
// Download & re-host
export async function downloadAndRehost(
  conversationId: string,
  sourceUrl: string,
  fileName: string,
  mimeType: string
) {
  const buffer = await fetch(sourceUrl).then(r => r.buffer());
  if (buffer.length > 5 * 1024 * 1024) throw new Error('File too large');

  const storageKey = `attachments/${conversationId}/${Date.now()}_${fileName}`;
  await s3Client.send(new PutObjectCommand({
    Bucket: 'omni-inbox',
    Key: storageKey,
    Body: buffer,
    ContentType: mimeType,
  }));

  return db.attachment.create({
    data: {
      url: `https://cdn.example.com/${storageKey}`,
      storage_key: storageKey,
      type: mimeType,
      name: fileName,
      size: buffer.length,
    },
  });
}
```

---

### 3.5 WebSocket Real-Time Updates (socket-controllers)

**When to use**: Notify UI of inbox changes, message delivery, presence, notifications

**Architecture Decision**: Adopted **socket-controllers** for declarative, type-safe WebSocket event handling (ADR-012)

**Configuration**:
```
Heartbeat: 60 seconds (ping/pong)
Backlog: 1 hour of missed events (stored in DB)
Reconnect: Exponential backoff (1s → 60s max, 5 attempts)
Auth: BetterAuth JWT validation via webSocketAuthMiddleware
```

**Controller Pattern** (socket-controllers):
```typescript
import { SocketController, OnConnect, OnDisconnect, OnMessage } from 'socket-controllers';
import type { Socket } from 'socket.io';
import type { AuthenticatedSocket } from '../websockets/auth.middleware';

@SocketController()
export class ConversationController {
  @OnConnect()
  onConnect(socket: Socket): void {
    const authSocket = socket as AuthenticatedSocket;
    const userId = authSocket.userId;
    // Join user's personal room
    if (userId) {
      socket.join(`user:${userId}`);
    }
  }

  @OnMessage('subscribe.conversation')
  async onSubscribeToConversation(socket: Socket, conversationId: string): Promise<void> {
    socket.join(`conversation:${conversationId}`);
    socket.emit('conversation.subscribed', { conversationId });
  }

  @OnMessage('conversation.updated')
  async onConversationUpdated(socket: Socket, payload: ConversationUpdatedPayload): Promise<void> {
    const room = `conversation:${payload.conversationId}`;
    // Broadcast to all subscribers
    socket.to(room).emit('conversation.updated', payload);
  }

  @OnDisconnect()
  onDisconnect(socket: Socket): void {
    const authSocket = socket as AuthenticatedSocket;
    // Broadcast offline status
    if (authSocket.userId) {
      socket.broadcast.emit('presence.updated', {
        userId: authSocket.userId,
        status: 'offline',
        timestamp: new Date().toISOString(),
      });
    }
  }
}
```

**Benefits Over Manual Listeners**:
- ✅ **Type Safety**: Full TypeScript with `AuthenticatedSocket` interface
- ✅ **Consistency**: Same decorator pattern as REST API (routing-controllers)
- ✅ **Auto-Discovery**: Controllers registered via `socket-controllers/index.ts`
- ✅ **Testability**: Controllers are unit-testable classes
- ✅ **Middleware Integration**: Auth middleware applies uniformly

**Implementation Details**:
- **Controllers**: `src/socket-controllers/` (6 controllers: conversation, message, typing, presence, reaction, connector)
- **Types**: `AuthenticatedSocket` interface from `websockets/auth.middleware.ts`
- **Auth**: `webSocketAuthMiddleware` validates JWT before `@OnConnect`
- **Events**: Named via `@OnMessage('event.name')` matching API contract in `.docs/02-api-and-data-model.md`

**For Detailed Patterns**: See `GOV-014: Socket-Controllers Implementation Guide` for:
- 5 common event handler patterns
- Type safety guidelines
- Error handling & logging standards
- Testing patterns
- Common gotchas & solutions

**Client Integration**:
```typescript
// TanStack Start frontend
const socket = io(WS_URL, { auth: { token: jwt } });

// Subscribe to conversation
socket.emit('subscribe.conversation', 'conv-123');

// Listen for updates
socket.on('conversation.updated', (payload) => {
  // Update store
  updateInboxStore(payload.conversation);
});

socket.on('presence.updated', (payload) => {
  // Update presence indicator
  updatePresenceStore(payload);
});
```

---

### 3.6 Routing Rules Engine

**When to use**: Automatically assign, tag, or prioritize new messages based on conditions

**Configuration**: Rules table stores conditions & actions as JSON

**Condition Types**:
```
- channel: match channel (eq, in)
- keyword: match message body (contains, matches regex)
- sender: match sender name/ID (eq, contains)
- tag: match if conversation has tag (in)
- time: match hour of day (gt, lt, in)
```

**Action Types**:
```
- assign: { type: 'assign', value: user_id }
- tag: { type: 'tag', value: tag_id }
- priority: { type: 'priority', value: 'high' | 'low' | ... }
```

**Key Code**:
```typescript
// Evaluate rules on inbound message
export async function evaluateRules(
  conversation: Conversation,
  message: Message
) {
  const rules = await db.routingRule.findMany({
    where: { status: 'active' },
    orderBy: { priority: 'asc' },
  });

  for (const rule of rules) {
    const conditions = JSON.parse(rule.conditions);
    const allMatch = conditions.every(cond =>
      evaluateCondition(cond, conversation, message)
    );

    if (allMatch) {
      // Apply first matching rule
      const actions = JSON.parse(rule.actions);
      for (const action of actions) {
        if (action.type === 'assign') {
          await db.conversation.update({
            where: { id: conversation.id },
            data: { assigned_user_id: action.value },
          });
        }
        // ... handle tag, priority
      }

      // Log execution
      await db.routingRuleExecution.create({
        data: {
          rule_id: rule.id,
          conversation_id: conversation.id,
          matched_conditions: JSON.stringify(conditions),
          applied_actions: JSON.stringify(actions),
        },
      });

      return;  // First match wins
     }
   }
}
```

---

### 3.7 IRC Profile Management (DB-First with Env Fallback)

**INT-010: Support for multi-profile IRC connections with DB-first gating**

**When to use**: Initialize IRC connector with credentials from database profiles or environment fallback

**Architecture**:
- **DB-first gating**: If ANY DB profiles exist for tenant + integration='irc', use DB only (ignore env)
- **Env fallback**: Only if zero DB profiles exist AND all required env vars are set
- **Error on DB failure**: If DB access errors occur, return 500 `irc_profile_resolution_failed` (fail closed; no silent env fallback)
- **Encryption**: Credentials stored encrypted at rest using `INTEGRATION_CREDENTIALS_ENCRYPTION_KEY` (AES-256-GCM)
- **Hard cap**: Maximum 10 profiles per tenant (enforce in service layer)

**Configuration**:
```env
# Encryption key for credential storage (required if using DB profiles)
INTEGRATION_CREDENTIALS_ENCRYPTION_KEY=<32-byte base64-encoded key>

# Fallback env vars (only used if zero DB profiles exist)
IRC_SERVER=irc.example.com
IRC_PORT=6667
IRC_USERNAME=mybot
IRC_PASSWORD=secret  # optional
IRC_CHANNELS=#channel1,#channel2
```

**Profile Lifecycle**:
```
CREATE → TEST → ACTIVATE → (optional) DISABLE → DELETE
  ↓       ↓       ↓          ↓                    ↓
 new   enabled  active   inactive            deleted
```

**Gating Logic** (in `ircProfileResolution.service.ts`):
```
1. Try query DB for ANY profiles (enabled OR disabled)
   - If DB error → throw 500 irc_profile_resolution_failed (FAIL CLOSED)
2. If >0 profiles found:
   - Active profile → use it
   - 0 active, 1 total → use implicitly (enabled or disabled)
   - 0 active, >1 total → throw 409 irc_profile_not_selected
3. If 0 profiles found:
   - Try env vars (IRC_SERVER, IRC_PORT, IRC_USERNAME, IRC_CHANNELS)
   - If incomplete → throw 409 irc_not_configured
   - If valid → use env (source: 'env')
```

**Key Code**:
```typescript
// Resolve IRC config for connector startup
import { resolveIrcConfig } from './services/ircProfileResolution.service';

// In IRC connector initialization:
const ircConfig = await resolveIrcConfig(tenantId);
// Returns: { server, port, nick, password?, channels[], source: 'db' | 'env', profileId? }

// Handle errors:
try {
  const config = await resolveIrcConfig(tenantId);
  await ircConnector.connect(config);
} catch (error) {
  if (error instanceof IrcProfileResolutionError) {
    // 500 irc_profile_resolution_failed → DB access failure
    // 409 irc_profile_not_selected → Multiple DB profiles, none active
    // 409 irc_not_configured → No DB profiles, env incomplete
    logger.error({ code: error.code, statusCode: error.statusCode }, error.message);
  }
  throw error;
}
```

**RBAC** (who can manage IRC profiles):
```
Super Admin: CREATE, UPDATE, TEST, ACTIVATE, DISABLE, DELETE, LIST
Admin:       LIST, GET (read-only)
Manager:     LIST, GET (read-only)
User:        (no access)
```

**Audit Logging**:
- All profile lifecycle events logged (create, update, activate, disable, delete, test)
- Metadata never includes passwords or encrypted credentials
- Entity type: 'integration', Entity ID: `irc-profile-{id}`

**See also**: `.docs/adr/ADR-017-irc-multi-profile-db-first-architecture.md`

---

## 4. Architecture Diagrams

### Repository Structure Tree

```
yacc-client/
 ├── packages/
 │   ├── common/
 │   │   ├── src/
 │   │   │   ├── types/
 │   │   │   ├── schemas/
 │   │   │   ├── constants/
 │   │   │   └── utils/
 │   │   ├── package.json
 │   │   └── tsconfig.json
 │   │
 │   ├── backend/
 │   │   ├── src/
 │   │   │   ├── index.ts
 │   │   │   ├── controllers/         ← API controllers (from api/controllers/)
 │   │   │   ├── middleware/          ← Middleware (from api/middleware/)
 │   │   │   ├── decorators/          ← Custom decorators (from api/decorators/)
 │   │   │   ├── services/            ← Business logic (merged from domain/services/ + services/)
 │   │   │   ├── config/              ← Configuration data (simple objects with env vars)
 │   │   │   ├── infrastructure/      ← Client initialization (singleton classes: DB, Redis, R2, etc.)
 │   │   │   ├── connectors/          ← Platform connectors (Telegram, IRC)
 │   │   │   ├── websockets/          ← WebSocket logic
 │   │   │   ├── workers/             ← Background workers
 │   │   │   ├── types/               ← Type definitions
 │   │   │   └── utils/               ← Utility functions
 │   │   ├── tests/
 │   │   ├── package.json
 │   │   ├── tsconfig.json
 │   │   └── Dockerfile
 │   │
 │   └── frontend/
 │       ├── src/
 │       │   ├── components/
 │       │   ├── pages/
 │       │   ├── stores/
 │       │   ├── services/
 │       │   ├── types/
 │       │   └── hooks/
 │       ├── tests/
 │       ├── public/
 │       ├── package.json
 │       ├── tsconfig.json
 │       ├── vite.config.ts
 │       └── playwright.config.ts
 │
 ├── .github/workflows/
 │   ├── lint.yml
 │   ├── tests.yml
 │   ├── backend-deploy.yml
 │   └── frontend-deploy.yml
 │
 ├── .docs/
 ├── docker compose.yml
 ├── turbo.json
 ├── pnpm-workspace.yaml
 └── package.json
 ```

### Backend Deployment Flow

```
Push to main
  ↓
GitHub Actions: backend-deploy.yml
  ├── Build Docker image (multi-stage)
  ├── Push to Docker registry
  ├── Helm upgrade --install (to K3s)
  ├── Rollout status check
  ↓
API live at https://api.example.com
```

### Frontend Deployment Flow

```
Push to main
  ↓
GitHub Actions: frontend-deploy.yml
  ├── Build React app (pnpm build)
  ├── Upload dist/ to Cloudflare R2
  ├── Invalidate CloudFront cache
  ↓
SPA live at https://app.example.com
```

### Authentication Flow

```
User Visits App
  ├── Token exists? → Try to revalidate
  ├── Token invalid/expired? → Redirect to login
  └── Token valid? → Load app

Login Form
  → POST /api/auth/login
  → Backend validates (BetterAuth)
  → Return JWT token
  → Frontend stores in localStorage + Zustand

Every API Request
  → Attach JWT: Authorization: Bearer <JWT>
  → Backend middleware: Verify & extract userId, role
  → Proceed to route handler
```

### Real-Time Data Flow (WebSocket)

```
Client (Frontend)
  → Socket.io connection
  → Automatic reconnection (exponential backoff)
  → Attach to user (via JWT)

Backend (Express + Socket.io)
  → WebSocket Gateway
  → Authentication middleware
  → Event handlers (8 event types)
  → Store in database (reconnect backlog)
  → Broadcast to relevant users
  → Clean up old events (1-hour backlog)

Client Receives Event
  → Update Zustand store
  → Invalidate TanStack Query cache
  → UI re-renders automatically
```

---

## 5. Implementation Phases

**MVP** includes **Phase 1 + Phase 2** (see GOV-021).

### Phase 1: Core + Messaging + Integrations (Week 1–2)
**Goal**: Auth + data model + inbox + messaging + Telegram/IRC integrations

**Tasks**:
- [ ] Setup PostgreSQL schema (users, conversations, messages, etc.)
- [ ] Implement BetterAuth (login, logout, forgot password)
- [ ] API: GET /conversations, GET /conversations/:id
- [ ] API: POST /auth/* endpoints
- [ ] Data: User roles + RBAC middleware
- [ ] WebSocket: connection, authentication, events
- [ ] Setup: Redis + BullMQ for message retry
- [ ] API: POST /conversations/:id/messages (send reply)
- [ ] Connectors: Telegram webhook ingestion
- [ ] Connectors: IRC polling/connection setup
- [ ] Frontend: Login page + inbox list UI
- [ ] Frontend: Conversation view + reply composer

**Deliverable**: Users can send/receive Telegram + IRC messages with live updates

**Phase 1 UI constraint**: Channel filter UI must expose Telegram + IRC only; future channels remain in enums for forward compatibility.

---

### Phase 2: Collaboration & Rules (Week 3–4)
**Goal**: Tags, notes, assignments, routing rules

**Tasks**:
- [ ] API: POST /conversations/:id/tags, /assign, /notes
- [ ] API: Routing rules CRUD + evaluation
- [ ] Frontend: Right panel (tags, notes, assignment)
- [ ] Frontend: Rules builder UI
- [ ] Audit logging: all actions logged
- [ ] Notifications: assignment & @mention
- [ ] Bulk actions: POST /conversations/bulk

**Deliverable**: Teams can collaborate, rules auto-route messages

---

### Phase 3: Search & Attachments (Week 5)
**Goal**: Search, file handling, raw payload access

**Tasks**:
- [ ] Search: PostgreSQL FTS setup + indexing
- [ ] API: GET /search/conversations endpoint
- [ ] Attachments: Upload/download to R2
- [ ] API: POST /conversations/:id/attachments
- [ ] Raw payloads: manager+ access + retention

**Deliverable**: Search and attachments complete

---

### Phase 4: Admin & Polish (Week 6)
**Goal**: Admin workflows, integration setup, QA

**Tasks**:
- [ ] Admin: User management UI
- [ ] Admin: Integration setup (credential form + test)
- [ ] Admin: Audit log viewer + export
- [ ] QA: Playwright E2E tests

**Deliverable**: MVP complete, ready for launch

---

## 6. Configuration & Environment

### Backend (.env)

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/omni_inbox

# Auth
BETTER_AUTH_SECRET=generate-random-string
JWT_SECRET=generate-random-string
RESET_PASSWORD_TOKEN_TTL_MINUTES=60

# Storage
CLOUDFLARE_R2_ENDPOINT=https://r2.example.com
CLOUDFLARE_R2_ACCESS_KEY=...
CLOUDFLARE_R2_SECRET_KEY=...
CLOUDFLARE_R2_BUCKET=omni-inbox
CLOUDFLARE_CDN_URL=https://cdn.example.com

# Redis & Queues
REDIS_HOST=localhost
REDIS_PORT=6379
MESSAGE_RETRY_ATTEMPTS=3
MESSAGE_RETRY_BASE_DELAY_MS=60000

# Integrations
TELEGRAM_BOT_TOKEN=your-bot-token
IRC_SERVER=irc.example.com
IRC_PORT=6667
IRC_USERNAME=botname
IRC_PASSWORD=bot-password
IRC_CHANNELS=#support,#general

# Retention
RAW_PAYLOAD_RETENTION_DAYS=7
AUDIT_LOG_RETENTION_DAYS=365

# Email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=...
SMTP_PASSWORD=...
SMTP_FROM_EMAIL=noreply@example.com

# Frontend
FRONTEND_URL=https://app.example.com

# WebSocket
WS_HEARTBEAT_INTERVAL_SEC=60
WS_BACKLOG_RETENTION_HOURS=1

 # Logging
 LOG_LEVEL=info
 ```

**Note**: For detailed guidance on configuration and infrastructure patterns, see **ADR-005: Simple Infrastructure and Config Pattern** (`docs/adr/ADR-005-infrastructure-config-pattern.md`). The config folder should contain simple objects with environment variables, while the infrastructure folder contains singleton classes for client initialization.

### Frontend (.env.local)

```env
REACT_APP_API_URL=https://api.example.com
REACT_APP_WS_URL=https://api.example.com
```

---

## 7. Key Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Database** | PostgreSQL | Mature, reliable, FTS support, ACID transactions |
| **File Storage** | Cloudflare R2 | Cheaper than S3, fast CDN, easy S3-compatible API |
| **Message Queue** | Redis + BullMQ | Simple, fast, built-in retry scheduling |
| **Search** | PostgreSQL FTS (MVP) → Elasticsearch (post-MVP) | FTS sufficient for MVP, easy to migrate |
| **Auth** | BetterAuth | Flexible, supports email/password + OAuth, JWT + session |
| **Real-Time** | Socket.io | Mature, handles reconnection, fallbacks (polling) |
| **Retry Strategy** | Exponential backoff (1m, 5m, 30m) | Standard practice, reduces server load on failures |
| **Notifications** | In-app only (email Phase 2) | Simplifies MVP, WebSocket delivery is instant |
| **Bulk Action** | Best-effort (partial OK) | More pragmatic than all-or-nothing, better UX |
 | **Single/Multi-Tenant** | Single-tenant (MVP) | Simpler architecture, env vars for credentials, easier deployment |
 | **Conversation Threading** | One per group/channel | Clear mapping, avoids confusion with multiple threads |
 | **Rules Evaluation** | First match wins | Simple, predictable, avoids conflicting actions |
 | **Attachment Re-Hosting** | Download + R2 | Preserves files if platform deletes, faster delivery via CDN |
 | **Infrastructure/Config Pattern** | Simple two-folder (config = data, infrastructure = clients) | Simple and clean approach, easy to test, clear separation (see ADR-005) |

---

## 8. Code Architecture Constraints (STRICT - Non-Negotiable)

### Backend Code Standards

1. **No `any` Types Allowed**
   - Use proper TypeScript interfaces extending `Request` from `express` module
   - Never use `any` casting for Express/Node.js types
   - Example: `AuthRequest extends Request` instead of `req as any`

2. **Flat Folder Structure** (NOT Layered Architecture)
   - ✅ CORRECT:
     - `controllers/` - All API controllers
     - `middleware/` - All middleware
     - `services/` - All business logic
     - `config/` - Configuration objects (data only, no class instances)
     - `infrastructure/` - Client initialization (singleton classes)
     - `connectors/`, `websockets/`, `workers/`, `types/`, `utils/`
   - ❌ WRONG: `api/`, `domain/`, `infrastructure/` nested folders

3. **Routing-Controllers Best Practices**
   - Use `middlewares` option in `useExpressServer()` to register middleware
   - ❌ NO: Use `app.use()` for general middleware registration
   - ✅ YES: Pass middlewares via routing-controllers config
   - ✅ Exception: request body parsing may use `app.use()` at the entrypoint boundary for BetterAuth compatibility (see ADR-014)

4. **One Definition Per File**
   - One class per file
   - One interface per file (unless closely related)
   - One service per file
   - Clear single responsibility principle

5. **Config vs Infrastructure Pattern** (ADR-005 Approved)
   - **Config folder**: Simple `const` objects with env var references
     - Example: `{ port: process.env.PORT, dbUrl: process.env.DATABASE_URL }`
     - NO class definitions, NO initialization logic
   - **Infrastructure folder**: Singleton client classes
     - Example: `class DatabaseClient { constructor() { ... } }`
     - Handles initialization, connection pooling, singleton pattern
   - Rationale: "I don't want clean architecture. I want to keep it simple and clean."

6. **No Global `/api` Prefix**
   - ❌ NO: Global `@Controller('/api/users')`
   - ✅ YES: Individual routes like `@Controller('/users')` with `@Post('/login')` → `/users/login`
   - Add `/api` prefix only when needed for routing clarity

### Testing & Quality Standards

1. **Code Coverage Target**: ≥ 85% for all new code
   - Exception: Infrastructure/config code can be lower if simple
   - Use **Vitest** for unit/integration tests (native ESM, 18.8% faster than Jest)
   - Use Playwright for E2E tests
   - **Reference**: ADR-006 (Jest → Vitest Migration, approved 2026-01-25)

2. **Test Organization**:
   - Unit tests co-located near source files or in `__tests__/` folder
   - E2E tests in `packages/frontend/e2e/` (Playwright)
   - Mock external services (Telegram, IRC) in tests

3. **Error Handling**:
   - Always return proper HTTP status codes (200, 201, 400, 401, 403, 404, 500)
   - Include error message in response body
   - Log errors with correlation ID for tracing

### Development Workflow

1. **Sequential Development**: "Do it 1 by 1, make it simple"
   - One task at a time (not parallel)
   - Each task gets its own feature branch from `dev`
   - Each task has its own PR after completion
   - Clear, single-focus PRs

2. **Git Workflow**:
   - Create branches: `feature/BE-XXX-description` or `feature/FE-XXX-description`
   - Push to repo (dev branch approves PRs)
   - No force pushes unless explicitly requested
   - No direct commits to dev/main without PR review

3. **Documentation Synchronization**:
   - Keep `.docs/plans/00-INDEX.md` in sync with implementation status
   - Update ADRs and governance logs when decisions are made
   - Mark tasks as DONE/In Progress/Ready based on actual state

4. **PR Requirements**:
   - Clear commit messages (describe WHY, not just WHAT)
   - Reference related issues/PRs in description
   - Link ADR if architectural change made
   - Include test coverage info
   - Update relevant `.docs/` files in same PR

---

**Version**: 2.0  
**Last Updated**: January 25, 2026  
**Status**: Phase 1 Development in Progress (BE-003 Complete)
