# WEEK 2 EXECUTION PLAN (PHASE 1.4) - MESSAGING + REAL-TIME

**Start Date**: February 9, 2026 (Monday, 9:00 AM)  
**Target Completion**: February 16, 2026 (Sunday, 5:00 PM)  
**Status**: 🚀 READY FOR EXECUTION  
**Lead**: Enterprise Architect + Fullstack Developer + Frontend Developer + QA  

---

## 📋 SCOPE

### Backend (BE-009, BE-010, BE-011, BE-014, BE-012, BE-017, BE-018, BE-019)

**Primary Objective**: Enable users to send/receive messages with exponential backoff retry and real-time WebSocket updates.

| Story | Title | Duration | Start | End | Status |
|-------|-------|----------|-------|-----|--------|
| **BE-009/010** | Message Retrieval & Send API | 6-8h | Feb 9 | Feb 10 | ⏳ TODO |
| **BE-011** | Message Status Tracking | 3-4h | Feb 11 | Feb 11 | ⏳ TODO |
| **BE-014** | Exponential Backoff Retry + DLQ | 6-8h | Feb 11 | Feb 12 | ⏳ TODO |
| **BE-012** | Manual Retry Endpoint | 2-3h | Feb 12 | Feb 12 | ⏳ TODO |
| **BE-017/018/019** | WebSocket Events (received/sent/failed) | 4-5h | Feb 13 | Feb 14 | ⏳ TODO |

**Sequential Order**: BE-009/010 → BE-011 → BE-014 → BE-012 → BE-017/018/019

---

### Frontend (FE-008, FE-009, FE-010, FE-013, FE-014, FE-015)

**Primary Objective**: Integrate with backend APIs and add real-time WebSocket listeners.

| Story | Title | Duration | Start | End | Status |
|-------|-------|----------|-------|-----|--------|
| **FE-008/009** | Inbox & Conversation API Integration | 8-10h | Feb 9 | Feb 11 | ⏳ TODO |
| **FE-010** | Reply Composer + File Upload | 6-8h | Feb 9 | Feb 11 | ⏳ TODO |
| **FE-013/014/015** | WebSocket Listeners & Real-Time | 4-5h | Feb 13 | Feb 14 | ⏳ TODO |

**Parallel with Backend**: No dependencies on BE for FE UI; can integrate APIs incrementally.

---

### QA (QA-001, QA-002, QA-003)

**Primary Objective**: Test message send/receive cycle end-to-end with 85%+ coverage.

| Story | Title | Duration | Start | End | Status |
|-------|-------|----------|-------|-----|--------|
| **QA-001** | Integration Tests (BE) | 6-8h | Feb 9 | Feb 12 | ⏳ TODO |
| **QA-002** | E2E Tests (FE + BE) | 8-10h | Feb 9 | Feb 14 | ⏳ TODO |
| **QA-003** | Real-Time Scenarios | 4-6h | Feb 13 | Feb 16 | ⏳ TODO |

**Parallel with Development**: Tests can start immediately after stories are scoped.

---

## 🎯 DAILY BREAKDOWN

### **MONDAY, Feb 9 (Day 1)**

#### Backend
- [ ] **BE-009/010: START** - Message Send/Receive API
  - [ ] Create schema migrations (messages.status, messages.errorDetails)
  - [ ] Implement `POST /conversations/:id/messages` controller
  - [ ] Implement message service (save, dispatch to stub connector)
  - [ ] Add role validation (user/manager only)
  - [ ] Create unit tests (8+ tests)
  - **Target**: Message can be created and persisted
  - **Files**: `controllers/message.controller.ts`, `services/message.service.ts`, `types/message.types.ts`

#### Frontend
- [ ] **FE-008/009 API Integration: START**
  - [ ] Create API client functions: `getConversations()`, `getConversationDetail(:id)`, `getConversationMessages(:id)`
  - [ ] Integrate with Zustand store
  - [ ] Display loading/error states
  - [ ] Wire up to existing UI components (FE-008, FE-009)
  - **Target**: Inbox and conversation views pull from live API
  - **Files**: `src/api/conversations.ts`, `src/hooks/useConversations.ts`, `src/hooks/useConversationDetail.ts`

