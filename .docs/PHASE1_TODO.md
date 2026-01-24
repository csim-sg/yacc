# Phase 1 Todo List - YACC Project

**Date**: January 20, 2026  
**Status**: Ready for developer handoff  
**Scope Correction**: IRC integration in Phase 1, Telegram deferred to Phase 2

## Executive Summary
This todo list reflects the corrected Phase 1 scope based on architectural decisions. The SOW.md "Out of Scope" section incorrectly lists both Telegram and IRC as out of scope. The correct scope is:
- **IN Phase 1**: IRC integration with full messaging endpoints, WebSocket gateway, message retry queue
- **DEFERRED to Phase 2**: Telegram integration

## 1. Scope Validation Tasks

| ID | Task | Status | Priority | Assignee | Dependencies | Acceptance Criteria |
|----|------|--------|----------|----------|--------------|---------------------|
| SV-001 | Fix SOW.md to correctly specify IRC in Phase 1, Telegram deferred to Phase 2 | Not Started | P0 | Product Owner | - | SOW.md updated with correct scope, Architect review approved |
| SV-002 | Validate all Phase 1 requirements captured in updated SOW (auth, RBAC, inbox APIs, messaging, IRC, WebSocket, retry queue) | Not Started | P0 | Product Owner | SV-001 | All Phase 1 requirements listed with correct dependencies |
| SV-003 | Update Phase 1 timeline (2 weeks) to include IRC integration tasks | Not Started | P1 | Product Owner | SV-001 | Timeline reflects IRC work with realistic estimates |

## 2. Backend Tasks

| ID | Task | Status | Priority | Assignee | Dependencies | Acceptance Criteria |
|----|------|--------|----------|----------|--------------|---------------------|
| BE-001 | Set up PostgreSQL database with Drizzle ORM | Not Started | P0 | Backend | - | Database connection working, Drizzle schema migrations functional |
| BE-002 | Define database schema (users, conversations, messages, tags, notes, audit logs, notifications, routing rules) | Not Started | P0 | Backend | BE-001 | All 11 tables defined with correct relationships, migrations generated |
| BE-003 | Implement BetterAuth for authentication (email/password, session/JWT) | Not Started | P0 | Backend | BE-002 | Login endpoint working, JWT/session management functional |
| BE-004 | Implement forgot password flow (reset token, email sending) | Not Started | P1 | Backend | BE-003 | POST /auth/forgot-password and /reset-password working |
| BE-005 | Implement RBAC middleware (4 roles: Super Admin, Admin, Manager, User) | Not Started | P0 | Backend | BE-002, BE-003 | Permission checks working for all role-based endpoints |
| BE-006 | Create user management endpoints (CRUD for users, roles) | Not Started | P1 | Backend | BE-005 | GET/POST/PUT/DELETE /users, /roles working with RBAC |
| BE-007 | Implement inbox API (GET /conversations with filters: channel, assignee, tag, status, priority) | Not Started | P0 | Backend | BE-002, BE-005 | Filtering and pagination working |
| BE-008 | Implement conversation detail endpoint (GET /conversations/:id) | Not Started | P0 | Backend | BE-007 | Returns conversation with messages and metadata |
| BE-009 | Implement message retrieval endpoint (GET /conversations/:id/messages) | Not Started | P0 | Backend | BE-002, BE-008 | Returns paginated messages with direction (inbound/outbound) |
| BE-010 | Implement send message endpoint (POST /conversations/:id/messages) | Not Started | P0 | Backend | BE-008 | Queues message for delivery, returns pending status |
| BE-011 | Implement message status tracking (pending → sent/failed) | Not Started | P0 | Backend | BE-010 | Status updates working, database reflects delivery state |
| BE-012 | Implement message retry endpoint (POST /conversations/:id/messages/:msgId/retry) | Not Started | P1 | Backend | BE-011 | Requeues failed message, updates status to pending |
| BE-013 | Set up Redis + BullMQ for message retry queue | Not Started | P0 | Backend | - | Redis connection working, BullMQ jobs processing |
| BE-014 | Implement exponential backoff for retries (1m, 5m, 30m; 3 attempts max) | Not Started | P0 | Backend | BE-013 | Failed messages retried with correct backoff schedule |
| BE-014A | Fix retry queue removal and backoff schedule alignment | Not Started | P0 | Backend | BE-013 | removeFromQueue uses supported job lookup; backoff is 1m/5m/30m |
| BE-015 | Implement dead-letter queue (DLQ) for failed messages | Not Started | P1 | Backend | BE-014 | Messages with 3 failed attempts moved to DLQ |
| BE-016 | Set up Socket.io WebSocket server | Not Started | P0 | Backend | - | WebSocket server running on configured port |
| BE-017 | Implement message.received event (push on inbound message) | Not Started | P0 | Backend | BE-016 | Event emitted when inbound message received |
| BE-018 | Implement message.sent event (push on successful delivery) | Not Started | P0 | Backend | BE-016 | Event emitted when message status → sent |
| BE-019 | Implement message.failed event (push on delivery failure) | Not Started | P0 | Backend | BE-016 | Event emitted when message status → failed |
| BE-020 | Set up Cloudflare R2 storage for raw payloads and attachments | Not Started | P0 | Backend | - | R2 connection working, upload/download functional |
| BE-021 | Implement raw payload storage (store inbound platform payloads, 7-day retention) | Not Started | P1 | Backend | BE-020 | Payloads stored, scheduled cleanup working |
| BE-022 | Implement raw payload retrieval endpoint (GET /messages/:id/raw-payload, manager+ only) | Not Started | P1 | Backend | BE-021, BE-005 | Endpoint working with RBAC, audit-logged |
| BE-023 | Implement attachment download and re-host (inbound files to R2, max 5 MB) | Not Started | P1 | Backend | BE-020 | Files downloaded from IRC, stored on R2, URLs returned |
| BE-024 | Implement audit logging (all actions: assignments, tags, notes, status changes, rule executions, retries) | Not Started | P1 | Backend | BE-002 | All actions logged with actor, action, entity_type, entity_id, timestamp |
| BE-025 | Implement health check endpoint (GET /health) | Not Started | P2 | Backend | - | Returns status of DB, Redis, R2 connections |

