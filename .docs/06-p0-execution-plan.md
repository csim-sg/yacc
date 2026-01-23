# Phase 1 Backend P0 Issues: Execution Plan

**Last Updated**: January 21, 2026
**Status**: Ready for Development
**Total P0 Issues**: 22

---

## Executive Summary

This document provides the complete execution plan for all 22 P0 Backend issues required for Phase 1 MVP. The plan includes dependency relationships, execution order, technical clarifications, and risk mitigation strategies.

**Timeline**: 3 weeks (15 business days)
**Team**: Backend Developer(s)
**Scope**: Authentication, RBAC, Core APIs, Real-Time WebSocket, Message Retry Queue

---

## Quick Reference: Issue Status

| Issue ID | Title | Status | Dependencies | Week |
|----------|-------|--------|--------------|------|
| **BE-028** | Create shared types package | Ready | None | 1 |
| **BE-026** | Create environment configuration scaffolding | Ready | None | 1 |
| **BE-001** | Set up PostgreSQL + Drizzle ORM | Ready | None | 1 |
| **BE-002** | Define database schema (11 tables) | Ready | BE-001 | 1 |
| **BE-027** | Set up structured logging infrastructure | Ready | BE-026 | 1 |
| **BE-020** | Set up Cloudflare R2 storage | Ready | None | 1 |
| **BE-025** | Set up email service (Nodemailer/SendGrid) | Ready | BE-026 | 1 |
| **BE-003** | Implement BetterAuth for authentication | Ready | BE-002, BE-025 | 1 |
| **BE-004** | Implement forgot password flow | Ready | BE-003, BE-025 | 1 |
| **BE-005** | Implement RBAC middleware | Ready | BE-002, BE-003 | 1 |
| **BE-016** | Set up Socket.io WebSocket server | Ready | BE-003, BE-026 | 1 |
| **BE-013** | Set up Redis + BullMQ for message retry queue | Ready | None | 2 |
| **BE-007** | Implement inbox API | Ready | BE-002, BE-005 | 2 |
| **BE-008** | Implement conversation detail endpoint | Ready | BE-007 | 2 |
| **BE-009** | Implement message retrieval endpoint | Ready | BE-002, BE-003, BE-008 | 2 |
| **BE-010** | Implement send message endpoint | Ready | BE-008, BE-013, BE-020 | 2 |
| **BE-014** | Implement exponential backoff for retries | Ready | BE-013 | 3 |
| **BE-011** | Implement message status tracking | Ready | BE-010 | 3 |
| **BE-012** | Implement message retry endpoint | Ready | BE-011 | 3 |
| **BE-017** | Implement message.received event | Ready | BE-016, BE-008 | 3 |
| **BE-018** | Implement message.sent event | Ready | BE-016, BE-008, BE-010 | 3 |
| **BE-019** | Implement message.failed event | Ready | BE-016, BE-008, BE-010 | 3 |

---

## Complete Dependency Graph

