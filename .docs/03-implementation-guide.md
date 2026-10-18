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
8. [Code Architecture Constraints](#8-code-architecture-constraints-strict---non-negotiable)
9. [API Contract Patterns](#9-api-contract-patterns-mandatory)

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
│ API Server (Java 21 + Spring Boot, services/backend-java)        │
├─────────────────────────────────────────────────────────────────┤
│ • REST Endpoints (auth, inbox, messages, rules, etc.)          │
│ • Raw WebSocket (/ws — enveloped realtime events)               │
│ • Rules Engine (evaluate conditions, apply actions)            │
│ • Search Service (full-text search on PostgreSQL)              │
│ • Notification Engine (creation, delivery via WS)              │
│ • Audit Logger (log all actions)                               │
│ • Connector Registry (Telegram, IRC dispatchers)               │
│ • Quartz Retry Worker + DB DLQ (ADR-028)                       │
└─────────────┬──────────┬──────────┬──────────────┬──────────────┘
              │          │          │              │
              ▼          ▼          ▼              ▼
     ┌──────────────┐ ┌─────┐ ┌─────────┐  ┌─────────────┐
     │ PostgreSQL   │ │ R2  │ │ Quartz  │  │ Connectors  │
     │ (data,       │ │(CDN)│ │ + DB DLQ│  │ (Telegram,  │
     │  Flyway/JPA) │ │     │ │(in PG)  │  │  IRC)       │
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
  → Failure: schedule retry (Quartz + PostgreSQL job store, ADR-028)
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

> **Java migration note (SPEC-002)**: the backend of record is the Java/Spring service (`services/backend-java`); Node/TypeScript backend rows below are **transitional until MIG-080 (#364)**. The frozen `.docs/migration/{openapi.yaml,asyncapi.yaml,schemas/*}` is the contract source of truth (ADR-023).

| Layer | Technology | Purpose |
| ----- | ----------- | --------- |
| **Frontend** | TanStack Start (React) | SPA for inbox UI, real-time updates (production until the SPEC-003 Angular cutover) |
| **Frontend Auth** | Spring Security session/JWT via REST | Session management, JWT (BetterAuth decommissioned with the Node POC; ADR-025) |
| **Frontend State** | Zustand + TanStack Query | Client-side state & data fetching |
| **Frontend Styling** | Tailwind CSS | Utility-first CSS |
| **Backend** | Java 21 (Temurin) | Runtime (`services/backend-java`) |
| **Backend Framework** | Spring Boot 3 (Spring MVC) | REST API per the frozen OpenAPI contract |
| **Backend Auth** | Spring Security + dual-role OIDC | Email/password, JWT, bootstrap + recovery (ADR-025) |
| **Database** | PostgreSQL 15 | Primary data store |
| **Database Access** | Flyway + JPA/Hibernate (Spring Data) | Migrations + type-safe persistence (ADR-027) |
| **Real-Time** | Raw Spring WebSocket (`/ws`) | Envelope-framed WebSocket for inbox updates, notifications (ADR-026) |
| **Search** | PostgreSQL FTS | Full-text search (future: Elasticsearch) |
| **Async / Queue** | Quartz + PostgreSQL DB DLQ | Outbound message retry queue (ADR-028; Redis dropped) |
| **File Storage** | Cloudflare R2 | Raw payloads, attachments, re-hosted files |
| **Email** | Spring mail / SendGrid | Password reset emails |
| **Hosting** | K3s + Helm (single-tenant MVP) | Backend runs on K3s; deploy via Helm; ADR-029 JVM envelope |
| **Testing** | Playwright | E2E testing |
| **Backend Testing** | JUnit 5 + Testcontainers | Unit, integration and contract tests (JaCoCo ≥85% gate) |
| **Frontend Testing** | Vitest | Unit tests |
| **Package Manager** | pnpm | Node-workspace management (frontend + transitional packages; Bun migration tracked separately) |

---

## 2.1 Package Manager: pnpm (Node workspaces — frontend + transitional packages)

YACC uses **pnpm** for efficient Node-workspace management. The Java backend does not use pnpm — build and test it with the Gradle wrapper (`services/backend-java/gradlew`; `./gradlew --no-daemon build`, `test`, `contractTest`, `check`). The pnpm sections below cover the frontend and the transitional Node packages (until MIG-080).

### Java backend commands (backend of record)

| Command | Purpose |
| ----- | --------- |
| `./gradlew --no-daemon bootRun` | Run the service locally (port 8080) |
| `./gradlew --no-daemon build` | Build + unit/integration tests + JaCoCo gate |
| `./gradlew --no-daemon test` | Unit + integration tests (Testcontainers PostgreSQL) |
| `./gradlew --no-daemon contractTest` | Frozen OpenAPI/AsyncAPI conformance tests |
| `./gradlew --no-daemon check` | Full verification gate (JaCoCo ≥85%) |

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

### 3.1 Message Retry Queue & DLQ (Quartz + PostgreSQL DB DLQ, ADR-028)

**When to use**: Outbound message fails to deliver to platform

**Flow**:
```
Message send fails
  → DLQ row created at first failure (retry-cycle carrier, failureReason=SEND_FAILED)
  → Quartz job scheduled: wait 1 minute (attempt 1)
  → Worker picks up job, attempts delivery via the gateway exchange
  → Success: mark message status = sent, clear DLQ row
  → Failure: retry with backoff (5 min, 30 min; durable attempt claims)
  → After 3 delivery attempts: terminal exhaustion — row rewritten to
    max_retries_exceeded, queue.message.dlq emitted, job state = failed
  → Ops retry or delete via DLQ API
```

**Configuration** (`MESSAGE_RETRY_*` env keys, wired via `QueueRetryProperties`):
```env
MESSAGE_RETRY_ATTEMPTS=3
MESSAGE_RETRY_BASE_DELAY_MS=60000  # 1 minute
MESSAGE_RETRY_BACKOFF_MULTIPLIER=5  # 1m, 5m, 30m
```

**Key Code** (Java, `com.yacc.api.queue`):
```java
// Quartz JDBC job store: one job per pending message id (1:1 identity),
// single-fire triggers per attempt on the 1m/5m/30m ladder.
// QueueRetryService claims the attempt durably (retryCycle jsonb on the DLQ row),
// delivers through the GatewayRedeliveryHandler seam, and settles the outcome:
// delivered → row cleared; failed → next ladder step; exhausted → terminal.
```

### 3.1.1 DLQ (Dead Letter Queue) Contract

**Message ID Contract**:
- `messageId` is always a UUID and references `messages.id`
- External job/platform IDs are **never** used as messageId
- Enforced by dlqService.moveToDLQ() validation

**Example** (moving failed Telegram message to DLQ):
```java
// ✅ CORRECT: UUID messageId, external ID in metadata
// (com.yacc.service.DlqService.enqueue — real message/conversation identities are
// required by the V1 FK constraints; the row is the retry-cycle carrier)
dlqService.enqueue(messageId, conversationId, payload,
    "SEND_FAILED",              // first-failure value; rewritten to max_retries_exceeded at exhaustion
    "Failed to send to Telegram",
    Map.of(
        "jobId", "msg-payload-abc123",          // Quartz job key (opaque string)
        "externalMessageId", "tg-msg-9876543"   // Telegram message ID
    ));
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

### 3.5 WebSocket Real-Time Updates (raw Spring WebSocket, ADR-026)

**When to use**: Notify UI of inbox changes, message delivery, presence, notifications

**Architecture Decision**: Raw Spring WebSocket at `/ws` — no Socket.io/STOMP/SockJS/broker (ADR-026, supersedes ADR-012 socket-controllers). Resilience is app-owned: durable backlog, server heartbeat, reconnect policy.

**Configuration** (`YACC_WS_*` env keys / `yacc.realtime` properties):
```
Path: /ws (JWT via ?token= query parameter, verified by the handshake interceptor)
Heartbeat: server-emitted system.heartbeat every 60 seconds
Backlog: 1 hour of missed events (websocket_backlog table in PostgreSQL)
Reconnect: client bounded backoff; server-observed reconnects replay the durable backlog
Envelope: every emission is {event, data, timestamp} (frozen schemas/envelope.schema.json)
```

**Handler Pattern** (Java, `com.yacc.api.realtime`):
```java
// YaccWebSocketHandler demuxes inbound frames {event, data} and rooms:
//   user:{userId} personal room, conversation:{id}, connector:{platform}
// WebSocketEventPublisher serializes the envelope with the single production
// Jackson ObjectMapper (RFC 3339 UTC timestamps, MIG-102 posture) and fans out
// to sessions/rooms; ConnectorRelayService bridges connector events.
// Emissions reuse the frozen RealtimeEvents constants — no new event names.
```

**Benefits Over the Node POC**:
- ✅ **No broker dependency**: transport is the servlet container itself
- ✅ **Durable replay**: backlog rows live in PostgreSQL (survive restarts; replayed on reconnect)
- ✅ **Single serialization posture**: same Jackson config as REST (contract-safe timestamps/nulls)
- ✅ **Testability**: handler/services are plain beans; integration tests drive real sockets

**Implementation Details**:
- **Realtime module**: `services/backend-java/src/main/java/com/yacc/api/realtime/` (handler, session registry, publisher, presence/typing/heartbeat/backlog/reconnect services)
- **Auth**: `WebSocketHandshakeAuthInterceptor` verifies the JWT before the upgrade completes
- **Events**: named via the frozen AsyncAPI vocabulary in `.docs/migration/asyncapi.yaml` + `schemas/*`

**Client Integration** (target wire contract; the frontend client implementation is owned by MIG-052 / SPEC-003):
```typescript
// Raw WebSocket — every server frame is enveloped {event, data, timestamp}
const ws = new WebSocket(`${WS_URL}?token=${jwt}`);

// Inbound ops are JSON frames; subscribe to a conversation room:
ws.send(JSON.stringify({ event: 'subscribe.conversation', data: { conversationId: 'conv-123' } }));

ws.onmessage = (msg) => {
  const frame = JSON.parse(msg.data);
  if (frame.event === 'conversation.updated') updateInboxStore(frame.data.conversation);
  if (frame.event === 'presence.updated') updatePresenceStore(frame.data);
};
```

#### 3.5.1 WebSocket Observability

> **Posture note (ADR-029)**: the backend instruments via **Micrometer** (frozen scrape path `/actuator/prometheus`); the `MetricsSink` interface below is the **Node-POC client-side metrics design** (transitional until MIG-080, client implementation now SPEC-003/MIG-052 scope). The SLO targets are unchanged.

All WebSocket metrics were emitted via the `MetricsSink` interface in the Node POC. By default, metrics are logged to console as JSON.

**SLO Targets** (from GOV-030):
- Connection Success Rate: ≥99.5%
- Event Latency P95: <100ms
- Reconnection Success Rate: ≥95%
- Backlog Replay: <5s per 100 events

**Metrics Architecture**:
```typescript
// Abstract interface for pluggable metrics
interface MetricsSink {
  counter(name: string, value: number, tags?: MetricsSinkTags): void;
  histogram(name: string, value: number, tags?: MetricsSinkTags): void;
  gauge(name: string, value: number, tags?: MetricsSinkTags): void;
  timer<T>(name: string, fn: () => T, tags?: MetricsSinkTags): T;
}

// Default implementation logs to console as JSON
class ConsoleMetricsSink implements MetricsSink { ... }

// No-op implementation for testing
class NoOpMetricsSink implements MetricsSink { ... }
```

**8 Metrics Emitted**:
| Metric | Type | Purpose |
|--------|------|---------|
| `ws.connection.attempt` | Counter | Track connection attempts |
| `ws.connection.success` | Counter | Calculate success rate SLO |
| `ws.connection.failure` | Counter | Diagnose failure modes |
| `ws.reconnection.attempt` | Counter | Track reconnection efficiency |
| `ws.event.received` | Counter | Track event volume |
| `ws.event.processed` | Histogram | Calculate latency P95 |
| `ws.event.error` | Counter | Surface handler bugs |
| `ws.backlog.replay` | Counter | Track reconnection efficiency |

**SLO Monitoring**:
```typescript
// Get current SLO metrics
const metrics = wsClient.getSLOMetrics();
// Returns: { connectionSuccessRate, eventLatencyP95, reconnectionSuccessRate, backlogReplayEfficiency }

// Warnings are automatically logged when SLO breaches occur
// [SLO] Connection success rate 98.50% below threshold (99%)
```

**Integration**:
```typescript
import { WebSocketClient, createWebSocketClient } from '@/services/websocket';
import { defaultMetricsSink } from '@/services/observability/ConsoleMetricsSink';

const wsClient = createWebSocketClient(WS_URL, authToken, userId, defaultMetricsSink);
```

See **GOV-030** for full metrics definitions and measurement methodology.

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

### 3.7 IRC Profile Management (DB-First, Fail-Closed)

**MIG-061: multi-profile IRC connections with DB-first gating** (the Node-era env fallback is decommissioned — the Java resolver never falls back to environment variables)

**When to use**: Initialize IRC connector with credentials from database profiles or the single stored config

**Architecture** (`IrcConnectionConfigResolver`, `com.yacc.api.connector`):
- **DB-first gating**: If ANY DB profiles exist, use DB only (active profile wins → single implicit profile → multiple without an active selection fails closed)
- **Zero profiles**: falls back to the existing `IrcConfigService.storedConfig()` (the single stored IRC config); if none → typed `irc_not_configured` (fail closed; **no env fallback**)
- **Error on DB failure**: resolution/decryption failures fail closed (no silent fallback)
- **Encryption**: Credentials stored encrypted at rest, decrypted via the shared `EncryptionService` (AES-256-GCM, ADR-027)
- **Hard cap**: Maximum 10 profiles (enforced in the profile service)

**Configuration**:
```env
# Encryption master key for credential storage (required)
INTEGRATION_CREDENTIALS_ENCRYPTION_KEY=<32-byte base64-encoded key>
```

**Profile Lifecycle**:
```
CREATE → TEST → ACTIVATE → (optional) DISABLE → DELETE
  ↓       ↓       ↓          ↓                    ↓
 new   enabled  active   inactive            deleted
```

**Gating Logic** (`IrcConnectionConfigResolver`):
```
1. Query DB for ANY profiles (enabled OR disabled)
   - DB/decryption error → fail closed (no fallback)
2. If >0 profiles found:
   - Active profile → use it
   - 0 active, 1 total → use implicitly (enabled or disabled)
   - 0 active, >1 total → fail closed (profile not selected)
3. If 0 profiles found:
   - Use IrcConfigService.storedConfig() (single stored config)
   - If absent → typed irc_not_configured (409)
```

**Key Code** (Java):
```java
// Resolve IRC config for connector startup (com.yacc.api.connector)
IrcConnectionConfig config = resolver.resolve();   // DB-first, fail-closed
ircConnector.connect(config);

// Failure codes surfaced as typed IntegrationApiException:
//   409 irc_not_configured   → no profiles and no stored config
//   409 profile-not-selected → multiple DB profiles, none active
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
 ├── services/
 │   └── backend-java/              ← THE BACKEND OF RECORD (Java 21 + Spring Boot, SPEC-002)
 │       ├── src/main/java/com/yacc/
 │       │   ├── api/                ← standalone API modules: auth, user, conversation, message,
 │       │   │                          note, tag, routingrule, notification, audit, dlq, queue,
 │       │   │                          integration, realtime, connector (controller + wire DTOs each;
 │       │   │                          amended ADR-030 / ARCH-004 §1)
 │       │   ├── entity/             ← JPA entities (+ enums/converters)
 │       │   ├── repository/         ← Spring Data repositories
 │       │   ├── service/            ← genuinely shared/persistence services (auth identity,
 │       │   │                          audit persistence, DLQ, encryption)
 │       │   ├── config/             ← Spring @Configuration (incl. Jackson posture)
 │       │   ├── common/             ← shared controllers/utilities
 │       │   └── YaccApplication.java
 │       ├── src/main/resources/
 │       │   ├── application.yml
 │       │   ├── logback-spring.xml  ← structured JSON logging (ADR-029)
 │       │   └── db/migration/       ← Flyway V1..V4 (ADR-027; incl. Quartz job store)
 │       ├── src/test/java/          ← JUnit 5 + Testcontainers (+ contractTest suite)
 │       ├── Dockerfile              ← Temurin 21 JRE, non-root, read-only-root-safe (ADR-029)
 │       └── build.gradle.kts
 │
 ├── packages/                       ← Node workspaces (frontend + transitional packages)
 │   ├── common/                     ← @yacc/common — TRANSITIONAL until MIG-080 (Zod layer is not
 │   │                                  the contract source; ADR-023)
 │   ├── backend/                    ← @yacc/backend — TRANSITIONAL Node POC until MIG-080
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
 ├── .docs/                          ← incl. frozen .docs/migration contracts (ADR-023)
 ├── .github/workflows/
 │   ├── backend-java-ci.yml         ← Java backend CI (build, tests, JaCoCo, contract tests)
 │   ├── deploy-staging.yaml         ← Helm deploy to staging (Java image)
 │   ├── lint.yml
 │   ├── tests.yml
 │   ├── backend-deploy.yml          ← transitional Node-era workflow (until MIG-080)
 │   └── frontend-deploy.yml
 ├── deploy/helm/yacc-backend/       ← chart (Java image, ADR-029 envelope, no Redis)
 ├── docker compose.yml
 ├── turbo.json
 ├── pnpm-workspace.yaml
 └── package.json
 ```

### Backend Deployment Flow

```
Push to dev
  ↓
GitHub Actions: deploy-staging.yaml
  ├── Build Java Docker image (services/backend-java/Dockerfile, Temurin 21)
  ├── Push to container registry
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
  → Backend validates (Spring Security, ADR-025)
  → Return JWT access token
  → Frontend stores token + session state

Every API Request
  → Attach JWT: Authorization: Bearer <JWT>
  → Backend filter: Verify & extract userId, role
  → Proceed to route handler
```

### Real-Time Data Flow (WebSocket)

```
Client (Frontend)
  → Raw WebSocket connection to /ws?token=<JWT>
  → Client-side bounded-backoff reconnection
  → Handshake interceptor verifies JWT before upgrade

Backend (Spring WebSocket, ADR-026)
  → YaccWebSocketHandler (session registry, rooms)
  → Event handlers (frozen AsyncAPI event vocabulary)
  → Store missed events in PostgreSQL (websocket_backlog, 1-hour retention)
  → Broadcast enveloped {event, data, timestamp} frames to relevant users
  → Reconnect replays the durable backlog (system.reconnection.* events)

Client Receives Event
  → Update store
  → Invalidate query cache
  → UI re-renders automatically
```

---

## 5. Implementation Phases

**MVP** includes **Phase 1 + Phase 2** (see GOV-021).

### Phase 1: Core + Messaging + Integrations (Week 1–2)
**Goal**: Auth + data model + inbox + messaging + Telegram/IRC integrations

**Tasks**:
- [x] Setup PostgreSQL schema (users, conversations, messages, etc.)
- [x] Implement auth (Spring Security: login, logout, forgot password — ADR-025)
- [x] API: GET /conversations, GET /conversations/:id
- [x] API: POST /auth/* endpoints
- [x] Data: User roles + RBAC (method security)
- [x] WebSocket: connection, authentication, events
- [x] Setup: Quartz + DB DLQ for message retry (ADR-028)
- [x] API: POST /conversations/:id/messages (send reply)
- [x] Connectors: Telegram ingestion (connector intake; no HTTP webhook route in the frozen contract)
- [x] Connectors: IRC socket connection
- [x] Frontend: Login page + inbox list UI
- [x] Frontend: Conversation view + reply composer

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

### Backend — Java service (`services/backend-java`; env keys bound via Spring relaxed binding, see `deploy/helm/yacc-backend/values.yaml` for the authoritative list)

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/yacc_inbox

# Auth (ADR-025: Spring Security; bootstrap Super Admin + founder recovery secrets)
BOOTSTRAP_SUPER_ADMIN_EMAIL=admin@example.org
BOOTSTRAP_SUPER_ADMIN_PASSWORD=change-me
RECOVERY_MODE=once
RECOVERY_KEY=founder-held-secret

# Storage
CLOUDFLARE_R2_ENDPOINT=https://r2.example.com
CLOUDFLARE_R2_ACCESS_KEY=...
CLOUDFLARE_R2_SECRET_KEY=...
CLOUDFLARE_R2_BUCKET=yacc-attachments
CLOUDFLARE_CDN_URL=https://cdn.example.com

# Encryption (credential storage, ADR-027)
INTEGRATION_CREDENTIALS_ENCRYPTION_KEY=<32-byte base64-encoded key>

# Async / retry (ADR-028 — Quartz + PostgreSQL job store; no Redis)
MESSAGE_RETRY_ATTEMPTS=3
MESSAGE_RETRY_BASE_DELAY_MS=60000
MESSAGE_RETRY_BACKOFF_MULTIPLIER=5

# Integrations
TELEGRAM_BOT_TOKEN=your-bot-token

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
YACC_WS_HEARTBEAT_INTERVAL_SEC=60
YACC_WS_BACKLOG_RETENTION_HOURS=1

# Service time basis (MIG-102: RFC 3339 UTC emission)
TZ=UTC

# Logging
LOGGING_LEVEL_ROOT=info
```

> The Node-POC env block (`BETTER_AUTH_SECRET`, `JWT_SECRET`, `REDIS_HOST/PORT`, `IRC_*` env fallback) is decommissioned with the transitional Node backend (MIG-080). `docker-compose.yml` still runs a Redis container for the transitional Node POC tests only — the Java service has no Redis dependency.

**Note**: For the Node POC's configuration/infrastructure pattern, see **ADR-005** (transitional). The Java service uses Spring `@ConfigurationProperties`/relaxed binding in `com.yacc.config`.

### Frontend (.env.local)

```env
REACT_APP_API_URL=https://api.example.com
REACT_APP_WS_URL=https://api.example.com
```

---

## 7. Key Technical Decisions

| Decision | Choice | Rationale |
| ----- | -------- | ----------- |
| **Contract source** | Frozen OpenAPI 3.1 + AsyncAPI/JSON Schema (`.docs/migration/`) | Cross-language single source of truth (ADR-023; supersedes Zod-as-contract ADR-020) |
| **Database** | PostgreSQL 15 | Mature, reliable, FTS support, ACID transactions |
| **File Storage** | Cloudflare R2 | Cheaper than S3, fast CDN, easy S3-compatible API |
| **Async / Queue** | Quartz + PostgreSQL DB DLQ | DB-backed retry scheduling + durable DLQ, no extra infrastructure (ADR-028) |
| **Search** | PostgreSQL FTS (MVP) → Elasticsearch (post-MVP) | FTS sufficient for MVP, easy to migrate |
| **Auth** | Spring Security + dual-role OIDC (RP + embedded AS) | Email/password + OIDC, deterministic bootstrap + founder recovery (ADR-025) |
| **Real-Time** | Raw Spring WebSocket (`/ws`, envelope-framed) | No broker/transport lock-in; resilience app-owned (ADR-026) |
| **Retry Strategy** | Exponential backoff (1m, 5m, 30m ladder, 3 delivery attempts) | Standard practice, reduces server load on failures |
| **Notifications** | In-app only (email Phase 2) | Simplifies MVP, WebSocket delivery is instant |
| **Bulk Action** | Best-effort (partial OK) | More pragmatic than all-or-nothing, better UX |
 | **Single/Multi-Tenant** | Single-tenant (MVP) | Simpler architecture, env vars for credentials, easier deployment |
 | **Conversation Threading** | One per group/channel | Clear mapping, avoids confusion with multiple threads |
 | **Rules Evaluation** | First match wins | Simple, predictable, avoids conflicting actions |
 | **Attachment Re-Hosting** | Download + R2 | Preserves files if platform deletes, faster delivery via CDN |
 | **Package Layout** | `api.<feature>` modules + shared entity/repository/service planes | Founder-corrected standalone-module model (ADR-030 as amended; ARCH-004 §1) |

---

## 8. Code Architecture Constraints (STRICT - Non-Negotiable)

> **Two codebases, two rule sets.** The Java backend of record follows ARCH-004 (`.docs/architecture/004-java-backend-guardrails.md`) + ADR-030; the Node POC rules below remain in force for the transitional Node packages until MIG-080.

### Backend Code Standards (Java service — ARCH-004)

1. **No `any` / raw types** — proper types everywhere; records for wire DTOs; no `Object` casts or `JsonNode` escape hatches (ARCH-004 §3).
2. **Package layout** (amended ADR-030 / ARCH-004 §1): standalone `com.yacc.api.<feature>` modules (controller + wire DTOs; mapper/service only when genuinely warranted) plus the shared `entity`/`repository`/`service` planes; `config`/`common` support packages; `YaccApplication` at the root. No mandatory layer skeleton.
3. **Spring idioms**: constructor injection only; middleware/filters via Spring configuration (no arbitrary `app.use()`-style global mutation); `/api` prefix at controller level (no global prefix).
4. **One definition per file**, single responsibility.
5. **Config vs infrastructure**: `config/` holds Spring configuration/properties; clients (DB, encryption) are Spring-managed beans — no bespoke singletons.
6. **Database**: Drizzle-era raw-SQL ban carries over — Flyway migrations + JPA/Jackson only, no raw SQL in code (ADR-027); validation/contract via the frozen schemas (ADR-023).
7. **No global `/api` prefix** — routes declare `/api` at the controller level where the frozen contract requires it.

### Node POC Standards (transitional until MIG-080)

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

3. **Routing-Controllers Best Practices** (Node POC only)
   - Use `middlewares` option in `useExpressServer()` to register middleware
   - ❌ NO: Use `app.use()` for general middleware registration
   - ✅ YES: Pass middlewares via routing-controllers config
   - ✅ Exception: request body parsing may use `app.use()` at the entrypoint boundary (see ADR-014)

### Testing & Quality Standards

1. **Code Coverage Target**: ≥ 85% for all new code
   - Java backend: JaCoCo aggregated gate enforced by `./gradlew check` and CI (aggregated over unit/integration + contract suites)
   - Node POC (transitional): Vitest; infrastructure/config code can be lower if simple
   - Use Playwright for E2E tests
   - **Reference**: ADR-006 (Jest → Vitest Migration, approved 2026-01-25; Node-era)

2. **Test Organization**:
   - Java: JUnit 5 suites under `src/test/java` (unit + Testcontainers integration) and the `contractTest` tag for frozen-contract conformance
   - Node POC: unit tests co-located near source files or in `__tests__/` folder
   - E2E tests in `packages/frontend/` (Playwright)
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

## 9. API Contract Patterns (MANDATORY)

### List Request/Response Standard Contract

All list/searchable endpoints MUST use standardized request/response classes from `@yacc/common`.

#### BaseListRequest (Frontend → Backend)

All list requests extend `BaseListRequest`:

```typescript
// @yacc/common/src/requests/base-list.request.ts
class BaseListRequest {
  page?: number = 0;       // 0-indexed internally
  limit?: number = 15;     // Default page size
  searchText?: string;     // Optional search term

  getPage(): number;       // Validated page number
  getLimit(): number;      // Validated limit (must be in allowed set: 15, 25, 35, 45, 55, 100, 150, 200)
  getSearch(): string;     // Search text or empty string
  getOffset(): number;     // Calculated offset (page * limit)
}
```

**Extending for Feature-Specific Filters:**
```typescript
// @yacc/common/src/requests/conversations/listConversations.request.ts
class ListConversationsRequest extends BaseListRequest {
  channel?: 'telegram' | 'irc';
  status?: 'open' | 'pending' | 'resolved';
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  assignedUserId?: string;
  tagId?: number;
  dateFrom?: string;
  dateTo?: string;
}
```

#### BaseListResponse<T> (Backend → Frontend)

All list endpoints return `BaseListResponse<T>`:

```typescript
// @yacc/common/src/responses/base-list.response.ts
class BaseListResponse<T> {
  data: T[];      // Array of items
  page: number;   // Current page (1-indexed for API consumers)
  limit: number;  // Items per page
  total: number;  // Total count of items matching filters

  constructor(data: T[], total: number, listRequest: BaseListRequest) {
    this.total = total;
    this.data = data;
    this.limit = listRequest.getLimit();
    this.page = listRequest.getPage() + 1; // 1-indexed for API
  }
}
```

#### Backend Pagination (Java service)

The Java backend implements the same envelope with Spring Data JPA: controllers bind `page`/`limit`/`searchText` request params, repositories return `Page<T>`/sliced results, and services map them to the `BaseListResponse<T>` wire shape (`data`, 1-indexed `page`, `limit`, `total`). The Node-POC `PaginationRequest`/Drizzle helper below is transitional (until MIG-080) and shows the same contract:

```typescript
// packages/backend/src/utilities/pagination.ts — TRANSITIONAL (Node POC, MIG-080)
class PaginationRequest extends BaseListRequest {
  /**
   * Apply pagination to Drizzle query.
   * Override in subclasses to add where conditions + pagination.
   */
  applyToQuery<T extends PgSelect>(query: T): T {
    return query.limit(this.getLimit()).offset(this.getOffset()) as T;
  }

  /**
   * Get offset (page * limit)
   */
  getOffset(): number {
    return this.getPage() * this.getLimit();
  }
}
```

**Feature-specific query classes override `applyToQuery()` to add BOTH filtering AND pagination** (Node POC pattern — transitional; the Java service expresses the same filtering via Spring Data `Specification` combinators in the owning repository):
```typescript
// packages/backend/src/types/conversations.types.ts — TRANSITIONAL (Node POC, MIG-080)
class ListConversationsQuery extends PaginationRequest {
  channel?: 'telegram' | 'irc';
  status?: 'open' | 'pending' | 'resolved';
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  assignedUserId?: string;

  /**
   * Override to apply BOTH filtering AND pagination
   */
  override applyToQuery<T extends PgSelect>(query: T): T {
    const conditions = [];
    if (this.channel) conditions.push(eq(conversations.channel, this.channel));
    if (this.status) conditions.push(eq(conversations.status, this.status));
    if (this.priority) conditions.push(eq(conversations.priority, this.priority));
    if (this.assignedUserId) conditions.push(eq(conversations.assignedUserId, this.assignedUserId));

    let result = query;
    if (conditions.length > 0) {
      result = result.where(and(...conditions)) as T;
    }
    
    // Apply pagination from base class
    return super.applyToQuery(result);
  }
}
```

### Rules (ENFORCED)

1. **Backend Controllers**:
   - ✅ MUST return `BaseListResponse<T>` for all list/search endpoints
   - ✅ MUST accept query objects extending `PaginationRequest`
   - ✅ MUST use single `query.applyToQuery(baseSelect)` call for filtering + pagination
   - ❌ MUST NOT create ad-hoc pagination response shapes
   - ❌ MUST NOT manually calculate offset/limit in controllers
   - ❌ MUST NOT manually build where conditions in controllers

2. **Feature Query Classes**:
   - ✅ MUST extend `PaginationRequest`
   - ✅ MUST override `applyToQuery()` to add where conditions + call `super.applyToQuery()`
   - ✅ Encapsulates all filtering logic in the query class

3. **Frontend API Calls**:
   - ✅ MUST expect `BaseListResponse<T>` shape from all list endpoints
   - ✅ MUST send request objects extending `BaseListRequest`
   - ✅ CAN rely on consistent `{ data, page, limit, total }` shape

4. **When NOT to Extend**:
   - If no additional fields needed, use `BaseListResponse<T>` directly
   - Don't create `ConversationListResponse extends BaseListResponse<Conversation>` if no extra fields

### Example Controller Implementation

```typescript
@JsonController('/api/conversations')
export class ConversationsController {
  @Get()
  @Authorized()
  async listConversations(
    @QueryParams() query: ListConversationsQuery
  ): Promise<BaseListResponse<Conversation>> {
    // Single call: applyToQuery handles BOTH filtering AND pagination
    const results = await query.applyToQuery(
      db.select().from(conversations)
    );

    // Get total count (query class can also be used for count)
    const total = await conversationService.count(query);

    // Return standardized response
    return new BaseListResponse(results, total, query);
  }
}
```

### Example Frontend Usage

```typescript
// API call with typed response
const fetchConversations = async (
  filters: ListConversationsRequest
): Promise<BaseListResponse<Conversation>> => {
  const response = await api.get('/api/conversations', { params: filters });
  return response.data;
};

// React Query hook
const useConversations = (filters: ListConversationsRequest) => {
  return useQuery({
    queryKey: ['conversations', filters],
    queryFn: () => fetchConversations(filters),
  });
};

// Component usage - consistent shape guaranteed
const { data } = useConversations({ page: 0, limit: 20, status: 'open' });
// data.data: Conversation[]
// data.page: number (1-indexed)
// data.limit: number
// data.total: number
```

---

## 7. Helm Deployment Architecture

### Overview

YACC backend deploys to Kubernetes via Helm (ADR-019 approved; pod envelope amended by ADR-029); production deployment/cutover remains pending MIG-070..072 (#361–#363). The Helm chart deploys the **Java/Spring backend** built from `services/backend-java/Dockerfile` (Temurin 21 JRE, non-root uid 1000, read-only root filesystem). PostgreSQL is managed as a Kubernetes StatefulSet; there is **no Redis** in the cluster (ADR-028).

**Scope**: Backend deployment only. Frontend remains AWS S3 + CloudFront (separate pipeline).

### Chart Structure

```
deploy/helm/yacc-backend/
├── Chart.yaml              # Helm metadata
├── values.yaml             # Default values
├── values-staging.yaml     # Staging overrides
├── values-prod.yaml        # Production overrides (post-MVP)
└── templates/
    ├── deployment.yaml     # Backend app (Deployment)
    ├── service.yaml        # Backend service (ClusterIP)
    ├── serviceaccount.yaml # RBAC
    ├── configmap.yaml      # App configuration
    ├── ingress.yaml        # External routing (Traefik)
    ├── _helpers.tpl        # Template macros
    └── tests/
        └── test-connection.yaml  # Smoke tests
```

### Deployment Manifest (deployment.yaml)

**Key Configuration**:
- **Type**: Deployment (stateless, rolling updates)
- **Replicas**: 1 (MVP), scale to 2-3 for HA
- **Strategy**: RollingUpdate with zero downtime
- **Liveness Probe**: HTTP GET `/health/live` (actuator liveness group, ADR-029)
- **Readiness Probe**: HTTP GET `/health/ready` (actuator readiness group; no external dependencies in the probe verdict)

**Pod Resource Allocation** (ADR-029 JVM envelope):
```yaml
resources:
  requests:
    cpu: 500m          # Guaranteed minimum
    memory: 1Gi
  limits:
    cpu: 1000m         # Hard limit (pod killed if exceeded)
    memory: 2Gi        # JVM heap sizes from the limit (MaxRAMPercentage=75)
```

**Environment Variables**:
- Injected from ConfigMap (`SPRING_PROFILES_ACTIVE`, `SERVER_PORT`, `TZ=UTC`, retry/WS tuning, etc.)
- Injected from K8s Secret (`DATABASE_URL`, bootstrap/recovery + integration credentials per ADR-025/values.yaml)
- Service discovery auto-populated (`POSTGRES_SVC_SERVICE_HOST`, etc.)

### Service Discovery

**Internal DNS Names**:
```
Backend pod resolves:
  - postgres-svc.yacc-staging.svc.cluster.local:5432 → PostgreSQL

Backend service exposed as:
  - yacc-backend.yacc-staging.svc.cluster.local:8080 (internal)
  - api-staging.example.com (external via Ingress/Traefik)
```

### Backend Service (ClusterIP)

**Type**: ClusterIP (internal only, no external port)

```yaml
ports:
- port: 8080            # Service port
  targetPort: 8080      # Pod port (container port)
  name: http
```

**Service Selector**: Automatically routes traffic to pods matching labels (`app=yacc-backend`)

### Configuration Management

**ConfigMap** (non-sensitive settings):
```yaml
SPRING_PROFILES_ACTIVE: production
LOGGING_LEVEL_ROOT: info
TZ: UTC
```

**K8s Secrets** (sensitive credentials):
```bash
kubectl create secret generic yacc-backend-secrets \
  --from-literal=DATABASE_URL="postgresql://user:pass@postgres-svc:5432/yacc" \
  --from-literal=TELEGRAM_BOT_TOKEN="xxxxx:xxxxx" \
  -n yacc-staging

# Auth bootstrap + recovery secrets (ADR-025) and R2/email credentials —
# see deploy/helm/yacc-backend/values.yaml for the exact key names
# (yacc-auth-secrets / yacc-cloudflare-secrets / yacc-email-secrets).
# No Redis/JWT/BetterAuth secrets: decommissioned with the Node POC.
```

**MVP Approach**: K8s Secrets (simple, sufficient). Post-MVP: sealed-secrets or Vault for multi-cluster.

### Ingress & External Access

**Traefik Ingress Controller** (K3s built-in):

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: yacc-backend-ingress
spec:
  ingressClassName: traefik
  rules:
    - host: api-staging.example.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: yacc-backend
                port:
                  number: 8080
  tls:
    - secretName: yacc-backend-tls
      hosts:
        - api-staging.example.com
```

**Traffic Flow**:
```
Client (external) → VPS:80/443 → Traefik Pod → Backend Service → Backend Pod
```

### Health Probes

**Backend Implementation** (Spring Boot actuator, ADR-029):
```java
// Management base path is "/" — the frozen wire paths are:
// GET /health/live   → liveness group (livenessState only; pod restart verdict)
// GET /health/ready  → readiness group (readinessState only; traffic verdict)
// No external dependencies in the probe verdict.
```

**Probe Configuration**:
- **Liveness**: `/health/live` — every 30 seconds, fail after 3 tries (pod restart)
- **Readiness**: `/health/ready` — every 10 seconds, fail after 3 tries (remove from load balancer)
- **Initial Delay**: 30s for liveness, 10s for readiness

### Storage Strategy

**PostgreSQL**: StatefulSet with a PersistentVolume (schema via Flyway V1..V4; includes the Quartz job-store, `dead_letter_queue` and `websocket_backlog` tables — ADR-027/ADR-028).

```yaml
kind: StatefulSet
spec:
  volumeClaimTemplates:
  - metadata:
      name: data
    spec:
      storageClassName: local-path  # K3s default
      accessModes: [ReadWriteOnce]
      resources:
        requests:
          storage: 5Gi               # PostgreSQL
```

**Backend Pod**: No persistent storage (stateless; writable emptyDir paths only: `/tmp`, heap dumps, logs — read-only root filesystem, ADR-029)

**Attachment Storage**: External (Cloudflare R2, not in Kubernetes)

### Deployment Workflow

**Local Development**:
```bash
# Using default values (values.yaml)
helm install yacc-backend ./deploy/helm/yacc-backend -n yacc-staging
```

**Staging Environment**:
```bash
# Using staging overrides (values-staging.yaml)
helm upgrade --install yacc-backend ./deploy/helm/yacc-backend \
  -n yacc-staging \
  -f deploy/helm/yacc-backend/values-staging.yaml
```

**Version Pinning**:
```bash
# Deploy specific backend version
helm upgrade --install yacc-backend ./deploy/helm/yacc-backend \
  -n yacc-staging \
  --set image.tag=v1.2.3
```

### Incident Response (Roll-Forward Posture)

The migration operational posture is **roll-forward only** (ARCH-004 §1; ADR-030 Decision 6): incidents are remediated by deploying a forward fix, not by `helm rollback` to a previous revision. `helm history` remains useful for audit (identifying what changed and when).

```bash
# Identify the running revision + image (audit trail)
helm history yacc-backend -n yacc-staging

# Recover by rolling FORWARD: fix, build, redeploy the new image tag
helm upgrade --install yacc-backend ./deploy/helm/yacc-backend \
  -n yacc-staging --set image.tag=<fixed-tag>

# Monitor the forward deployment
kubectl rollout status deployment/yacc-backend -n yacc-staging --timeout=2m
```

**Details**: See `.docs/runbooks/helm-rollback.md` — despite its historical name, it now documents the roll-forward incident procedure (trigger conditions, forward-verification, stop authority). The rehearsal-evidenced incident/rollback decision procedure lands with MIG-070 (#361).

### Related Documentation

- **ADR-019**: K3s + Helm deployment decision & rationale
- **K3s Cluster Requirements**: `.docs/infrastructure/k3s-cluster-requirements.md`
- **Technology Architecture**: `.docs/architecture/TECH-ARCH-006-helm-deployment-architecture.md`
- **Helm Rollback Runbook**: `.docs/runbooks/helm-rollback.md`

---

**Version**: 2.3  
**Last Updated**: 2026-10-18 (Java/Spring backend — MIG-090 docs sweep)  
**Status**: SPEC-002 Phases 0–6 merged; Java service is the backend of record (Node POC transitional until MIG-080)