## 3. Frontend Tasks

| ID | Task | Status | Priority | Assignee | Dependencies | Acceptance Criteria |
|----|------|--------|----------|----------|--------------|---------------------|
| FE-001 | Set up TanStack Start project with React 18 | Not Started | P0 | Frontend | - | Project scaffold created, dev server running |
| FE-002 | Configure Tailwind CSS with Williamstown SC brand colors | Not Started | P0 | Frontend | FE-001 | Tailwind working, brand colors defined |
| FE-003 | Set up Zustand for client state management | Not Started | P0 | Frontend | FE-001 | Store configured, example state working |
| FE-004 | Set up TanStack Query for API data fetching | Not Started | P0 | Frontend | FE-001 | Query client configured, API requests working |
| FE-005 | Implement login page (email/password form) | Not Started | P0 | Frontend | FE-002, BE-003 | Login functional, redirects on success, error handling working |
| FE-006 | Implement forgot password page (email input form) | Not Started | P1 | Frontend | FE-002, BE-004 | Request reset working, confirmation message shown |
| FE-007 | Implement password reset page (new password form) | Not Started | P1 | Frontend | FE-002, BE-004 | Password reset functional, login redirect on success |
| FE-008 | Implement inbox list page (conversation cards with filters) | Not Started | P0 | Frontend | FE-004, BE-007 | Filters: channel, assignee, tag, status, priority, search, date range |
| FE-009 | Implement conversation detail page (messages timeline, reply composer) | Not Started | P0 | Frontend | FE-004, BE-008 | Shows conversation with messages, reply form functional |
| FE-010 | Implement message reply composer (text input, attachment upload) | Not Started | P0 | Frontend | FE-009, BE-010 | Send message working, attachment upload to R2 |
| FE-011 | Implement message status display (pending/sent/failed with retry button) | Not Started | P0 | Frontend | FE-009, BE-011 | Status icons visible, retry button for failed messages |
| FE-012 | Set up Socket.io client for WebSocket | Not Started | P0 | Frontend | - | Socket.io client connected to server |
| FE-013 | Implement message.received event listener (real-time inbox update) | Not Started | P0 | Frontend | FE-012, BE-017 | New inbound messages appear in inbox without refresh |
| FE-014 | Implement message.sent event listener (update message status in UI) | Not Started | P0 | Frontend | FE-012, BE-018 | Message status changes to sent in real-time |
| FE-015 | Implement message.failed event listener (show failed status) | Not Started | P0 | Frontend | FE-012, BE-019 | Failed messages updated in UI, retry button appears |
| FE-012A | Implement WebSocket client with one-definition-per-file structure | Deferred | P0 | Frontend | FE-012, GOV-005 | Follow GOV-005 guidance for constants, types, and service file structure. Blocked: WebSocket client not implemented yet |
| FE-012B | Implement WebSocket client observability (metrics, traces, SLO) | Deferred | P0 | Frontend | FE-012, GOV-005 | Emit all required metrics per GOV-005; define SLOs in governance log. Blocked: WebSocket client not implemented yet |
| FE-016 | Implement admin panel - IRC configuration (server, port, username, password inputs) | Not Started | P0 | Frontend | FE-002, BE-026 | Form to save IRC credentials, validation working |
| FE-017 | Implement IRC connection test button (connects to server, shows success/error) | Not Started | P0 | Frontend | FE-016, BE-027 | Button triggers test, displays result message |
| FE-018 | Implement IRC connection status display (connected/retrying/disconnected) | Not Started | P0 | Frontend | FE-016 | Status badge visible in admin panel, updates in real-time |
| FE-019 | Implement admin panel - users list (table with email, role, status, edit/delete actions) | Not Started | P1 | Frontend | FE-002, BE-006 | Users table functional, CRUD operations working with RBAC |
| FE-020 | Implement authentication guards (redirect to login if unauthenticated) | Not Started | P0 | Frontend | FE-005 | Protected pages redirect unauthenticated users |
| FE-021 | Implement role-based UI (hide admin features from non-admin users) | Not Started | P1 | Frontend | FE-020 | Admin panel only visible to Super Admin/Admin |

