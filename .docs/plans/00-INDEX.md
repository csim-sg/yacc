# Execution Status Index

**Last Updated**: 2026-02-20  
**Status**: ⏳ Phase 1 in progress (IRC integration)

---

## What This File Is
This is the single always-current status page.

Historical execution plans, phase packets, and session notes are removed post-MVP (ADR-015) and remain available via git history.

---

## Current Delivery Status
- Phase 1: ⏳ In Progress (IRC integration + DLQ contract hardening)
- Phase 2: ✅ Completed (collaboration + rules merged)
- QA: ⏳ Not Started

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
