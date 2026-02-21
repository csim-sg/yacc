# Execution Status Index

**Last Updated**: 2026-02-21  
**Status**: ⏳ Phase 1 in progress (P0 Frontend Option 2 + IRC integration)

---

## What This File Is
This is the single always-current status page.

Historical execution plans, phase packets, and session notes are removed post-MVP (ADR-015) and remain available via git history.

---

## Current Delivery Status
- Phase 1 Backend: ⏳ In Progress (IRC integration + DLQ contract hardening)
- Phase 1 Frontend (P0 Option 2): ⏳ In Progress (core workflow + account recovery)
- Phase 2: ✅ Completed (collaboration + rules merged)
- QA: ⏳ Not Started

## P0 Frontend Option 2 Status (FE-001-021)

**Branch**: `feature/p0-frontend-option2-core-workflow`  
**Target Delivery**: Sprint end (1-2 days)

### Implementation Summary
| Component | Status | Details |
|-----------|--------|---------|
| **Auth** | ✅ DONE | Login, session, logout + protected routes + RBAC-safe navigation |
| **Account Recovery** | ✅ DONE | Forgot password (no enumeration) + Reset password (token expiry, single-use) |
| **Core Workflow** | ✅ DONE | Inbox → conversation → reply; message delivery status (pending/sent/failed) + manual retry (exactly once per message) |
| **Real-Time** | ✅ DONE | WS initialized after auth; reconnect indicator; REST refresh on reconnect (no 1-hour replay in P0) |
| **Notifications** | ✅ DONE | Bell + unread badge + persistence + mark read/dismiss + click-through (assignment only; @mention deferred) |
| **Tests** | ✅ DONE | Playwright E2E tests for auth, recovery, workflow, real-time, notifications (25+ scenarios) |
| **Docs** | ⏳ In Progress | Update spec, API docs, QA strategy, task list |

### Key Files Changed
- `packages/frontend/src/pages/ForgotPasswordPage.tsx` (NEW)
- `packages/frontend/src/pages/ResetPasswordPage.tsx` (NEW)
- `packages/frontend/src/App.tsx` (updated: routes + WebSocket init)
- `packages/frontend/src/pages/ConversationPage.tsx` (updated: message retry)
- `packages/frontend/src/services/conversations.service.ts` (updated: add retryMessage)
- `packages/frontend/src/pages/LoginPage.tsx` (updated: test IDs)
- `packages/frontend/tests/acceptance/phase1/p0-frontend-option2.spec.ts` (NEW: 25+ tests)

### Next Steps (Before Merge)
1. ✅ Code review (ea-architecture-validator)
2. ⏳ Update `.docs/02-api-and-data-model.md` (API response shapes for reset, retry endpoints)
3. ⏳ Update `.docs/01-product-specification.md` (P0 scope confirmation)
4. ⏳ Update `.docs/04-qa-and-testing.md` (E2E test cases)
5. ⏳ Update `.docs/05-quick-reference.md` (role matrix + P0 features)
6. ⏳ Update `.docs/06-tasks.md` (mark FE tasks complete)

## Current Integration Task Status (Phase 1)