## 4. Shared Tasks

| ID | Task | Status | Priority | Assignee | Dependencies | Acceptance Criteria |
|----|------|--------|----------|----------|--------------|---------------------|
| SH-001 | Define TypeScript types for core entities (User, Conversation, Message, Tag, Note, Notification, RoutingRule, AuditLog) | Not Started | P0 | Architect | BE-002 | All types defined in packages/common/src/types/ |
| SH-002 | Define API request/response types (conversations, messages, auth, users, IRC config) | Not Started | P0 | Architect | SH-001 | All API types defined, imported by backend and frontend |
| SH-003 | Define WebSocket event types (message.received, message.sent, message.failed) | Not Started | P0 | Architect | SH-001 | Event types defined with payloads |
| SH-004 | Create Zod schemas for request validation (auth, conversations, messages, IRC config) | Not Started | P1 | Architect | SH-002 | All schemas created, export for backend validation |
| SH-005 | Set up shared package exports in packages/common/src/index.ts | Not Started | P0 | Architect | SH-001, SH-002, SH-003 | All types and schemas exported correctly |

## 5. Integration Tasks (IRC)

| ID | Task | Status | Priority | Assignee | Dependencies | Acceptance Criteria |
|----|------|--------|----------|----------|--------------|---------------------|
| INT-001 | Create IRC connector (server connection, authentication, channel joins) | Not Started | P0 | Backend | BE-001 | Connects to IRC server, authenticates, joins configured channels |
| INT-002 | Implement IRC message ingestion (inbound messages → inbox) | Not Started | P0 | Backend | BE-002, INT-001 | Inbound messages create conversations/messages in DB |
| INT-003 | Implement IRC message delivery (outbound messages → IRC channel) | Not Started | P0 | Backend | BE-010, INT-001 | Messages sent to IRC channel, status updated to sent/failed |
| INT-004 | Implement IRC auto-reconnect with exponential backoff (1s → 60s max, 5 attempts) | Not Started | P0 | Backend | INT-001 | Disconnects trigger reconnect attempts with backoff |
| INT-005 | Implement IRC connection status tracking (connected/retrying/disconnected) | Not Started | P0 | Backend | INT-004 | Status stored in DB, exposed via WebSocket |
| INT-006 | Create IRC configuration endpoint (POST /integrations/irc/config) | Not Started | P0 | Backend | BE-005 | Saves server, port, username, password to env/db |
| INT-007 | Create IRC connect endpoint (POST /integrations/irc/connect) | Not Started | P0 | Backend | INT-006 | Initiates IRC connection, returns connection status |
| INT-008 | Create IRC connection test endpoint (POST /integrations/irc/test) | Not Started | P0 | Backend | INT-007 | Attempts connection, returns success/failure response |
| INT-009 | Implement IRC connection status endpoint (GET /integrations/irc/status) | Not Started | P0 | Backend | INT-005 | Returns current connection status |
| INT-010 | Implement IRC environment variable management (store credentials securely) | Not Started | P1 | Backend | INT-006 | Credentials loaded from env vars on startup |
| INT-011 | Map IRC channels to conversations (one conversation per channel) | Not Started | P0 | Backend | INT-002, BE-002 | Channel joins create/update conversations, external_thread_id = channel name |
| INT-012 | Handle IRC connection errors (logging, DLQ for failed messages) | Not Started | P1 | Backend | INT-001, BE-015 | Connection errors logged, failed messages moved to DLQ |
| INT-013 | Write unit tests for IRC connector (connection, authentication, message handling) | Not Started | P1 | Backend | INT-003 | 90%+ coverage for IRC connector |
| INT-014 | Write integration tests for IRC connector (mock IRC server) | Not Started | P1 | Backend | INT-003 | End-to-end message flow tested |

