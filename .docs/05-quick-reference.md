# 05. Quick Reference Card

**YACC - One-Page MVP Decision Summary**

---

## Project Overview

**YACC - Yet Another Chat Client** — Omni-channel social inbox for Telegram + IRC with auth, real-time updates, routing rules, notifications, search, attachments, and audit logs. Frontend deployed to AWS S3 + CloudFront, backend on VPS.

| Aspect | Value |
|--------|-------|
| **Duration** | 6 weeks (4 phases) |
| **Platforms** | Telegram, IRC (MVP); WhatsApp, WeChat, Meta, X (Phase 2+) |
| **Users** | 4 roles: Super Admin, Admin, Manager, User |
| **Tech Stack** | Node.js/Express, React + TanStack Start, PostgreSQL, AWS S3, Redis, Socket.io |
| **Monorepo** | Turborepo + pnpm (packages: backend, frontend, common) |
| **Hosting** | Frontend: AWS S3 + CloudFront, Backend: Docker on VPS (single-tenant MVP) |

---

## Core Features Checklist

| Feature | Status | Details |
|---------|--------|---------|
| **Inbox** | ✅ | Unified list, filters, search, bulk actions (max 100) |
| **Auth** | ✅ | Email/password, forgot password, RBAC (4 roles) |
| **Messages** | ✅ | Send/receive, attachments (5 MB max), retry on failure |
| **Collaboration** | ✅ | Tags (user-created), notes (@mentions), assignments |
| **Rules** | ✅ | Route by channel, keyword, sender, tag, time |
| **Notifications** | ✅ | In-app (assignment, @mention, unread badges) |
| **Search** | ✅ | Full-text on message bodies + sender names, date range |
| **Attachments** | ✅ | Download inbound, upload outbound, re-host on R2 |
| **Real-Time** | ✅ | WebSocket (60s heartbeat, 1-hour backlog) |
| **Audit Log** | ✅ | All actions logged, 1-year retention |
| **Presence** | ✅ | Online/offline + typing indicators |

---

## Data Flow Quick Summary

```
INBOUND:
Platform → Connector → Download attachments → Store on R2 → Save to DB
→ Index for search → Evaluate rules → Create notifications → WebSocket push

OUTBOUND:
User reply → Save pending → Dispatch → Success=sent or Failure=enqueue retry
→ Exponential backoff (1m, 5m, 30m) → Max 3 attempts → DLQ → WebSocket update

SEARCH:
User query → PostgreSQL FTS → Combine filters → Sort by relevance + date → Paginate

RULES:
New message → Evaluate conditions (AND logic) → First match wins
→ Apply actions (assign, tag, priority) → Log execution → WebSocket update

NOTIFICATIONS:
Assigned/mentioned → Create notification → Store in DB → Push via WebSocket
→ User dismisses/reads → Mark in DB
```

---

## Technology Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Database** | PostgreSQL | ACID, FTS, JSON support, mature |
| **Search** | PostgreSQL FTS (MVP → Elasticsearch later) | Simple, fast enough for MVP |
| **Storage** | Cloudflare R2 | Cheaper than S3, CDN built-in |
| **Message Queue** | Redis + BullMQ | Simple, fast, good retry scheduling |
| **Real-Time** | Socket.io | Mature, handles reconnection |
| **Auth** | BetterAuth | Flexible, email/password + JWT |
| **Retry** | Exponential backoff (1m/5m/30m) | Industry standard, reduces load |
| **Conversations** | One per group/channel | Clear mapping, avoids confusion |
| **Rules** | First match wins | Simple, predictable |
| **Bulk Actions** | Best-effort (partial OK) | Pragmatic, better UX than all-or-nothing |
| **Notifications** | In-app only (email Phase 2) | Simpler MVP, instant via WebSocket |

---

## API Endpoints (Core)

### Auth
```
POST /auth/login → JWT + session
POST /auth/forgot-password → email
POST /auth/reset-password
```

