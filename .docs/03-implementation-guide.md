# 03. Implementation Guide & Technical Deep Dive

**YACC - Architecture, Technical Decisions, & Code Examples**

---

## Table of Contents

1. [System Architecture](#1-system-architecture)
2. [Technology Stack](#2-technology-stack)
3. [Core Components Guide](#3-core-components-guide)
4. [Implementation Phases](#4-implementation-phases)
5. [Configuration & Environment](#5-configuration--environment)
6. [Key Technical Decisions](#6-key-technical-decisions)

---

## 1. System Architecture

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

## 4. Implementation Phases

### Phase 1: Core (Week 1–2)
**Goal**: Auth + data model + basic inbox + real-time foundation

**Tasks**:
- [ ] Setup PostgreSQL schema (users, conversations, messages, etc.)
- [ ] Implement BetterAuth (login, logout, forgot password)
- [ ] API: GET /conversations, GET /conversations/:id
- [ ] API: POST /auth/* endpoints
- [ ] Data: User roles + RBAC middleware
- [ ] WebSocket: connection, authentication, events
- [ ] Setup: Redis + BullMQ for message retry
- [ ] Frontend: Login page + inbox list UI

**Deliverable**: Authenticated users can see inbox list with live updates

---

### Phase 2: Messages & Integrations (Week 3–4)
**Goal**: Send/receive messages, connector wiring

**Tasks**:
- [ ] API: POST /conversations/:id/messages (send reply)
- [ ] Frontend: Conversation view + reply composer
- [ ] Frontend: Real-time inbox updates (WebSocket)
- [ ] Connectors: Telegram webhook ingestion
- [ ] Connectors: IRC polling/connection setup

**Deliverable**: Users can send/receive messages via Telegram/IRC

---

### Phase 3: Collaboration & Rules (Week 5)
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

### Phase 4: Search, Attachments, Admin (Week 6)
**Goal**: Search, file handling, admin features

**Tasks**:
- [ ] Search: PostgreSQL FTS setup + indexing
- [ ] API: GET /search/conversations endpoint
- [ ] Attachments: Upload/download to R2
- [ ] API: POST /conversations/:id/attachments
- [ ] Connectors: Telegram + IRC end-to-end
- [ ] Admin: User management UI
- [ ] Admin: Integration setup (credential form + test)
- [ ] Admin: Audit log viewer + export
- [ ] QA: Playwright E2E tests

**Deliverable**: MVP complete, ready for launch

---

## 5. Configuration & Environment

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

### Frontend (.env.local)

```env
REACT_APP_API_URL=https://api.example.com
REACT_APP_WS_URL=https://api.example.com
```

---

## 6. Key Technical Decisions

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

---

**Version**: 1.0  
**Last Updated**: January 17, 2026  
**Status**: Complete & Ready for Implementation
