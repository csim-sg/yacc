# 06. Issues & User stories

**Last Updated**: February 25, 2026  
**Phase 1 Status**: ✅ **COMPLETE** (100% feature deliverables merged to `dev`)  
**Phase 2 Status**: 🚧 **EA-APPROVED** (ready for 2026-03-05 kickoff; see Section 2 below)
**Outstanding P0/P1 Tasks**: See Section 3 for categorization
  - ✅ 0 Phase 1 features remain
  - 🔄 6 post-MVP planning tasks (deferred, EA-gated)
  - 🧪 3 QA automation tasks (non-blocking for feature completion)

**Key Governance**: ADR-003, ADR-005, GOV-006, GOV-033 (Phase 1 complete), GOV-034 (Phase 2 EA approval), GOV-035 (scope clarification)

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

---

## 1.5 Phase 2 Readiness Checklist (2026-03-05 Kickoff)

Before Phase 2 development may begin, **all 3 conditions must be verified**:

| Condition | Status | Reference | Owner |
|-----------|--------|-----------|-------|
| **Condition 1**: Phase 1 100% feature complete | ✅ VERIFIED | GOV-033 | Product Owner |
| **Condition 2**: EA approval for Phase 2 scope & implementation | ✅ APPROVED | GOV-034 | Architect |
| **Condition 3**: Phase 2 implementation pre-conditions met | ✅ VERIFIED | GOV-034, 02-PHASE2-PLANNING.md | Product Owner + Architect |

**If any condition fails**: Do not proceed with Phase 2 development. Escalate to Architect.

**Reference Documents**:
- **GOV-033**: Phase 1 Final Completion Review (all 58 features verified complete)
- **GOV-034**: Phase 2 Final EA Approval (3 conditions + implementation roadmap)
- **GOV-035**: Scope Clarification (reconciles P0/P1 tasks vs. Phase 1 completion)
- **02-PHASE2-PLANNING.md**: Phase 2 feature scope (50+ tasks across backend/frontend)

---

## 1.6 Outstanding P0/P1 Tasks - Categorization

### Not Phase 1 Features (EA-Gated to Phase 2)

The following P0/P1 tasks in the task list below are **NOT Phase 1 features** and are properly deferred. They are marked "Not Started" because:

1. **Configuration & Hygiene** (non-blocking): BE-026, DEV-001a-d
   - Deferred: Code organization work, no feature impact
   - EA-Gated: Phase 2 pre-condition (see GOV-034)

2. **Test Infrastructure** (refactoring): DEV-007-008
   - Deferred: Test structure migration, doesn't block feature tests
   - EA-Gated: Phase 2 pre-condition (see GOV-034)

3. **Bun Runtime** (architectural shift): DEV-009-012
   - Deferred: Post-MVP runtime migration decision
   - EA-Gated: Phase 2 pre-condition (see GOV-034)

4. **UI Polish** (nice-to-have): FE-018
   - Deferred: Status badge refinement, not Phase 1 scope
   - EA-Gated: Phase 2 pre-condition (see GOV-034)

5. **Shared Types/Schemas** (Phase 2 prep): SH-003-006
   - Deferred: Routing rules and notifications prep
   - EA-Gated: Phase 2 pre-condition (see GOV-034)

### QA Testing (Non-Blocking for Feature Completion)

The following QA tasks are **testing deliverables**, not feature blockers:

- **QA-001-012**: Test automation and regression suite
  - 3 of 12 tasks remain non-blocking (documentation only)
  - Can proceed with Phase 2 development in parallel
  - See GOV-033 for classification

**All Phase 1 features are production-ready for Phase 2 kickoff.**

---

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

| ID | Task | Status | Phase | Assignee | Dependencies | Acceptance Criteria | Project Item ID | Issue ID |
|----|------|--------|----------|----------|--------------|---------------------|-----------------|----------|
| SV-001 | Fix Phase 1 scope (Telegram + IRC; Phase 2 = WhatsApp/WeChat/Meta/X) | Completed | Phase 1 | Product Owner | - | Phase 1 scope aligns to ADR-003/GOV-006/GOV-007; Architect review approved | PVTI_lAHOAB4wV84BNGcwzgj_5rA | 8 |
| SV-002 | Validate Phase 1 requirements in execution guide | Completed | Phase 1 | Product Owner | SV-001 | Validation checklist covers all Phase 1 requirements; Phase 2 excluded | PVTI_lAHOAB4wV84BNGcwzgj_5sI | 9 |
| SV-003 | Update Phase 1 timeline (2 weeks) | Completed | Phase 1 | Product Owner | SV-001 | Phase 1 timeline includes Telegram + IRC tasks; Phase 2 deferred | PVTI_lAHOAB4wV84BNGcwzgj_5r8 | 16 |

### Backend Tasks

