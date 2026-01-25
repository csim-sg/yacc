# Project Context for AI Agents

## 🎯 Project Summary

**YACC - Yet Another Chat Client** — A unified inbox application that centralizes social communications from multiple platforms (Telegram, IRC) into one interface with role-based access, real-time updates, message routing rules, notifications, search, and full audit logging.

**Status**: Monorepo + Turborepo setup complete, ready for Phase 1 implementation (auth, core inbox, messaging)  
**Scope**: Single-tenant MVP with 2 integrations (Telegram, IRC); additional platforms deferred to Phase 2+
**Deployment**: Frontend to AWS S3 + CloudFront, Backend to Docker on VPS

---

## Important Information
- Repo: https://github.com/csim-sg/yacc

### YACC Project Board
- **Project Number**: 1
- **Project ID**: `PVT_kwHOAB4wV84BNGcw`
- **URL**: https://github.com/users/csim-sg/projects/1/views/1
- **Owner**: csim-sg

#### Common Field IDs
- **Status**: `PVTSSF_lAHOAB4wV84BNGcwzg8MYR0`
- **Assignee**: `PVTSSF_lAHOAB4wV84BNGcwzg8MYR1`
- **Priority**: `PVTSSF_lAHOAB4wV84BNGcwzg8MYR2`
- **Iteration**: `PVIT_lAHOAB4wV84BNGcwzg8MYO0`

## 📋 Project Quick Facts

| Aspect | Details |
|--------|---------|
| **Goal** | Unified inbox for teams to manage multi-channel social messages in one place |
| **Users** | 4 roles: Super Admin (full control), Admin (operations), Manager (oversight), User (handle messages) |
| **MVP Features** | 15 core features: inbox, auth, messaging, collaboration (tags/notes/assignments), routing rules, notifications (in-app), search (full-text), attachments (5 MB max), real-time (WebSocket), audit logging (1-year retention), presence, integrations |
| **Initial Platforms** | Telegram groups/channels, IRC networks |
| **Deferred Platforms** | WhatsApp, WeChat, Meta (FB/Instagram), X/Twitter (Phase 2+) |
| **Monorepo Structure** | `packages/backend/` (Node.js API), `packages/frontend/` (React SPA), `packages/common/` (shared types/schemas) |
| **Architecture** | Backend (Node.js + Express), Frontend (React 18 + TanStack Start), Database (PostgreSQL + Drizzle), Cache (Redis + BullMQ), Storage (AWS S3), Real-time (Socket.io) |
| **Timeline** | 6 weeks (4 implementation phases) |
| **Team** | Backend dev, Frontend dev, QA, Product owner, Architect |

---

## 📂 Core Features at a Glance

### 1. **Unified Inbox**
- Single queue for all channels (Telegram, IRC)
- Filters: channel, assignee, tag, status (open/pending/resolved), priority
- Search: full-text on message bodies + sender names, date range
- Bulk actions: assign, tag, change status (max 100 per request)
- Sorting: newest activity by default

### 2. **Authentication & RBAC**
- Email/password login, forgot password (email reset)
- 4 roles with permission matrix:
  - **Super Admin**: full access, user/role management, integrations, routing rules
  - **Admin**: inbox operations, assignments, tags, notes
  - **Manager**: assignments, priority, audit log access, raw payload access
  - **User**: reply, use tags/notes, view assigned conversations
- BetterAuth + JWT or session-based

### 3. **Messaging**
- Send/receive messages (inbound from platforms, outbound from UI)
- Message status tracking: pending → sent (success) or failed
- Attachments: download + re-host inbound (max 5 MB), upload outbound
- Message retry on failure: exponential backoff (1m, 5m, 30m; 3 attempts max)
- Dead-letter queue (DLQ) for failed messages (ops review)
- Delivery status visible in UI (pending/sent/failed with retry button)

### 4. **Collaboration**
- **Tags**: user-created, reusable across conversations, create inline
- **Notes**: internal only (not sent to customer), @mention support (triggers notifications)
- **Assignments**: assign to users, reassignment allowed, notifications sent to assignee
- **Audit trail**: all actions logged (who, what, when, metadata)

### 5. **Routing Rules**
- Auto-assign, auto-tag, auto-prioritize based on conditions
- Conditions: channel (eq), keyword (contains, regex), sender (eq), tag (has), time (hour)
- Rules evaluated in priority order; first match wins
- Manual overrides allowed (override rule, logged in audit)
- Rule execution logs queryable by rule ID or conversation ID

