# Week 2 Development Action Plan

**Date:** 2026-01-31  
**Status:** Ready to Execute  
**Approvals:** ✅ Product Owner, ✅ Architect  
**Team Capacity:** Sequential development (one task at a time)

---

## Executive Summary

After comprehensive review by Product Owner and Architect, Week 2 is **FULLY APPROVED** with 10 tasks across Frontend Authentication, WebSocket Infrastructure, and Message Routing.

**Approval Status:**
- ✅ Product Owner: All 10 tasks approved
- ✅ Architect: All 10 tasks approved, zero architectural issues
- ✅ Ready to begin immediately

**Estimated Total Effort:** 54-72 hours (8 business days)

**Success Criteria:** All 10 tasks in "Done" status, all tests passing (80%+ coverage), all PRs merged

---

## Approved Tasks (10 Total)

### Frontend Tasks (4 tasks, ~30-40 hours)

| Task ID | Title | Est. Hours | Priority | Dependencies |
|---------|-------|-----------|----------|--------------|
| **FE-001** | Frontend Auth Integration | 10-12h | P0 | BE-003, BE-005, BE-027 ✅ |
| **FE-002** | Login/Logout UI Components | 10-12h | P0 | FE-001 |
| **FE-003** | RBAC-Based Navigation | 8-10h | P0 | FE-001 |
| **FE-004** | API Integration Layer | 10-12h | P0 | BE-006 (start) |

### Backend Tasks (2 tasks, ~26-30 hours)

| Task ID | Title | Est. Hours | Priority | Dependencies |
|---------|-------|-----------|----------|--------------|
| **BE-006** | WebSocket Infrastructure | 12-14h | P0 | BE-003, BE-005, BE-027 ✅ |
| **BE-007** | Message Routing & Status | 14-16h | P1 | BE-006 |

### Quality & Documentation (4 tasks, ~22 hours)

| Task ID | Title | Est. Hours | Priority | Dependencies |
|---------|-------|-----------|----------|--------------|
| **QA-001** | Integration Testing | 8h | P0 | All features complete |
| **QA-002** | E2E Testing (Playwright) | 6h | P0 | QA-001 |
| **DOC-001** | API Documentation | 4h | P1 | FE-004, BE-007 |
| **DOC-002** | WebSocket Events Doc | 4h | P1 | BE-006, BE-007 |

**Total:** 54-72 hours (avg 64 hours)  
**Capacity:** ~8 hours/day × 8 days = 64 hours ✅ **Perfect alignment**

---

## Blocking Requirements (NONE)

**Status:** ✅ **No blocking issues identified**

All dependencies from Week 1 are complete:
- ✅ BE-027: Structured Logging (Pino)
- ✅ BE-003: BetterAuth Authentication
- ✅ BE-005: RBAC Middleware
- ✅ BE-004: Forgot Password Flow

No pre-development setup required. Development can start immediately.

---

## Execution Timeline (Day-by-Day Breakdown)

### Pre-Development Setup (Today - 1 hour)

**Preparation:**
- [ ] Verify all Week 1 PRs merged to `dev` branch
- [ ] Pull latest `dev` branch: `git pull origin dev`
- [ ] Verify database schema ready (messages table exists)
- [ ] Install frontend dependencies (TanStack Query, BetterAuth React client)

**Exit Criteria:**
- ✅ All Week 1 code merged
- ✅ Frontend dependencies installed
- ✅ Database ready for Week 2 tasks

---

### Day 1-2: FE-001 Frontend Auth Integration (10-12 hours)

**Morning Session (4-5 hours):**

| Time | Task | Duration |
|------|------|----------|
| 09:00-09:30 | Create branch `task/FE-001-auth-integration` | 30min |
| 09:30-10:30 | Setup BetterAuth client configuration | 1h |
| 10:30-11:30 | Create AuthProvider + useAuth hook | 1h |
| 11:30-12:30 | Implement session restoration | 1h |
| 12:30-13:30 | LUNCH | 1h |

**Afternoon Session (5-6 hours):**

