# GOV-012: Phase 1.4 MVP Execution Plan - APPROVED

**Date**: February 6, 2026  
**Decision**: Approve Core-First MVP execution plan (Option A)  
**Approved By**: Architect  
**Status**: ✅ **APPROVED & EXECUTED**

---

## Executive Summary

**Scope**: Phase 1.4 MVP - Core-First (2-week sprint)  
**Timeline**: February 10-20, 2026  
**Deliverables**: 14 backend/frontend tasks + QA coverage  
**Success Criteria**: Working inbox + messaging + real-time updates (≥85% test coverage)

---

## Approved Scope

### Backend (7 issues)
- **BE-007**: Inbox API (GET /conversations with filters)
- **BE-008**: Conversation Detail (GET /conversations/:id)
- **BE-009/010**: Message Retrieval & Send
- **BE-017**: message.received WebSocket event
- **BE-018**: message.sent WebSocket event
- **BE-019**: message.failed WebSocket event

### Frontend (7 issues)
- **FE-008**: Inbox List Page
- **FE-009**: Conversation Detail Page
- **FE-010**: Reply Composer
- **FE-013**: message.received Listener
- **FE-014**: message.sent Listener
- **FE-015**: message.failed Listener

### QA (3 issues)
- **QA-001**: Integration Tests (BE-007-010)
- **QA-002**: E2E Tests (FE-008-011)
- **QA-003**: Real-Time Integration Tests

---

## Architecture Alignment

### ✅ Verification Checklist

| Criterion | Status | Evidence |
|-----------|--------|----------|
| Scope: MVP-first, 2-week sprint | ✅ | Core inbox + messaging, deferred retry queue/audit logging |
| RBAC Enforcement: 4 roles enforced in BE-007 | ✅ | Acceptance criteria enforce Super Admin/Admin/Manager/User permissions |
| No `any` types: Strict TypeScript | ✅ | All responses defined with proper interfaces |
| Flat folder structure | ✅ | Task briefs specify controllers/, services/, middleware/ (flat) |
| One definition per file | ✅ | All task briefs enforce this constraint |
| Config vs Infrastructure pattern | ✅ | Implicit; will verify in PR review |
| WebSocket room-based delivery | ✅ | BE-017-019 use conversation rooms |
| Drizzle ORM, no raw SQL | ✅ | Task briefs specify Drizzle queries |
| Error handling standards | ✅ | Status codes (400/401/403/404/500) + correlation IDs |
| Documentation sync | ✅ | `.docs/plans/00-INDEX.md` updated with execution schedule |

### ✅ ADR Alignment

- **ADR-005** (Config vs Infrastructure): Implicit in task design
- **ADR-003** (REST API): Used for inbox, conversation, message endpoints
- **ADR-004** (RBAC): 4-role matrix enforced in BE-007
- **ADR-006** (WebSocket): Room-based events in BE-017-019

### ✅ Testing & Quality Standards

- **Coverage Target**: ≥85% for all new code
- **Test Types**: Unit + integration (BE), E2E (FE), real-time (WebSocket)
- **Test Scenarios**: 
  - BE: Filtering, pagination, RBAC, message flow
  - FE: Inbox UI, conversation view, message send, real-time updates
  - Real-time: Event delivery, reconnection, backlog

### ✅ Security & Governance

- **RBAC**: Enforced at controller level (4 roles: Super Admin, Admin, Manager, User)
- **Input Validation**: Message text not empty, conversation exists, user has permission
- **Error Handling**: Generic messages (prevent user enumeration), correlation IDs, structured logging
- **Secrets**: No changes to secret handling (covered by BE-003)
- **Audit Trail**: Not in MVP scope (deferred to Phase 1.5)

---

## Execution Plan (Approved)

### Week 1: Feb 10-16 (Core APIs)

**Backend** (estimated 20-25 hours):
- BE-007: Inbox API (filters, pagination, search) - **DUE Feb 14**
- BE-008: Conversation Detail - **DUE Feb 14**

**Frontend** (estimated 16-20 hours):
- FE-008: Inbox List Page (UI scaffold with mocks) - **DUE Feb 12**
- FE-009: Conversation Detail (UI scaffold with mocks) - **DUE Feb 14**

**QA**:
- Test case preparation, test data seeding

**Sync Points**:
- API contract finalized: Feb 10 (morning)
- Frontend UI ready with mocks: Feb 12 (EOD)
- Backend ready for FE integration: Feb 14 (EOD)

### Week 2: Feb 17-23 (Message Flow + Real-Time)

**Backend** (estimated 30-35 hours):
- BE-009/010: Message Retrieval & Send - **DUE Feb 20**
- BE-017-019: WebSocket Events (message.received/sent/failed) - **DUE Feb 21**