- [ ] **FE-010: Reply Composer START**
  - [ ] Create composer UI component
  - [ ] Add textarea + attachment area
  - [ ] Wire up to message send API
  - [ ] Show pending state while sending
  - **Target**: User can compose and initiate send
  - **Files**: `src/components/ReplyComposer.tsx`

#### QA
- [ ] **QA-001: Preparation**
  - [ ] Set up test infrastructure for integration tests
  - [ ] Create test fixtures (test conversations, users, messages)
  - [ ] Plan 20+ test cases for message send/receive
  - **Target**: Test harness ready for BE features

---

### **TUESDAY, Feb 10 (Day 2)**

#### Backend
- [ ] **BE-009/010: CONTINUE**
  - [ ] Implement stub connector dispatch (simulate Telegram/IRC response)
  - [ ] Emit WebSocket event stub (placeholder for BE-017)
  - [ ] Add error handling for malformed requests
  - [ ] Complete unit tests (15+ tests)
  - [ ] **Complete & Merge**: BE-009/010 PR to dev
  - **Target**: Full message send/receive cycle working (with stub connector)

#### Frontend
- [ ] **FE-008/009: CONTINUE**
  - [ ] Test API integration (mock responses if backend not ready)
  - [ ] Handle empty states (no conversations)
  - [ ] Add loading spinners
  - [ ] Test pagination for message list
  - **Target**: Both pages fully functional with live API

- [ ] **FE-010: CONTINUE**
  - [ ] Add file upload UI (drag-and-drop area)
  - [ ] Test message send to backend API
  - [ ] Show sent state (message appears in timeline)
  - [ ] Add retry button (placeholder; actual retry comes Feb 12+)
  - **Target**: User can send messages and see them appear

#### QA
- [ ] **QA-001: START - Integration Tests**
  - [ ] Create WebSocketTestServer fixture (from BE-206 Phase 4 work)
  - [ ] Write 5+ connection + auth tests
  - [ ] Write 5+ message send/receive tests
  - **Target**: 10+ integration tests passing

---

### **WEDNESDAY, Feb 11 (Day 3)**

#### Backend
- [ ] **BE-011: Message Status Tracking START**
  - [ ] Add `@Column status: 'pending' | 'sent' | 'failed'` to message model
  - [ ] Implement status transitions in message service
  - [ ] Add `errorDetails: JSON` column for failure reasons
  - [ ] Update stub connector to transition status to 'sent'
  - [ ] Create unit tests (10+ tests)
  - **Target**: Message status correctly reflects delivery state

#### Frontend
- [ ] **FE-008/009: MERGE** - API integration complete
  - [ ] Review and merge FE-008/009 PR to dev
  - **Target**: Both pages in dev branch with live API

#### QA
- [ ] **QA-001: CONTINUE - Integration Tests**
  - [ ] Add 5+ status transition tests
  - [ ] Add 5+ error scenario tests
  - [ ] Begin integration with BE-011 (status tracking)
  - **Target**: 20+ integration tests (50% of target)

---

### **THURSDAY, Feb 12 (Day 4)**

#### Backend
- [ ] **BE-014: Exponential Backoff Retry + DLQ START**
  - [ ] Review existing BullMQ setup (70% complete)
  - [ ] Create DLQ table (failed_messages) schema
  - [ ] Implement message retry worker (1m, 5m, 30m exponential backoff)
  - [ ] Move failed messages to DLQ after 3 attempts
  - [ ] Add audit logging for retry attempts
  - [ ] Create unit tests (20+ tests for queue behavior)
  - **Target**: Retry queue operational; messages retry automatically