### 6. **Notifications (In-App)**
- **Triggers**: assigned to conversation, @mentioned in note
- **Features**: notification center panel, mark as read, dismiss, unread badge count
- **Delivery**: via WebSocket (real-time push)
- **Storage**: database persistence (show on reconnect)
- **Deferred**: email notifications (Phase 2)

### 7. **Search**
- Full-text search on message bodies and sender names
- Date range filtering (dateFrom, dateTo)
- Combine with inbox filters (channel, tag, assignee, status, priority)
- Results sorted by relevance + recency
- Pagination: 20 results per page
- Performance: <1 second for typical queries

### 8. **Attachments**
- **Inbound**: download from platform, re-host on Cloudflare R2 (5 MB max)
- **Outbound**: upload from UI to R2, include in reply
- **Display**: inline images, file previews, download links
- **Storage**: Cloudflare R2 (CDN-backed for fast delivery)

### 9. **Real-Time Updates (WebSocket)**
- Events: conversation_updated, message.sent/failed, notification.received, conversation.reopened, presence.updated, typing.started/stopped
- Configuration: 60-second heartbeat, 1-hour message backlog on reconnect, exponential backoff reconnection (1s → 60s max, 5 attempts)
- Handles disconnection gracefully (buffered events, replay on reconnect)

### 10. **Conversation Status Lifecycle**
- **Open**: active, awaiting reply or action
- **Pending**: agent replied, awaiting customer response
- **Resolved**: conversation closed (DM/group only; broadcast ignores status)
- **Auto-Reopen**: resolved conversation reopens if new inbound message arrives
- Status changes logged in audit trail, WebSocket pushed to UI

### 11. **Integrations (MVP)**
- **Telegram**: groups/channels, one conversation per group, replies on-behalf-of system account, error handling with retry
- **IRC**: networks/channels, one conversation per channel, auto-reconnect on disconnect
- **Credentials**: stored in environment variables (MVP single-tenant)

### 12. **Audit Logging**
- Logs all actions: assignments, tags, notes, status changes, rule executions, user role changes, message retries, attachment access, integration changes, bulk operations
- Queryable by: actor, action, entity_type, entity_id, date range
- Exportable: CSV export
- Retention: 1 year (configurable)

### 13. **Presence & Typing**
- Online/offline status visible per user (real-time)
- Typing indicators in conversation view (5-second timeout)

### 14. **Raw Payload Storage**
- Store inbound platform payloads as plain text on Cloudflare R2
- Retention: 7 days (configurable)
- Access: manager+ only, audit-logged
- Purpose: debug connector issues

### 15. **Localization**
- Default: English
- i18n scaffolding for future translations
- Deferred: RTL support (Phase 2)

---

## 🏗️ System Architecture (High-Level)

```
FRONTEND (TanStack Start SPA)
├─ Inbox UI (filters, search, bulk actions)
├─ Conversation view (messages, timeline, attachments)
├─ Admin panel (users, integrations, rules, audit logs)
└─ Notification center

        ↕ REST API + WebSocket

BACKEND (Node.js + Express)
├─ REST endpoints (40+)
├─ WebSocket gateway (8 event types)
├─ Rules engine (evaluate & apply)
├─ Search service (PostgreSQL FTS)
├─ Notification engine (create & deliver)
├─ Audit logger
└─ Connector manager (Telegram, IRC)

        ↓ (stores/caches)

DATA LAYER
├─ PostgreSQL (conversations, messages, users, tags, notes, audit logs, notifications, routing rules)
├─ Cloudflare R2 (raw payloads, attachments, re-hosted files)
├─ Redis + BullMQ (message retry queue)
└─ Socket.io (real-time events)

        ↓ (connects to)

EXTERNAL PLATFORMS
├─ Telegram API (webhooks/polling)
└─ IRC networks (socket connections)
```

---

## 💾 Data Model (Core Entities)

**Users**: id, email, password_hash, role, status, created_at  
**Conversations**: id, channel, external_thread_id, status (open/pending/resolved), priority, assigned_user_id  
**Messages**: id, conversation_id, sender_id, body, status (pending/sent/failed), direction (inbound/outbound)  
**Attachments**: id, message_id, url (CDN), storage_key (R2), type, name, size  
**Tags**: id, name, color, created_by_id  
**ConversationTags**: conversation_id, tag_id (M:M)  
**Notes**: id, conversation_id, author_id, body  
**Notifications**: id, user_id, type (assignment/mention), conversation_id, actor_id, is_read  
**RoutingRules**: id, name, status (active/disabled), priority, conditions (JSON), actions (JSON), last_run_at  
**RoutingRuleExecutions**: id, rule_id, conversation_id, matched_conditions, applied_actions (audit of rule runs)  
**RawPayloads**: id, message_id, storage_key (R2), created_at, expires_at  
**AuditLogs**: id, actor_id, action, entity_type, entity_id, metadata (JSON), created_at  