## 6. QA Handoff Tasks

| ID | Task | Status | Priority | Assignee | Dependencies | Acceptance Criteria |
|----|------|--------|----------|----------|--------------|---------------------|
| QA-001 | Create test cases for authentication (login, logout, forgot password, reset password) | Not Started | P1 | QA | BE-004 | All ACs from 01-product-specification.md covered |
| QA-002 | Create test cases for RBAC (role permissions, access control) | Not Started | P1 | QA | BE-005 | All 4 roles tested, permission matrix validated |
| QA-003 | Create test cases for inbox (filters, search, pagination, sorting) | Not Started | P1 | QA | BE-007 | All filter combinations tested |
| QA-004 | Create test cases for messaging (send, receive, status tracking, retry) | Not Started | P1 | QA | BE-012 | Full message lifecycle tested |
| QA-005 | Create test cases for IRC integration (connect, disconnect, inbound/outbound messages) | Not Started | P1 | QA | INT-004 | All IRC requirements tested |
| QA-006 | Create test cases for WebSocket events (message.received, message.sent, message.failed) | Not Started | P1 | QA | BE-019 | Real-time updates verified |
| QA-007 | Create test cases for message retry queue (backoff, DLQ, 3 attempts) | Not Started | P1 | QA | BE-015 | Retry behavior tested |
| QA-008 | Create test cases for raw payload storage (manager+ access, 7-day retention) | Not Started | P1 | QA | BE-022 | RBAC and retention verified |
| QA-009 | Create test cases for attachments (download/re-host, 5 MB limit, R2 storage) | Not Started | P1 | QA | BE-023 | File handling tested, size limit enforced |
| QA-010 | Implement Playwright E2E tests for happy path (login → inbox → send message) | Not Started | P1 | QA | FE-010 | Automated test suite for core user flow |
| QA-011 | Implement Playwright E2E tests for IRC admin panel (config, test connection, status) | Not Started | P1 | QA | FE-018 | Automated test suite for IRC configuration |
| QA-012 | Create regression test suite (12 critical tests, run on every PR) | Not Started | P0 | QA | QA-010, QA-011 | Regression suite automated in CI/CD |