```mermaid
graph TD
    %% Week 1: Foundation
    BE028[BE-028: Shared Types]
    BE026[BE-026: Env Config]
    BE001[BE-001: PostgreSQL + Drizzle]
    BE002[BE-002: Database Schema]
    BE027[BE-027: Logging]
    BE020[BE-020: R2 Storage]
    BE025[BE-025: Email Service]
    BE003[BE-003: BetterAuth]
    BE004[BE-004: Forgot Password]
    BE005[BE-005: RBAC Middleware]
    BE016[BE-016: Socket.io Server]

    %% Week 2: Core APIs
    BE013[BE-013: Redis + BullMQ]
    BE007[BE-007: Inbox API]
    BE008[BE-008: Conversation Detail]
    BE009[BE-009: Message Retrieval]
    BE010[BE-010: Send Message]

    %% Week 3: Messaging & Real-Time
    BE014[BE-014: Exponential Backoff]
    BE011[BE-011: Message Status Tracking]
    BE012[BE-012: Message Retry Endpoint]
    BE017[BE-017: message.received]
    BE018[BE-018: message.sent]
    BE019[BE-019: message.failed]

    %% Dependencies
    BE001 --> BE002
    BE026 --> BE027
    BE026 --> BE025
    BE002 --> BE003
    BE025 --> BE003
    BE003 --> BE004
    BE003 --> BE005
    BE026 --> BE016
    BE002 --> BE007
    BE005 --> BE007
    BE007 --> BE008
    BE002 --> BE009
    BE003 --> BE009
    BE008 --> BE009
    BE008 --> BE010
    BE013 --> BE010
    BE020 --> BE010
    BE013 --> BE014
    BE010 --> BE011
    BE011 --> BE012
    BE016 --> BE017
    BE008 --> BE017
    BE016 --> BE018
    BE008 --> BE018
    BE010 --> BE018
    BE016 --> BE019
    BE008 --> BE019
    BE010 --> BE019

    %% Week grouping
    subgraph Week_1[Week 1: Foundation]
        BE028
        BE026
        BE001
        BE002
        BE027
        BE020
        BE025
        BE003
        BE004
        BE005
        BE016
    end

    subgraph Week_2[Week 2: Core APIs]
        BE013
        BE007
        BE008
        BE009
        BE010
    end

    subgraph Week_3[Week 3: Messaging & Real-Time]
        BE014
        BE011
        BE012
        BE017
        BE018
        BE019
    end

    %% Styling
    style BE028 fill:#d4edda
    style BE026 fill:#d4edda
    style BE001 fill:#d4edda
    style BE002 fill:#fff3cd
    style BE003 fill:#fff3cd
    style BE005 fill:#fff3cd
```

---

## Week-by-Week Execution Plan

### Week 1: Foundation (Days 1-5)

**Goal**: Set up all infrastructure, authentication, and configuration.

| Day | Issues | Focus Area | Key Deliverables |
|-----|--------|------------|-----------------|
| **Day 1** | BE-028, BE-026, BE-001 | Core Infrastructure | Shared types package, env config, PostgreSQL connection |
| **Day 2** | BE-002, BE-027 | Database + Logging | Database schema with 11 tables, structured logging |
| **Day 3** | BE-020, BE-025 | External Services | R2 storage, email service with templates |
| **Day 4** | BE-003, BE-004 | Authentication | BetterAuth implementation, forgot password flow |
| **Day 5** | BE-005, BE-016 | Authorization + Real-Time | RBAC middleware, Socket.io WebSocket server |

**Week 1 Deliverables**:
- ✅ `packages/common/` package with all types and schemas
- ✅ `.env.example` with all 15+ environment variables
- ✅ PostgreSQL database with Drizzle ORM, all 11 tables
- ✅ Pino logger with correlation ID middleware
- ✅ Cloudflare R2 storage service
- ✅ Email service with SendGrid/SMTP
- ✅ BetterAuth with login, logout, forgot password
- ✅ RBAC middleware with 4 roles
- ✅ Socket.io WebSocket server with auth

**Parallel Work Opportunities**:
- BE-020 (R2) can be implemented in parallel with BE-025 (Email)
- BE-027 (Logging) can be implemented in parallel with BE-002 (Database)
- BE-016 (WebSocket) can be implemented in parallel with BE-005 (RBAC)

---

### Week 2: Core APIs (Days 6-10)

**Goal**: Implement all conversation and messaging APIs.

| Day | Issues | Focus Area | Key Deliverables |
|-----|--------|------------|-----------------|
| **Day 6** | BE-013 | Message Queue | Redis + BullMQ setup, retry queue |
| **Day 7** | BE-007 | Inbox API | GET /conversations with filters |
| **Day 8** | BE-008, BE-009 | Conversation & Messages | Conversation detail, message retrieval |
| **Day 9** | BE-010 | Send Message | POST /conversations/:id/messages |
| **Day 10** | Integration & Testing | End-to-End | All APIs working together, unit tests |

