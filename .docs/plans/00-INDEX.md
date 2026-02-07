# Active Execution Plans Index

**Last Updated**: 2026-02-07  
**Status**: BE-206 Phase 4 (Integration Testing) ready to start
**Current Focus**: WebSocket integration & E2E testing  

---

## 📋 Document Catalog

### Active Plans

- **[BE-206-phase4-integration-plan.md](./BE-206-phase4-integration-plan.md)** - Phase 4 Integration Testing Plan (⏳ READY FOR EXECUTION - 10-12 hours)
- **[week1-qa-test-cases-and-data.md](./week1-qa-test-cases-and-data.md)** - Week 1 QA: test cases + test data setup (✅ ready)
- **[00-consolidated-active-plans.md](./00-consolidated-active-plans.md)** - Historical execution plan for Week 1-2 (BE-003 complete)
- **[BE-003-COMPLETION-SUMMARY.md](./BE-003-COMPLETION-SUMMARY.md)** - BE-003 BetterAuth completion with test results (194 passing tests)

### Archive (Historical Reference)

Historical planning documents from Week 1-2 have been consolidated into `.docs/plans/00-consolidated-active-plans.md`. For reference on completed tasks:
- **BE-027**: Structured Logging (Week 1 - Complete) - See git history: commit 2f56987
- **BE-003**: BetterAuth (Week 1-2 - Complete) - See `BE-003-COMPLETION-SUMMARY.md`
- **BE-004**: Forgot Password (Week 1 - Complete) - See git history: commit 7089841
- **BE-005**: RBAC (Week 1 - Complete) - See git history: commit 254f74c  
- **FE-001 to FE-006**: Frontend Features (Week 2 - Complete) - See git history: commits 95ea616, b5eb3ad, 2376a22

---

## ✅ Current Status

### Phase 1.4: MVP Core-First Execution (APPROVED)
**Status**: 🚀 **IN PROGRESS - Week 2 (Feb 17-23)** — Week 1 complete 2026-02-07 (BE-007, BE-008, FE-008, FE-009)  
**Approval Date**: 2026-02-06  
**Target Completion**: 2026-02-20  
**Timeline**: 2-week sprint

**MVP Scope**:
- Backend: BE-007 (Inbox API), BE-008 (Conversation Detail), BE-009/010 (Messages), BE-017-019 (WebSocket Events)
- Frontend: FE-008 (Inbox List), FE-009 (Conversation Detail), FE-010 (Reply Composer), FE-013-015 (WebSocket Listeners)
- QA: QA-001-003 (Integration + E2E + Real-Time tests)

**Success Criteria**:
- ✅ Users can view unified inbox with filters
- ✅ Users can read conversation messages
- ✅ Users can send replies
- ✅ Real-time updates work (message received/sent/failed)
- ✅ Full RBAC enforcement (4 roles)
- ✅ ≥85% test coverage

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

## 🚀 Week 1 Execution ✅ COMPLETE (2026-02-07)

**Backend**:
- [x] BE-007: Inbox API (GET /conversations with filters) - DONE
- [x] BE-008: Conversation Detail (GET /conversations/:id) - DONE

**Frontend**:
- [x] FE-008: Inbox List Page (UI scaffold with mocks) - DONE
- [x] FE-009: Conversation Detail Page (UI scaffold with mocks) - DONE

**QA**:
- [x] Test case preparation and test data setup (see [week1-qa-test-cases-and-data.md](./week1-qa-test-cases-and-data.md))

**Sync Points** (completed with Week 1):
- API contract finalized ✅
- Frontend UI ready with mocks ✅
- Backend ready for FE integration ✅

---

## 🚀 Week 2 Execution (Feb 17-23)

**Backend**:
- [ ] BE-009/010: Message Retrieval & Send - DUE Feb 20
- [ ] BE-017/018/019: WebSocket Events - DUE Feb 21

**Frontend**:
- [ ] FE-008/009 API Integration - DUE Feb 20
- [ ] FE-010: Reply Composer - DUE Feb 20
- [ ] FE-013/014/015: WebSocket Listeners - DUE Feb 21

**QA**:
- [ ] Run integration tests (BE)
- [ ] Run E2E tests (FE)
- [ ] Real-time test scenarios

**MVP Complete**: Feb 20-21, 2026

---

## 📞 Planning Document Questions

| Topic | Reference |
|-------|-----------|
| BE-003 requirements | `.docs/01-product-specification.md` |
| BE-003 API contract | `.docs/02-api-and-data-model.md` |
| BE-003 implementation | `BE-003-COMPLETION-SUMMARY.md` |
| Current active plans | `00-consolidated-active-plans.md` |

---

**Version**: 1.0  
**Status**: Active  
**Governance**: GOV-008 + ADR-005 apply