### IRC Integration (INT-001-014)
| Task | Status | Dependencies | Notes |
|------|--------|--------------|-------|
| **INT-001** (IRC Connector) | ✅ **COMPLETED** (Feb 15, 2026) | — | Code merged to dev; production-ready IRC server connection with proper handshake, event-driven reconnect, security hardening |
| **INT-002** (IRC Ingestion) | ✅ **COMPLETED** (PR #257 merged) | INT-001 | Inbound messages → conversations/messages in DB; atomic upsert, auto-reopen resolved conversations, WebSocket events (backlog-aware) |
| **INT-003** (IRC Delivery) | ✅ **COMPLETED** (PR #259 merged) | INT-001 | Outbound messages → IRC channel; pending → sent/failed; BullMQ retry worker + correlationId propagation |
| **INT-004** (IRC Auto-Reconnect) | ✅ **COMPLETED** (PR #260 merged) | INT-001 | Exponential backoff reconnect (1s, 2s, 4s, 8s, 16s; 5 attempts max), behavioral timer-boundary tests |
| **INT-005** (IRC Status) | ✅ **COMPLETED** (PR #261 merged) | INT-004 | Connection status model + infrastructure (runtime memory storage) |
| **INT-006** (IRC Config) | ✅ **COMPLETED** (PR #263 merged) | INT-005 | POST /api/integrations/irc/config - save/upsert with encryption (super_admin only) |
| **INT-007** (IRC Connect) | ✅ **COMPLETED** (PR #263 merged) | INT-005 | POST /api/integrations/irc/connect - manual connect via connectorManager (super_admin, body ignored) |
| **INT-008** (IRC Test) | ✅ **COMPLETED** (PR #263 merged) | INT-005 | POST /api/integrations/irc/test - test connection with 10s timeout, no side effects (super_admin) |
| **INT-009** (Status Endpoint) | ✅ **COMPLETED** (PR #262 merged) | INT-005 | GET /api/integrations/irc/status endpoint (admin+ RBAC) |
| **INT-010** (DB Profile Management) | ✅ **COMPLETED** (PR #265 merged) | INT-006-009 | DB-first gating, encrypted credential storage, profile selection logic, deterministic E2E tests, migration & schema alignment |
| **INT-011-014** (Profile-Scoped Mapping, DLQ, Tests) | ✅ **COMPLETED** (PR #267 merged) | INT-002, INT-003, INT-010 | Profile-scoped (ircProfileId, channel) uniqueness; DLQ trace context uses integer `ircProfileId`; unit + integration test coverage. FE sidebar deferred. |

## Recent Merges
- **PR #272** (Feb 20, 2026): DLQ UUID contract enforcement + traceability fields + RBAC hardening (fixes #270)

### Test Results (INT-001)
- **28/28 tests passing** (100% pass rate)
- **100% type safety** (no `any` types)
- **Security hardening** (CRLF injection prevention, message length limits)
- **EA approved** ✅

### DLQ Contract & RBAC Hardening (Phase 1.5)
| Task | Status | PR | Notes |
|------|--------|----|----|
| **DLQ UUID Contract + Traceability + RBAC** | ⏳ **IN PROGRESS** (PR #272) | #272 | UUID FK enforcement, traceability fields (correlationId, ircProfileId, externalThreadId), RBAC policy (manager=read-only, admin=mutate, super_admin=delete), GOV-028 governance decision |
| Test Coverage | ⏳ In Progress | #272 | UUID contract tests ≥85%, RBAC tests ≥85% |
| Governance Documentation | ⏳ In Progress | #272 | GOV-028 created, API docs updated, implementation guide updated |

## Pending: Test & Lint Stabilization (PR #274 Follow-Up)

**Context**: PR #274 adds interim CI gating to enforce quality on new code while baseline cleanup proceeds in parallel (see GOV-029).

| Task | Status | Owner | Priority | Estimate | Notes |
|------|--------|-------|----------|----------|-------|
| **fix/backend-lint-baseline** | ⏳ Not Started | Backend Dev | 🔴 HIGH | 1-2 days | Resolve 449 lint errors (import order, type annotations, unused vars, filename cases) |
| **fix/backend-test-baseline-stabilization** | ⏳ Not Started | QA/Test Lead | 🔴 HIGH | 2-3 days | Stabilize integration tests (timeouts, flakes); ensure full suite passes consistently |

**Exit Condition for PR #274**: Both tasks completed + merged, then remove interim gating (changed-files lint → full lint; test split → single blocking test job).

**Related**: GOV-029 (interim policy), PR #274 (CI checks)

## References (Authoritative)
- Product scope & ACs: `.docs/01-product-specification.md`
- API & data model: `.docs/02-api-and-data-model.md`
- Implementation & architecture: `.docs/03-implementation-guide.md`
- QA strategy: `.docs/04-qa-and-testing.md`
- Quick reference: `.docs/05-quick-reference.md`
- Task + issue map (GitHub-aligned): `.docs/06-tasks.md`

## Governance
- ADRs: `.docs/adr/`
- GOV logs: `.docs/governance/`