## 7. Documentation Tasks

| ID | Task | Status | Priority | Assignee | Dependencies | Acceptance Criteria |
|----|------|--------|----------|----------|--------------|---------------------|
| DOC-001 | Update SOW.md with corrected scope (IRC in Phase 1, Telegram Phase 2) | Not Started | P0 | Product Owner | SV-001 | SOW.md updated, reviewed by Architect |
| DOC-002 | Update 02-api-and-data-model.md with IRC-specific endpoints | Not Started | P1 | Backend | INT-009 | IRC endpoints documented with request/response examples |
| DOC-003 | Update 03-implementation-guide.md with IRC connector architecture | Not Started | P1 | Backend | INT-001 | IRC integration documented in architecture section |
| DOC-004 | Create IRC integration guide (setup, configuration, troubleshooting) | Not Started | P1 | Backend | INT-004 | Step-by-step guide for connecting IRC to YACC |
| DOC-005 | Update 05-quick-reference.md with Phase 1 endpoint list | Not Started | P1 | Product Owner | BE-025 | All Phase 1 endpoints listed in quick reference |
| DOC-006 | Create API documentation (OpenAPI/Swagger for all Phase 1 endpoints) | Not Started | P2 | Backend | BE-025 | API docs generated, hosted |
| DOC-007 | Create environment variables reference (IRC, R2, Redis, DB) | Not Started | P1 | Backend | INT-010 | All env vars documented with descriptions |
| DOC-008 | Create deployment guide for Phase 1 (Docker setup, env vars, migrations) | Not Started | P1 | Backend | BE-025 | Step-by-step deployment instructions |
| DOC-009 | Add governance log entry for PR #131 blocker fixes | Completed | P0 | Architect | DEV-131-03, DEV-131-04 | GOV-004 created with compliance checklist and Mermaid diagram |
| DOC-010 | Create WebSocket client implementation guidance (GOV-005) | Completed | P0 | Architect | DEV-131-05, DEV-131-06 | GOV-005 created with one-definition-per-file rules and observability requirements |

## 8. Handoff Tasks

| ID | Task | Status | Priority | Assignee | Dependencies | Acceptance Criteria |
|----|------|--------|----------|----------|--------------|---------------------|
| HD-001 | Create Docker Compose configuration (PostgreSQL, Redis, R2 local/minio) | Not Started | P0 | Backend | BE-001, BE-013, BE-020 | All services running via docker-compose up |
| HD-002 | Create production Docker image for backend (multi-stage build) | Not Started | P0 | Backend | BE-025 | Docker image builds and runs correctly |
| HD-003 | Create production Docker image for frontend (static build for S3) | Not Started | P0 | Frontend | FE-021 | Docker image generates static build |
| HD-004 | Create database migration scripts (Drizzle migrations) | Not Started | P0 | Backend | BE-002 | Migrations tested, reversible |
| HD-005 | Set up CI/CD pipeline (GitHub Actions for tests, lint, build) | Not Started | P1 | Architect | QA-012 | Automated pipeline passing on PRs |
| HD-006 | Create production environment template (env.example with all variables) | Not Started | P0 | Backend | DOC-007 | Template includes IRC, R2, Redis, DB variables |
| HD-007 | Perform security review (env vars, RBAC, input validation) | Not Started | P1 | Architect | BE-005 | No critical vulnerabilities found |
| HD-008 | Deploy Phase 1 to staging environment | Not Started | P0 | Backend | HD-001, HD-002 | Staging environment functional |
| HD-009 | Run QA regression suite on staging environment | Not Started | P0 | QA | HD-008 | All regression tests passing |
| HD-010 | Create Phase 1 handoff notes (known issues, next steps, dependencies) | Not Started | P1 | Product Owner | HD-009 | Handoff document created, reviewed by team |
| HD-011 | Schedule Phase 2 planning meeting (Telegram integration, search, attachments) | Not Started | P1 | Product Owner | HD-010 | Meeting scheduled, agenda prepared |
| HD-012 | Archive Phase 1 artifacts (specs, test results, deployment logs) | Not Started | P2 | Product Owner | HD-011 | All artifacts archived in project repository |