### Conversations
```
GET /conversations → list (filters, search, pagination)
GET /conversations/:id → detail
PATCH /conversations/:id → update status/priority/assign
POST /conversations/bulk → bulk actions (max 100)
```

### Messages & Attachments
```
GET /conversations/:id/messages
POST /conversations/:id/messages → send reply
POST /conversations/:id/attachments → upload (5 MB max)
GET /attachments/:id → download
```

### Collaboration
```
POST /conversations/:id/tags
DELETE /conversations/:id/tags/:tagId
POST /conversations/:id/notes
POST /conversations/:id/assign
```

### Admin & Rules
```
GET /users, POST /users, PATCH /users/:id
GET /routing-rules, POST /routing-rules, PATCH /routing-rules/:id
GET /audit-logs → query filters (actor, action, date range)
GET /audit-logs/export → CSV
```

### Search & Notifications
```
GET /search/conversations → full-text + filters
GET /notifications → user notifications
PATCH /notifications/:id → mark read
DELETE /notifications/:id → dismiss
```

---

## Conversation Status Lifecycle

```
NEW → OPEN → PENDING → RESOLVED
              ↑__________|
                (auto-reopen on new inbound)
```

**Status Meanings**:
- **OPEN**: Active, awaiting reply or action
- **PENDING**: Agent replied, awaiting customer response
- **RESOLVED**: Conversation closed (DM/group only; broadcast ignores)

---

## Message Retry Strategy

```
User sends reply
  ↓
Success → status = SENT ✅
  
Failure → status = FAILED
  ↓
Enqueue job (delay: 1 min)
  ↓ Attempt 1
Try again → Success → SENT ✅
        or Failure → retry (delay: 5 min)
               ↓ Attempt 2
            Try again → Success → SENT ✅
                    or Failure → retry (delay: 30 min)
                           ↓ Attempt 3
                        Try again → Success → SENT ✅
                                or Failure → DLQ ❌
```

**Config**:
- Max retries: 3
- Backoff: 1 min, 5 min, 30 min (exponential)
- Queue: Redis + BullMQ
- After max retries: Dead-letter queue (DLQ) for ops

---

## WebSocket Configuration

| Setting | Value | Notes |
|---------|-------|-------|
| **Heartbeat** | 60s | Ping/pong to detect stale connections |
| **Backlog** | 1 hour | Client receives missed events on reconnect |
| **Reconnect** | Exponential backoff | 1s → 60s max, 5 attempts |

**Events**:
- `conversation.updated` — status, priority, assignment change
- `message.received` / `message.sent` / `message.failed` — message delivery
- `notification.received` — new notification
- `typing.started` / `typing.stopped` — typing indicator
- `presence.updated` — user online/offline

---

## Role Permissions Summary

| Action | Super Admin | Admin | Manager | User |
|--------|:-:|:-:|:-:|:-:|
| Reply to messages | ✓ | ✓ | ✓ | ✓ |
| Tag conversations | ✓ | ✓ | ✓ | ✓ |
| Add notes | ✓ | ✓ | ✓ | ✓ |
| Assign conversations | ✓ | ✓ | ✓ |   |
| View audit logs | ✓ | ✓ | ✓ |   |
| Access raw payloads | ✓ | ✓ | ✓ |   |
| Create/edit users | ✓ |   |   |   |
| Manage integrations | ✓ |   |   |   |
| Configure routing rules | ✓ |   |   |   |

---

## Implementation Roadmap

```
Week 1–2: Core (auth, data model, basic inbox, WebSocket, retry queue)
Week 3–4: Messages (send/receive, connectors)
Week 5: Collaboration (tags, notes, rules, notifications)
Week 6: Polish (search, attachments, admin, QA)
```

**Definition of Done**:
- All 20 user stories with ACs met
- 12 regression tests passing
- Playwright E2E tests for critical paths
- Zero critical bugs
- Audit logs complete
- Documentation complete

---

## Configuration Quick Copy