| Time | Task | Duration |
|------|------|----------|
| 13:30-14:30 | Implement token refresh logic | 1h |
| 14:30-15:30 | Error handling (401, 403, network) | 1h |
| 15:30-16:30 | Write unit tests (85%+ coverage) | 1h |
| 16:30-17:30 | Manual testing + PR creation | 1h |

**Exit Criteria (Day 1-2):**
- [ ] BetterAuth client configured
- [ ] AuthProvider component working
- [ ] useAuth() hook functional
- [ ] Session restoration working
- [ ] Token refresh working
- [ ] 85%+ test coverage
- [ ] PR created and reviewed

**Next:** FE-002 depends on FE-001 completion

---

### Day 2-3: FE-002 Login/Logout UI (10-12 hours) + BE-006 Start (Parallel)

**Frontend: FE-002 (Days 2-3, 10-12 hours)**

| Time | Task | Duration |
|------|------|----------|
| Day 2, 09:00-09:30 | Create branch `task/FE-002-login-ui` | 30min |
| Day 2, 09:30-11:00 | Build login form component | 1.5h |
| Day 2, 11:00-12:30 | Form validation + error handling | 1.5h |
| Day 2, 12:30-13:30 | LUNCH | 1h |
| Day 2, 13:30-14:30 | Loading states + submit handler | 1h |
| Day 2, 14:30-15:30 | Unit tests (90%+ coverage) | 1h |
| Day 2, 15:30-16:30 | E2E tests (Playwright) | 1h |
| Day 3, 09:00-10:00 | Logout button + forgot password link | 1h |
| Day 3, 10:00-11:00 | Accessibility audit (WCAG 2.1 AA) | 1h |
| Day 3, 11:00-12:00 | PR creation + manual testing | 1h |

**Backend: BE-006 Start (Days 2-3, parallel)**

| Time | Task | Duration |
|------|------|----------|
| Day 2, 14:00-17:00 | Socket.io server setup (3h) | 3h |
| Day 3, 09:00-12:00 | WebSocket auth middleware (3h) | 3h |
| Day 3, 13:00-17:00 | Event handlers setup (4h) | 4h |

**Exit Criteria:**
- [ ] **FE-002:** Login form working, error messages displayed, 90%+ coverage
- [ ] **BE-006:** Socket.io running, auth working, ready for Day 4 completion

**Next:** FE-003 ready (depends on FE-001 ✅), BE-006 continues

---

### Day 3-4: FE-003 RBAC Navigation (8-10 hours) + BE-007 Start (Parallel)

**Frontend: FE-003 (Days 3-4, 8-10 hours)**

| Time | Task | Duration |
|------|------|----------|
| Day 3, 13:00-13:30 | Create branch `task/FE-003-rbac-nav` | 30min |
| Day 3, 13:30-14:30 | Navigation component with role filtering | 1h |
| Day 3, 14:30-15:30 | Sidebar visibility rules per role | 1h |
| Day 3, 15:30-16:30 | Route protection middleware | 1h |
| Day 4, 09:00-10:00 | RBAC decorators integration | 1h |
| Day 4, 10:00-11:00 | Unit tests (85%+ coverage) | 1h |
| Day 4, 11:00-12:00 | E2E tests (4 roles) | 1h |
| Day 4, 12:00-13:00 | LUNCH | 1h |
| Day 4, 13:00-14:00 | Manual testing + PR | 1h |

**Backend: BE-007 Start (Days 3-4, parallel)**

| Time | Task | Duration |
|------|------|----------|
| Day 3, 13:00-17:00 | Message inbound routing logic (4h) | 4h |
| Day 4, 09:00-13:00 | Message outbound + status tracking (4h) | 4h |
| Day 4, 14:00-17:00 | Retry logic + BullMQ setup (3h) | 3h |

**Exit Criteria:**
- [ ] **FE-003:** Role-based navigation working, all roles tested, 85%+ coverage
- [ ] **BE-007:** Message routing 50% complete, ready for Day 5 finish

**Next:** FE-004 ready (depends on BE-006 + FE-001 ✅)