**Frontend** (estimated 25-30 hours):
- FE-008/009: API integration - **DUE Feb 20**
- FE-010: Reply Composer - **DUE Feb 20**
- FE-013-015: WebSocket Listeners - **DUE Feb 21**

**QA**:
- Run integration tests (BE-007-010)
- Run E2E tests (FE-008-011)
- Real-time test scenarios
- Identify blockers, report to team

**MVP Complete**: Feb 20-21, 2026

---

## Deferred (Phase 1.5+)

The following features are DEFERRED and NOT in this MVP:

- **Message Retry Queue** (BE-014-015): Exponential backoff retry queue
- **Message Status Tracking** (BE-011): Track "pending" → "sent"/"failed" transitions
- **Retry Button UI** (FE-011): Allow manual retry of failed messages
- **Audit Logging** (BE-024): Comprehensive audit trail for all actions
- **Raw Payload Storage** (BE-021-023): Store inbound platform payloads on R2
- **Attachment Upload/Download** (BE-025-026, FE-012): File handling (MVP: text only)
- **Message Edit/Delete** (BE-012): Edit/delete outbound messages
- **Routing Rules** (BE-027-028): Auto-assign, auto-tag based on rules
- **Notification Center** (FE-016): In-app notification panel

---

## Immediate Actions (Completed)

✅ **Feb 6, 2026 - Architect Actions**:
1. ✅ Finalized API contract for BE-007 (response format, filters, pagination)
2. ✅ Created all task briefs in GitHub issues (BE-007 through QA-003)
3. ✅ Updated `.docs/plans/00-INDEX.md` with execution schedule
4. ✅ Created governance log entry (this document)

**Next**: Team assigns tasks and begins Week 1 implementation

---

## Success Criteria (MVP Definition)

**MVP is DONE when**:

- [ ] **BE-007**: Inbox API implemented, tested (≥85% coverage), integration ready
- [ ] **BE-008**: Conversation Detail implemented, tested, integration ready
- [ ] **BE-009/010**: Message Retrieval & Send implemented, tested, queued for delivery
- [ ] **BE-017-019**: WebSocket events implemented, tested, real-time delivery works
- [ ] **FE-008**: Inbox List Page implemented (UI + API integration), E2E tests passing
- [ ] **FE-009**: Conversation Detail Page implemented (UI + API integration), E2E tests passing
- [ ] **FE-010**: Reply Composer implemented, E2E tests passing
- [ ] **FE-013-015**: WebSocket Listeners implemented, real-time updates working
- [ ] **QA-001-003**: All integration + E2E + real-time tests passing
- [ ] **No Architecture Violations**: Code follows flat structure, one definition per file, proper RBAC, no `any` types
- [ ] **Documentation**: API contracts, WebSocket events documented
- [ ] **Security Review**: Input validation, RBAC, error handling approved

**MVP Delivers to Users**:
- ✅ Unified inbox view with conversations from Telegram + IRC
- ✅ Filter inbox by channel, status, assignee, tag, priority, search
- ✅ View conversation messages with sender names and timestamps
- ✅ Send replies to conversations
- ✅ Real-time updates (new messages appear without refresh)
- ✅ Message status tracking (pending/sent/failed)
- ✅ Full RBAC (4 roles with different permissions)

---

## Architecture Decisions (Related ADRs)

| ADR | Decision | Rationale |
|-----|----------|-----------|
| ADR-003 | REST API for inbox/conversations/messages | Standard, easy to integrate with frontend |
| ADR-004 | RBAC 4-role matrix | Clear separation of concerns, security boundary |
| ADR-005 | Config vs Infrastructure pattern | Simple, clean, no complex DI |
| ADR-006 | WebSocket + Socket.io for real-time | Handles reconnection, fallback to polling |

---

## Governance & Audit Trail

| Entry | Value |
|-------|-------|
| Decision ID | GOV-012 |
| Approval Date | 2026-02-06 |
| Approved By | Architect |
| Approval Chain | Product Owner → Architect |
| Scope Change | No (within planned scope) |
| Risk Assessment | Low (core MVP features, proven tech stack) |
| Documentation Status | ✅ Complete (all task briefs created) |
| Execution Status | ✅ In Progress (Week 1 starts Feb 10) |

---

## References

- **Execution Plan Details**: `.docs/plans/00-INDEX.md` (Week 1-2 schedule)
- **Product Requirements**: `.docs/01-product-specification.md` (Features 1, 3, 9)
- **API Contract**: `.docs/02-api-and-data-model.md` (Endpoints, WebSocket events)
- **GitHub Issues**: #183-197 (all tasks created)
- **Project Board**: [YACC Project](https://github.com/users/csim-sg/projects/1/views/1)

---

**Status**: ✅ APPROVED  
**Next Review**: Weekly sync with team (Feb 10, 17, 20)  
**Escalation**: Any blockers >30 min reach out to architect immediately