- [ ] **BE-012: Manual Retry Endpoint START**
  - [ ] Implement `POST /conversations/:id/messages/:msgId/retry` controller
  - [ ] Validate message is in failed state
  - [ ] Enqueue as 4th manual attempt
  - [ ] Return updated message
  - [ ] Add audit logging
  - [ ] Create unit tests (8+ tests)
  - [ ] **Complete & Merge**: BE-014 + BE-012 PR to dev
  - **Target**: Manual retry works; user can retry failed messages

#### Frontend
- [ ] **FE-010: MERGE** - Reply Composer complete
  - [ ] Final touches: error handling, file validation
  - [ ] Review and merge FE-010 PR to dev
  - **Target**: Composer in dev with file upload support

#### QA
- [ ] **QA-001: Continue + QA-002 START**
  - [ ] Complete 20+ integration tests for message send/receive/status
  - [ ] Merge QA-001 PR to dev
  - [ ] Begin E2E test planning for FE (QA-002)
  - [ ] Write 5+ E2E tests (Playwright): compose → send → appear in timeline
  - **Target**: Integration tests complete; E2E tests started

---

### **FRIDAY, Feb 13 (Day 5)**

#### Backend
- [ ] **BE-017/018/019: WebSocket Events START**
  - [ ] Implement event emission in message service
  - [ ] Wire up to socket-controllers (already migrated in BE-206)
  - [ ] Emit `message.received` on inbound
  - [ ] Emit `message.sent` on successful send
  - [ ] Emit `message.failed` on send failure
  - [ ] Include message object + conversation ID in payload
  - [ ] Create unit tests (12+ tests)
  - **Target**: WebSocket events firing on message events

#### Frontend
- [ ] **FE-013/014/015: WebSocket Listeners START**
  - [ ] Implement Socket.io client connection
  - [ ] Add auth token to WebSocket handshake
  - [ ] Create event listeners for message.received, message.sent, message.failed
  - [ ] Update Zustand store on events
  - [ ] Invalidate TanStack Query cache to trigger re-render
  - [ ] Add presence listener for online/offline status
  - [ ] Create component tests (10+ tests)
  - **Target**: WebSocket connected; events received and displayed

#### QA
- [ ] **QA-002: CONTINUE**
  - [ ] Write 10+ E2E tests (Playwright)
  - [ ] Test scenarios: send → see in timeline, failed → retry → succeed, multi-tab broadcast
  - [ ] Test real-time updates (message appears <1s)
  - **Target**: 15+ E2E tests written

---

### **SATURDAY, Feb 14 (Day 6)**

#### Backend
- [ ] **BE-017/018/019: COMPLETE**
  - [ ] Complete all WebSocket event tests
  - [ ] Verify event broadcasts to all connected clients
  - [ ] Test event backlog retrieval (1-hour history)
  - [ ] **Merge**: BE-017/018/019 PR to dev
  - **Target**: All WebSocket events working end-to-end

#### Frontend
- [ ] **FE-013/014/015: COMPLETE & MERGE**
  - [ ] Complete all WebSocket listeners + tests
  - [ ] Test presence updates
  - [ ] Test reconnection + backlog replay
  - [ ] **Merge**: FE-013/014/015 PR to dev
  - **Target**: Real-time updates fully functional

#### QA
- [ ] **QA-002: CONTINUE**
  - [ ] Test reconnection + backlog scenarios
  - [ ] Test presence + typing indicators (or mark deferred)
  - [ ] Verify 85%+ coverage across all tests
  - **Target**: 20+ E2E tests passing

---

### **SUNDAY, Feb 15-16 (Days 7-8)**

#### Backend
- [ ] **Final Verification**
  - [ ] Run all backend tests: `pnpm --filter @yacc/backend test`
  - [ ] Verify coverage ≥85%: `pnpm --filter @yacc/backend coverage`
  - [ ] Run linter + TypeScript: `pnpm --filter @yacc/backend lint`
  - [ ] No breaking changes to existing endpoints
  - **Target**: Zero test failures, full coverage

