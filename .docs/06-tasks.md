# 06. Issues & User stories

**Last Updated**: February 14, 2026  
**Status**: ✅ Phase 1 COMPLETE; ✅ Phase 2 COMPLETE; ✅ MVP stage  
**Current focus**: Post-MVP backlog / hardening (GitHub Project is source of truth)  
**Governance**: ADR-003, ADR-014, ADR-015, GOV-026

---

## 1. Phase Scope (Authoritative)

**Phase 1 (Weeks 1-2) In scope:**
- Telegram + IRC integrations (inbound/outbound messaging)
- Unified inbox with filters and status lifecycle (open/pending/resolved)
- Authentication & RBAC (Super Admin/Admin/Manager/User)
- Messaging lifecycle (pending → sent/failed), retry queue (1m/5m/30m, 3 attempts), DLQ
- Real-time updates via WebSocket events (message.received/sent/failed, conversation.updated)

**Phase 2 (Weeks 3-4) In scope:**
- Collaboration: tags, notes, assignments
- Notifications (in-app): assignment + @mentions (persisted + WebSocket push)
- Routing rules: CRUD + evaluation (priority order, first-match-wins) + execution logs
- Bulk actions: assign/tag/status (max 100 per request, best-effort)

**Out of scope (Phase 2+ / future):**
- Platforms: WhatsApp, WeChat, Meta (FB/Instagram), X/Twitter
- Email notifications
- Multi-tenant support / credential vault
- Advanced analytics/reporting

**Enum policy:** Channel enums include future channels (email, slack, whatsapp, wechat, meta, x) for forward compatibility. Phase 1 UI filters must only show Telegram + IRC.

## 1.1 Phase 2 Developer Ask (Collaboration & Rules)

Build Phase 2 features end-to-end (backend + frontend) following `.docs/02-api-and-data-model.md` and the Phase 2 scope in `.docs/03-implementation-guide.md`.

**Pre-conditions**
- Phase 1.4 is stable enough to demo: login, inbox list/detail, send reply, WebSocket updates.

**Backend deliverables (API + side effects)**
- Tags: `GET /tags`, `POST /tags`, `POST /conversations/:id/tags`, `DELETE /conversations/:id/tags/:tagId` (audit + `conversation.updated`)
- Notes: `GET /conversations/:id/notes`, `POST /conversations/:id/notes` with `@username` mention parsing (creates notifications)
- Assignment: `POST /conversations/:id/assign` (creates notification to assignee; audit + `conversation.updated`)
- Notifications: `GET /notifications`, `PATCH /notifications/:id`, `DELETE /notifications/:id`, `POST /notifications/mark-all-read` and WebSocket `notification.received`
- Bulk actions: `POST /conversations/bulk` (max 100 IDs, best-effort response, emits `conversation.updated` for successful changes)
- Routing rules: `GET /routing-rules`, `POST /routing-rules`, `PATCH /routing-rules/:id`, `DELETE /routing-rules/:id`, `GET /routing-rules/:id/executions`
- Rule evaluation: run on inbound message ingestion; apply actions (assign/tag/priority); record `routing_rule_executions`; audit `rule.executed`; emit `conversation.updated`

**Frontend deliverables**
- Conversation right panel: tags (add/remove/create), notes (list/create with mentions), assignment (change assignee)
- Rules builder UI: routing rule CRUD (name/status/priority/conditions/actions)
- Notifications: handle `notification.received` and reflect unread state

**RBAC expectations (unless existing enforcement is already stricter)**
- Tags/notes/assign/bulk: `admin`, `manager`, `user`, `super_admin`
- Routing rules CRUD: `super_admin` only
- Notifications: users can only access their own notifications

**Recommendation (sequential tickets; keep PRs small and auditable)**
1) Backend tags (incl. conversation tag add/remove) + audit + `conversation.updated`
2) Backend notes + mention parsing + notifications + `notification.received`
3) Backend assignment + notification + audit + `conversation.updated`
4) Backend bulk actions (best-effort) + audit + `conversation.updated`
5) Backend routing rules CRUD + executions listing
6) Backend routing rules evaluation on inbound messages
7) Frontend right panel (tags/notes/assign) + thin E2E happy path
8) Frontend rules builder UI + thin E2E create/disable rule

**Definition of done (Phase 2)**
- Endpoints match `.docs/02-api-and-data-model.md` request/response shapes
- WebSocket emits `conversation.updated` and `notification.received` where applicable
- Audit logs created for tags/notes/assign/bulk/rules actions
- New logic has >= 85% unit/integration coverage; at least one Playwright flow proving tags/notes/assign updates from UI

---

## 2. Statement of Work (Phase 1)

### Scope & Objectives
Phase 1 delivers Telegram + IRC integrations, core inbox operations, authentication, messaging send/retry, real-time updates, and the audit logging foundation. The focus is to ship a stable MVP with essential workflows for ingesting inbound messages, replying from a unified UI, and managing conversations with role-based controls.

### Deliverables
1. **Backend API & Data Layer**
   - REST endpoints for auth, conversations, messages, and WebSocket gateway events
   - PostgreSQL schema and migrations (channel enums include future channels for forward compatibility)
   - Redis + BullMQ retry queue with 1m/5m/30m backoff
   - Cloudflare R2 scaffolding (client/config) to support Phase 3 attachments + raw payload storage
2. **Integrations**
   - Telegram connector (inbound + outbound)
   - IRC connector (inbound + outbound)
   - Connector health/status endpoints and admin configuration API
3. **Frontend**
   - Login/forgot/reset password flows
   - Inbox list with filters/search
   - Conversation detail view with reply composer
   - Real-time updates (WebSocket client)
   - Role-based UI visibility
4. **Governance & Documentation**
   - ADR-003 and GOV-006 confirming Phase 1 scope
   - Updated product, QA, implementation, and quick reference docs

### Acceptance Criteria
- **Telegram + IRC are live in Phase 1** (inbound + outbound)
- **Inbox operations are functional** (filters, status lifecycle)
- **Message lifecycle is correct** (pending → sent/failed, retry queue, DLQ)
- **Auth and RBAC operate correctly**
- **Real-time updates** via WebSocket events
- **Audit logging** of key actions
- **Governance alignment** with ADR-003/GOV-006/GOV-007