### Backend .env (Essential)
```env
DATABASE_URL=postgresql://user:pass@localhost/omni_inbox
JWT_SECRET=generate-random
REDIS_HOST=localhost REDIS_PORT=6379
CLOUDFLARE_R2_ENDPOINT=https://r2.example.com
CLOUDFLARE_R2_BUCKET=omni-inbox
CLOUDFLARE_CDN_URL=https://cdn.example.com
TELEGRAM_BOT_TOKEN=your-token
FRONTEND_URL=https://app.example.com
```

### Database Setup
```sql
-- Run migrations (Drizzle)
npm run db:migrate

-- Or execute SQL directly (see 02-api-and-data-model.md)
CREATE TABLE users (...);
CREATE TABLE conversations (...);
-- etc.
```

### Search Index (PostgreSQL)
```sql
CREATE INDEX idx_messages_search_vector ON messages USING gin(search_vector);
CREATE TRIGGER trigger_update_message_search_vector
BEFORE INSERT OR UPDATE ON messages FOR EACH ROW
EXECUTE FUNCTION update_message_search_vector();
```

### Redis + BullMQ Queue
```typescript
const queue = new Queue('message-retry', {
  redis: { host: 'localhost', port: 6379 },
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 60000 },
  },
});
```

---

## Common Gotchas

| Gotcha | Solution |
|--------|----------|
| **Retry loops**: User hits retry multiple times | Disable retry button after 1 attempt, show timeout |
| **Notification spam**: Same conversation assigned twice | Dedup by (user_id, conversation_id, type) |
| **Search lag**: Message not searchable immediately | Index in real-time or batch every 5 minutes |
| **Status confusion**: Conversation auto-reopens | Show reason in UI: "Reopened: new message from customer" |
| **Bulk failure silent**: 50 of 100 fail without feedback | Always return failure list with reasons |
| **Group threading wrong**: Messages in separate conversations | Design: one conversation per group (Telegram group ID) |
| **Role check missing**: User can do admin action | Enforce RBAC on every endpoint via middleware |
| **Attachment not deleted**: R2 grows unbounded | Manual cleanup or archival policy (defer to Phase 2) |

---

## Checklist for Dev Kickoff

- [ ] Read 01-product-specification.md (features + user stories)
- [ ] Read 02-api-and-data-model.md (API + data model)
- [ ] Review 03-implementation-guide.md (architecture, phases)
- [ ] Check 04-qa-and-testing.md (ACs, regression suite)
- [ ] Keep 05-quick-reference.md pinned for quick lookup
- [ ] Setup PostgreSQL + Redis locally
- [ ] Setup Cloudflare R2 bucket (or use MinIO locally)
- [ ] Create auth.ts with BetterAuth setup
- [ ] Create data models (Drizzle or raw SQL)
- [ ] Implement auth endpoints
- [ ] Implement inbox API (GET /conversations, filters)
- [ ] Setup WebSocket server (Socket.io)
- [ ] Setup message retry queue
- [ ] Implement message send/receive
- [ ] Begin Telegram connector

---

## Quick Links

| Document | Purpose |
|----------|---------|
| **01-product-specification.md** | Product scope, features, user stories (20 stories, 130+ ACs) |
| **02-api-and-data-model.md** | Complete API contract + database schema |
| **03-implementation-guide.md** | Architecture, tech stack, code examples, phases |
| **04-qa-and-testing.md** | Test cases, acceptance criteria, regression suite |
| **05-quick-reference.md** | This file — one-page cheat sheet |

---

## Key Contacts / Decision Makers

**Product Owner**: [Name] — Feature scope, acceptance criteria decisions  
**Tech Lead**: [Name] — Architecture, technical implementation decisions  
**QA Lead**: [Name] — Testing strategy, release criteria  

---

**Version**: 1.0  
**Last Updated**: January 17, 2026  
**Status**: MVP Ready for Launch  

**Print this page. Pin it on your wall. Reference frequently. 📌**