---

### Day 4-5: FE-004 API Integration (10-12 hours) + BE-007 Complete (Parallel)

**Frontend: FE-004 (Days 4-5, 10-12 hours)**

| Time | Task | Duration |
|------|------|----------|
| Day 4, 14:00-14:30 | Create branch `task/FE-004-api-integration` | 30min |
| Day 4, 14:30-16:30 | API client setup (Axios + interceptors) | 2h |
| Day 5, 09:00-10:00 | TanStack Query hooks (useConversations, useMessages) | 1h |
| Day 5, 10:00-11:00 | Zod schema validation | 1h |
| Day 5, 11:00-12:00 | Error handling (401, 403, 5xx, network) | 1h |
| Day 5, 12:00-13:00 | LUNCH | 1h |
| Day 5, 13:00-14:00 | Retry logic implementation | 1h |
| Day 5, 14:00-15:00 | Logging + correlation ID injection | 1h |
| Day 5, 15:00-16:00 | Unit tests (85%+ coverage) | 1h |
| Day 5, 16:00-17:00 | PR creation + manual testing | 1h |

**Backend: BE-007 Complete (Days 4-5, parallel)**

| Time | Task | Duration |
|------|------|----------|
| Day 4, 14:00-17:00 | Conversation status FSM + auto-reopen (3h) | 3h |
| Day 5, 09:00-11:00 | Dead-letter queue setup (2h) | 2h |
| Day 5, 11:00-12:00 | WebSocket event publishing (1h) | 1h |
| Day 5, 12:00-13:00 | LUNCH | 1h |
| Day 5, 13:00-15:00 | Audit logging + error handling (2h) | 2h |
| Day 5, 15:00-16:00 | Unit tests (90%+ coverage) (1h) | 1h |
| Day 5, 16:00-17:00 | PR creation (1h) | 1h |

**Exit Criteria:**
- [ ] **FE-004:** API client working, all queries/mutations functional, 85%+ coverage
- [ ] **BE-007:** Complete message routing flow, retry logic working, 90%+ coverage
- [ ] **BE-006:** Complete (carried over from Day 4)

**Next:** All 6 core tasks (FE-001 to FE-004, BE-006, BE-007) complete ✅

---

### Day 6: Integration Testing (QA-001, 8 hours)

| Time | Task | Duration |
|------|------|----------|
| 09:00-10:00 | Setup test database + fixtures | 1h |
| 10:00-11:00 | Auth flow integration tests | 1h |
| 11:00-12:00 | API client integration tests | 1h |
| 12:00-13:00 | LUNCH | 1h |
| 13:00-14:00 | WebSocket integration tests | 1h |
| 14:00-15:00 | Message routing integration tests | 1h |
| 15:00-16:00 | Edge case testing | 1h |
| 16:00-17:00 | Coverage report + PR | 1h |

**Exit Criteria:**
- [ ] All integration tests pass
- [ ] Coverage ≥80%
- [ ] Edge cases identified + tests added
- [ ] QA-001 PR created

---

### Day 6-7: E2E Testing & Documentation (QA-002 + DOC-001/002, 14 hours)

**E2E Testing (QA-002, Days 6-7, 6 hours):**

| Time | Task | Duration |
|------|------|----------|
| Day 6, 16:00-17:00 | Create branch `task/QA-002-e2e-tests` | 1h |
| Day 7, 09:00-10:00 | Playwright setup + test fixtures | 1h |
| Day 7, 10:00-11:00 | Auth flow E2E tests (login, logout, session) | 1h |
| Day 7, 11:00-12:00 | Message flow E2E tests (send, receive, status) | 1h |
| Day 7, 12:00-13:00 | LUNCH | 1h |
| Day 7, 13:00-14:00 | RBAC E2E tests (role-based access) | 1h |
| Day 7, 14:00-15:00 | PR creation + manual verification | 1h |

**Documentation (DOC-001 + DOC-002, Days 6-7, 8 hours):**