### Validation Checklist
- Authentication & RBAC (Super Admin/Admin/Manager/User)
- Inbox operations (filters, status lifecycle)
- Messaging (send/receive, status tracking, retry queue, DLQ)
- Telegram + IRC integrations (inbound/outbound)
- Real-time updates (WebSocket events)
- Audit logging (action log retained per Phase 1 requirements)


### Timeline (High-Level)
- **Duration:** 2 weeks total
- **Week 1:** Auth/RBAC, data model, inbox APIs, Telegram + IRC ingestion, UI skeleton
- **Week 2:** Messaging send/retry, real-time updates, integration testing, audit logging

---

## 3. Phase 1 Task List (Scope Validation + Execution)

**Scope Summary**
- **IN Phase 1**: Telegram + IRC integration with full messaging endpoints, WebSocket gateway, message retry queue
- **DEFERRED to Phase 2**: Additional platforms (WhatsApp, WeChat, Meta, X)
- **ENUMS**: Keep future channels (email, slack) for forward compatibility

### Scope Validation Tasks

| ID | Task | Status | Priority | Assignee | Dependencies | Acceptance Criteria | Project Item ID | Issue ID |
|----|------|--------|----------|----------|--------------|---------------------|-----------------|----------|
| SV-001 | Fix Phase 1 scope (Telegram + IRC; Phase 2 = WhatsApp/WeChat/Meta/X) | Completed | P0 | Product Owner | - | Phase 1 scope aligns to ADR-003/GOV-006/GOV-007; Architect review approved | PVTI_lAHOAB4wV84BNGcwzgj_5rA | 8 |
| SV-002 | Validate Phase 1 requirements in execution guide | Completed | P0 | Product Owner | SV-001 | Validation checklist covers all Phase 1 requirements; Phase 2 excluded | PVTI_lAHOAB4wV84BNGcwzgj_5sI | 9 |
| SV-003 | Update Phase 1 timeline (2 weeks) | Completed | P1 | Product Owner | SV-001 | Phase 1 timeline includes Telegram + IRC tasks; Phase 2 deferred | PVTI_lAHOAB4wV84BNGcwzgj_5r8 | 16 |

### Backend Tasks

