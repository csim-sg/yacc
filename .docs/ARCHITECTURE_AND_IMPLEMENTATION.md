# System Architecture & Implementation Guide

**YACC - Yet Another Chat Client**

Complete system architecture, technology stack, technical decisions, and implementation components.

> **Product Reference**: See `.docs/01-product-specification.md` for features, user stories, acceptance criteria, UI requirements, and implementation milestones.

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

### High-Level Overview

```
┌─────────────────────────────────────────────────────────────────┐
│ Frontend (React + TanStack Start SPA)                           │
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
     │ PostgreSQL   │ │ S3  │ │Redis +  │  │ Connectors  │
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
  → Store raw payload on S3
  → Download & store attachments on S3
  → Save message + conversation to PostgreSQL
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
  → Save attachment(s) to S3
  → Save message to PostgreSQL (status: pending)
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
| **Frontend** | React 18 + TanStack Start | SPA for inbox UI, real-time updates |
| **Frontend Auth** | BetterAuth | Session management, JWT |
| **Frontend State** | Zustand + TanStack Query | Client-side state & data fetching |
| **Frontend Styling** | Tailwind CSS | Utility-first CSS |
| **Backend** | Node.js 18+ | Runtime |
| **Backend Framework** | Express | REST API |
| **Backend Auth** | BetterAuth | Email/password, session/JWT |
| **Database** | PostgreSQL 14+ | Primary data store |
| **Database ORM** | Drizzle | Type-safe SQL |
| **Real-Time** | Socket.io | WebSocket for inbox updates, notifications |
| **Search** | PostgreSQL FTS | Full-text search (future: Elasticsearch) |
| **Message Queue** | Redis + BullMQ | Outbound message retry queue |
| **File Storage** | AWS S3 | Raw payloads, attachments, re-hosted files |
| **Email** | Nodemailer / SendGrid | Password reset emails |
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

**Key Code**:
```typescript
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

---

### 3.3 Notification Engine

**When to use**: User assigned, @mentioned, or has unread messages

**Flow**:
```
Trigger 1: User assigned conversation
  → Create notification: type='assignment', user_id=assignee
  → Emit WebSocket: user:${userId}:notifications
  → Frontend receives, shows notification bell + increments badge

Trigger 2: User @mentioned in note
  → Parse note body for @username
  → Create notification: type='mention', user_id=mentioned_user
  → Same WebSocket flow
```

**Key Code**:
```typescript
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
```

---

### 3.4 Attachment Handling (AWS S3)

**When to use**: Download/re-host inbound attachments, upload outbound attachments

**Inbound Flow**:
```
Telegram/IRC message with attachment
  → Connector downloads file (validate: <5 MB)
  → Upload to S3: PUT /attachments/{conversationId}/{uuid}_{filename}
  → Save to DB: { message_id, url, storage_key, type, name, size }
  → Return CDN URL: https://cdn.example.com/attachments/...
  → Display inline in message timeline
```

**Configuration**:
```env
AWS_REGION=us-east-1
AWS_S3_BUCKET=yacc-attachments
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
ATTACHMENT_MAX_SIZE_MB=5
```

---

### 3.5 WebSocket Real-Time Updates

**Configuration**:
```
Heartbeat: 60 seconds (ping/pong)
Backlog: 1 hour of missed events (stored in DB)
Reconnect: Exponential backoff (1s → 60s max, 5 attempts)
```

**Key Events**:
- `conversation_updated` - Conversation changes
- `message.sent / message.failed` - Message delivery status
- `notification.received` - New notification
- `conversation.reopened` - Resolved conversation reopened
- `presence.updated` - User online/offline
- `typing.started / typing.stopped` - Typing indicator

---

### 3.6 Routing Rules Engine

**When to use**: Automatically assign, tag, or prioritize new messages based on conditions

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
      }
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
│   │   │   ├── api/
│   │   │   ├── domain/
│   │   │   ├── services/
│   │   │   ├── connectors/
│   │   │   ├── infrastructure/
│   │   │   └── config/
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
  ├── Upload dist/ to AWS S3
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

