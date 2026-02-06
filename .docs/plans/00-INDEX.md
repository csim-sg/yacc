# Active Execution Plans Index

**Last Updated**: 2026-02-06  
**Status**: Updated to reflect BE-003 completion and current task status  

---

## 📋 Document Catalog

### Active Plans

- **[00-consolidated-active-plans.md](./00-consolidated-active-plans.md)** - Current authoritative execution plan for in-flight and pending tasks (BE-003 complete)
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
**Status**: 🚀 **IN PROGRESS - Week 1 (Feb 10-16)**  
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

### BE-003: BetterAuth Authentication
**Status**: ✅ **COMPLETE**  
**PR**: #179 (feature/BE-003-completion)  
**Test Coverage**: 194/194 passing (100%)  

---

## 🚀 Week 1 Execution (Feb 10-16)

**Backend**:
- [ ] BE-007: Inbox API (GET /conversations with filters) - DUE Feb 14
- [ ] BE-008: Conversation Detail (GET /conversations/:id) - DUE Feb 14

**Frontend**:
- [ ] FE-008: Inbox List Page (UI scaffold with mocks) - DUE Feb 14
- [ ] FE-009: Conversation Detail Page (UI scaffold with mocks) - DUE Feb 14

**QA**:
- [ ] Test case preparation and test data setup

**Sync Points**:
- API contract finalized: Feb 10 (morning)
- Frontend UI ready with mocks: Feb 12 (EOD)
- Backend ready for FE integration: Feb 14 (EOD)

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