| ID | Task | Status | Phase | Assignee | Dependencies | Acceptance Criteria | Project Item ID | Issue ID |
|----|------|--------|----------|----------|--------------|---------------------|-----------------|----------|
| BE-001 | Set up PostgreSQL database with Drizzle ORM | **Done** | Phase 1 | Backend | - | Database connection working, Drizzle schema migrations functional | PVTI_lAHOAB4wV84BNGcwzgj_5rE | 12 |
| BE-002 | Define database schema (users, conversations, messages, tags, notes, audit logs, notifications, routing rules) | **Done** | Phase 1 | Backend | BE-001 | All 11 tables defined with correct relationships, migrations generated | PVTI_lAHOAB4wV84BNGcwzgj_5rQ | 13 |
| BE-003 | Implement BetterAuth for authentication (email/password, session/JWT) | **Done** | Phase 1 | Backend | BE-002 | Login endpoint working, JWT/session management functional, rate limiting added, 194 tests passing | PVTI_lAHOAB4wV84BNGcwzgj_5rc | 18 |
| BE-004 | Implement forgot password flow (reset token, email sending) | **Done** | Phase 1 | Backend | BE-003 | POST /auth/forgot-password and /reset-password working | PVTI_lAHOAB4wV84BNGcwzgj_5sM | 19 |
| BE-005 | Implement RBAC middleware (4 roles: Super Admin, Admin, Manager, User) | **Done** | Phase 1 | Backend | BE-002, BE-003 | Permission checks working for all role-based endpoints | PVTI_lAHOAB4wV84BNGcwzgj_5rU | 20 |
| BE-006 | Create user management endpoints (CRUD for users, roles) | **Done** (PR #294 merged) | Phase 1 | Backend | BE-005 | GET/POST/PUT/DELETE /users, /roles working with RBAC; soft-delete; audit logging; 70 tests ✅ | PVTI_lAHOAB4wV84BNGcwzgj_5rk | 17 |
| BE-007 | Implement inbox API (GET /conversations with filters: channel, assignee, tag, status, priority) | **Done** (PR #227 merged) | Phase 1 | Backend | BE-002, BE-005 | Filtering and pagination working ✅ | PVTI_lAHOAB4wV84BNGcwzgj_5sA | 14 |
| BE-008 | Implement conversation detail endpoint (GET /conversations/:id) | **Done** (PR #227 merged) | Phase 1 | Backend | BE-007 | Returns conversation with messages and metadata ✅ | PVTI_lAHOAB4wV84BNGcwzgj_5rM | 15 |
| BE-009 | Implement message retrieval endpoint (GET /conversations/:id/messages) | **Done** (PR #240 merged) | Phase 1 | Backend | BE-002, BE-008 | Returns paginated messages with direction (inbound/outbound) | PVTI_lAHOAB4wV84BNGcwzgj_5r4 | 10 |
| BE-010 | Implement send message endpoint (POST /conversations/:id/messages) | **Done** (PR #240 merged) | Phase 1 | Backend | BE-008 | Queues message for delivery, returns pending status | PVTI_lAHOAB4wV84BNGcwzgj_5ro | 11 |
| BE-011 | Implement message status tracking (pending → sent/failed) | **Done** (PR #241) | Phase 1 | Backend | BE-010 | Status updates working, database reflects delivery state | PVTI_lAHOAB4wV84BNGcwzgj_54c | 30 |
| BE-012 | Implement message retry endpoint (implemented under queue controller) | **Done** (PR #242 merged) | Phase 1 | Backend | BE-011 | Retry endpoint available, requeues failed message, status returns to pending | PVTI_lAHOAB4wV84BNGcwzgj_54Q | 22 |
| BE-013 | Set up Redis + BullMQ for message retry queue | **Done** | Phase 1 | Backend | - | Redis connection working, BullMQ jobs processing | PVTI_lAHOAB4wV84BNGcwzgj_55I | 23 |
| BE-014 | Implement exponential backoff for retries (1m, 5m, 30m; 3 attempts max) | **Done** (PR #242 merged) | Phase 1 | Backend | BE-013 | Failed messages retried with correct backoff schedule | PVTI_lAHOAB4wV84BNGcwzgj_55A | 26 |
| BE-014A | Fix retry queue removal and backoff schedule alignment | **Done** (PR #242 merged) | Phase 1 | Backend | BE-013 | removeFromQueue uses supported job lookup; backoff is 1m/5m/30m | PVTI_lAHOAB4wV84BNGcwzgldpko | 251 |
| BE-015 | Implement dead-letter queue (DLQ) for failed messages | **Done** (PR #242 merged) | Phase 1 | Backend | BE-014 | Messages with 3 failed attempts moved to DLQ | PVTI_lAHOAB4wV84BNGcwzgkHa9k | 127 |
| BE-015B | Enforce DLQ `message_id` UUID contract + add traceability fields + RBAC hardening | **Done** (PR #272 merged) | Phase 1 | Backend | BE-015 | DLQ rows always reference `messages.id` (UUID); queue/DLQ endpoints enforce RBAC; traceability fields persisted | PVTI_lAHOAB4wV84BNGcwzgl2YV8 | 270 |
| BE-016 | Set up Socket.io WebSocket server | **Done** | Phase 1 | Backend | - | WebSocket server running on configured port | PVTI_lAHOAB4wV84BNGcwzgkAl2c | 28 |
| BE-017 | Implement message.received event (push on inbound message) | **Done** | Phase 1 | Backend | BE-016 | Event emitted when inbound message received | PVTI_lAHOAB4wV84BNGcwzgj_54o | 27 |
| BE-018 | Implement message.sent event (push on successful delivery) | **Done** | Phase 1 | Backend | BE-016 | Event emitted when message status → sent | PVTI_lAHOAB4wV84BNGcwzgj_54g | 31 |
| BE-019 | Implement message.failed event (push on delivery failure) | **Done** | Phase 1 | Backend | BE-016 | Event emitted when message status → failed | PVTI_lAHOAB4wV84BNGcwzgj_55M | 29 |
| BE-020 | Set up Cloudflare R2 storage for raw payloads and attachments | **Done** | Phase 1 | Backend | - | R2 connection working, upload/download functional | PVTI_lAHOAB4wV84BNGcwzgkAlho | 106 |
| BE-021 | Implement raw payload storage (store inbound platform payloads, 7-day retention) | Deferred (Post-MVP) | Phase 2+ | Backend | BE-020 | Payloads stored, scheduled cleanup working | PVTI_lAHOAB4wV84BNGcwzgj_54I | 24 |
| BE-022 | Implement raw payload retrieval endpoint (GET /messages/:id/raw-payload, manager+ only) | Deferred (Post-MVP) | Phase 2+ | Backend | BE-021, BE-005 | Endpoint working with RBAC, audit-logged | PVTI_lAHOAB4wV84BNGcwzgj_54U | 21 |
| BE-023 | Implement attachment download and re-host (inbound files to R2, max 5 MB) | Not Started | Phase 2+ | Backend | BE-020 | Files downloaded from IRC, stored on R2, URLs returned | PVTI_lAHOAB4wV84BNGcwzgj_548 | 25 |
| BE-024 | Implement audit logging (all actions: assignments, tags, notes, status changes, rule executions, retries) | Not Started | Phase 2+ | Backend | BE-002 | All actions logged with actor, action, entity_type, entity_id, timestamp | PVTI_lAHOAB4wV84BNGcwzgj_54s | 33 |
| BE-025 | Set up email service (MVP implementation) | **Done** | Phase 1 | Backend | - | Password reset email integration wired for MVP | PVTI_lAHOAB4wV84BNGcwzgkAlhg | 105 |
| BE-026 | Create environment configuration scaffolding | Not Started | Phase 2+ | Backend | - | Centralized env config with validation; app boots cleanly | PVTI_lAHOAB4wV84BNGcwzgkAlhs | 108 |

### Code Review Tasks (Phase 1.4)

| ID | Task | Status | Phase | Assignee | Dependencies | Acceptance Criteria | Project Item ID | Issue ID |
|----|------|--------|----------|----------|--------------|---------------------|-----------------|----------|
| BE-203 | Add observability to conversation endpoints (correlation IDs, request timing) | **Done** | Phase 1 | Backend | BE-007-010 | Structured logging with correlation IDs, request timing (ms) on all conversation endpoints | PVTI_lAHOAB4wV84BNGcwzgj_5sA | 200 |
| BE-204 | Enforce RBAC on all conversation endpoints (@Authorized decorators) | **Done** | Phase 1 | Backend | BE-005, BE-007 | All endpoints require authentication, role-based access control enforced | PVTI_lAHOAB4wV84BNGcwzgj_5rU | 201 |
| BE-205 | Verify type safety - remove 'any' types from conversation service | **Done** | Phase 1 | Backend | BE-007-010 | Zero 'any' types, type guards implemented for null checks, full TypeScript safety | PVTI_lAHOAB4wV84BNGcwzgj_5sA | 202 |

### Development Hygiene Tasks

| ID | Task | Status | Phase | Assignee | Dependencies | Acceptance Criteria | Project Item ID | Issue ID |
|----|------|--------|----------|----------|--------------|---------------------|-----------------|----------|
| DEV-001a | Fix config file duplicate exports (r2.ts, redis.ts, email.ts, logging.ts) | Not Started | Phase 2+ | Backend | - | No duplicate exports; TypeScript build and tests pass | PVTI_lAHOAB4wV84BNGcwzgldpQI | 173 |
| DEV-001b | Fix messageRetryWorker.ts import paths and module references | Not Started | Phase 2+ | Backend | DEV-001a | Worker imports resolved; tests pass | PVTI_lAHOAB4wV84BNGcwzgldpQ4 | 174 |
| DEV-001c | Fix TypeScript moduleResolution and tsconfig issues | Not Started | Phase 2+ | Backend | DEV-001a | TypeScript config consistent across packages; no resolution errors | PVTI_lAHOAB4wV84BNGcwzgldpRI | 175 |
| DEV-001d | Standardize logger usage across backend config files | Not Started | Phase 2+ | Backend | DEV-001c | Logging uses approved patterns; no console logging in config/infrastructure | PVTI_lAHOAB4wV84BNGcwzgldpRU | 176 |
| DEV-002 | Consolidate auth services into authentication.service.ts (login/logout/getSession + password reset/validation) | ✅ Done | Phase 1 | Backend | BE-003, BE-004 | Create `services/authentication.service.ts`; update `controllers/auth.controller.ts` to call it; remove redundant auth-only service files; keep `services/authorization.service.ts` scoped to authZ; tests + lint pass | PVTI_lAHOAB4wV84BNGcwzgl42jI | 277 |
| DEV-003 | Create gateway-exchange.ts for inbound + outbound orchestration | ✅ Done | Phase 1 | Backend | - | Add `services/gateway-exchange.ts` as the single orchestration point for inbound/outbound message flow (persist, audit, rules hook, retry enqueue, typed WS emit); no platform-specific mapping in this file; existing flows updated to call gateway-exchange; tests pass | PVTI_lAHOAB4wV84BNGcwzgl42jk | 278 |
| DEV-004 | Move platform adapters into infrastructure (ADR-005 Addendum-2) | ✅ Done | Phase 1 | Backend | DEV-003 | Migrate `connectors/*` platform translation to `infrastructure/*.adapter.ts` (e.g. `irc.adapter.ts`, `telegram.adapter.ts`); adapters contain SDK/protocol + mapping only; adapters DO NOT import `services/*` or write DB/emit WS; compilation passes | PVTI_lAHOAB4wV84BNGcwzgl42kM | 279 |
| DEV-005 | Refactor inbound pipeline to remove service dependencies from adapters | ✅ Done | Phase 1 | Backend | DEV-004 | IRC inbound no longer calls `irc-ingestion.service.ts` from adapter; instead adapter emits normalized inbound events and `gateway-exchange.ts` handles persistence + side effects; add similar wiring for Telegram inbound when implemented; tests updated/added | PVTI_lAHOAB4wV84BNGcwzgl42rw | 292 |
| DEV-006 | Standardize adapter registration and outbound dispatch through gateway-exchange | ✅ Done | Phase 1 | Backend | DEV-003, DEV-004 | `integrations-runtime.service.ts` registers adapters consistently; `message.service.ts` dispatches outbound via `gateway-exchange.ts` (gateway calls adapter send); connectorManager usage updated or replaced; retry worker path remains compatible; tests pass | PVTI_lAHOAB4wV84BNGcwzgl42lI | 280 |
| DEV-007 | Move backend unit tests out of src/__tests__ into tests/ mirror structure | Not Started | Phase 2+ | Backend | - | All backend tests live under `packages/backend/tests/` (same-level as `src/`); folder structure mirrors `src/` (e.g. `tests/services/...`); feature/task tests allowed in `tests/tasks/<TASK-ID>.spec.ts`; remove all `packages/backend/src/**/__tests__/` and `packages/backend/src/**/*.{spec,test}.ts`; test runner config updated if needed; `pnpm --filter @yacc/backend test` passes | PVTI_lAHOAB4wV84BNGcwzgl42lc | 281 |
| DEV-008 | Add guardrail to prevent new src/__tests__ tests | Not Started | Phase 2+ | Backend | DEV-007 | Add a CI/lint check (script or lint rule) that fails if any files exist under `packages/backend/src/**/__tests__/` or match `packages/backend/src/**/*.{spec,test}.ts`; developer docs updated; pipeline passes | PVTI_lAHOAB4wV84BNGcwzgl42mI | 282 |
| DEV-009 | ADR-018: Bun runtime migration (monorepo) | Not Started | Phase 2+ | Architect | - | ADR-018 approved; scope (runtime vs package manager) clarified; rollback plan documented; risks captured | PVTI_lAHOAB4wV84BNGcwzgl42mc | 283 |
| DEV-010 | Migrate monorepo installs to Bun workspaces | Not Started | Phase 2+ | Backend | DEV-009 | `bun install` works at repo root; workspace links resolve; pnpm usage removed or explicitly scoped; lockfile and CI caching updated; `turbo` tasks still run | PVTI_lAHOAB4wV84BNGcwzgl42mw | 284 |
| DEV-011 | Run backend on Bun in dev and production Docker | Not Started | Phase 2+ | Backend | DEV-010 | Backend starts via Bun (local + Docker); health smoke test passes; decorator stack works; no Node runtime requirement for prod container | PVTI_lAHOAB4wV84BNGcwzgl42m8 | 285 |
| DEV-012 | CI/CD update for Bun runtime | Not Started | Phase 2+ | Backend | DEV-011 | GitHub Actions uses Bun install/cache; backend/frontend/common build and tests pass in CI; rollback path verified | PVTI_lAHOAB4wV84BNGcwzgl42nQ | 286 |
| DEV-013 | ADR-019: Standardize CI/CD to K3s + Helm | ✅ **Done** (PR #303 merged) | Phase 1 | Architect | - | ADR-019 approved; docs updated (technology + implementation + quick reference); environment assumptions documented; rollback approach captured ✅ | PVTI_lAHOAB4wV84BNGcwzgl42n4 | 287 |
| DEV-014 | Create Helm charts for YACC + dependencies (MVP) | ✅ **Done** (PR #303 merged) | Phase 1 | Backend | DEV-013 | Helm charts exist for backend; PostgreSQL + Redis pre-installed on cluster; values separated per env; `helm upgrade --install` idempotent; smoke deploy works on K3s ✅ | PVTI_lAHOAB4wV84BNGcwzgl42oQ | 288 |
| DEV-015 | Update CI pipeline to deploy to K3s using Helm | ✅ **Done** (PR #303 merged) | Phase 1 | Backend | DEV-014 | GitHub Actions deploy job uses Helm; deploys to staging namespace; rollback documented; no kubectl imperative drift; pipeline passes ✅ | PVTI_lAHOAB4wV84BNGcwzgl42ok | 289 |
| DEV-016 | Align controller names with endpoint paths (code hygiene) | ✅ **Done** (PR #306 merged) | Phase 1 | Backend | - | Renamed 5 controllers to kebab-case (assignments→assignment, bulkActions→bulk-action, notes→note, auditLogsQuery→audit-log); deleted duplicate tags.controller.ts; API paths unchanged (non-breaking) ✅ | PVTI_lAHOAB4wV84BNGcwzgl2YV8 | 300 |
| DEV-017 | Standardize list request/response contracts (BaseListRequest/Response) | ✅ **Done** (PR #306 merged) | Phase 1 | Backend, Frontend | SH-002 | All 7+ list controllers return `BaseListResponse<T>`; services return `{ data, total }`; `IListResponse` removed completely; common exports updated ✅ | PVTI_lAHOAB4wV84BNGcwzgl2YXY | 301 |
| DEV-018 | Consolidate pagination logic (service-layer pattern) | ✅ **Done** (PR #306 merged) | Phase 1 | Backend | DEV-017 | Pagination consolidated in services; ~70% boilerplate reduction; query adapter pattern for offset calculation; offset formula: (page-1)*limit ✅ | PVTI_lAHOAB4wV84BNGcwzgl2YZ6 | 302 |

### Frontend Tasks

| ID | Task | Status | Phase | Assignee | Dependencies | Acceptance Criteria | Project Item ID | Issue ID |
|----|------|--------|----------|----------|--------------|---------------------|-----------------|----------|
| FE-001 | Set up TanStack Start project with React 18 | **Done** | Phase 1 | Frontend | - | Project scaffold created, dev server running | PVTI_lAHOAB4wV84BNGcwzgj_6Ek | 43 |
| FE-002 | Configure Tailwind CSS with Williamstown SC brand colors | **Done** | Phase 1 | Frontend | FE-001 | Tailwind working, brand colors defined | PVTI_lAHOAB4wV84BNGcwzgj_6Eg | 40 |
| FE-003 | Set up Zustand for client state management | **Done** | Phase 1 | Frontend | FE-001 | Store configured, example state working | PVTI_lAHOAB4wV84BNGcwzgj_6Ew | 37 |
| FE-004 | Set up TanStack Query for API data fetching | **Done** | Phase 1 | Frontend | FE-001 | Query client configured, API requests working | PVTI_lAHOAB4wV84BNGcwzgj_6E0 | 38 |
| FE-005 | Implement login page (email/password form) | **Done** | Phase 1 | Frontend | FE-002, BE-003 | Login functional, redirects on success, error handling working | PVTI_lAHOAB4wV84BNGcwzgj_6EI | 42 |
| FE-006 | Implement forgot password page (email input form) | **Done** (PR #293 merged) | Phase 1 | Frontend | FE-002, BE-004 | Request reset working, no account enumeration, confirmation message shown | PVTI_lAHOAB4wV84BNGcwzgj_6EU | 45 |
| FE-007 | Implement password reset page (new password form) | **Done** (PR #293 merged) | Phase 1 | Frontend | FE-002, BE-004 | Password reset functional, token validation, single-use, login redirect on success | PVTI_lAHOAB4wV84BNGcwzgj_6EM | 39 |
| FE-008 | Implement inbox list page (conversation cards with filters) | **Done** (PR #243 merged) | Phase 1 | Frontend | FE-004, BE-007 | Filters: channel, assignee, tag, status, priority, search, date range | PVTI_lAHOAB4wV84BNGcwzgj_6Eo | 35 |
| FE-009 | Implement conversation detail page (messages timeline, reply composer) | **Done** (PR #243 merged) | Phase 1 | Frontend | FE-004, BE-008 | Shows conversation with messages, reply form functional | PVTI_lAHOAB4wV84BNGcwzgj_6D0 | 41 |
| FE-010 | Implement message reply composer (text input, attachment upload) | **Done** (PR #243 merged) | Phase 1 | Frontend | FE-009, BE-010 | Send message working, attachment upload to R2 | PVTI_lAHOAB4wV84BNGcwzgj_6E8 | 46 |
| FE-011 | Implement message status display (pending/sent/failed with retry button) | **Done** (PR #293 merged) | Phase 1 | Frontend | FE-009, BE-011 | Status icons visible, retry button for failed messages, exactly-once retry enforced | PVTI_lAHOAB4wV84BNGcwzgj_6EY | 44 |
| FE-012 | Set up Socket.io client for WebSocket | **Done** (PR #244 merged) | Phase 1 | Frontend | - | Socket.io client connected to server | PVTI_lAHOAB4wV84BNGcwzgj_6EE | 36 |
| FE-013 | Implement message.received event listener (real-time inbox update) | **Done** (PR #244 merged) | Phase 1 | Frontend | FE-012, BE-017 | New inbound messages appear in inbox without refresh | PVTI_lAHOAB4wV84BNGcwzgj_9W0 | 51 |
| FE-014 | Implement message.sent event listener (update message status in UI) | **Done** (PR #244 merged) | Phase 1 | Frontend | FE-012, BE-018 | Message status changes to sent in real-time | PVTI_lAHOAB4wV84BNGcwzgj_6NU | 58 |
| FE-015 | Implement message.failed event listener (show failed status) | **Done** (PR #244 merged) | Phase 1 | Frontend | FE-012, BE-019 | Failed messages updated in UI, retry button appears | PVTI_lAHOAB4wV84BNGcwzgj_6MI | 49 |
| FE-012A | Implement WebSocket client with one-definition-per-file structure | **Done** (PR #295 merged) | Phase 1 | Frontend | FE-012, GOV-005 | 20 files (GOV-005 compliant); WebSocketConnectionManager, EventHandler, Logger; exponential backoff; 63 tests ✅ | PVTI_lAHOAB4wV84BNGcwzgldplA | 252 |
| FE-012B | Implement WebSocket client observability (metrics, traces, SLO) | **Done** (PR #296 merged) | Phase 1 | Frontend | FE-012A, GOV-005 | 8 metrics; SLOMonitor; pluggable MetricsSink; GOV-030 created; 130 tests ✅ | PVTI_lAHOAB4wV84BNGcwzgldplY | 253 |
| FE-016 | Implement admin panel - IRC configuration (server, port, username, password inputs) | **Done** (PR merged) | Phase 1 | Frontend | FE-002, BE-026 | 6 input components; real-time validation; Zustand store; DaisyUI; 46 unit tests ✅ | PVTI_lAHOAB4wV84BNGcwzgj_6No | 54 |
| FE-017 | Implement IRC connection test button (connects to server, shows success/error) | **Done** (PR #297 merged) | Phase 1 | Frontend | FE-016, BE-027 | Button triggers test, displays result message | PVTI_lAHOAB4wV84BNGcwzgj_6Nk | 66 |
| FE-018 | Implement IRC connection status display (connected/retrying/disconnected/failed) | Not Started | Phase 2+ | Frontend | FE-016 | Status badge visible in admin panel, updates in real-time | PVTI_lAHOAB4wV84BNGcwzgj_6MA | 47 |
| FE-019 | Implement admin panel - users list (table with email, role, status, edit/delete actions) | **Done** (PR #298 merged) | Phase 1 | Frontend | FE-002, BE-006 | Users table functional, CRUD operations working with RBAC | PVTI_lAHOAB4wV84BNGcwzgj_6L4 | 52 |
| FE-020 | Implement authentication guards (redirect to login if unauthenticated) | **Done** (PR #293 merged) | Phase 1 | Frontend | FE-005 | Protected pages redirect unauthenticated users, 401/403 error handling | PVTI_lAHOAB4wV84BNGcwzgj_6NM | 48 |
| FE-021 | Implement role-based UI (hide admin features from non-admin users) | **Done** (PR #293 merged) | Phase 1 | Frontend | FE-020 | Admin panel hidden from non-admins, deep links show permission denied, RBAC enforced | PVTI_lAHOAB4wV84BNGcwzgj_6Ng | 56 |

### Shared Tasks

| ID | Task | Status | Phase | Assignee | Dependencies | Acceptance Criteria | Project Item ID | Issue ID |
|----|------|--------|----------|----------|--------------|---------------------|-----------------|----------|
| SH-001 | Define TypeScript types for core entities (User, Conversation, Message, Tag, Note, Notification, RoutingRule, AuditLog) | **Done** (PR #304 merged) | Phase 1 | Architect | BE-002 | All Phase 2 entity types + request/response DTOs defined in packages/common; shared by backend + frontend; 33 files updated; builds passing ✅ | PVTI_lAHOAB4wV84BNGcwzgj_8cg | 83 |
| SH-002 | Define API request/response types (conversations, messages, auth, users, IRC config) | ✅ **Done** (PR #305 merged) | Phase 1 | Architect | SH-001 | BaseListRequest + BaseListResponse<T>; 17 tests; 90% coverage ✅ | PVTI_lAHOAB4wV84BNGcwzgj_83I | 74 |
| SH-003 | Define WebSocket event types (message.received, message.sent, message.failed) | Not Started | Phase 2+ | Architect | SH-001 | Event types defined with payloads | PVTI_lAHOAB4wV84BNGcwzgj_6hE | 76 |
| SH-004 | Create Zod schemas for request validation (auth, conversations, messages, IRC config) | Not Started | Phase 2+ | Architect | SH-002 | All schemas created, export for backend validation | PVTI_lAHOAB4wV84BNGcwzgj_6g8 | 78 |
| SH-005 | Set up shared package exports in packages/common/src/index.ts | Not Started | Phase 2+ | Architect | SH-001, SH-002, SH-003 | All types and schemas exported correctly | PVTI_lAHOAB4wV84BNGcwzgj_6hA | 81 |
| SH-006 | Organize DTOs by feature folders | Not Started | Phase 2+ | Architect | SH-001 | DTOs grouped by feature; no barrel export regressions | PVTI_lAHOAB4wV84BNGcwzgkHUZM | 126 |

---

#### SH-003: Define WebSocket Event Types - Detailed Acceptance Criteria

**Objective**: Create TypeScript interfaces for all 9 WebSocket events with complete payload structures

**Scope**:
- Base event structure (`BaseEvent<T, D>`)
- Message events: `message.received`, `message.sent`, `message.failed`
- Conversation events: `conversation.updated`, `conversation.reopened`
- Notification events: `notification.received`
- Presence events: `presence.updated`, `typing.started`, `typing.stopped`

**Deliverables**:
1. TypeScript interfaces in `packages/common/types/events/`
2. One definition per file (ADR-005 compliance)
3. Domain-specific index aggregators (message, conversation, notification, presence)
4. Discriminated union type `WebSocketEvent`
5. JSDoc documentation with example payloads
6. Tests with 85%+ coverage

**Acceptance Criteria**:
1. ✅ All 9 WebSocket events have TypeScript interfaces
2. ✅ Each interface extends `BaseEvent<T, D>` with event name literal type
3. ✅ Payloads reference entity types from SH-001 (User, Conversation, Message, Notification)
4. ✅ Events documented with JSDoc + example payloads
5. ✅ File structure follows one-definition-per-file (ADR-005)
6. ✅ Discriminated union type `WebSocketEvent` exists for type narrowing
7. ✅ Exports available in `packages/common/types/events/index.ts`
8. ✅ Tests verify type assertions and discriminated union discrimination works
9. ✅ 85%+ test coverage
10. ✅ Zero `any` types in TypeScript
11. ✅ All linting passes

**Dependencies**: SH-001 (entity types must be complete)

**Estimate**: 4 days

**Reference**: `.docs/02-api-and-data-model.md` Section 6 (WebSocket events)

---

#### SH-004: Create Zod Schemas for Request Validation - Detailed Acceptance Criteria

**Objective**: Create Zod schemas for all 35+ REST API endpoints with runtime validation integrated

**Scope**:
- Auth endpoints (4): login, register, forgot-password, reset-password
- Conversation endpoints (7): list, get, update, reopen, assign, tag, bulk-action
- Message endpoints (4): send, retry, list, get
- Tags, Notes, Routing Rules endpoints (13 total)
- IRC config endpoints (5+): save, test, connect, status, list-profiles
- Search, Notifications, Bulk, Raw Payloads, DLQ, Integrations (11+ endpoints)

**Deliverables**:
1. Zod schemas in `packages/common/schemas/` (domain-specific files)
2. Schema aggregator in `schemas/index.ts`
3. Validation middleware in `packages/backend/middleware/validation.middleware.ts`
4. Integration with routing-controllers via `middlewares` option
5. Tests with 85%+ coverage

**Acceptance Criteria**:
1. ✅ Zod schemas for all 35+ request bodies
2. ✅ Schemas validate body, query params, path params where applicable
3. ✅ Schemas export from `packages/common/schemas/` organized by domain (auth, conversations, messages, etc.)
4. ✅ **ADR-020**: Schemas are source of truth, types inferred via `z.infer<typeof schema>`
5. ✅ Validation middleware integrates via `middlewares` option (NOT app.use() per ADR-014)
6. ✅ Error messages are user-friendly (not raw Zod errors, formatted for API consumers)
7. ✅ Tests verify schema validation catches invalid inputs (400 errors)
8. ✅ Tests verify valid requests pass validation
9. ✅ 85%+ test coverage
10. ✅ Zero `any` types in TypeScript
11. ✅ All linting passes

**Implementation Notes**:
- **ADR-020**: Zod schemas are source of truth (see ADR for rationale)
- Middleware must not use `app.use()` (violates routing-controllers pattern per ADR-014)
- Use `middlewares` option in `useExpressServer()` instead
- Error handling: catch Zod errors, return 400 with friendly message (e.g., `{ error: 'validation_error', details: [...] }`)

**Dependencies**: SH-002 (API types may be refactored to use `z.infer`)

**Estimate**: 11.5 days

**Reference**: `.docs/02-api-and-data-model.md` Sections 2-5 (API endpoints), ADR-020 (Zod source of truth)

---

#### SH-005: Set Up Shared Package Exports - Detailed Acceptance Criteria

**Objective**: Configure domain-specific export paths using package.json `exports` map (NOT barrel exports)

**Scope**:
- Configure package.json `exports` map for domain-specific imports
- Create domain-specific index aggregators
- Document allowed import patterns
- Test imports in backend/frontend

**Deliverables**:
1. Updated `packages/common/package.json` with `exports` map
2. Domain-specific index aggregators:
   - `types/entities/index.ts`
   - `types/api/index.ts`
   - `types/events/index.ts`
   - `schemas/index.ts`
3. Documentation in `packages/common/README.md`
4. Tests in backend/frontend verifying imports work

**Acceptance Criteria**:
1. ✅ package.json `exports` map configured for domain paths (`@yacc/common/types/entities`, etc.)
2. ✅ Domain-specific index aggregators export all types/schemas
3. ✅ Import patterns documented in README with DO/DON'T examples
4. ✅ Backend can import and use types/schemas
5. ✅ Frontend can import and use types
6. ✅ No circular dependencies introduced
7. ✅ Tree-shaking works correctly (unused exports not bundled)
8. ✅ **NO** single barrel export at `src/index.ts` (ADR-005 compliance)
9. ✅ TypeScript module resolution works (no import errors)
10. ✅ Tests verify all imports resolve and compile

**Import Pattern (Expected)**:
```typescript
// ✅ GOOD (domain-specific)
import { User, Conversation } from '@yacc/common/types/entities';
import { LoginRequest } from '@yacc/common/types/api';
import { MessageReceivedEvent } from '@yacc/common/types/events';
import { loginSchema } from '@yacc/common/schemas';

// ❌ BAD (barrel export, violates ADR-005)
import { User, LoginRequest } from '@yacc/common';
```

**Dependencies**: SH-001, SH-002, SH-003, SH-004

**Estimate**: 3.5 days

**Reference**: `AGENTS.md` (ADR-005 constraint on barrel exports), ADR-005, ADR-012 (index aggregator allowance)

---

### Integration Tasks (IRC)

| ID | Task | Status | Phase | Assignee | Dependencies | Acceptance Criteria | Project Item ID | Issue ID |
|----|------|--------|----------|----------|--------------|---------------------|-----------------|----------|
| INT-001 | Create IRC connector (server connection, authentication, channel joins) | **Done** (PR #254 merged) | Phase 1 | Backend | BE-001 | Connects to IRC server, authenticates, joins configured channels | PVTI_lAHOAB4wV84BNGcwzgkHa_U | 128 |
| INT-002 | Implement IRC message ingestion (inbound messages → inbox) | **Done** (PR #257 merged) | Phase 1 | Backend | BE-002, INT-001 | Inbound messages create conversations/messages in DB; WebSocket `message.received` backlog-aware; tests passing | PVTI_lAHOAB4wV84BNGcwzgkHbAU | 129 |
| INT-003 | Implement IRC message delivery (outbound messages → IRC channel) | **Done** (PR #259 merged) | Phase 1 | Backend | BE-010, INT-001 | Messages sent to IRC channel, status updated to sent/failed | PVTI_lAHOAB4wV84BNGcwzgkHbB4 | 130 |
| INT-004 | Implement IRC auto-reconnect with exponential backoff (1s → 60s max, 5 attempts) | **Done** (PR #260 merged) | Phase 1 | Backend | INT-001 | Disconnects trigger reconnect attempts with backoff; strict timer boundary + post-exhaustion disconnect behavioral tests | PVTI_lAHOAB4wV84BNGcwzgj_824 | 60 |
| INT-005 | Implement IRC connection status tracking (connected/retrying/disconnected/failed) | **Done** (PR #261 merged) | Phase 1 | Backend | INT-004 | Status stored in runtime memory (no DB persistence for MVP); exposed via endpoint + WebSocket | PVTI_lAHOAB4wV84BNGcwzgj_6NE | 59 |
| INT-006 | Create IRC configuration endpoint (POST /api/integrations/irc/config) | **Done** (PR #263 merged) | Phase 1 | Backend | BE-005 | Saves server, port, username, password, channels with AES-256-GCM encryption; validates all fields; RBAC super_admin only; audit logged; DB migration exists for `integration_configs` | PVTI_lAHOAB4wV84BNGcwzgj_6MQ | 53 |
| INT-007 | Create IRC connect endpoint (POST /api/integrations/irc/connect) | **Done** (PR #263 merged) | Phase 1 | Backend | INT-006 | Initiates non-blocking connection from stored config; each call forces status=retrying and resets attemptCount=0; uses connectorManager; `409 irc_not_configured` if not configured | PVTI_lAHOAB4wV84BNGcwzgj_6Mk | 50 |
| INT-008 | Create IRC connection test endpoint (POST /api/integrations/irc/test) | **Done** (PR #263 merged) | Phase 1 | Backend | INT-001 | Tests connection with hard 10s timeout (timeout returns `500 internal_error`); body-first validation with stored config fallback; uses irc-framework Client; no state changes; audit logged | PVTI_lAHOAB4wV84BNGcwzgj_6MY | 55 |
| INT-009 | Implement IRC connection status endpoint (GET /api/integrations/irc/status) | **Done** (PR #262 merged) | Phase 1 | Backend | INT-005 | Returns current connection status; RBAC admin+; no secrets exposed | PVTI_lAHOAB4wV84BNGcwzgj_6Mc | 57 |
| INT-010 | Support multi-profile IRC credentials in DB with DB-first gating | **Done** (PR #265 merged) | Phase 1 | Product Owner | INT-006 | Each tenant stores up to 10 IRC profiles encrypted at rest (hard cap, no tenant-specific policy); DB-first gating (if any DB profiles exist, use only DB; env fallback only if zero DB profiles); fail-closed on DB errors (no silent env fallback); no plaintext secrets in responses/logs/audit; RBAC: Super Admin CRUD, Admin/Manager read-only; audit logging for all profile lifecycle events; deterministic E2E tests with mocked test-connection | PVTI_lAHOAB4wV84BNGcwzgj_6Mo | 61 |
| INT-011 | Map IRC channels to conversations (one conversation per channel) | **Done** (PR #267 merged) | Phase 1 | Backend | INT-002, BE-002 | Channel joins create/update conversations, external_thread_id = channel name | PVTI_lAHOAB4wV84BNGcwzgj_6M4 | 65 |
| INT-012 | Handle IRC connection errors (logging, DLQ for failed messages) | **Done** (PR #267 merged) | Phase 1 | Backend | INT-001, BE-015 | Connection errors logged, failed messages moved to DLQ | PVTI_lAHOAB4wV84BNGcwzgj_6NY | 64 |
| INT-013 | Write unit tests for IRC connector (connection, authentication, message handling) | **Done** (PR #267 merged) | Phase 1 | Backend | INT-003 | 90%+ coverage for IRC connector | PVTI_lAHOAB4wV84BNGcwzgj_6M0 | 62 |
| INT-014 | Write integration tests for IRC connector (mock IRC server) | **Done** (PR #267 merged) | Phase 1 | Backend | INT-003 | End-to-end message flow tested | PVTI_lAHOAB4wV84BNGcwzgj_6Nw | 63 |

### QA Handoff Tasks

| ID | Task | Status | Phase | Assignee | Dependencies | Acceptance Criteria | Project Item ID | Issue ID |
|----|------|--------|----------|----------|--------------|---------------------|-----------------|----------|
| QA-001 | Create test cases for authentication (login, logout, forgot password, reset password) | Not Started | Phase 2+ | QA | BE-004 | All ACs from 01-product-specification.md covered | PVTI_lAHOAB4wV84BNGcwzgj_8jw | 84 |
| QA-002 | Create test cases for RBAC (role permissions, access control) | Not Started | Phase 2+ | QA | BE-005 | All 4 roles tested, permission matrix validated | PVTI_lAHOAB4wV84BNGcwzgj_6gc | 79 |
| QA-003 | Create test cases for inbox (filters, search, pagination, sorting) | Not Started | Phase 2+ | QA | BE-007 | All filter combinations tested | PVTI_lAHOAB4wV84BNGcwzgj_6gA | 75 |
| QA-004 | Create test cases for messaging (send, receive, status tracking, retry) | Not Started | Phase 2+ | QA | BE-012 | Full message lifecycle tested | PVTI_lAHOAB4wV84BNGcwzgj_8Os | 70 |
| QA-005 | Create test cases for IRC integration (connect, disconnect, inbound/outbound messages) | Not Started | Phase 2+ | QA | INT-004 | All IRC requirements tested | PVTI_lAHOAB4wV84BNGcwzgj_6hQ | 71 |
| QA-006 | Create test cases for WebSocket events (message.received, message.sent, message.failed) | Not Started | Phase 2+ | QA | BE-019 | Real-time updates verified | PVTI_lAHOAB4wV84BNGcwzgj_8Ow | 68 |
| QA-007 | Create test cases for message retry queue (backoff, DLQ, 3 attempts) | Not Started | Phase 2+ | QA | BE-015 | Retry behavior tested | PVTI_lAHOAB4wV84BNGcwzgj_6gw | 85 |
| QA-008 | Create test cases for raw payload storage (manager+ access, 7-day retention) | Not Started | Phase 2+ | QA | BE-022 | RBAC and retention verified | PVTI_lAHOAB4wV84BNGcwzgj_6g0 | 73 |
| QA-009 | Create test cases for attachments (download/re-host, 5 MB limit, R2 storage) | Not Started | Phase 2+ | QA | BE-023 | File handling tested, size limit enforced | PVTI_lAHOAB4wV84BNGcwzgj_6gQ | 82 |
| QA-010 | Implement Playwright E2E tests for happy path (login → inbox → send message) | Not Started | Phase 2+ | QA | FE-010 | Automated test suite for core user flow | PVTI_lAHOAB4wV84BNGcwzgj_6g4 | 86 |
| QA-011 | Implement Playwright E2E tests for IRC admin panel (config, test connection, status) | Not Started | Phase 2+ | QA | FE-018 | Automated test suite for IRC configuration | PVTI_lAHOAB4wV84BNGcwzgj_6f0 | 77 |
| QA-012 | Create regression test suite (12 critical tests, run on every PR) | Not Started | Phase 2+ | QA | QA-010, QA-011 | Regression suite automated in CI/CD | PVTI_lAHOAB4wV84BNGcwzgj_6gI | 80 |

### Handoff Tasks

| ID | Task | Status | Phase | Assignee | Dependencies | Acceptance Criteria | Project Item ID | Issue ID |
|----|------|--------|----------|----------|--------------|---------------------|-----------------|----------|
| HD-001 | Create Docker Compose configuration (PostgreSQL, Redis, R2 local/minio) | In Progress | Phase 2+ | Backend | BE-001, BE-013, BE-020 | All services running via docker compose up | PVTI_lAHOAB4wV84BNGcwzgj_7D0 | 103 |
| HD-002 | Create production Docker image for backend (multi-stage build) | In Progress | Phase 2+ | Backend | BE-025 | Docker image builds and runs correctly | PVTI_lAHOAB4wV84BNGcwzgj_8js | 88 |
| HD-003 | Create production Docker image for frontend (static build for S3) | Not Started | Phase 2+ | Frontend | FE-021 | Docker image generates static build | PVTI_lAHOAB4wV84BNGcwzgj_7EA | 99 |
| HD-004 | Create database migration scripts (Drizzle migrations) | In Progress | Phase 2+ | Backend | BE-002 | Migrations tested, reversible | PVTI_lAHOAB4wV84BNGcwzgj_8O8 | 101 |
| HD-005 | Set up CI/CD pipeline (GitHub Actions for tests, lint, build) | In Progress | Phase 2+ | Architect | QA-012 | Automated pipeline passing on PRs | PVTI_lAHOAB4wV84BNGcwzgj_7D4 | 94 |
| HD-006 | Create production environment template (env.example with all variables) | **Done** | Phase 2+ | Backend | DOC-007 | Template includes IRC, R2, Redis, DB variables | PVTI_lAHOAB4wV84BNGcwzgj_7EU | 96 |
| HD-007 | Perform security review (env vars, RBAC, input validation) | Not Started | Phase 2+ | Architect | BE-005 | No critical vulnerabilities found | PVTI_lAHOAB4wV84BNGcwzgj_7Dc | 95 |
| HD-008 | Deploy Phase 1 to staging environment | Not Started | Phase 2+ | Backend | HD-001, HD-002 | Staging environment functional | PVTI_lAHOAB4wV84BNGcwzgj_7EI | 97 |
| HD-009 | Run QA regression suite on staging environment | Not Started | Phase 2+ | QA | HD-008 | All regression tests passing | PVTI_lAHOAB4wV84BNGcwzgj_8Pk | 90 |
| HD-010 | Create Phase 1 handoff notes (known issues, next steps, dependencies) | Not Started | Phase 2+ | Product Owner | HD-009 | Handoff document created, reviewed by team | PVTI_lAHOAB4wV84BNGcwzgj_8Ps | 92 |
| HD-011 | Schedule Phase 2 planning meeting (Telegram integration, search, attachments) | Not Started | Phase 2+ | Product Owner | HD-010 | Meeting scheduled, agenda prepared | PVTI_lAHOAB4wV84BNGcwzgj_7EY | 100 |
| HD-012 | Archive Phase 1 artifacts (specs, test results, deployment logs) | Not Started | Phase 2+ | Product Owner | HD-011 | All artifacts archived in project repository | PVTI_lAHOAB4wV84BNGcwzgj_7Dk | 89 |

### Execution Tracking (Historical)

| ID | Task | Status | Phase | Assignee | Dependencies | Acceptance Criteria | Project Item ID | Issue ID |
|----|------|--------|----------|----------|--------------|---------------------|-----------------|----------|
| WEEK-1 | Phase 1 Week 1: Foundation (Days 1-5) | Open (cleanup) | Phase 2+ | Product Owner | - | Historical tracking issue closed or superseded | PVTI_lAHOAB4wV84BNGcwzgkAsF4 | 110 |

### GitHub Backlog Items (GH)

| ID | Task | Status | Phase | Assignee | Dependencies | Acceptance Criteria | Project Item ID | Issue ID |
|----|------|--------|----------|----------|--------------|---------------------|-----------------|----------|
| GH-032 | Implement health check endpoint (legacy numbering mismatch) | Not Started | Phase 2+ | Backend | - | Health endpoint exists; smoke tests pass | PVTI_lAHOAB4wV84BNGcwzgj_54k | 32 |
| GH-034 | Label setup required | Not Started | Phase 2+ | Architect | - | Repo labels defined and consistent | PVTI_lAHOAB4wV84BNGcwzgj_59g | 34 |
| GH-112 | UUID refactor incomplete for tags/raw_payloads/routing_rule_executions | Not Started | Phase 2+ | Backend | - | UUID refactor complete; schema + migrations consistent | PVTI_lAHOAB4wV84BNGcwzgkERi0 | 112 |
| GH-117 | Audit logs entity_id must accept non-UUID IDs | Not Started | Phase 2+ | Backend | - | Audit logs handle non-UUID entity IDs | PVTI_lAHOAB4wV84BNGcwzgkEbhI | 117 |
| GH-118 | Clarify audit_logs scope to conversation-only | Not Started | Phase 2+ | Architect | - | Scope decision recorded; docs updated | PVTI_lAHOAB4wV84BNGcwzgkEc-Y | 118 |
| GH-119 | Align audit logs to conversation-only scope | Not Started | Phase 2+ | Backend | GH-118 | Implementation matches scope decision | PVTI_lAHOAB4wV84BNGcwzgkEeHw | 119 |
| GH-120 | Align audit log scope to conversations | Not Started | Phase 2+ | Backend | GH-118 | Implementation matches scope decision | PVTI_lAHOAB4wV84BNGcwzgkEefE | 120 |
| GH-137 | PR 131 missing blocker fixes | Not Started | Phase 2+ | Architect | - | Blockers resolved or issue closed | PVTI_lAHOAB4wV84BNGcwzgldpzQ | 137 |
| GH-138 | Split ADR-003 refactor moves out of PR #131 | Not Started | Phase 2+ | Architect | - | Refactor split or issue closed | PVTI_lAHOAB4wV84BNGcwzgldpzY | 138 |
| GH-139 | FE-012: WebSocket constants violate one-definition-per-file rule | Not Started | Phase 2+ | Frontend | - | Constants refactored to comply | PVTI_lAHOAB4wV84BNGcwzgldpzk | 139 |
| GH-140 | FE-012: PR #131 missing required fixes and governance artifacts | Not Started | Phase 2+ | Architect | - | Governance artifacts complete or issue closed | PVTI_lAHOAB4wV84BNGcwzgldpzw | 140 |
| GH-141 | FE-012: Unrelated changes detected in PR #131 | Not Started | Phase 2+ | Architect | - | Unrelated changes removed or issue closed | PVTI_lAHOAB4wV84BNGcwzgldpz8 | 141 |
| GH-164 | P0: Fix @yacc/common type-check failures (schema filename casing duplicates) | Not Started | Phase 2+ | Backend | - | Type-check passes; casing duplicates eliminated | PVTI_lAHOAB4wV84BNGcwzgldp0M | 164 |
| GH-165 | P0: Backend architecture alignment (remove wrapper/DI patterns, fix logger + auth wiring) | Not Started | Phase 2+ | Backend | - | Backend matches architecture constraints | PVTI_lAHOAB4wV84BNGcwzgldp0U | 165 |
| GH-166 | P0: Eliminate 'any' usage in backend (enforce no-any standard) | Not Started | Phase 2+ | Backend | - | No `any` in backend; lint/type checks enforce | PVTI_lAHOAB4wV84BNGcwzgldp0c | 166 |
| GH-167 | P0: Eliminate 'any' usage in frontend (enforce no-any standard) | Not Started | Phase 2+ | Frontend | - | No `any` in frontend; lint/type checks enforce | PVTI_lAHOAB4wV84BNGcwzgldp0s | 167 |
| GH-168 | P0: Remove barrel exports (index.ts) and enforce direct file imports | Not Started | Phase 2+ | Backend | - | Barrel exports removed; import rules enforced | PVTI_lAHOAB4wV84BNGcwzgldp1A | 168 |
| GH-169 | P1: Remove package-lock.json (pnpm is the only supported package manager) | Not Started | Phase 2+ | Architect | - | package-lock removed; docs enforce pnpm only | PVTI_lAHOAB4wV84BNGcwzgldp1Q | 169 |
| GH-170 | P1: Stop tracking test env secrets file (packages/backend/.env.test) | Not Started | Phase 2+ | Backend | - | Secrets removed from git; docs updated | PVTI_lAHOAB4wV84BNGcwzgldp1w | 170 |
| GH-171 | P1: Replace console logging with pino + redact PII | Not Started | Phase 2+ | Backend | - | Console logs removed; PII redaction enabled | PVTI_lAHOAB4wV84BNGcwzgldp2E | 171 |
| GH-172 | P2/ADR: Decide frontend auth token storage strategy (localStorage vs HttpOnly cookie) | Not Started | Phase 2+ | Architect | - | ADR created; implementation aligned | PVTI_lAHOAB4wV84BNGcwzgldp2U | 172 |
| GH-180 | PR 179: Documentation status mismatch and missing governance log | Not Started | Phase 2+ | Architect | - | Governance correct or issue closed | PVTI_lAHOAB4wV84BNGcwzgldp2Y | 180 |
| GH-181 | PR 179: Mandatory planning index deleted | Not Started | Phase 2+ | Architect | - | Planning index restored or issue closed | PVTI_lAHOAB4wV84BNGcwzgldp2w | 181 |
| GH-182 | PR 179: routing-controllers middleware registered via app.use | Not Started | Phase 2+ | Backend | - | Middleware registration aligns with ADRs | PVTI_lAHOAB4wV84BNGcwzgldp28 | 182 |
| GH-195 | QA-001: Integration Tests for BE-007-010 | Not Started | Phase 2+ | QA | - | Integration tests implemented and passing | PVTI_lAHOAB4wV84BNGcwzglA41c | 195 |
| GH-196 | QA-002: E2E Tests for FE-008-011 (Inbox & Messaging) | Not Started | Phase 2+ | QA | - | E2E tests implemented and passing | PVTI_lAHOAB4wV84BNGcwzglA41o | 196 |
| GH-197 | QA-003: Real-Time Integration Tests (WebSocket) | Not Started | Phase 2+ | QA | - | Real-time tests implemented and passing | PVTI_lAHOAB4wV84BNGcwzglA41w | 197 |
| GH-199 | BE-007 PR: Align /conversations response contract between backend and frontend | Not Started | Phase 2+ | Backend | - | Contract consistent between FE/BE | PVTI_lAHOAB4wV84BNGcwzgldp3E | 199 |
| GH-203 | BE-007 PR: Add observability (logs/metrics/traces) for new conversation endpoints | Not Started | Phase 2+ | Backend | - | Observability meets ADR-004 | PVTI_lAHOAB4wV84BNGcwzgldp3g | 203 |
