# Phase 2 MVP Plan (Real-Time Messaging)

**Window:** 2026-02-09 to 2026-02-23 (2 weeks)  
**Owner:** Architect (plan) + Backend/Frontend/QA (execution)  
**Status:** ⏳ Ready for kickoff  
**Governance:** ADR-014 (middleware exception), GOV-005 (WS client guidance), GOV-008 (workarounds)

---

## Objectives (Exit Criteria)
1. ✅ End-to-end message send/receive working through at least one connector (Telegram or IRC)
2. ✅ Real-time updates delivered via WebSocket to multiple clients (broadcast)
3. ✅ Retry queue operational (1m/5m/30m; max 3 attempts) + DLQ path defined
4. ✅ Frontend inbox and conversation timeline update live (no manual refresh)
5. ✅ All tests passing; E2E coverage target ≥80% for Phase 2 scenarios

---

## Backend Workstream (Phase 2)

**Week 1 (Feb 9–13): Real-time foundations + messaging lifecycle**
1. BE-016: Socket.io server setup + auth handshake
2. BE-017/018/019: Core event emission (message.received/sent/failed)
3. BE-009/010: Message retrieval + send endpoints (API contract alignment)
4. BE-011: Message status tracking (pending → sent/failed)
5. BE-014/015: Retry backoff alignment + DLQ behavior

**Week 2 (Feb 16–23): Connector activation + broadcast polish**
1. INT-* (IRC) or Telegram connector activation (choose one as the primary Phase 2 connector)
2. Broadcast semantics validated (multi-tab/multi-user)
3. Backlog/reconnect behavior verified (minimum: replay last 1 hour of events if implemented)
4. Observability checks: structured logs for WS connect/disconnect and message lifecycle

---

## Frontend Workstream (Phase 2)

**Week 1 (Feb 9–13): WebSocket wiring + live inbox updates**
1. FE-012: Socket.io client setup + reconnect strategy (per GOV-005)
2. FE-013/014/015: Event listeners updating client state (received/sent/failed)
3. FE-008: Inbox list UI wired to live updates (reorder by activity, unread updates)
4. FE-009: Conversation detail view shows live incoming messages

**Week 2 (Feb 16–23): Composer + timeline polish**
1. FE-010: Reply composer (send message + optimistic UI)
2. FE-011: Message status rendering (pending/sent/failed + retry affordance)
3. FE-009: Timeline pagination/lazy-load if required for large threads
4. FE-014 (stretch): typing indicators + presence

---

## QA / E2E (Phase 2)
1. Add Playwright E2E scenarios:
   - Multi-tab broadcast (send in tab A, see update in tab B)
   - Offline → reconnect replay (if backlog implemented)
   - Failed send → retry success
2. Regression suite updated to include Phase 2 flows

---

## Milestones
| Date | Milestone |
|------|-----------|
| Feb 09 | Phase 2 kickoff (plan finalized, issues selected, owners assigned) |
| Feb 13 | Backend WS events + FE WS client delivering live inbox updates |
| Feb 16 | Mid-phase architect review (integration readiness + quality gate) |
| Feb 23 | Phase 2 demo: end-to-end message + real-time broadcast |

---

## Assignments (Role-Based)
1. Backend workstream owner: Backend Developer
2. Frontend workstream owner: Frontend Developer
3. QA / E2E owner: QA
4. Governance / architecture gate: Architect

---

## Notes / Governance Gates
1. Any expansion of `app.use()` beyond body parsing requires ADR update/approval.
2. If backlog persistence is implemented (DB-backed), confirm data retention and performance impact and record in governance log.