---

## 🛠️ Tech Stack (Complete)

| Layer | Tech | Purpose |
|-------|------|---------|
| **Frontend** | TanStack Start (React) | SPA with real-time updates |
| **Frontend State** | Zustand + TanStack Query | Client state & data fetching |
| **Frontend Auth** | BetterAuth | Session/JWT management |
| **Frontend Styling** | Tailwind CSS | Utility-first CSS |
| **Backend Runtime** | Node.js 18+ | Server runtime |
| **Backend Framework** | Express + routing-controllers | REST API (MVC pattern) |
| **Backend Auth** | BetterAuth | Email/password, JWT, session |
| **Database** | PostgreSQL 14+ | Primary data store (ACID, FTS, JSON) |
| **Database ORM** | Drizzle | Type-safe SQL queries |
| **Real-Time** | Socket.io | WebSocket for inbox updates |
| **Search** | PostgreSQL FTS | Full-text search (MVP); Elasticsearch (future) |
| **Message Queue** | Redis + BullMQ | Outbound message retry (exponential backoff) |
| **File Storage** | Cloudflare R2 | Payloads, attachments, re-hosted files |
| **Email** | Nodemailer/SendGrid | Password reset emails |
| **Hosting** | Docker on VPS | Single instance (MVP) |
| **Testing** | Playwright | E2E test automation |
| **Testing** | Jest | Unit & integration tests |

---

## 📚 Documentation

Complete specifications in `.docs/`:

| File | Purpose | Key Content |
|------|---------|-------------|
| **01-product-specification.md** | Product scope & features | 20 user stories, 130+ ACs, UI requirements, flows |
| **02-api-and-data-model.md** | API contract & database | 40+ endpoints, 11 tables, data models, WebSocket events |
| **03-implementation-guide.md** | Architecture & decisions | 6 components (code), 4 phases, tech decisions |
| **04-qa-and-testing.md** | Testing strategy | 80+ test cases, 12-test regression suite |
| **05-quick-reference.md** | One-page cheat sheet | Configs, role matrix, gotchas, checklist |
| **README.md** | Navigation guide | How-to-use by role, quick start |

**For detailed info on any feature, see relevant doc (linked above).**

---

## 🚦 Implementation Phases (6 Weeks)

### Phase 1: Core (Week 1–2)
- Auth (BetterAuth, login/logout/forgot password)
- Data model (PostgreSQL schema)
- Basic inbox API (GET /conversations, filters)
- RBAC middleware
- Frontend: login page + inbox list

### Phase 2: Real-Time & Messages (Week 3–4)
- WebSocket gateway (Socket.io)
- Send/receive messages
- Redis + BullMQ retry queue
- Telegram webhook ingestion
- IRC socket connection
- Frontend: conversation view + reply composer

### Phase 3: Collaboration & Rules (Week 5)
- Tags, notes, assignments
- Routing rules engine
- Notifications (in-app)
- Audit logging (all actions)
- Bulk actions

### Phase 4: Polish & Integrations (Week 6)
- Search (PostgreSQL FTS)
- Attachments (R2 upload/download)
- Telegram + IRC end-to-end
- Integration credential setup UI
- Admin panel (users, audit logs, rules)
- QA (Playwright E2E, regression suite)

---

## 🎯 Key Design Decisions

| Decision | Choice | Why |
|----------|--------|-----|
| **Database** | PostgreSQL | ACID transactions, FTS, JSON, mature |
| **Search** | PostgreSQL FTS (MVP) | Sufficient for MVP, migrate to Elasticsearch later |
| **Storage** | Cloudflare R2 | Cheaper than S3, CDN-backed, S3-compatible API |
| **Queue** | Redis + BullMQ | Simple, fast, built-in retry scheduling |
| **Real-Time** | Socket.io | Handles reconnection, fallback to polling |
| **Architecture** | Single-tenant (MVP) | Simpler, credentials in env vars |
| **Conversations** | One per group/channel | Clear mapping, no confusion |
| **Rules** | First match wins | Simple, predictable, avoids conflicts |
| **Retry** | Exponential backoff (1m, 5m, 30m) | Standard, reduces server load |
| **Bulk Actions** | Best-effort (partial OK) | Pragmatic, better UX than all-or-nothing |
| **Notifications** | In-app only (email Phase 2) | Simpler MVP, WebSocket instant delivery |
| **Attachments** | Re-host on R2 | Preserves files, faster via CDN |