**See `.docs/01-product-specification.md` § 9 for detailed phase milestones and user stories.**

### Phase Summary

**Phase 1: Core (Week 1–2)** — Auth + data model + basic inbox  
**Phase 2: Messages & Real-Time (Week 3–4)** — Send/receive, WebSocket, Telegram/IRC  
**Phase 3: Collaboration & Rules (Week 5)** — Tags, notes, assignments, routing rules  
**Phase 4: Search, Attachments, Admin (Week 6)** — Search, files, admin features, QA

---

### Backend Implementation Checklist (Phase 1)

**Database**:
- [x] PostgreSQL schema (users, conversations, messages, tags, notes, notifications, routing_rules, audit_logs, attachments, raw_payloads) using Drizzle ORM
- [x] Index optimization (channel, status, assignee, created_at, last_activity_at)
- [x] Migration utilities (runMigrations, dropAllTables)

**Authentication**:
- [ ] BetterAuth setup (email/password provider)
- [ ] JWT token generation + validation
- [ ] Password hashing (PBKDF2, upgrade to bcrypt/argon2 in production)
- [ ] Forgot password flow (token generation, email delivery, reset)
- [ ] Session persistence (Redis or database sessions)

**API Endpoints (Auth)**:
- [ ] POST /api/auth/register (super admin only)
- [ ] POST /api/auth/login
- [ ] POST /api/auth/logout
- [ ] POST /api/auth/forgot-password
- [ ] POST /api/auth/reset-password
- [ ] GET /api/auth/me (verify session)

**API Endpoints (Conversations)**:
- [ ] GET /api/conversations (list with filters, pagination)
- [ ] GET /api/conversations/:id (detail)
- [ ] PATCH /api/conversations/:id (update status, priority)

**RBAC & Middleware**:
- [ ] Authentication middleware (verify JWT/session)
- [ ] Authorization middleware (check role permissions)
- [ ] Error handling (401, 403, 500)
- [ ] Request logging

**Frontend**:
- [ ] Login page
- [ ] Inbox list component (conversations, filters)
- [ ] Auth API client integration
- [ ] Zustand + TanStack Query setup for state management
- [ ] Error handling & user feedback

---

## 6. Configuration & Environment

### Backend (.env)

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/yacc_db

# Auth
BETTER_AUTH_SECRET=generate-random-string
JWT_SECRET=generate-random-string
RESET_PASSWORD_TOKEN_TTL_MINUTES=60

# Storage
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_S3_BUCKET=yacc-attachments

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
VITE_API_URL=https://api.example.com
VITE_WS_URL=https://api.example.com
```

---

## 7. Key Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Database** | PostgreSQL | Mature, reliable, FTS support, ACID transactions |
| **File Storage** | AWS S3 | Industry standard, CDN-backed via CloudFront, cost-effective |
| **Message Queue** | Redis + BullMQ | Simple, fast, built-in retry scheduling |
| **Search** | PostgreSQL FTS (MVP) → Elasticsearch (Phase 2) | FTS sufficient for MVP, easy to migrate |
| **Auth** | BetterAuth | Flexible, supports email/password + OAuth, JWT + session |
| **Real-Time** | Socket.io | Mature, handles reconnection, fallbacks (polling) |
| **Retry Strategy** | Exponential backoff (1m, 5m, 30m) | Standard practice, reduces server load on failures |
| **Notifications** | In-app only (email Phase 2) | Simplifies MVP, WebSocket delivery is instant |
| **Bulk Action** | Best-effort (partial OK) | More pragmatic than all-or-nothing, better UX |
| **Single/Multi-Tenant** | Single-tenant (MVP) | Simpler architecture, env vars for credentials |
| **Conversation Threading** | One per group/channel | Clear mapping, avoids confusion |
| **Rules Evaluation** | First match wins | Simple, predictable, avoids conflicting actions |
| **Attachment Re-Hosting** | Download + S3 | Preserves files if platform deletes, faster delivery via CDN |

---

**Version**: 1.0  
**Last Updated**: January 17, 2026  
**Status**: Complete & Ready for Implementation