**Week 2 Deliverables**:
- ✅ Redis + BullMQ message retry queue
- ✅ Inbox API with filtering (channel, assignee, tag, status, priority)
- ✅ Conversation detail endpoint with latest message
- ✅ Message retrieval endpoint (paginated, chronological)
- ✅ Send message endpoint with attachment support

**Parallel Work Opportunities**:
- BE-013 (Redis) can be implemented in parallel with BE-007 (Inbox API)
- BE-009 (Messages) depends on BE-008 (Conversation), but can start in parallel

---

### Week 3: Messaging & Real-Time (Days 11-15)

**Goal**: Implement message retry logic, status tracking, and WebSocket events.

| Day | Issues | Focus Area | Key Deliverables |
|-----|--------|------------|-----------------|
| **Day 11** | BE-014, BE-011 | Retry Logic | Exponential backoff, message status tracking |
| **Day 12** | BE-012 | Retry Endpoint | Manual retry endpoint for failed messages |
| **Day 13** | BE-017 | Event: message.received | Real-time inbound message push |
| **Day 14** | BE-018, BE-019 | Events: sent/failed | Real-time delivery status push |
| **Day 15** | Integration & Testing | End-to-End | Full message pipeline with WebSocket, regression tests |

**Week 3 Deliverables**:
- ✅ Exponential backoff retry (1m, 5m, 30m; 3 attempts max)
- ✅ Message status tracking (pending → sent/failed)
- ✅ Manual retry endpoint (POST /conversations/:id/messages/:msgId/retry)
- ✅ message.received WebSocket event
- ✅ message.sent WebSocket event
- ✅ message.failed WebSocket event

**Parallel Work Opportunities**:
- BE-017, BE-018, BE-019 (WebSocket events) can be implemented in parallel
- BE-012 (Retry endpoint) can be implemented in parallel with BE-011 (Status tracking)

---

## Technical Clarifications by Issue

### BE-001: PostgreSQL + Drizzle ORM

| Ambiguity | Resolution |
|-----------|------------|
| **Migration strategy** | Use Drizzle Kit (official tool) |
| **Database host** | Local PostgreSQL for dev, RDS/Neon for prod (document both) |
| **Connection pooling** | Use `pg` with built-in pooling (min: 2, max: 10) |
| **Naming convention** | snake_case in DB, auto-convert to camelCase via Drizzle |

**Environment Variables**:
```env
DATABASE_URL=postgresql://user:password@localhost:5432/omni_inbox
DATABASE_POOL_MIN=2
DATABASE_POOL_MAX=10
```

---

### BE-002: Database Schema (11 Tables)

| Ambiguity | Resolution |
|-----------|------------|
| **UUID generation** | DB-generated via `gen_random_uuid()` (PostgreSQL function) |
| **Cascade deletes** | Soft delete for users (status='disabled'), hard delete with cascade for conversations/messages |
| **Indexes** | Add composite indexes: `(channel, status, assigned_user_id)` for inbox queries |
| **Foreign key constraints** | Enforce constraints, defer constraints for bulk operations if needed |

**Tables Required**:
1. `users` - id, email, password_hash, role, status, created_at, updated_at
2. `conversations` - id, channel, external_thread_id, status, priority, assigned_user_id, last_message_at, created_at, updated_at
3. `messages` - id, conversation_id, sender_id, body, status, direction, platform_message_id, created_at, updated_at
4. `attachments` - id, message_id, url, storage_key, type, name, size, uploaded_by_id, uploaded_at
5. `tags` - id, name, color, created_by_id, created_at
6. `conversation_tags` - conversation_id, tag_id (M:M junction)
7. `notes` - id, conversation_id, author_id, body, created_at
8. `notifications` - id, user_id, type, conversation_id, actor_id, is_read, created_at
9. `routing_rules` - id, name, status, priority, conditions (JSON), actions (JSON), last_run_at, created_at, updated_at
10. `routing_rule_executions` - id, rule_id, conversation_id, matched_conditions, applied_actions, created_at
11. `raw_payloads` - id, message_id, storage_key, created_at, expires_at