---

## 👥 Agent Roles & Responsibilities

### Product Owner
**What to do**: Validate features, acceptance criteria, scope changes  
**When to ask**: Feature scope unclear, UX questionable, AC incomplete  
**Reference**: `.docs/01-product-specification.md` (20 stories, 130+ ACs)

### Frontend Developer
**What to do**: Implement UI (React/TanStack), WebSocket client, API integration  
**What to collaborate on**: API response shapes, error handling, auth flow  
**When to ask**: API contract ambiguous, response format unclear, auth integration  
**Reference**: `.docs/02-api-and-data-model.md` (section 5–6: endpoints, WebSocket events)

### Backend Developer
**What to do**: Implement REST API, database, integrations, message retry, rules engine  
**What to collaborate on**: API contract, response shapes, error codes  
**When to ask**: API design unclear, data model ambiguous, integration strategy  
**Reference**: `.docs/02-api-and-data-model.md` (endpoints, schema) + `.docs/03-implementation-guide.md` (architecture, components)

### QA/Tester
**What to do**: Create test cases, automate (Playwright), verify acceptance criteria  
**What to collaborate on**: AC clarity, edge cases, test strategy  
**When to ask**: AC unclear, acceptance criteria incomplete  
**Reference**: `.docs/04-qa-and-testing.md` (80+ test cases, regression suite) + `.docs/01-product-specification.md` section 8 (user stories with ACs)

### Architect (Final Decision-Maker)
**What to do**: Unblock ambiguities, make design trade-off decisions, ensure alignment  
**When to escalate**: Architecture questions, tech choice conflicts, scope creep  
**Reference**: All docs, especially `.docs/03-implementation-guide.md` (design decisions, trade-offs)

---

## 🎯 Your Preferences & Constraints (CRITICAL)

### Development Workflow Preferences
1. **Sequential Development**: "Do it 1 by 1, make it simple"
   - One task at a time (not parallel)
   - Each task gets its own feature branch
   - Each task has its own PR after completion
   - Simpler, cleaner workflow

2. **Documentation Synchronization**: "Update document if the status not same as project"
   - Keep `.docs/plans/00-INDEX.md` in sync with actual implementation status
   - Update ADRs and governance logs when decisions are made
   - Mark tasks as DONE/In Progress/Ready based on actual state

3. **Infrastructure Setup**: Use Docker Compose for local development
   - PostgreSQL database
   - Redis cache
   - Mailhog for email testing
   - Don't worry about multi-environment setup yet

4. **Git Workflow**: Create branches, push to repo, create PRs against `dev` branch
   - No force pushes unless explicitly requested
   - No direct commits to dev/main without PR review
   - Each PR should have a clear commit message following your conventions

### Code Architecture Constraints (STRICT - Non-negotiable)

1. **No `any` Types Allowed** (Enforcement: LSP errors, linter warnings)
   - Use proper TypeScript interfaces extending `Request` from `express` module
   - Never use `any` casting for Express/Node.js types
   - Example: Use `AuthRequest extends Request` instead of `req as any`

2. **Flat Folder Structure** (Not layered architecture)
   - ❌ NO: `api/`, `domain/`, `infrastructure/` nested folders
   - ✅ YES: Flat structure:
     - `controllers/` - All API controllers
     - `middleware/` - All middleware
     - `services/` - All business logic
     - `config/` - Configuration objects (data only, no class instances)
     - `infrastructure/` - Client initialization (singleton classes)
     - `connectors/`, `websockets/`, `workers/`, `types/`, `utils/`

3. **Routing-Controllers Best Practices** (Follow framework standards)
   - Use `middlewares` option in `useExpressServer()` to register middleware
   - ❌ NO: Use `app.use()` for middleware registration
   - ✅ YES: Pass middlewares via routing-controllers config
   - Ensures proper integration with authorization flow

4. **One Definition Per File** (Separation of concerns)
   - One class per file
   - One interface per file (unless closely related)
   - One service per file
   - Clear, single responsibility principle