| Time | Task | Duration |
|------|------|----------|
| Day 6, 13:00-14:30 | Update API docs (FE-004 endpoints) | 1.5h |
| Day 6, 14:30-15:30 | WebSocket event docs (BE-006 types) | 1h |
| Day 7, 15:00-16:00 | Message routing docs (BE-007 flow) | 1h |
| Day 7, 16:00-17:00 | Integration guide + examples | 1h |
| Day 7, 17:00+ | Create both DOC PRs | 1.5h |

**Exit Criteria:**
- [ ] **QA-002:** E2E tests pass, all scenarios covered, 95%+ passing
- [ ] **DOC-001:** API documentation updated with 10+ new endpoints
- [ ] **DOC-002:** WebSocket events documented with examples

---

### Day 7-8: Final QA & Merge (2-4 hours)

| Time | Task | Duration |
|------|------|----------|
| Day 8, 09:00-10:00 | Architect review of all PRs | 1h |
| Day 8, 10:00-11:00 | Fix any comments from reviews | 1h |
| Day 8, 11:00-12:00 | Final manual testing (smoke test) | 1h |
| Day 8, 12:00-12:30 | Merge all PRs to `dev` | 30min |

**Exit Criteria:**
- [ ] All 10 PRs merged to `dev`
- [ ] All tests passing
- [ ] No merge conflicts
- [ ] Production build successful

---

## Success Criteria

### Pre-Development Checklist

Before any coding starts:
- [ ] Week 1 code merged to `dev`
- [ ] Frontend dependencies installed
- [ ] Backend dependencies installed
- [ ] Test database ready
- [ ] Environment variables configured

### Per-Task Success Criteria

#### FE-001 ✅
- [ ] BetterAuth client configured and working
- [ ] AuthProvider wraps app
- [ ] useAuth() hook returns correct interface
- [ ] Session restoration working on page load
- [ ] Token refresh working before expiry
- [ ] Error handling covers 401, 403, network
- [ ] 85%+ test coverage
- [ ] Manual testing completed
- [ ] PR created, reviewed, and merged

#### FE-002 ✅
- [ ] Login form with email + password fields
- [ ] Client-side validation (required, email format, min 8 chars)
- [ ] Server-side error messages displayed
- [ ] Loading state (button shows spinner, disabled)
- [ ] Logout button in header
- [ ] Forgot password link
- [ ] 90%+ test coverage
- [ ] E2E tests (happy path, invalid creds, validation errors)
- [ ] Accessibility audit (WCAG 2.1 AA)
- [ ] Mobile responsive
- [ ] PR created, reviewed, and merged

#### FE-003 ✅
- [ ] Sidebar shows different items per role
- [ ] Super Admin: All items visible
- [ ] Admin: No user management
- [ ] Manager: No integration settings
- [ ] User: Only Inbox visible
- [ ] Routes protected by role
- [ ] Unauthorized access redirects to /inbox
- [ ] 85%+ test coverage
- [ ] E2E tests (all 4 roles)
- [ ] PR created, reviewed, and merged

#### FE-004 ✅
- [ ] API client configured (base URL, headers, auth)
- [ ] Axios interceptors working (error handling, retries)
- [ ] TanStack Query hooks working
- [ ] Zod schema validation on responses
- [ ] Error handling (401 → logout, 403 → toast, 5xx → retry)
- [ ] Retry logic (max 3, exponential backoff)
- [ ] Correlation ID injected in requests
- [ ] Logging (requests, responses, errors)
- [ ] 85%+ test coverage
- [ ] PR created, reviewed, and merged

#### BE-006 ✅
- [ ] Socket.io server running
- [ ] CORS configured (frontend URL)
- [ ] Compression enabled
- [ ] JWT authentication working
- [ ] 8 event types defined + working
- [ ] Heartbeat/ping-pong working
- [ ] Reconnection logic (exponential backoff, 5 attempts)
- [ ] Message buffering (1-hour retention)
- [ ] Error handling (auth failed, connection error)
- [ ] Logging (connections, disconnections, events)
- [ ] 85%+ test coverage
- [ ] Manual testing (connect, send events, disconnect, reconnect)
- [ ] PR created, reviewed, and merged

