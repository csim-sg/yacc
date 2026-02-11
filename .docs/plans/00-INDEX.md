# Active Execution Plans Index

**Last Updated**: 2026-02-11  
**Status**: ✅ Week 1 COMPLETE, ✅ Phase 1.4 Week 2 COMPLETE (merged PRs #241, #242, #243, #244, #245), ✅ Phase 2 EA validation done (GOV-021), Phase 2 implementation ready to kickoff
**Current Focus**: Phase 2 (Collaboration & Rules) developer kickoff  

---

## 📋 Document Catalog

### Active Plans

- **[BE-206-phase4-integration-plan.md](./BE-206-phase4-integration-plan.md)** - BE-206 Phase 4 Integration Testing Plan (⏳ READY FOR EXECUTION - 10-12 hours)
- **[BE-206-PHASE-4-EXECUTION-LOG.md](./BE-206-PHASE-4-EXECUTION-LOG.md)** - BE-206 Phase 4 execution log (⏳ IN PROGRESS)
- **[BE-206-PHASE-4-STATUS.md](./BE-206-PHASE-4-STATUS.md)** - BE-206 Phase 4 status snapshot (⏳ READY)

### Completed Work (Reference)

Completed artifacts have been removed from `.docs/plans/` to keep this directory actionable.

Governance references:
- BE-003 completion: `.docs/governance/GOV-011-BE-003-completion-review.md`
- PR #227 governance trail: `.docs/governance/GOV-015-pr227-week1-docs-entrypoint-tests.md`
- BE-206 session summary: `.docs/governance/GOV-016-be-206-phase4-session-summary.md`
- Plans cleanup decision: `.docs/governance/GOV-017-plans-directory-cleanup-phase2.md`
- **Phase 2 EA validation & conditions: `.docs/governance/GOV-021-phase2-architecture-decisions.md`** ← Developer MUST read before starting Phase 2 tickets


---

## ✅ Current Status

### Phase 1.4: MVP Core-First Execution (APPROVED)
**Status**: ✅ **COMPLETE - Week 2 (Feb 9-11)**  
**Approval Date**: 2026-02-06  
**Backend Completion**: 2026-02-09 (BE-009/010/011/014 merged)
**Frontend Completion**: 2026-02-10 (FE-008/009/010/012/013/014/015 merged)
**GitHub Issues & Project Sync**: 2026-02-11 (13 issues closed, Project board updated)

**MVP Scope**:
- Backend: BE-007 (Inbox API), BE-008 (Conversation Detail), BE-009/010 (Messages), BE-017-019 (WebSocket Events)
- Frontend: FE-008 (Inbox List), FE-009 (Conversation Detail), FE-010 (Reply Composer), FE-013-015 (WebSocket Listeners)
- QA: QA-001-003 (Integration + E2E + Real-Time tests)

**Target Success Criteria (when Phase 1.4 completes)**:
- Users can view unified inbox with filters
- Users can read conversation messages
- Users can send replies
- Real-time updates work (message received/sent/failed)
- Full RBAC enforcement (4 roles)
- ≥85% test coverage

**GitHub Issues Created**:
- BE-007 (#183), BE-008 (#184), BE-009/010 (#185)
- BE-017 (#186), BE-018 (#187), BE-019 (#188)
- FE-008 (#189), FE-009 (#190), FE-010 (#191)
- FE-013 (#192), FE-014 (#193), FE-015 (#194)
- QA-001 (#195), QA-002 (#196), QA-003 (#197)

### BE-206: Socket-Controllers Migration (Phases 1-3)
**Status**: ✅ **COMPLETE**  
**PR**: #208 (feature/BE-206-socket-controllers-migration)  
**Code Coverage**: 6 controllers, 0 TypeScript errors, 0 `any` types  
**Unit Tests**: 46/46 passing (100%)  
**Merged**: dev branch (commit ec2c0e9)  

### BE-206: Socket-Controllers Migration Phase 4
**Status**: ⏳ **READY FOR EXECUTION**  
**Plan**: BE-206-phase4-integration-plan.md  
**Duration**: 10-12 hours  
**Tasks**:
- Task 1: Integration Tests (4-5 hours) - 20+ tests
- Task 2: E2E Tests (3-4 hours) - 15+ tests
- Task 3: Performance Verification (2 hours) - SLO compliance
- Task 4: Regression Testing (1 hour) - Zero breakage

### FE-013/014/015: WebSocket Real-Time Message Listeners
**Status**: ⏳ **IN ARCHITECT REVIEW (Feb 10 - test enhancements)**  
**PR**: #244 (feature/FE-013-014-015-websocket-listeners)  
**Implementation Complete**:
- ✅ FE-013: Message.received listener - inbound messages appear without refresh (deduped, cached)
- ✅ FE-014: Message.sent listener - real-time delivery status updates
- ✅ FE-015: Message.failed listener - retry status and timing
- ✅ Conversation.updated listener - status/priority/assignment changes in real-time
**Type Safety**: 100% (zero `any` types, backend-frontend contract fully aligned)
**Tests**: 39 passing (message 10 tests + conversation + typing + presence + notification handlers)
**AC Verification**:
- Type-safe event handlers accept correct WebSocket event shapes
- Handlers execute without errors
- Cache mutation and invalidation logic implemented (see source)
- FE-013 accepts `message.received` with platform/senderId/attachments
- FE-014 accepts `message.sent` with delivery status
- FE-015 accepts `message.failed` with retry timing

### BE-003: BetterAuth Authentication
**Status**: ✅ **COMPLETE**  
**PR**: #179 (feature/BE-003-completion)  
**Test Coverage**: 194/194 passing (100%)  

---

## 🚀 Week 1 Execution (Feb 3-8)

**Status**: ✅ COMPLETE

**Backend**:
- [x] BE-007: Inbox API (GET /conversations with filters) - COMPLETE (PR #227 merged)
- [x] BE-008: Conversation Detail (GET /conversations/:id) - COMPLETE (PR #227 merged)

**Frontend**:
- [x] FE-008: Inbox List Page (UI scaffold with mocks) - COMPLETE
- [x] FE-009: Conversation Detail Page (UI scaffold with mocks) - COMPLETE

**QA**:
- [x] Test case preparation and test data setup - COMPLETE

**Completion Summary**:
- PR #227 merged: commit a956002 (Feb 8, 14:15 UTC)
- 253/253 tests passing
- ESM imports fixed across all packages
- All 6 critical blockers resolved (Issues #228, #229, #230, #232, #233, #237)
- Governance sync complete

---

## 🚀 Phase 2: Collaboration & Rules (Feb 11 onwards)

**Status**: ✅ **TICKET #1 FIXES COMPLETE (PR #246)** — Ready for re-review (GOV-022)

**Governance Gate**: Phase 2 approved under conditions documented in GOV-021:
- RBAC matrix finalized (assignment/bulk = manager+admin+super_admin, NOT user)
- Event semantics locked (`conversation.updated` includes tag changes; `notification.received` for assignments+mentions)
- Mention resolution: `@username` → email local-part match
- Routing rules override policy documented
- Sequential ticket order validated

**Ticket #1 Status** (BE-P2-001: Backend Tags CRUD):
- **PR #246 created** (feature/BE-P2-001-tags)
- **Status**: ✅ FIXES COMPLETE — Awaiting architect re-review
- **Blocking Issues Fixed** (per GOV-022):
  1. ✅ Added resource-level authorization check (conversation access verified)
  2. ✅ Use WebSocket backlog helper (emitToConversation instead of raw gateway)
  3. ✅ Audit logging enforced (transactional with error propagation)
  4. ✅ Tests passing (pnpm test green, WebSocket gateway mock fixed)
- **Non-Blocking Issues Fixed**:
  1. ✅ TagTypes extracted to types/tag.types.ts (one-definition-per-file)
  2. ✅ Removed all `any` types from integration tests
  3. ✅ Fixed idempotency race condition (atomic INSERT...ON CONFLICT)
  4. ✅ Enhanced test coverage (all 4 roles, super_admin verified)
- **Reference**: `.docs/governance/GOV-022-pr246-architecture-review-findings.md`
- **Commit**: 8163534 (BE-P2-001: Fix architecture review findings)
- **Next Step**: Architect re-reviews and approves (target: Feb 12-13)

**Remediation Pattern** (all Phase 2 tickets):
- Resource-level authorization REQUIRED on all conversation-scoped operations
- WebSocket events MUST use backlog helper (not raw gateway)
- Audit logging MUST be transactional (enforce on all actions)
- Tests MUST verify side effects (WebSocket events, audit log persistence)
- All 4 roles MUST be tested in RBAC scenarios

**Tickets (In Order)**:
1. ⏸️ **BE-P2-001: Backend tags** (IN REVIEW — awaiting fixes) - PR #246
2. ⏳ Backend notes + mention parsing + notifications (BLOCKED on #1 approval)
3. ⏳ Backend assignment + notification (BLOCKED on #1 approval)
4. ⏳ Backend bulk actions (BLOCKED on #1 approval)
5. ⏳ Backend routing rules CRUD + executions listing (BLOCKED on #1 approval)
6. ⏳ Backend routing rules evaluation on inbound messages (BLOCKED on #1 approval)
7. ⏳ Frontend right panel (tags/notes/assign) (BLOCKED on BE tickets)
8. ⏳ Frontend rules builder UI (BLOCKED on BE tickets)

---

## 📞 Planning Document Questions

| Topic | Reference |
|-------|-----------|
| BE-003 requirements | `.docs/01-product-specification.md` |
| BE-003 API contract | `.docs/02-api-and-data-model.md` |
| BE-003 completion (governed) | `.docs/governance/GOV-011-BE-003-completion-review.md` |
| PR #227 governance trail | `.docs/governance/GOV-015-pr227-week1-docs-entrypoint-tests.md` |
| Plans cleanup decision | `.docs/governance/GOV-017-plans-directory-cleanup-phase2.md` |

---

**Version**: 1.0  
**Status**: Active  
**Governance**: GOV-008 + ADR-005 apply