5. **Config vs Infrastructure Pattern** (ADR-005 approved)
   - **Config folder**: Simple `const` objects with env var references
     - Example: `{ port: process.env.PORT, dbUrl: process.env.DATABASE_URL }`
     - NO class definitions, NO initialization logic
   - **Infrastructure folder**: Singleton client classes
     - Example: `class DatabaseClient { constructor() { ... } }`
     - Handles initialization, connection pooling, singleton pattern
   - Reason: "I don't want clean architecture. I want to keep it simple and clean."

6. **No Global `/api` Prefix** (Add to controllers individually)
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

### Documentation Standards (MANDATORY)

1. **Keep These Documents Updated**:
   - `.docs/plans/00-INDEX.md` - Track task progress, approvals, status
   - `.docs/adr/` - Architecture decision records (ADR-XXX)
   - `.docs/governance/GOV-008-week1-workarounds.md` - Governance & workarounds
   - `.docs/03-implementation-guide.md` - Tech decisions & architecture

2. **PR Requirements**:
   - Clear commit messages (describe WHY, not just WHAT)
   - Reference related issues/PRs in description
   - Link ADR if architectural change made
   - Include test coverage info
   - Update relevant `.docs/` files in same PR

3. **ADR Requirements** (When ADR is needed):
   - Change affects multiple services/teams
   - Introduces new technology or pattern
   - Impacts security, cost, scalability, or data
   - Changes core architecture principle
   - Use template: `.docs/adr/ADR-001-monorepo-turborepo-setup.md`

### Communication & Review Process

1. **PR Review Flow**:
   - I (Architect) will review all PRs for alignment with constraints
   - Block PRs that violate architecture rules
   - Request changes with clear explanations
   - Approve when all constraints met

2. **Issue Escalation**:
   - Ask questions early if requirements unclear
   - Reference relevant docs in questions
   - Provide context: what you tried, what went wrong, what options you see

3. **Documentation Issues**:
   - If docs are unclear, say so immediately
   - Update docs before moving to next task
   - Keep governance log in sync with decisions

### Your Proven Workflow (From BE-003)
✅ Works well, continue this pattern:
1. Create feature branch from `dev`
2. Implement feature with tests (85%+ coverage)
3. Update `.docs/` files if needed
4. Create PR with clear description + ADR reference if applicable
5. Wait for architect review (me)
6. Fix any issues raised
7. Merge to dev when approved
8. Update planning documents (00-INDEX.md)
9. Move to next task

---

## ⚠️ Important Notes

1. **Single-Tenant MVP**: Credentials stored in env vars (Telegram token, IRC password). Multi-tenant with vault (Phase 2).

2. **Message Retry**: Exponential backoff (1m, 5m, 30m; 3 attempts max) via Redis + BullMQ. Failed messages go to DLQ for ops review.

3. **Conversation Status**: Auto-reopen resolved conversations on new inbound message. Status applies to DM/group only (broadcast ignores).

4. **Rules Engine**: First matching rule wins (simple, predictable). Manual overrides allowed (always logged in audit).

5. **WebSocket Backlog**: Clients receive 1 hour of missed events on reconnect (stored in DB, auto-cleanup).

6. **Audit Logging**: 1-year retention (configurable). Every action logged (assignments, tags, notes, status changes, rule executions, retries, etc.).

7. **Search**: PostgreSQL FTS in MVP (sufficient). Migrate to Elasticsearch if needed (Phase 2+).

8. **Attachment Re-Hosting**: Download inbound files, store on R2 (5 MB max). Preserves files if platform deletes, faster via CDN.

---

## 🚀 Getting Started

1. **Understand the project**: Read this file + `.docs/05-quick-reference.md` (5 min each)
2. **Dive into your area**: 
   - **Frontend dev**: `.docs/02-api-and-data-model.md` (sections 1–5) + section 6 (WebSocket)
   - **Backend dev**: `.docs/02-api-and-data-model.md` + `.docs/03-implementation-guide.md`
   - **QA**: `.docs/04-qa-and-testing.md` + `.docs/01-product-specification.md` section 8
   - **Product owner**: `.docs/01-product-specification.md`
3. **Ask questions**: If anything is unclear, ask the architect (or relevant agent)

---

**Last Updated**: January 25, 2026  
**Status**: Phase 1 Development in Progress (BE-003 Complete, BE-004 Ready)  
**Questions?** See `.docs/05-quick-reference.md` → "Quick Links" section