| ID | Task | Status | Priority | Assignee | Dependencies | Acceptance Criteria | Project Item ID | Issue ID |
|----|------|--------|----------|----------|--------------|---------------------|-----------------|----------|
| BE-001 | Set up PostgreSQL database with Drizzle ORM | **Done** | P0 | Backend | - | Database connection working, Drizzle schema migrations functional | PVTI_lAHOAB4wV84BNGcwzgj_5rE | 12 |
| BE-002 | Define database schema (users, conversations, messages, tags, notes, audit logs, notifications, routing rules) | **Done** | P0 | Backend | BE-001 | All 11 tables defined with correct relationships, migrations generated | PVTI_lAHOAB4wV84BNGcwzgj_5rQ | 13 |
| BE-003 | Implement BetterAuth for authentication (email/password, session/JWT) | **Done** | P0 | Backend | BE-002 | Login endpoint working, JWT/session management functional, rate limiting added, 194 tests passing | PVTI_lAHOAB4wV84BNGcwzgj_5rc | 18 |
| BE-004 | Implement forgot password flow (reset token, email sending) | **Done** | P1 | Backend | BE-003 | POST /auth/forgot-password and /reset-password working | PVTI_lAHOAB4wV84BNGcwzgj_5sM | 19 |
| BE-005 | Implement RBAC middleware (4 roles: Super Admin, Admin, Manager, User) | **Done** | P0 | Backend | BE-002, BE-003 | Permission checks working for all role-based endpoints | PVTI_lAHOAB4wV84BNGcwzgj_5rU | 20 |
| BE-006 | Create user management endpoints (CRUD for users, roles) | Deferred (Post-MVP) | P1 | Backend | BE-005 | GET/POST/PUT/DELETE /users, /roles working with RBAC | PVTI_lAHOAB4wV84BNGcwzgj_5rk | 17 |
| BE-007 | Implement inbox API (GET /conversations with filters: channel, assignee, tag, status, priority) | **Done** (PR #227 merged) | P0 | Backend | BE-002, BE-005 | Filtering and pagination working ✅ | PVTI_lAHOAB4wV84BNGcwzgj_5sA | 14 |
| BE-008 | Implement conversation detail endpoint (GET /conversations/:id) | **Done** (PR #227 merged) | P0 | Backend | BE-007 | Returns conversation with messages and metadata ✅ | PVTI_lAHOAB4wV84BNGcwzgj_5rM | 15 |
| BE-009 | Implement message retrieval endpoint (GET /conversations/:id/messages) | **Done** (PR #240 merged) | P0 | Backend | BE-002, BE-008 | Returns paginated messages with direction (inbound/outbound) | PVTI_lAHOAB4wV84BNGcwzgj_5r4 | 10 |
| BE-010 | Implement send message endpoint (POST /conversations/:id/messages) | **Done** (PR #240 merged) | P0 | Backend | BE-008 | Queues message for delivery, returns pending status | PVTI_lAHOAB4wV84BNGcwzgj_5ro | 11 |
| BE-011 | Implement message status tracking (pending → sent/failed) | **Done** (PR #241) | P0 | Backend | BE-010 | Status updates working, database reflects delivery state | PVTI_lAHOAB4wV84BNGcwzgj_54c | 30 |
| BE-012 | Implement message retry endpoint (implemented under queue controller) | **Done** (PR #242 merged) | P1 | Backend | BE-011 | Retry endpoint available, requeues failed message, status returns to pending | PVTI_lAHOAB4wV84BNGcwzgj_54Q | 22 |
| BE-013 | Set up Redis + BullMQ for message retry queue | **Done** | P0 | Backend | - | Redis connection working, BullMQ jobs processing | PVTI_lAHOAB4wV84BNGcwzgj_55I | 23 |
| BE-014 | Implement exponential backoff for retries (1m, 5m, 30m; 3 attempts max) | **Done** (PR #242 merged) | P0 | Backend | BE-013 | Failed messages retried with correct backoff schedule | PVTI_lAHOAB4wV84BNGcwzgj_55A | 26 |
| BE-014A | Fix retry queue removal and backoff schedule alignment | **Done** (PR #242 merged) | P0 | Backend | BE-013 | removeFromQueue uses supported job lookup; backoff is 1m/5m/30m | PVTI_lAHOAB4wV84BNGcwzgldpko | 251 |
| BE-015 | Implement dead-letter queue (DLQ) for failed messages | **Done** (PR #242 merged) | P1 | Backend | BE-014 | Messages with 3 failed attempts moved to DLQ | PVTI_lAHOAB4wV84BNGcwzgkHa9k | 127 |
| BE-016 | Set up Socket.io WebSocket server | **Done** | P0 | Backend | - | WebSocket server running on configured port | PVTI_lAHOAB4wV84BNGcwzgkAl2c | 28 |
| BE-017 | Implement message.received event (push on inbound message) | **Done** | P0 | Backend | BE-016 | Event emitted when inbound message received | PVTI_lAHOAB4wV84BNGcwzgj_54o | 27 |
| BE-018 | Implement message.sent event (push on successful delivery) | **Done** | P0 | Backend | BE-016 | Event emitted when message status → sent | PVTI_lAHOAB4wV84BNGcwzgj_54g | 31 |
| BE-019 | Implement message.failed event (push on delivery failure) | **Done** | P0 | Backend | BE-016 | Event emitted when message status → failed | PVTI_lAHOAB4wV84BNGcwzgj_55M | 29 |
| BE-020 | Set up Cloudflare R2 storage for raw payloads and attachments | **Done** | P0 | Backend | - | R2 connection working, upload/download functional | PVTI_lAHOAB4wV84BNGcwzgkAlho | 106 |
| BE-021 | Implement raw payload storage (store inbound platform payloads, 7-day retention) | Deferred (Post-MVP) | P1 | Backend | BE-020 | Payloads stored, scheduled cleanup working | PVTI_lAHOAB4wV84BNGcwzgj_54I | 24 |
| BE-022 | Implement raw payload retrieval endpoint (GET /messages/:id/raw-payload, manager+ only) | Deferred (Post-MVP) | P1 | Backend | BE-021, BE-005 | Endpoint working with RBAC, audit-logged | PVTI_lAHOAB4wV84BNGcwzgj_54U | 21 |
| BE-023 | Implement attachment download and re-host (inbound files to R2, max 5 MB) | Not Started | P1 | Backend | BE-020 | Files downloaded from IRC, stored on R2, URLs returned | PVTI_lAHOAB4wV84BNGcwzgj_548 | 25 |
| BE-024 | Implement audit logging (all actions: assignments, tags, notes, status changes, rule executions, retries) | Not Started | P1 | Backend | BE-002 | All actions logged with actor, action, entity_type, entity_id, timestamp | PVTI_lAHOAB4wV84BNGcwzgj_54s | 33 |
| BE-025 | Set up email service (MVP implementation) | **Done** | P2 | Backend | - | Password reset email integration wired for MVP | PVTI_lAHOAB4wV84BNGcwzgkAlhg | 105 |

| BE-026 | Create environment configuration scaffolding | Not Started | P0 | Backend | - | Centralized env config with validation; app boots cleanly | PVTI_lAHOAB4wV84BNGcwzgkAlhs | 108 |

### Code Review Tasks (Phase 1.4)

| ID | Task | Status | Priority | Assignee | Dependencies | Acceptance Criteria | Project Item ID | Issue ID |
|----|------|--------|----------|----------|--------------|---------------------|-----------------|----------|
| BE-203 | Add observability to conversation endpoints (correlation IDs, request timing) | **Done** | P0 | Backend | BE-007-010 | Structured logging with correlation IDs, request timing (ms) on all conversation endpoints | PVTI_lAHOAB4wV84BNGcwzgj_5sA | 200 |
| BE-204 | Enforce RBAC on all conversation endpoints (@Authorized decorators) | **Done** | P0 | Backend | BE-005, BE-007 | All endpoints require authentication, role-based access control enforced | PVTI_lAHOAB4wV84BNGcwzgj_5rU | 201 |
| BE-205 | Verify type safety - remove 'any' types from conversation service | **Done** | P0 | Backend | BE-007-010 | Zero 'any' types, type guards implemented for null checks, full TypeScript safety | PVTI_lAHOAB4wV84BNGcwzgj_5sA | 202 |

### Development Hygiene Tasks

| ID | Task | Status | Priority | Assignee | Dependencies | Acceptance Criteria | Project Item ID | Issue ID |
|----|------|--------|----------|----------|--------------|---------------------|-----------------|----------|
| DEV-001a | Fix config file duplicate exports (r2.ts, redis.ts, email.ts, logging.ts) | Not Started | P0 | Backend | - | No duplicate exports; TypeScript build and tests pass | PVTI_lAHOAB4wV84BNGcwzgldpQI | 173 |
| DEV-001b | Fix messageRetryWorker.ts import paths and module references | Not Started | P0 | Backend | DEV-001a | Worker imports resolved; tests pass | PVTI_lAHOAB4wV84BNGcwzgldpQ4 | 174 |
| DEV-001c | Fix TypeScript moduleResolution and tsconfig issues | Not Started | P0 | Backend | DEV-001a | TypeScript config consistent across packages; no resolution errors | PVTI_lAHOAB4wV84BNGcwzgldpRI | 175 |
| DEV-001d | Standardize logger usage across backend config files | Not Started | P0 | Backend | DEV-001c | Logging uses approved patterns; no console logging in config/infrastructure | PVTI_lAHOAB4wV84BNGcwzgldpRU | 176 |

### Frontend Tasks

| ID | Task | Status | Priority | Assignee | Dependencies | Acceptance Criteria | Project Item ID | Issue ID |
|----|------|--------|----------|----------|--------------|---------------------|-----------------|----------|
| FE-001 | Set up TanStack Start project with React 18 | **Done** | P0 | Frontend | - | Project scaffold created, dev server running | PVTI_lAHOAB4wV84BNGcwzgj_6Ek | 43 |
| FE-002 | Configure Tailwind CSS with Williamstown SC brand colors | **Done** | P0 | Frontend | FE-001 | Tailwind working, brand colors defined | PVTI_lAHOAB4wV84BNGcwzgj_6Eg | 40 |
| FE-003 | Set up Zustand for client state management | **Done** | P0 | Frontend | FE-001 | Store configured, example state working | PVTI_lAHOAB4wV84BNGcwzgj_6Ew | 37 |
| FE-004 | Set up TanStack Query for API data fetching | **Done** | P0 | Frontend | FE-001 | Query client configured, API requests working | PVTI_lAHOAB4wV84BNGcwzgj_6E0 | 38 |
| FE-005 | Implement login page (email/password form) | **Done** | P0 | Frontend | FE-002, BE-003 | Login functional, redirects on success, error handling working | PVTI_lAHOAB4wV84BNGcwzgj_6EI | 42 |
| FE-006 | Implement forgot password page (email input form) | Not Started | P1 | Frontend | FE-002, BE-004 | Request reset working, confirmation message shown | PVTI_lAHOAB4wV84BNGcwzgj_6EU | 45 |
| FE-007 | Implement password reset page (new password form) | Not Started | P1 | Frontend | FE-002, BE-004 | Password reset functional, login redirect on success | PVTI_lAHOAB4wV84BNGcwzgj_6EM | 39 |
| FE-008 | Implement inbox list page (conversation cards with filters) | **Done** (PR #243 merged) | P0 | Frontend | FE-004, BE-007 | Filters: channel, assignee, tag, status, priority, search, date range | PVTI_lAHOAB4wV84BNGcwzgj_6Eo | 35 |
| FE-009 | Implement conversation detail page (messages timeline, reply composer) | **Done** (PR #243 merged) | P0 | Frontend | FE-004, BE-008 | Shows conversation with messages, reply form functional | PVTI_lAHOAB4wV84BNGcwzgj_6D0 | 41 |
| FE-010 | Implement message reply composer (text input, attachment upload) | **Done** (PR #243 merged) | P0 | Frontend | FE-009, BE-010 | Send message working, attachment upload to R2 | PVTI_lAHOAB4wV84BNGcwzgj_6E8 | 46 |
| FE-011 | Implement message status display (pending/sent/failed with retry button) | Not Started | P0 | Frontend | FE-009, BE-011 | Status icons visible, retry button for failed messages | PVTI_lAHOAB4wV84BNGcwzgj_6EY | 44 |
| FE-012 | Set up Socket.io client for WebSocket | **Done** (PR #244 merged) | P0 | Frontend | - | Socket.io client connected to server | PVTI_lAHOAB4wV84BNGcwzgj_6EE | 36 |
| FE-013 | Implement message.received event listener (real-time inbox update) | **Done** (PR #244 merged) | P0 | Frontend | FE-012, BE-017 | New inbound messages appear in inbox without refresh | PVTI_lAHOAB4wV84BNGcwzgj_9W0 | 51 |
| FE-014 | Implement message.sent event listener (update message status in UI) | **Done** (PR #244 merged) | P0 | Frontend | FE-012, BE-018 | Message status changes to sent in real-time | PVTI_lAHOAB4wV84BNGcwzgj_6NU | 58 |
| FE-015 | Implement message.failed event listener (show failed status) | **Done** (PR #244 merged) | P0 | Frontend | FE-012, BE-019 | Failed messages updated in UI, retry button appears | PVTI_lAHOAB4wV84BNGcwzgj_6MI | 49 |
| FE-012A | Implement WebSocket client with one-definition-per-file structure | Deferred | P0 | Frontend | FE-012, GOV-005 | Follow GOV-005 guidance for constants, types, and service file structure. Blocked: WebSocket client not implemented yet | PVTI_lAHOAB4wV84BNGcwzgldplA | 252 |
| FE-012B | Implement WebSocket client observability (metrics, traces, SLO) | Deferred | P0 | Frontend | FE-012, GOV-005 | Emit all required metrics per GOV-005; define SLOs in governance log. Blocked: WebSocket client not implemented yet | PVTI_lAHOAB4wV84BNGcwzgldplY | 253 |
| FE-016 | Implement admin panel - IRC configuration (server, port, username, password inputs) | Not Started | P0 | Frontend | FE-002, BE-026 | Form to save IRC credentials, validation working | PVTI_lAHOAB4wV84BNGcwzgj_6No | 54 |
| FE-017 | Implement IRC connection test button (connects to server, shows success/error) | Not Started | P0 | Frontend | FE-016, BE-027 | Button triggers test, displays result message | PVTI_lAHOAB4wV84BNGcwzgj_6Nk | 66 |
| FE-018 | Implement IRC connection status display (connected/retrying/disconnected) | Not Started | P0 | Frontend | FE-016 | Status badge visible in admin panel, updates in real-time | PVTI_lAHOAB4wV84BNGcwzgj_6MA | 47 |
| FE-019 | Implement admin panel - users list (table with email, role, status, edit/delete actions) | Not Started | P1 | Frontend | FE-002, BE-006 | Users table functional, CRUD operations working with RBAC | PVTI_lAHOAB4wV84BNGcwzgj_6L4 | 52 |
| FE-020 | Implement authentication guards (redirect to login if unauthenticated) | Not Started | P0 | Frontend | FE-005 | Protected pages redirect unauthenticated users | PVTI_lAHOAB4wV84BNGcwzgj_6NM | 48 |
| FE-021 | Implement role-based UI (hide admin features from non-admin users) | Not Started | P1 | Frontend | FE-020 | Admin panel only visible to Super Admin/Admin | PVTI_lAHOAB4wV84BNGcwzgj_6Ng | 56 |

### Shared Tasks

| ID | Task | Status | Priority | Assignee | Dependencies | Acceptance Criteria | Project Item ID | Issue ID |
|----|------|--------|----------|----------|--------------|---------------------|-----------------|----------|
| SH-001 | Define TypeScript types for core entities (User, Conversation, Message, Tag, Note, Notification, RoutingRule, AuditLog) | Not Started | P0 | Architect | BE-002 | All types defined in packages/common/src/types/ | PVTI_lAHOAB4wV84BNGcwzgj_8cg | 83 |
| SH-002 | Define API request/response types (conversations, messages, auth, users, IRC config) | Not Started | P0 | Architect | SH-001 | All API types defined, imported by backend and frontend | PVTI_lAHOAB4wV84BNGcwzgj_83I | 74 |
| SH-003 | Define WebSocket event types (message.received, message.sent, message.failed) | Not Started | P0 | Architect | SH-001 | Event types defined with payloads | PVTI_lAHOAB4wV84BNGcwzgj_6hE | 76 |
| SH-004 | Create Zod schemas for request validation (auth, conversations, messages, IRC config) | Not Started | P1 | Architect | SH-002 | All schemas created, export for backend validation | PVTI_lAHOAB4wV84BNGcwzgj_6g8 | 78 |
| SH-005 | Set up shared package exports in packages/common/src/index.ts | Not Started | P0 | Architect | SH-001, SH-002, SH-003 | All types and schemas exported correctly | PVTI_lAHOAB4wV84BNGcwzgj_6hA | 81 |

| SH-006 | Organize DTOs by feature folders | Not Started | P1 | Architect | SH-001 | DTOs grouped by feature; no barrel export regressions | PVTI_lAHOAB4wV84BNGcwzgkHUZM | 126 |

### Integration Tasks (IRC)

| ID | Task | Status | Priority | Assignee | Dependencies | Acceptance Criteria | Project Item ID | Issue ID |
|----|------|--------|----------|----------|--------------|---------------------|-----------------|----------|
| INT-001 | Create IRC connector (server connection, authentication, channel joins) | **Done** (PR #254 merged) | P0 | Backend | BE-001 | Connects to IRC server, authenticates, joins configured channels | PVTI_lAHOAB4wV84BNGcwzgkHa_U | 128 |
| INT-002 | Implement IRC message ingestion (inbound messages → inbox) | **Done** (PR #257 merged) | P0 | Backend | BE-002, INT-001 | Inbound messages create conversations/messages in DB; WebSocket `message.received` backlog-aware; tests passing | PVTI_lAHOAB4wV84BNGcwzgkHbAU | 129 |
| INT-003 | Implement IRC message delivery (outbound messages → IRC channel) | Ready | P0 | Backend | BE-010, INT-001 | Messages sent to IRC channel, status updated to sent/failed | PVTI_lAHOAB4wV84BNGcwzgkHbB4 | 130 |
| INT-004 | Implement IRC auto-reconnect with exponential backoff (1s → 60s max, 5 attempts) | Not Started | P0 | Backend | INT-001 | Disconnects trigger reconnect attempts with backoff | PVTI_lAHOAB4wV84BNGcwzgj_824 | 60 |
| INT-005 | Implement IRC connection status tracking (connected/retrying/disconnected) | Not Started | P0 | Backend | INT-004 | Status stored in DB, exposed via WebSocket | PVTI_lAHOAB4wV84BNGcwzgj_6NE | 59 |
| INT-006 | Create IRC configuration endpoint (POST /integrations/irc/config) | Not Started | P0 | Backend | BE-005 | Saves server, port, username, password to env/db | PVTI_lAHOAB4wV84BNGcwzgj_6MQ | 53 |
| INT-007 | Create IRC connect endpoint (POST /integrations/irc/connect) | Not Started | P0 | Backend | INT-006 | Initiates IRC connection, returns connection status | PVTI_lAHOAB4wV84BNGcwzgj_6Mk | 50 |
| INT-008 | Create IRC connection test endpoint (POST /integrations/irc/test) | Not Started | P0 | Backend | INT-007 | Attempts connection, returns success/failure response | PVTI_lAHOAB4wV84BNGcwzgj_6MY | 55 |
| INT-009 | Implement IRC connection status endpoint (GET /integrations/irc/status) | Not Started | P0 | Backend | INT-005 | Returns current connection status | PVTI_lAHOAB4wV84BNGcwzgj_6Mc | 57 |
| INT-010 | Implement IRC environment variable management (store credentials securely) | Not Started | P1 | Backend | INT-006 | Credentials loaded from env vars on startup | PVTI_lAHOAB4wV84BNGcwzgj_6Mo | 61 |
| INT-011 | Map IRC channels to conversations (one conversation per channel) | Not Started | P0 | Backend | INT-002, BE-002 | Channel joins create/update conversations, external_thread_id = channel name | PVTI_lAHOAB4wV84BNGcwzgj_6M4 | 65 |
| INT-012 | Handle IRC connection errors (logging, DLQ for failed messages) | Not Started | P1 | Backend | INT-001, BE-015 | Connection errors logged, failed messages moved to DLQ | PVTI_lAHOAB4wV84BNGcwzgj_6NY | 64 |
| INT-013 | Write unit tests for IRC connector (connection, authentication, message handling) | Not Started | P1 | Backend | INT-003 | 90%+ coverage for IRC connector | PVTI_lAHOAB4wV84BNGcwzgj_6M0 | 62 |
| INT-014 | Write integration tests for IRC connector (mock IRC server) | Not Started | P1 | Backend | INT-003 | End-to-end message flow tested | PVTI_lAHOAB4wV84BNGcwzgj_6Nw | 63 |

### QA Handoff Tasks

| ID | Task | Status | Priority | Assignee | Dependencies | Acceptance Criteria | Project Item ID | Issue ID |
|----|------|--------|----------|----------|--------------|---------------------|-----------------|----------|
| QA-001 | Create test cases for authentication (login, logout, forgot password, reset password) | Not Started | P1 | QA | BE-004 | All ACs from 01-product-specification.md covered | PVTI_lAHOAB4wV84BNGcwzgj_8jw | 84 |
| QA-002 | Create test cases for RBAC (role permissions, access control) | Not Started | P1 | QA | BE-005 | All 4 roles tested, permission matrix validated | PVTI_lAHOAB4wV84BNGcwzgj_6gc | 79 |
| QA-003 | Create test cases for inbox (filters, search, pagination, sorting) | Not Started | P1 | QA | BE-007 | All filter combinations tested | PVTI_lAHOAB4wV84BNGcwzgj_6gA | 75 |
| QA-004 | Create test cases for messaging (send, receive, status tracking, retry) | Not Started | P1 | QA | BE-012 | Full message lifecycle tested | PVTI_lAHOAB4wV84BNGcwzgj_8Os | 70 |
| QA-005 | Create test cases for IRC integration (connect, disconnect, inbound/outbound messages) | Not Started | P1 | QA | INT-004 | All IRC requirements tested | PVTI_lAHOAB4wV84BNGcwzgj_6hQ | 71 |
| QA-006 | Create test cases for WebSocket events (message.received, message.sent, message.failed) | Not Started | P1 | QA | BE-019 | Real-time updates verified | PVTI_lAHOAB4wV84BNGcwzgj_8Ow | 68 |
| QA-007 | Create test cases for message retry queue (backoff, DLQ, 3 attempts) | Not Started | P1 | QA | BE-015 | Retry behavior tested | PVTI_lAHOAB4wV84BNGcwzgj_6gw | 85 |
| QA-008 | Create test cases for raw payload storage (manager+ access, 7-day retention) | Not Started | P1 | QA | BE-022 | RBAC and retention verified | PVTI_lAHOAB4wV84BNGcwzgj_6g0 | 73 |
| QA-009 | Create test cases for attachments (download/re-host, 5 MB limit, R2 storage) | Not Started | P1 | QA | BE-023 | File handling tested, size limit enforced | PVTI_lAHOAB4wV84BNGcwzgj_6gQ | 82 |
| QA-010 | Implement Playwright E2E tests for happy path (login → inbox → send message) | Not Started | P1 | QA | FE-010 | Automated test suite for core user flow | PVTI_lAHOAB4wV84BNGcwzgj_6g4 | 86 |
| QA-011 | Implement Playwright E2E tests for IRC admin panel (config, test connection, status) | Not Started | P1 | QA | FE-018 | Automated test suite for IRC configuration | PVTI_lAHOAB4wV84BNGcwzgj_6f0 | 77 |
| QA-012 | Create regression test suite (12 critical tests, run on every PR) | Not Started | P0 | QA | QA-010, QA-011 | Regression suite automated in CI/CD | PVTI_lAHOAB4wV84BNGcwzgj_6gI | 80 |

### Documentation Tasks

| ID | Task | Status | Priority | Assignee | Dependencies | Acceptance Criteria | Project Item ID | Issue ID |
|----|------|--------|----------|----------|--------------|---------------------|-----------------|----------|
| DOC-001 | Update Phase 1 scope (Telegram + IRC; Phase 2 = WhatsApp/WeChat/Meta/X) | Completed | P0 | Product Owner | SV-001 | Phase 1 scope aligned; Architect review approved | PVTI_lAHOAB4wV84BNGcwzgj_6gY | 69 |
| DOC-002 | Update 02-api-and-data-model.md with IRC-specific endpoints | Not Started | P1 | Backend | INT-009 | IRC endpoints documented with request/response examples | PVTI_lAHOAB4wV84BNGcwzgj_6f8 | 72 |
| DOC-003 | Update 03-implementation-guide.md with IRC connector architecture | Not Started | P1 | Backend | INT-001 | IRC integration documented in architecture section | PVTI_lAHOAB4wV84BNGcwzgj_9kw | 67 |
| DOC-004 | Create IRC integration guide (setup, configuration, troubleshooting) | Not Started | P1 | Backend | INT-004 | Step-by-step guide for connecting IRC to YACC | PVTI_lAHOAB4wV84BNGcwzgj_6hc | 87 |
| DOC-005 | Update 05-quick-reference.md with Phase 1 endpoint list | Not Started | P1 | Product Owner | BE-025 | All Phase 1 endpoints listed in quick reference | PVTI_lAHOAB4wV84BNGcwzgj_7Ew | 98 |
| DOC-006 | Create API documentation (OpenAPI/Swagger for all Phase 1 endpoints) | Not Started | P2 | Backend | BE-025 | API docs generated, hosted | PVTI_lAHOAB4wV84BNGcwzgj_7Eo | 93 |
| DOC-007 | Create environment variables reference (IRC, R2, Redis, DB) | Not Started | P1 | Backend | INT-010 | All env vars documented with descriptions | PVTI_lAHOAB4wV84BNGcwzgj_7Ek | 91 |
| DOC-008 | Create deployment guide for Phase 1 (Docker setup, env vars, migrations) | Not Started | P1 | Backend | BE-025 | Step-by-step deployment instructions | PVTI_lAHOAB4wV84BNGcwzgj_7Es | 102 |
| DOC-009 | Add governance log entry for PR #131 blocker fixes | Completed | P0 | Architect | DEV-131-03, DEV-131-04 | GOV-004 created with compliance checklist and Mermaid diagram |  |  |
| DOC-010 | Create WebSocket client implementation guidance (GOV-005) | Completed | P0 | Architect | DEV-131-05, DEV-131-06 | GOV-005 created with one-definition-per-file rules and observability requirements |  |  |

### Handoff Tasks

| ID | Task | Status | Priority | Assignee | Dependencies | Acceptance Criteria | Project Item ID | Issue ID |
|----|------|--------|----------|----------|--------------|---------------------|-----------------|----------|
| HD-001 | Create Docker Compose configuration (PostgreSQL, Redis, R2 local/minio) | Not Started | P0 | Backend | BE-001, BE-013, BE-020 | All services running via docker compose up | PVTI_lAHOAB4wV84BNGcwzgj_7D0 | 103 |
| HD-002 | Create production Docker image for backend (multi-stage build) | Not Started | P0 | Backend | BE-025 | Docker image builds and runs correctly | PVTI_lAHOAB4wV84BNGcwzgj_8js | 88 |
| HD-003 | Create production Docker image for frontend (static build for S3) | Not Started | P0 | Frontend | FE-021 | Docker image generates static build | PVTI_lAHOAB4wV84BNGcwzgj_7EA | 99 |
| HD-004 | Create database migration scripts (Drizzle migrations) | Not Started | P0 | Backend | BE-002 | Migrations tested, reversible | PVTI_lAHOAB4wV84BNGcwzgj_8O8 | 101 |
| HD-005 | Set up CI/CD pipeline (GitHub Actions for tests, lint, build) | Not Started | P1 | Architect | QA-012 | Automated pipeline passing on PRs | PVTI_lAHOAB4wV84BNGcwzgj_7D4 | 94 |
| HD-006 | Create production environment template (env.example with all variables) | Not Started | P0 | Backend | DOC-007 | Template includes IRC, R2, Redis, DB variables | PVTI_lAHOAB4wV84BNGcwzgj_7EU | 96 |
| HD-007 | Perform security review (env vars, RBAC, input validation) | Not Started | P1 | Architect | BE-005 | No critical vulnerabilities found | PVTI_lAHOAB4wV84BNGcwzgj_7Dc | 95 |
| HD-008 | Deploy Phase 1 to staging environment | Not Started | P0 | Backend | HD-001, HD-002 | Staging environment functional | PVTI_lAHOAB4wV84BNGcwzgj_7EI | 97 |
| HD-009 | Run QA regression suite on staging environment | Not Started | P0 | QA | HD-008 | All regression tests passing | PVTI_lAHOAB4wV84BNGcwzgj_8Pk | 90 |
| HD-010 | Create Phase 1 handoff notes (known issues, next steps, dependencies) | Not Started | P1 | Product Owner | HD-009 | Handoff document created, reviewed by team | PVTI_lAHOAB4wV84BNGcwzgj_8Ps | 92 |
| HD-011 | Schedule Phase 2 planning meeting (Telegram integration, search, attachments) | Not Started | P1 | Product Owner | HD-010 | Meeting scheduled, agenda prepared | PVTI_lAHOAB4wV84BNGcwzgj_7EY | 100 |
| HD-012 | Archive Phase 1 artifacts (specs, test results, deployment logs) | Not Started | P2 | Product Owner | HD-011 | All artifacts archived in project repository | PVTI_lAHOAB4wV84BNGcwzgj_7Dk | 89 |

### Execution Tracking (Historical)

| ID | Task | Status | Priority | Assignee | Dependencies | Acceptance Criteria | Project Item ID | Issue ID |
|----|------|--------|----------|----------|--------------|---------------------|-----------------|----------|
| WEEK-1 | Phase 1 Week 1: Foundation (Days 1-5) | Open (cleanup) | P2 | Product Owner | - | Historical tracking issue closed or superseded | PVTI_lAHOAB4wV84BNGcwzgkAsF4 | 110 |

### GitHub Backlog Items (GH)

| ID | Task | Status | Priority | Assignee | Dependencies | Acceptance Criteria | Project Item ID | Issue ID |
|----|------|--------|----------|----------|--------------|---------------------|-----------------|----------|
| GH-032 | Implement health check endpoint (legacy numbering mismatch) | Not Started | P2 | Backend | - | Health endpoint exists; smoke tests pass | PVTI_lAHOAB4wV84BNGcwzgj_54k | 32 |
| GH-034 | Label setup required | Not Started | P2 | Architect | - | Repo labels defined and consistent | PVTI_lAHOAB4wV84BNGcwzgj_59g | 34 |
| GH-112 | UUID refactor incomplete for tags/raw_payloads/routing_rule_executions | Not Started | P1 | Backend | - | UUID refactor complete; schema + migrations consistent | PVTI_lAHOAB4wV84BNGcwzgkERi0 | 112 |
| GH-117 | Audit logs entity_id must accept non-UUID IDs | Not Started | P1 | Backend | - | Audit logs handle non-UUID entity IDs | PVTI_lAHOAB4wV84BNGcwzgkEbhI | 117 |
| GH-118 | Clarify audit_logs scope to conversation-only | Not Started | P2 | Architect | - | Scope decision recorded; docs updated | PVTI_lAHOAB4wV84BNGcwzgkEc-Y | 118 |
| GH-119 | Align audit logs to conversation-only scope | Not Started | P2 | Backend | GH-118 | Implementation matches scope decision | PVTI_lAHOAB4wV84BNGcwzgkEeHw | 119 |
| GH-120 | Align audit log scope to conversations | Not Started | P2 | Backend | GH-118 | Implementation matches scope decision | PVTI_lAHOAB4wV84BNGcwzgkEefE | 120 |
| GH-137 | PR 131 missing blocker fixes | Not Started | P2 | Architect | - | Blockers resolved or issue closed | PVTI_lAHOAB4wV84BNGcwzgldpzQ | 137 |
| GH-138 | Split ADR-003 refactor moves out of PR #131 | Not Started | P2 | Architect | - | Refactor split or issue closed | PVTI_lAHOAB4wV84BNGcwzgldpzY | 138 |
| GH-139 | FE-012: WebSocket constants violate one-definition-per-file rule | Not Started | P2 | Frontend | - | Constants refactored to comply | PVTI_lAHOAB4wV84BNGcwzgldpzk | 139 |
| GH-140 | FE-012: PR #131 missing required fixes and governance artifacts | Not Started | P2 | Architect | - | Governance artifacts complete or issue closed | PVTI_lAHOAB4wV84BNGcwzgldpzw | 140 |
| GH-141 | FE-012: Unrelated changes detected in PR #131 | Not Started | P2 | Architect | - | Unrelated changes removed or issue closed | PVTI_lAHOAB4wV84BNGcwzgldpz8 | 141 |
| GH-164 | P0: Fix @yacc/common type-check failures (schema filename casing duplicates) | Not Started | P0 | Backend | - | Type-check passes; casing duplicates eliminated | PVTI_lAHOAB4wV84BNGcwzgldp0M | 164 |
| GH-165 | P0: Backend architecture alignment (remove wrapper/DI patterns, fix logger + auth wiring) | Not Started | P0 | Backend | - | Backend matches architecture constraints | PVTI_lAHOAB4wV84BNGcwzgldp0U | 165 |
| GH-166 | P0: Eliminate 'any' usage in backend (enforce no-any standard) | Not Started | P0 | Backend | - | No `any` in backend; lint/type checks enforce | PVTI_lAHOAB4wV84BNGcwzgldp0c | 166 |
| GH-167 | P0: Eliminate 'any' usage in frontend (enforce no-any standard) | Not Started | P0 | Frontend | - | No `any` in frontend; lint/type checks enforce | PVTI_lAHOAB4wV84BNGcwzgldp0s | 167 |
| GH-168 | P0: Remove barrel exports (index.ts) and enforce direct file imports | Not Started | P0 | Backend | - | Barrel exports removed; import rules enforced | PVTI_lAHOAB4wV84BNGcwzgldp1A | 168 |
| GH-169 | P1: Remove package-lock.json (pnpm is the only supported package manager) | Not Started | P1 | Architect | - | package-lock removed; docs enforce pnpm only | PVTI_lAHOAB4wV84BNGcwzgldp1Q | 169 |
| GH-170 | P1: Stop tracking test env secrets file (packages/backend/.env.test) | Not Started | P1 | Backend | - | Secrets removed from git; docs updated | PVTI_lAHOAB4wV84BNGcwzgldp1w | 170 |
| GH-171 | P1: Replace console logging with pino + redact PII | Not Started | P1 | Backend | - | Console logs removed; PII redaction enabled | PVTI_lAHOAB4wV84BNGcwzgldp2E | 171 |
| GH-172 | P2/ADR: Decide frontend auth token storage strategy (localStorage vs HttpOnly cookie) | Not Started | P2 | Architect | - | ADR created; implementation aligned | PVTI_lAHOAB4wV84BNGcwzgldp2U | 172 |
| GH-180 | PR 179: Documentation status mismatch and missing governance log | Not Started | P2 | Architect | - | Governance correct or issue closed | PVTI_lAHOAB4wV84BNGcwzgldp2Y | 180 |
| GH-181 | PR 179: Mandatory planning index deleted | Not Started | P2 | Architect | - | Planning index restored or issue closed | PVTI_lAHOAB4wV84BNGcwzgldp2w | 181 |
| GH-182 | PR 179: routing-controllers middleware registered via app.use | Not Started | P2 | Backend | - | Middleware registration aligns with ADRs | PVTI_lAHOAB4wV84BNGcwzgldp28 | 182 |
| GH-195 | QA-001: Integration Tests for BE-007-010 | Not Started | P1 | QA | - | Integration tests implemented and passing | PVTI_lAHOAB4wV84BNGcwzglA41c | 195 |
| GH-196 | QA-002: E2E Tests for FE-008-011 (Inbox & Messaging) | Not Started | P1 | QA | - | E2E tests implemented and passing | PVTI_lAHOAB4wV84BNGcwzglA41o | 196 |
| GH-197 | QA-003: Real-Time Integration Tests (WebSocket) | Not Started | P1 | QA | - | Real-time tests implemented and passing | PVTI_lAHOAB4wV84BNGcwzglA41w | 197 |
| GH-199 | BE-007 PR: Align /conversations response contract between backend and frontend | Not Started | P2 | Backend | - | Contract consistent between FE/BE | PVTI_lAHOAB4wV84BNGcwzgldp3E | 199 |
| GH-203 | BE-007 PR: Add observability (logs/metrics/traces) for new conversation endpoints | Not Started | P2 | Backend | - | Observability meets ADR-004 | PVTI_lAHOAB4wV84BNGcwzgldp3g | 203 |
| GH-204 | BE-007 PR: Use explicit HTTP errors for validation in sendMessage | Not Started | P2 | Backend | - | Validation errors return explicit HTTP errors | PVTI_lAHOAB4wV84BNGcwzgldp30 | 204 |
| GH-205 | Migrate websocket connectors to socket-controllers | Not Started | P2 | Backend | - | Connectors use socket-controllers pattern | PVTI_lAHOAB4wV84BNGcwzgldp4E | 205 |
| GH-206 | Clarify auth endpoint prefix decision (BetterAuth) | Not Started | P2 | Architect | - | Prefix decision recorded; docs aligned | PVTI_lAHOAB4wV84BNGcwzgldp4Y | 206 |
| GH-207 | Enforce /api prefix on all REST endpoints (health excluded) | Not Started | P2 | Architect | - | Decision recorded; implementation consistent | PVTI_lAHOAB4wV84BNGcwzgldp40 | 207 |

### Success Criteria & Next Steps

1) All P0 tasks completed
2) All P0 and P1 QA tests passing
3) Telegram + IRC integration end-to-end working
4) Authentication and RBAC fully functional
5) Inbox with filters and search operational
6) Message send/receive with status tracking working
7) WebSocket real-time updates functional
8) Message retry queue with DLQ operational
9) Deployment to staging environment successful
10) Phase 1 scope aligned to ADR-003/GOV-006/GOV-007

---

## 4. Testing Execution Guide (Condensed)

For detailed test strategy and acceptance criteria, see `.docs/04-qa-and-testing.md`.

### Quick Start
- Backend running at `http://localhost:3000`
- PostgreSQL initialized and migrations applied
- Redis running for retry queue

### Test Data Setup (Summary)
- Create test users (admin, manager, agent, support)
- Login and capture JWT tokens
- Seed conversations and tags for Telegram + IRC

### Automated Testing
- Backend: `npm test` in `packages/backend`
- Frontend E2E: `npm test` in `packages/frontend` (Playwright)

### Performance Checks
- List conversations latency < 500ms for typical queries
- Pagination limits validated for 10/50/100 records

### Common Issues
- 401 errors: verify token and role
- DB errors: check migrations and DATABASE_URL
- CORS: verify FRONTEND_URL in backend config

### Regression Suite
- Run regression suite before staging release
- Ensure critical flows: login → inbox → view conversation → reply

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
| **BE-028** | Create shared types package | **Done** | None | 1 |
| **BE-026** | Create environment configuration scaffolding | **Ready** | None | 1 |
| **BE-001** | Set up PostgreSQL + Drizzle ORM | **Done** | None | 1 |
| **BE-002** | Define database schema (11 tables) | **Done** | BE-001 | 1 |
| **BE-027** | Set up structured logging infrastructure | **Ready** | BE-026 | 1 |
| **BE-020** | Set up Cloudflare R2 storage | **Ready** | None | 1 |
| **BE-025** | Set up email service (Nodemailer/SendGrid) | **Ready** | BE-026 | 1 |
| **BE-003** | Implement BetterAuth for authentication | **Ready** | BE-002, BE-025 | 1 |
| **BE-004** | Implement forgot password flow | **Ready** | BE-003, BE-025 | 1 |
| **BE-005** | Implement RBAC middleware | **Ready** | BE-002, BE-003 | 1 |
| **BE-016** | Set up Socket.io WebSocket server | **Ready** | BE-003, BE-026 | 1 |
| **BE-013** | Set up Redis + BullMQ for message retry queue | **Done** | None | 2 |
| **BE-007** | Implement inbox API | **Done** (PR #227 merged) | BE-002, BE-005 | 2 |
| **BE-008** | Implement conversation detail endpoint | **Done** (PR #227 merged) | BE-007 | 2 |
| **BE-009** | Implement message retrieval endpoint | **Done** (PR #240 merged) | BE-002, BE-003, BE-008 | 2 |
| **BE-010** | Implement send message endpoint | **Done** (PR #240 merged) | BE-008, BE-013, BE-020 | 2 |
| **BE-014** | Implement exponential backoff for retries | **Done** (PR #242 merged) | BE-013 | 3 |
| **BE-011** | Implement message status tracking | **Done** (PR #241) | BE-010 | 3 |
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