## Priority Legend
- **P0**: Critical - blocks Phase 1 completion or release
- **P1**: High - important for MVP success
- **P2**: Medium - nice to have if time permits
- **P3**: Low - can be deferred

## Assignee Legend
- **Backend**: Backend Developer
- **Frontend**: Frontend Developer
- **Architect**: System Architect
- **Product Owner**: Product Owner
- **QA**: QA/Tester

## Phase 1 Success Criteria
1. All P0 tasks completed
2. All P0 and P1 QA tests passing
3. IRC integration end-to-end working
4. Authentication and RBAC fully functional
5. Inbox with filters and search operational
6. Message send/receive with status tracking working
7. WebSocket real-time updates functional
8. Message retry queue with DLQ operational
9. Deployment to staging environment successful
10. SOW.md corrected to reflect accurate scope

## Next Steps
1. Product Owner: Execute SV-001 to fix SOW.md scope contradiction
2. Architect: Review and approve corrected SOW.md
3. Team: Begin P0 tasks in parallel (Backend, Frontend, Shared)
4. QA: Start creating test cases once core endpoints are ready
5. Weekly sync: Track progress, unblock dependencies

## Developer Handoff Todo (PR #131 Blockers)

| ID | Task | Status | Priority | Assignee | Dependencies | Acceptance Criteria |
|----|------|--------|----------|----------|--------------|---------------------|
 | DEV-131-01 | Split WebSocket constants/types/service to one-definition-per-file (no barrel exports) | Deferred | P0 | Frontend | FE-012 | Each file exports a single definition; direct imports only. Blocked: WebSocket client not implemented yet |
| DEV-131-02 | Add WebSocket observability (metrics, traces, SLO) | Deferred | P0 | Frontend | FE-012 | Metrics and traces emitted; SLO documented. Blocked: WebSocket client not implemented yet |
| DEV-131-03 | Fix retry queue removal logic and enforce 1m/5m/30m schedule | Completed | P0 | Backend | BE-013 | removeFromQueue uses proper BullMQ API; backoff schedule aligned to 1m/5m/30m |
| DEV-131-04 | Remove non-MVP channel types or document ADR | Completed | P0 | Backend | BE-002 | channel_type limited to IRC only for Phase 1 MVP |
 | DEV-131-05 | Add governance log entry for blocker fixes | Completed | P0 | Architect | DEV-131-03, DEV-131-04 | GOV-004 created with checklist + Mermaid diagram |
| DEV-131-06 | Align PR summary with actual diff and reference ADR ID | Completed | P0 | Frontend | DEV-131-01 | PR description matches changes; ADR ID referenced |

**Notes:**
- DEV-131-03 and DEV-131-04 completed in PR #142
- DEV-131-05 created GOV-004 governance log for these fixes
- DEV-131-01 and DEV-131-02 deferred until WebSocket client is implemented (blocked by missing frontend code)
- GOV-004 documents blocker fixes and Phase 1 MVP channel type restrictions

---

**Last Updated**: January 20, 2026  
**Status**: Ready for developer handoff  
**Total Tasks**: 85 tasks across 8 categories