#### Frontend
- [ ] **Final Verification**
  - [ ] Run all frontend tests: `pnpm --filter @yacc/frontend test`
  - [ ] Run E2E tests: `pnpm --filter @yacc/frontend e2e`
  - [ ] Verify coverage ≥85%
  - [ ] Manual smoke test: send message, see in timeline, retry failed message
  - **Target**: All tests passing, MVP functional

#### QA
- [ ] **QA-001/002/003: COMPLETE**
  - [ ] Finalize all 55+ tests (integration + E2E)
  - [ ] Document test results + coverage metrics
  - [ ] Create regression suite snapshot
  - [ ] **Merge**: QA-001/002/003 PR to dev
  - **Target**: 85%+ coverage verified

#### Final
  - [ ] **Week 2 Completion (Phase 1.4)**
  - [ ] Update `.docs/plans/00-INDEX.md` with completion status
  - [ ] Create completion summary in `.docs/plans/`
  - [ ] Create governance entry (Week 2 completion)
  - [ ] Prepare Phase 2 planning (collaboration + rules)
  - **Target**: Week 2 merged to dev; ready for Phase 2 (collaboration + rules)

---

## 📊 RESOURCE ALLOCATION

### Backend Developer
- **Feb 9-16**: Full-time on Week 2 (Phase 1.4)
- **Primary**: BE-009/010 → BE-011 → BE-014 → BE-012 → BE-017/018/019
- **Parallel**: Code review for FE PRs, QA coordination
- **Effort**: ~40 hours (6-8 hours/day)

### Frontend Developer
- **Feb 9-16**: Full-time on Week 2 (Phase 1.4)
- **Primary**: FE-008/009 API integration + FE-010 Composer + FE-013/014/015 WebSocket
- **Parallel**: Code review for BE PRs, design feedback
- **Effort**: ~40 hours (6-8 hours/day)

### QA / Test Writer
- **Feb 9-16**: Full-time on Week 2 (Phase 1.4)
- **Primary**: QA-001 (integration) + QA-002 (E2E) + QA-003 (real-time)
- **Parallel**: Regression test suite, manual testing, coordination with devs
- **Effort**: ~35 hours (5-6 hours/day)

### Architect (You)
- **Feb 9**: Kickoff + architecture review + unblocking
- **Feb 9-16**: Daily standup + PR reviews + blockers resolution
- **Post-Feb 16**: Week 2 completion review + Phase 2 planning
- **Effort**: ~10 hours (1-2 hours/day)

---

## 🎯 SUCCESS CRITERIA

### Week 2 Completion (Phase 1.4)
- [ ] **Message Send/Receive**: Users can compose, send, and see messages in timeline
- [ ] **Real-Time Updates**: New messages appear <1 second without page refresh
- [ ] **Status Tracking**: Message status (pending/sent/failed) visible to user
- [ ] **Retry Queue**: Failed messages automatically retry (1m, 5m, 30m)
- [ ] **Manual Retry**: User can manually retry failed messages
- [ ] **WebSocket Events**: All 3 events (received/sent/failed) firing correctly
- [ ] **Role-Based Access**: Only managers/users can send; others cannot
- [ ] **Test Coverage**: ≥85% (unit + integration + E2E)
- [ ] **Audit Trail**: All message actions logged (send, retry, status change)
- [ ] **No Regressions**: All Phase 1 tests still passing

### Code Quality
- [ ] Zero TypeScript errors
- [ ] Zero `any` types
- [ ] Flat folder structure maintained
- [ ] One definition per file
- [ ] No hardcoded secrets
- [ ] Proper error handling + correlation IDs

### Performance
- [ ] Message send latency: <500ms
- [ ] WebSocket event delivery: <100ms (p99)
- [ ] Page load: <2s (with 50+ conversations)
- [ ] Retry queue: process messages in <1m intervals

---

## 🚀 BRANCH & PR STRATEGY

### Branch Naming
```
task/BE-009-message-send-receive
task/BE-011-message-status
task/BE-014-retry-queue
task/BE-012-manual-retry
task/BE-017-websocket-events
task/FE-008-009-api-integration
task/FE-010-reply-composer
task/FE-013-015-websocket-listeners
task/QA-001-integration-tests
task/QA-002-e2e-tests
```

