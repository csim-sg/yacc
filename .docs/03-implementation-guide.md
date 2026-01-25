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

**Phase Scope Reference**: See `.docs/06-phase1-execution-guide.md` for authoritative Phase 1 scope and acceptance criteria.

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
| **Hosting** | VPS (single-tenant MVP) | Node API + SPA on S3/Cloudflare |
| **Testing** | Playwright | E2E testing |
| **Testing** | Jest | Unit & integration tests |

---

## 3. Core Components Guide

### 3.1 Message Retry Queue (Redis + BullMQ)

**When to use**: Outbound message fails to deliver to platform

**Flow**:
```
Message send fails
  → Enqueue job: { messageId, conversationId, providerId }
  → Job schedule: wait 1 minute (attempt 1)
  → Worker picks up job, attempts delivery
  → Success: mark message status = sent
  → Failure: retry with backoff (5 min, 30 min)
  → After 3 failures: move to DLQ for ops
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

### 3.5 WebSocket Real-Time Updates

**When to use**: Notify UI of inbox changes, message delivery, presence, notifications

**Configuration**:
```
Heartbeat: 60 seconds (ping/pong)
Backlog: 1 hour of missed events (stored in DB)
Reconnect: Exponential backoff (1s → 60s max, 5 attempts)
```

**Key Code**:
```typescript
// Server: authenticate & setup
const wsServer = new Server(httpServer);
wsServer.use(async (socket, next) => {
  const user = await verifyAuth(socket.handshake.auth.token);
  socket.userId = user.id;
  next();
});

// Emit event to user
export async function publishEvent(userId: string, event: any) {
  wsServer.to(`user:${userId}`).emit('event', event);
  // Store for backlog
  await db.webSocketEvent.create({
    data: { user_id: userId, event_type: event.type, payload: JSON.stringify(event.payload) },
  });
}

// Client: subscribe to updates
const socket = io(WS_URL, { auth: { token: jwt } });
socket.on('event', (event) => {
  if (event.type === 'conversation.updated') {
    updateInboxStore(event.payload.conversation);
  }
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
 ├── docker-compose.yml
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
  ├── SSH to VPS
  ├── Pull image + restart container
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
| **Search** | PostgreSQL FTS (MVP) → Elasticsearch (Phase 2) | FTS sufficient for MVP, easy to migrate |
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
   - ❌ NO: Use `app.use()` for middleware registration
   - ✅ YES: Pass middlewares via routing-controllers config

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
   - Use Jest for unit/integration tests
   - Use Playwright for E2E tests

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