#### BE-007 ✅
- [ ] Inbound message routing working (webhook → DB → WebSocket)
- [ ] Outbound message routing working (API → Queue → Platform → DB → WebSocket)
- [ ] Conversation status FSM working (open → pending → resolved → auto-reopen)
- [ ] Message status tracking (pending → sent/failed)
- [ ] Retry logic (1m, 5m, 30m; 3 attempts)
- [ ] Dead-letter queue working (failed messages → DLQ)
- [ ] WebSocket event publishing (message.received, message.sent, etc.)
- [ ] Audit logging (all state changes)
- [ ] Error handling (platform errors, network errors)
- [ ] 90%+ test coverage
- [ ] PR created, reviewed, and merged

#### QA-001 ✅
- [ ] Integration test database setup
- [ ] Auth flow integration tests (session, token, logout)
- [ ] API integration tests (CRUD operations)
- [ ] WebSocket integration tests (connect, events, reconnect)
- [ ] Message routing integration tests (inbound, outbound, retry)
- [ ] Edge case tests (network failures, timeouts, invalid data)
- [ ] Coverage ≥80%
- [ ] PR created, reviewed, and merged

#### QA-002 ✅
- [ ] E2E test setup (Playwright, test fixtures)
- [ ] Auth E2E tests (login, logout, session persistence)
- [ ] Message E2E tests (send, receive, status)
- [ ] RBAC E2E tests (role-based access, redirects)
- [ ] Error handling E2E tests (invalid creds, network errors)
- [ ] All tests passing
- [ ] PR created, reviewed, and merged

#### DOC-001 ✅
- [ ] API documentation updated (`.docs/02-api-and-data-model.md`)
- [ ] New endpoints documented (messages, dead-letter queue)
- [ ] Request/response examples provided
- [ ] Error codes documented
- [ ] PR created, reviewed, and merged

#### DOC-002 ✅
- [ ] WebSocket events documented (`.docs/02-api-and-data-model.md`)
- [ ] 8 event types documented with examples
- [ ] Message structure examples
- [ ] Reconnection strategy documented
- [ ] PR created, reviewed, and merged

### Week 2 Completion Checklist

**All tasks done when:**
- [ ] All 10 PRs merged to `dev`
- [ ] All tests passing (coverage ≥80% overall)
- [ ] Zero merge conflicts
- [ ] Zero TODO comments in code
- [ ] Documentation updated
- [ ] Architecture compliance verified
- [ ] No `any` types in code
- [ ] All error handling implemented
- [ ] All logging implemented
- [ ] All tests documented in PR
- [ ] Manual testing documented in PR
- [ ] Production build successful

---

## Quality Gates (All PRs)

| Gate | Requirement | Tool | Blocker |
|------|-------------|------|---------|
| **Tests Pass** | 100% of tests pass | GitHub Actions | Yes |
| **Coverage** | ≥80% (frontend), ≥90% (backend) | Codecov | Yes |
| **Linting** | No ESLint errors | GitHub Actions | Yes |
| **Types** | No `any`, compiles | TypeScript | Yes |
| **Security** | No secrets in code | GitGuardian | Yes |
| **Review** | Architect approval | Manual | Yes |
| **Docs** | API docs updated | Manual | No |

---

## Communication Plan

### Daily Standup (9:00 AM)

**Format:**
```
## Yesterday
- Completed: [task + PR link]
- Issues: [blockers, if any]

## Today
- Working on: [current task]
- Estimated completion: [EOD or tomorrow]

## Risks
- [new risks]
```

### Milestone Updates

**When:** After each PR merged

**Audience:** Product Owner, Architect, Team

**Format:**
```
✅ TASK COMPLETE: [Task ID]
- PR: [link]
- Coverage: [X%]
- Status: Merged to dev
- Next: [next task]
```

---

## Risk Management

### High Priority Risks