### PR Workflow
1. Create branch from `dev`
2. Implement feature + tests (≥85% coverage)
3. Update `.docs/` files if needed (API contracts, ADRs)
4. Create PR against `dev` with clear description
5. **Request Architect review**
6. Address feedback
7. Merge to `dev` (squash and merge)
8. Update `.docs/plans/00-INDEX.md` with task status

### Parallel PR Openings
- **Feb 9-10**: BE-009/010 + FE-008/009 + FE-010 (can open simultaneously if non-blocking)
- **Feb 11-12**: BE-011 + BE-014 + BE-012 (sequential, but can open Feb 11 for review)
- **Feb 13-14**: BE-017/018/019 + FE-013/014/015 (can open simultaneously)
- **Feb 9-14**: QA-001/002 (can open incrementally as features are code-complete)

---

## ⚠️ RISKS & MITIGATIONS

| Risk | Impact | Mitigation |
|------|--------|-----------|
| **Backend API delays** | Frontend blocked | FE can mock responses; integrate incrementally |
| **WebSocket infrastructure issues** | Real-time fails | BE-206 Phase 4 integration tests provide baseline |
| **Test coverage gaps** | MVP shipped with bugs | QA starts immediately; daily coverage checks |
| **Merge conflicts** | Integration delays | Communicate early; frequent small PRs |
| **Connector stub complexity** | Message send doesn't work | Use simple in-memory mock; deferred real connectors Phase 3 |
| **BullMQ config issues** | Retry queue doesn't work | 70% already implemented; extend carefully |

---

## 📞 COMMUNICATION & HANDOFFS

### Daily Standup (9:00 AM)
- Backend: What done yesterday → What doing today → Blockers
- Frontend: What done yesterday → What doing today → Blockers
- QA: What done yesterday → What doing today → Blockers
- Architect: Unblock any issues + approve PRs

### Async Updates
- Post to team Slack with PR links + status
- Update GitHub issues with progress
- Escalate blockers immediately (don't wait for standup)

### Knowledge Handoffs
- FE → BE: API contract questions (respond <1h)
- BE → QA: Feature-complete notification (enables test writing)
- QA → BE/FE: Test failures + reproduction steps (respond <2h)

---

## 📋 DELIVERABLES CHECKLIST

### Code
- [ ] BE-009/010: Message API (POST, GET endpoints)
- [ ] BE-011: Status tracking (pending→sent/failed)
- [ ] BE-014: Retry queue (exponential backoff + DLQ)
- [ ] BE-012: Manual retry endpoint
- [ ] BE-017/018/019: WebSocket events (3 events)
- [ ] FE-008/009: API integration (fetch + display)
- [ ] FE-010: Reply composer + file upload
- [ ] FE-013/014/015: WebSocket listeners + real-time
- [ ] QA-001/002/003: 55+ tests (integration + E2E)

### Tests
- [ ] ≥85% coverage for all new code
- [ ] No failing tests in Phase 1 (regressions)
- [ ] Integration tests: 20+ passing
- [ ] E2E tests: 15+ passing
- [ ] Real-time tests: 12+ passing

### Documentation
- [ ] `.docs/plans/00-INDEX.md` updated with task status
- [ ] API endpoints documented (if changes to contract)
- [ ] WebSocket events documented
- [ ] `.docs/02-api-and-data-model.md` updated
- [ ] Completion summary created

### Governance
- [ ] All PRs merged to `dev` with architect approval
- [ ] Governance entry: Week 2 completion record
- [ ] No architecture constraint violations
- [ ] Test coverage metrics captured

---

## 🎉 TARGET: WEEK 2 (PHASE 1.4) COMPLETE BY Feb 16 EOD

**Message send/receive with real-time updates, retry queue, and 85%+ test coverage.**

Ready to kickoff? Let's go! 🚀

---

**Last Updated**: 2026-02-09  
**Status**: READY FOR EXECUTION  
**Approval**: Architect + Product Owner
