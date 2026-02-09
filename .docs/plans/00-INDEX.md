# Active Execution Plans Index

**Last Updated**: 2026-02-09  
**Status**: ✅ Week 1 COMPLETE, ✅ BE-009/010 COMPLETE (PR #240), ✅ BE-011 COMPLETE (PR #241), ✅ BE-014 Phases 1-3 COMPLETE
**Current Focus**: BE-014 Phase 4 ready, BE-011 architect review (Feb 9, 16:30 UTC)  

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


---

## ✅ Current Status

### Phase 1.4: MVP Core-First Execution (APPROVED)
**Status**: ✅ **COMPLETE - Week 1 Backend (Feb 8)** (PR #227 merged; 253 tests passing)  
**Approval Date**: 2026-02-06  
**Completion Date**: 2026-02-08  
**Timeline**: Week 1 complete, Phase 2 kickoff Feb 9

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

## 🚀 Week 2 Execution (Feb 9-16)

**Status**: READY FOR KICKOFF (Feb 9, 9am)

**Backend** (Priority Order):
- [x] BE-009/010: Message Retrieval & Send - COMPLETE (PR #240 merged)
- [x] BE-011: Message Status Tracking - COMPLETE (PR #241 in review)
- [x] BE-014: Exponential Backoff Retry - PHASES 1-3 COMPLETE (Phase 4 ready)
- [ ] BE-014 Phase 4: Service integration & worker registration - START Feb 11
- [ ] BE-012: Message Retry Endpoint - START Feb 12 (unblocked by BE-014)
- [ ] BE-017/018/019: WebSocket Events - START Feb 13

**Frontend** (Parallel):
- [ ] FE-008/009 API Integration - START Feb 9
- [ ] FE-010: Reply Composer - START Feb 9
- [ ] FE-013/014/015: WebSocket Listeners - START Feb 13

**QA** (Parallel):
- [ ] Integration tests (BE) - START Feb 9
- [ ] E2E tests (FE) - START Feb 9
- [ ] Real-time test scenarios - START Feb 13

**Target MVP Completion**: Feb 16, 2026 (EOD)

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