---

### BE-003: BetterAuth Implementation

| Ambiguity | Resolution |
|-----------|------------|
| **Auth strategy** | JWT for API, session for web (BetterAuth supports both) |
| **Token TTL** | Access: 48h, Refresh: 30d (documented in API spec) |
| **Password hashing** | argon2id (BetterAuth's default) |
| **Middleware** | 401 for unauthenticated, 403 for disabled users (explicit reason) |

**Enhanced ACs** (Updated):
- Login endpoint (POST /api/auth/login) returns JWT + user data
- Logout endpoint (POST /api/auth/logout) invalidates session
- Forgot password endpoint (POST /api/auth/forgot-password) sends email with time-limited token (60 min TTL)
- Reset password endpoint (POST /api/auth/reset-password) validates token and sets new password
- Disabled users cannot login (403 error)

**Environment Variables**:
```env
BETTER_AUTH_SECRET=<random-64-char-string>
JWT_SECRET=<random-64-char-string>
ACCESS_TOKEN_TTL_SECONDS=172800  # 48h
REFRESH_TOKEN_TTL_SECONDS=2592000  # 30d
RESET_PASSWORD_TOKEN_TTL_MINUTES=60
```

---

### BE-004: Forgot Password Flow

| Ambiguity | Resolution |
|-----------|------------|
| **Email service integration** | Call email service (BE-025) to send reset email |
| **Reset link format** | Use RESET_PASSWORD_URL env variable + token parameter |
| **Security** | Always return success even if email not found (prevents email enumeration) |

**Dependencies**: BE-003, BE-025

---

### BE-005: RBAC Middleware

| Ambiguity | Resolution |
|-----------|------------|
| **Permission storage** | Hardcoded in code for MVP (faster), migrate to DB in Phase 2+ |
| **Middleware scope** | Express middleware + routing-controllers decorators (per-controller) |
| **Permission granularity** | Role-based only (4 roles) per spec |
| **Failure response** | 401 for unauthenticated, 403 for unauthorized (role mismatch) |

**Permission Matrix**:
```typescript
const PERMISSIONS = {
  '/users': ['POST', 'PATCH', 'DELETE']: ['super_admin'],
  '/audit-logs': ['GET']: ['super_admin', 'admin', 'manager'],
  '/routing-rules': ['POST', 'PATCH', 'DELETE']: ['super_admin', 'admin'],
  '/conversations/:id/messages': ['POST']: ['admin', 'manager', 'user'],
  // ... full matrix in implementation guide
};
```

---

### BE-007: Inbox API

| Ambiguity | Resolution |
|-----------|------------|
| **Search implementation** | Use simple `LIKE` for MVP, upgrade to FTS in Phase 4 |
| **Filter combination** | All filters AND (only matches all criteria) |
| **Unread count calculation** | Real-time query for MVP |
| **Pagination default** | Page size 20 |

**Query Parameters**:
- `channel` (eq): telegram, irc
- `assignedUserId` (eq): filter by assignee
- `tagId` (eq): filter by tag
- `status` (eq): open, pending, resolved
- `priority` (eq): low, normal, high, urgent
- `page` (int, default 1)
- `pageSize` (int, default 20, max 100)

---

### BE-008: Conversation Detail Endpoint

| Ambiguity | Resolution |
|-----------|------------|
| **Nested includes** | No; use separate endpoints (BE-009, /tags, /notes) for better caching |
| **Participants** | Return full participant objects with id, name, type (for presence) |
| **Latest message preview** | Include in response (reduces extra query) |

---

### BE-009: Message Retrieval Endpoint

| Ambiguity | Resolution |
|-----------|------------|
| **Attachment loading** | Embed attachment objects (id, url, name, size) but not binary content |
| **Pagination direction** | Oldest-first (chronological order) for conversation timeline |
| **Raw payload access** | Include raw_payload_ref; accessible only via separate endpoint for managers+ |

**Dependencies**: BE-002, BE-003, BE-008 (NEW)

---

### BE-010: Send Message Endpoint

| Ambiguity | Resolution |
|-----------|------------|
| **Immediate delivery** | Queue immediately (status=pending), async delivery via worker |
| **Attachment handling** | Verify attachments exist and belong to user/conversation before sending |
| **Connector dispatch** | Lookup conversation.channel, dispatch to connector manager |

**Dependencies**: BE-008, BE-013 (NEW), BE-020 (NEW)

---

### BE-011: Message Status Tracking

| Ambiguity | Resolution |
|-----------|------------|
| **Status transitions** | Can go from failed → sent on successful retry |
| **Status broadcast** | Yes, trigger BE-018/BE-019 on status change |
| **Failure details** | Store in message table (add error_message, error_code columns) |

---

### BE-013: Redis + BullMQ

| Ambiguity | Resolution |
|-----------|------------|
| **Queue naming** | Single queue `message-retry` for MVP |
| **Worker scaling** | Single worker, thread-safe (BullMQ handles concurrency) |
| **Failed job strategy** | Move to DLQ after 3 failed attempts |
| **Job retention** | 24 hours for failed, immediate for completed |

**Environment Variables**:
```env
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=  # Optional, set in prod
MESSAGE_RETRY_ATTEMPTS=3
MESSAGE_RETRY_BASE_DELAY_MS=60000  # 1 minute
MESSAGE_RETRY_BACKOFF_MULTIPLIER=5  # 1m, 5m, 30m
```

---

### BE-014: Exponential Backoff Retry

| Ambiguity | Resolution |
|-----------|------------|
| **Backoff implementation** | Use BullMQ built-in `backoff: { type: 'exponential', delay: 60000 }` |
| **Retry payload** | `{ messageId, conversationId, attemptCount, previousError }` |
| **Connector retry logic** | Connectors must implement idempotency (message_id check) |

**Dependencies**: BE-013

---

### BE-016: Socket.io WebSocket Server

| Ambiguity | Resolution |
|-----------|------------|
| **HTTP server attachment** | Attach to Express HTTP server (same port, upgrade protocol) |
| **CORS origin** | FRONTEND_URL env variable (strict origin checking) |
| **Authentication** | Token in `socket.handshake.auth.token` (Socket.io recommended) |
| **Room strategy** | Both: `user:{userId}` for notifications, `conversation:{id}` for typing/presence |

**Enhanced ACs** (Updated):
- WebSocket server running on configured port
- Authentication middleware validates JWT token on connection
- Heartbeat mechanism: server sends ping every 60 seconds, client responds with pong
- Store 1 hour of missed events for replay on reconnect
- Reconnect attempts: exponential backoff (1s → 60s max, 5 attempts)

**Environment Variables**:
```env
FRONTEND_URL=https://app.example.com
WS_HEARTBEAT_INTERVAL_SEC=60
WS_BACKLOG_RETENTION_HOURS=1
```

**Dependencies**: BE-003, BE-026 (NEW)

---

### BE-017, BE-018, BE-019: WebSocket Events

| Ambiguity | Resolution |
|-----------|------------|
| **Broadcast scope** | Assigned user + all admins/managers (for oversight) |
| **Payload size** | Full message object (including attachments) |
| **Unread count** | Include updated unread_count in conversation summary |

**Dependencies**: BE-016, BE-008 (NEW), BE-010 (NEW for BE-018/BE-019)

---

## High-Risk Areas & Mitigation

| Risk Area | Severity | Impact | Mitigation |
|-----------|----------|--------|------------|
| **Message Idempotency** | 🟠 High | Duplicate messages on retry/reconnect | Implement idempotency keys in connectors; check message_id before processing |
| **WebSocket Backlog** | 🟠 High | Missed events during disconnect | Store events in DB for 1-hour replay; auto-cleanup after retention period |
| **Race Conditions** | 🟠 High | Status updates vs WebSocket emit | Use DB transactions + event bus pattern; emit events after transaction commit |
| **Authentication Middleware** | 🟠 High | RBAC bypass possible | Write unit tests for all permission matrices; use middleware-first approach |
| **Connection Pool Exhaustion** | 🟡 Medium | Postgres pool under high load | Configure proper pool sizes (min: 2, max: 10); monitor connection count |
| **Memory Leaks (WebSocket)** | 🟡 Medium | Unsubscribed events accumulate | Implement cleanup on disconnect; remove event listeners properly |
| **Circular Retry Loops** | 🟡 Medium | Connector failure causing infinite retries | Hard cap on retries (3 attempts max); move to DLQ after failures |

---

## Environment Variables Reference

All environment variables are defined in `packages/backend/.env.example`.

### Database
```env
DATABASE_URL=postgresql://user:password@localhost:5432/omni_inbox
DATABASE_POOL_MIN=2
DATABASE_POOL_MAX=10
```

### Authentication
```env
BETTER_AUTH_SECRET=<random-64-char-string>
JWT_SECRET=<random-64-char-string>
ACCESS_TOKEN_TTL_SECONDS=172800  # 48h
REFRESH_TOKEN_TTL_SECONDS=2592000  # 30d
RESET_PASSWORD_TOKEN_TTL_MINUTES=60
```

### Cloudflare R2 Storage
```env
CLOUDFLARE_R2_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
CLOUDFLARE_R2_ACCESS_KEY=<your-r2-access-key-id>
CLOUDFLARE_R2_SECRET_KEY=<your-r2-secret-access-key>
CLOUDFLARE_R2_BUCKET=omni-inbox
CLOUDFLARE_CDN_URL=https://cdn.example.com
ATTACHMENT_MAX_SIZE_MB=5
RAW_PAYLOAD_RETENTION_DAYS=7
EXPORT_RETENTION_HOURS=24
```

### Redis & Queues
```env
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=  # Optional
MESSAGE_RETRY_ATTEMPTS=3
MESSAGE_RETRY_BASE_DELAY_MS=60000  # 1 minute
MESSAGE_RETRY_BACKOFF_MULTIPLIER=5
```

### Email Service
```env
# SendGrid (Recommended)
SENDGRID_API_KEY=<your-sendgrid-api-key>
SENDGRID_FROM_EMAIL=noreply@example.com
SENDGRID_FROM_NAME=OmniInbox

# SMTP (Fallback)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_FROM_EMAIL=noreply@example.com
SMTP_FROM_NAME=OmniInbox

RESET_PASSWORD_URL=https://app.example.com/reset-password
```

### Frontend & WebSocket
```env
FRONTEND_URL=https://app.example.com
WS_HEARTBEAT_INTERVAL_SEC=60
WS_BACKLOG_RETENTION_HOURS=1
```

### Logging
```env
LOG_LEVEL=info  # error | warn | info | debug
LOG_FORMAT=json  # json | pretty
LOG_FILE_ENABLED=true
LOG_FILE_PATH=logs/app.log
LOG_FILE_MAX_SIZE=10M
LOG_FILE_MAX_FILES=5
AUDIT_LOG_ENABLED=true
AUDIT_LOG_PATH=logs/audit.log
AUDIT_LOG_MAX_SIZE=10M
AUDIT_LOG_MAX_FILES=10
```

### Node Environment
```env
NODE_ENV=development  # development | production | test
PORT=3000
```

---

## Testing Strategy

### Unit Tests
- **Coverage Target**: 90%+ for all critical paths
- **Frameworks**: Jest for backend, Vitest for shared types
- **Scope**: Validate Zod schemas, service methods, middleware logic

### Integration Tests
- **Frameworks**: Supertest for API endpoints
- **Scope**: Test end-to-end request flows, database transactions
- **Required**: Auth flow, RBAC, message retry, WebSocket events

### E2E Tests
- **Frameworks**: Playwright (handled by QA team)
- **Scope**: User journeys (login → inbox → view conversation → send message)
- **Timing**: After Week 3 completion

### Regression Test Suite
- **Scope**: 12-test regression suite covering critical paths
- **Execution**: Before each deployment to staging

---

## Handoff Checklist

Before marking Phase 1 as complete, ensure:

- [ ] All 22 P0 issues are closed
- [ ] All unit tests pass with 90%+ coverage
- [ ] All integration tests pass
- [ ] Environment variables documented in `.env.example`
- [ ] API documentation updated (Swagger/OpenAPI)
- [ ] WebSocket events documented
- [ ] Error codes and messages documented
- [ ] Database migrations tested and verified
- [ ] Email delivery tested with real email provider
- [ ] R2 storage tested with real bucket
- [ ] Redis connection tested and monitored
- [ ] WebSocket reconnection tested
- [ ] Message retry flow tested end-to-end
- [ ] RBAC permissions tested for all roles
- [ ] Regression test suite passes
- [ ] Staging deployment successful
- [ ] QA sign-off received

---

## Contact & Support

| Issue | Contact Person | Role |
|-------|---------------|------|
| Architecture questions | Architect | Solution Architect |
| Product scope questions | Product Owner | Product Owner |
| API contract ambiguities | Backend Lead | Backend Developer |
| Testing strategy | QA/Tester | QA Lead |

---

## Appendix: Issue Links

| Issue ID | Title | GitHub Link |
|----------|-------|-------------|
| BE-001 | Set up PostgreSQL + Drizzle ORM | https://github.com/csim-sg/yacc/issues/12 |
| BE-002 | Define database schema (11 tables) | https://github.com/csim-sg/yacc/issues/13 |
| BE-003 | Implement BetterAuth for authentication | https://github.com/csim-sg/yacc/issues/18 |
| BE-004 | Implement forgot password flow | https://github.com/csim-sg/yacc/issues/19 |
| BE-005 | Implement RBAC middleware | https://github.com/csim-sg/yacc/issues/20 |
| BE-007 | Implement inbox API | https://github.com/csim-sg/yacc/issues/14 |
| BE-008 | Implement conversation detail endpoint | https://github.com/csim-sg/yacc/issues/15 |
| BE-009 | Implement message retrieval endpoint | https://github.com/csim-sg/yacc/issues/10 |
| BE-010 | Implement send message endpoint | https://github.com/csim-sg/yacc/issues/11 |
| BE-011 | Implement message status tracking | https://github.com/csim-sg/yacc/issues/30 |
| BE-012 | Implement message retry endpoint | https://github.com/csim-sg/yacc/issues/22 |
| BE-013 | Set up Redis + BullMQ for message retry queue | https://github.com/csim-sg/yacc/issues/23 |
| BE-014 | Implement exponential backoff for retries | https://github.com/csim-sg/yacc/issues/26 |
| BE-016 | Set up Socket.io WebSocket server | https://github.com/csim-sg/yacc/issues/28 |
| BE-017 | Implement message.received event | https://github.com/csim-sg/yacc/issues/27 |
| BE-018 | Implement message.sent event | https://github.com/csim-sg/yacc/issues/31 |
| BE-019 | Implement message.failed event | https://github.com/csim-sg/yacc/issues/29 |
| BE-020 | Set up Cloudflare R2 storage | https://github.com/csim-sg/yacc/issues/106 |
| BE-025 | Set up email service (Nodemailer/SendGrid) | https://github.com/csim-sg/yacc/issues/105 |
| BE-026 | Create environment configuration scaffolding | https://github.com/csim-sg/yacc/issues/108 |
| BE-027 | Set up structured logging infrastructure | https://github.com/csim-sg/yacc/issues/107 |
| BE-028 | Create shared types package | https://github.com/csim-sg/yacc/issues/109 |

---

**Document Status**: ✅ Ready for Development
**Next Action**: Assign BE-028 to backend developer to start Week 1