| Risk | Mitigation | Owner | Status |
|------|-----------|-------|--------|
| Frontend state desync | FE-004 implements cache invalidation | Frontend Dev | ⏳ Active |
| WebSocket reconnection fails | BE-006 implements exponential backoff | Backend Dev | ⏳ Active |
| Message retries create duplicates | BE-007 implements idempotent IDs | Backend Dev | ⏳ Active |
| Auth token expiry not handled | FE-001 implements auto-refresh | Frontend Dev | ⏳ Active |

### Medium Priority Risks

| Risk | Mitigation | Owner | Status |
|------|-----------|-------|--------|
| API endpoint response mismatch | FE-004 validates with Zod | Frontend Dev | ⏳ Active |
| RBAC bypass (role spoofing) | BE-005 enforced Week 1, FE-003 filters | Backend Dev | ✅ Handled |
| Database performance issues | Use pagination + indexes | Backend Dev | ✅ Planned |

---

## Rollback Plan

### If FE-004 API Client Fails

**Trigger:** Requests failing, responses not validating

**Steps:**
1. Revert FE-004 PR
2. Debug API client offline
3. Fix issue
4. Create new PR

**Estimated Time:** 2 hours

### If BE-006 WebSocket Fails

**Trigger:** Connections not working, events not delivering

**Steps:**
1. Revert BE-006 PR
2. Debug Socket.io setup offline
3. Fix issue
4. Create new PR

**Estimated Time:** 3 hours

### If BE-007 Message Routing Fails

**Trigger:** Messages not routing, retries not working

**Steps:**
1. Revert BE-007 PR
2. Debug message flow offline
3. Fix issue
4. Create new PR

**Estimated Time:** 4 hours

---

## Contingency Plan (If Behind Schedule)

**If at end of Day 5, not all 6 core tasks complete:**

1. **Defer QA testing to Week 3** (if integration tests pass)
2. **Merge core tasks early** (with "testing" label)
3. **Continue testing in parallel** with Week 3 development
4. **Prioritize critical tasks:** FE-001, FE-002, BE-006 (must complete)
5. **Defer documentation** to end of Week 2

**Expected Outcome:** All core features working by EOD Day 5, full coverage by EOD Day 8

---

## Next Steps (Immediate - Today)

### Developers

1. **Review Documentation**
   - [ ] Read week2-product-owner-review.md (60 min)
   - [ ] Read week2-architect-review.md (60 min)
   - [ ] Read this action plan (30 min)

2. **Prepare Environment**
   - [ ] Verify Week 1 code merged
   - [ ] `git pull origin dev`
   - [ ] Install dependencies: `pnpm install`
   - [ ] Run tests to verify setup: `pnpm test`

3. **Setup Branches**
   - [ ] Will create task branches during development (one per day)

### Architect

1. **Final Sign-Off**
   - [ ] Approve this action plan
   - [ ] Confirm zero architectural blockers
   - [ ] Schedule weekly checkpoint meetings

### Product Owner

1. **Final Sign-Off**
   - [ ] Approve this action plan
   - [ ] Confirm all requirements captured
   - [ ] Schedule daily standup (9:00 AM)

---

## Document References

| Document | Purpose | Link |
|----------|---------|------|
| **Product Owner Review** | Requirements | `.docs/plans/week2-product-owner-review.md` |
| **Architect Review** | Technical decisions | `.docs/plans/week2-architect-review.md` |
| **Product Spec** | User stories | `.docs/01-product-specification.md` |
| **API Contract** | Endpoints | `.docs/02-api-and-data-model.md` |
| **Implementation Guide** | Architecture | `.docs/03-implementation-guide.md` |
| **QA Strategy** | Testing | `.docs/04-qa-and-testing.md` |

---

## Document Metadata

**Created:** 2026-01-31  
**Author:** Product Owner + Architect  
**Status:** Ready to Execute  
**Approvals:**
- Product Owner: ✅ APPROVED
- Architect: ✅ APPROVED
- Tech Lead: _______________

**Next Review:** Daily standup (9:00 AM)  
**Last Updated:** 2026-01-31

**Approval Date:** _________________  
**Approved by:** _________________
