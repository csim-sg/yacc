# Active Execution Plans Index

**Last Updated**: 2026-02-12 (EOD)  
**Status**: ✅ Phase 1.4 COMPLETE | ⏳ Phase 2 Backend 60% DONE (tags, notes, assign, rules) | 🎯 MVP Feb 20  
**Next**: Phase 2 Days 7-8 - Backend bulk/audit completion (Feb 13) + Frontend UI (Feb 13-14) + QA (Feb 19)

---

## 📋 Document Catalog

### Active Plans (Priority Order)

- **[PHASE-2-DEV-START-CHECKLIST.md](./PHASE-2-DEV-START-CHECKLIST.md)** - ✅ Phase 2 sequential dev plan (Feb 12-19 kickoff) - START HERE
- **[WEEK-2-MESSAGING-REALTIME-EXECUTION-PLAN.md](./WEEK-2-MESSAGING-REALTIME-EXECUTION-PLAN.md)** - ⏳ Week 2 execution (Phase 1.4) in progress
- **[BE-206-phase4-integration-plan.md](./BE-206-phase4-integration-plan.md)** - ⏳ Phase 4 integration testing (10-12 hours)
- **[PHASE-2-EXECUTION-PLAN.md](./PHASE-2-EXECUTION-PLAN.md)** - ✅ Phase 2 execution overview (MVP extension approved)
- **[PHASE-2-COLLABORATION-RULES-HANDOFF.md](./PHASE-2-COLLABORATION-RULES-HANDOFF.md)** - ✅ Phase 2 handoff (blockers resolved, RBAC matrix added)

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
**Status**: ✅ **COMPLETE**  
**Completion Date**: 2026-02-12
**Test Results**: 253+ tests passing (100% pass rate)
**Coverage**: ≥85% across all new code
**Code Quality**: Zero `any` types, flat structure, 1 def per file

**Implemented**:
- ✅ Backend: BE-007 (Inbox API), BE-008 (Conversation Detail), BE-009/010 (Messages), BE-017-019 (WebSocket Events)
- ✅ Frontend: FE-008 (Inbox List), FE-009 (Conversation Detail), FE-010 (Reply Composer), FE-013-015 (WebSocket Listeners)
- ✅ QA: Integration + E2E + Real-Time tests written and passing

**Deliverables**:
- ✅ Users can view unified inbox with filters (5+ filter options)
- ✅ Users can read conversation messages with full history
- ✅ Users can send replies with delivery status tracking
- ✅ Real-time updates work (message received/sent/failed + typing + presence)
- ✅ Full RBAC enforcement (4 roles: Super Admin, Admin, Manager, User)
- ✅ ≥85% test coverage

**Merged PRs**:
- #227 (Week 1 complete)
- #243 (FE-008/009/010)
- #244 (FE-013/014/015)
- #242 (BE-014 retry queue)
- #241 (BE-011 message status)

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

### Phase 2: Collaboration & Rules (IN PROGRESS)
**Status**: ⏳ **BACKEND 60% DONE (Tags, Notes, Assign, Rules) | FRONTEND & QA STARTING FEB 13**  
**Scope**: Extended MVP to include Phase 2 (GOV-021 approved)
**Timeline**: Feb 12-19 (8 days)
**Target Completion**: Feb 20, 2026

**Days 1-6 Complete (BACKEND)**:
- ✅ BE-TAGS-01: Tags CRUD (6 endpoints) - 61 tests passing
- ✅ BE-NOTES-01: Notes + @mention parsing (2 endpoints) - 20 tests passing  
- ✅ BE-ASSIGN-01: Assignments CRUD (1 endpoint) - 15 tests passing
- ✅ BE-NOTIFICATIONS: Notification CRUD (4 endpoints) - 22 tests passing
- ✅ BE-ROUTING-RULES-01: Rules CRUD + Engine (5 endpoints) - 20 tests passing
- **Total: 20 endpoints, 133+ tests (100% pass rate), ≥85% coverage**

**Days 7-8 Next (BACKEND)**:
- ⏳ BE-BULK-ACTIONS-01: Bulk assign/tag/status (1 endpoint)
- ⏳ BE-AUDIT-QUERY: Audit log query + export (3 endpoints)
- **Target: 25+ tests, ≥85% coverage, ready for handoff**

**Days 7-8 Parallel (FRONTEND)**:
- ⏳ FE-TAGS-NOTES-UI: Right panel components + E2E tests
- ⏳ FE-ASSIGN-NOTIFY-UI: Assignment dropdown + Notification center
- ⏳ FE-RULES-AUDIT-BULK: Admin page + audit viewer + bulk actions UX
- **Target: 40+ E2E tests**

**Day 8 (QA)**:
- ⏳ Final verification, RBAC testing, regression suite, sign-off

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
- [x] FE-008/009 API Integration - COMPLETE (PR #243 merged)
- [x] FE-010: Reply Composer - COMPLETE (PR #243 merged)
- [x] FE-013/014/015: WebSocket Listeners - IMPLEMENTATION COMPLETE (PR #244 in architect review)

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
