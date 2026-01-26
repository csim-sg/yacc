# Week 2 Quick Reference - One-Page Summary

**Period:** Monday Jan 27 - Friday Jan 31, 2026 (8 business days)  
**Team:** Single developer (sequential tasks)  
**Status:** ✅ Fully Approved (Product Owner + Architect)

---

## 📋 Week 2 Scope (10 Tasks)

### Frontend (4 tasks, 30-40h)
| Task | Hours | Status |
|------|-------|--------|
| **FE-001** - Auth Integration | 10-12h | ✅ Ready |
| **FE-002** - Login UI | 10-12h | ✅ Ready |
| **FE-003** - RBAC Navigation | 8-10h | ✅ Ready |
| **FE-004** - API Integration | 10-12h | ✅ Ready |

### Backend (2 tasks, 26-30h)
| Task | Hours | Status |
|------|-------|--------|
| **BE-006** - WebSocket | 12-14h | ✅ Ready |
| **BE-007** - Message Routing | 14-16h | ✅ Ready |

### Quality & Docs (4 tasks, 22h)
| Task | Hours | Status |
|------|-------|--------|
| **QA-001** - Integration Tests | 8h | ✅ Ready |
| **QA-002** - E2E Tests | 6h | ✅ Ready |
| **DOC-001** - API Docs | 4h | ✅ Ready |
| **DOC-002** - WebSocket Docs | 4h | ✅ Ready |

**Total:** 54-72 hours | **Capacity:** 64 hours ✅

---

## 🗓️ Key Dates & Milestones

| Milestone | Target | Status |
|-----------|--------|--------|
| **Day 1-2** | FE-001 complete | Sprint start |
| **Day 2-3** | FE-002 + BE-006 start | Parallel work |
| **Day 3-4** | FE-003 + BE-007 start | Parallel work |
| **Day 4-5** | FE-004 + BE-007 complete | Core feature sprint |
| **Day 6** | Integration testing | QA phase |
| **Day 6-7** | E2E + Documentation | Final QA |
| **Day 8** | All PRs merged | Week 2 complete |

---

## 👥 Team Capacity

**Developer:** Single person, sequential tasks (one at a time)

**Daily Availability:** 8 hours/day (with 1-hour lunch)

**Parallel Work:** Frontend FE-002 ↔ Backend BE-006 (Days 2-3)

---

## ✅ Success Criteria Checklist

### Must Haves (Blocking)
- [ ] All 10 tasks in "Done" status
- [ ] All tests passing (80%+ coverage)
- [ ] All 10 PRs merged to `dev`
- [ ] No `any` types in code
- [ ] No console errors/warnings
- [ ] Architect approval on all PRs

### Should Haves (Important)
- [ ] 90%+ test coverage on backend
- [ ] 85%+ test coverage on frontend
- [ ] E2E tests cover happy path + errors
- [ ] Documentation updated
- [ ] Manual testing documented

### Nice to Haves (Optional)
- [ ] Performance benchmarks
- [ ] Load testing results
- [ ] Accessibility audit report

---

## 🚨 Approval Status

| Reviewer | Status | Signature |
|----------|--------|-----------|
| **Product Owner** | ✅ APPROVED | ___________ |
| **Architect** | ✅ APPROVED | ___________ |
| **Tech Lead** | Pending | ___________ |

**Blocking Issues:** ✅ **NONE**

---

## 🏗️ Critical Path

```
FE-001 (10-12h)
  ↓
FE-002 (10-12h) ← FE-003 (8-10h) parallel
  ↓                    ↓
FE-004 (10-12h)    BE-007 (14-16h) parallel
  ↓                    ↓
QA-001 (8h) ─────→ QA-002 (6h)
  ↓
DOC-001 (4h) + DOC-002 (4h)
  ↓
Merge All ✅
```

**Total Path:** 8 days (sequential with parallelization)

---

## 🔑 Key Technologies

**Frontend:**
- TanStack Query (server state)
- Zustand (client state)
- BetterAuth React client
- Zod (validation)
- React Hook Form (forms)
- DaisyUI (components)

**Backend:**
- Socket.io (WebSocket)
- BullMQ + Redis (queue)
- Express + routing-controllers
- Pino (logging)
- Zod (validation)

---

## 📊 Dependencies Status

| Dependency | Task | Status | Week |
|-----------|------|--------|------|
| Pino logging | BE-027 | ✅ Done | Week 1 |
| BetterAuth | BE-003 | ✅ Done | Week 1 |
| RBAC middleware | BE-005 | ✅ Done | Week 1 |
| DB schema | BE-002 | ✅ Done | Week 1 |
| Redis | BE-013 | ✅ Done | Week 0 |
| PostgreSQL | BE-001 | ✅ Done | Week 0 |

**All dependencies met. No blockers.** ✅

---

## 🎯 Definition of Done (Per Task)

### Frontend Tasks
- [ ] Code complete (no TODOs)
- [ ] Unit tests: 85%+ coverage
- [ ] E2E tests: Happy path + errors
- [ ] Manual testing: Documented
- [ ] PR created + Architect approved
- [ ] Merged to `dev`

### Backend Tasks
- [ ] Code complete (no TODOs)
- [ ] Unit tests: 90%+ coverage
- [ ] Integration tests: Passed
- [ ] Manual testing: Documented
- [ ] PR created + Architect approved
- [ ] Merged to `dev`

### QA Tasks
- [ ] All tests passing
- [ ] Coverage ≥80%
- [ ] Edge cases identified + tested
- [ ] PR created + approved
- [ ] Merged to `dev`

### Doc Tasks
- [ ] Documentation complete + accurate
- [ ] Examples provided
- [ ] PR created + approved
- [ ] Merged to `dev`

---

## ⚡ Daily Standup Template

**Time:** 9:00 AM daily  
**Duration:** 15 minutes

```
## Yesterday
- Completed: [task] (PR #XXX)
- Coverage: [XX%]
- Issues: None / [list]

## Today  
- Working on: [task]
- Expected completion: [time]

## Risks
- [any new risks or blockers]
```

---

## 🚀 Launch Checklist (Day 1)

Before development starts:
- [ ] Week 1 code merged to `dev`
- [ ] Dependencies installed: `pnpm install`
- [ ] Tests pass: `pnpm test`
- [ ] Database ready (check schema)
- [ ] Environment vars configured
- [ ] Redis running (docker-compose up)
- [ ] Read all Week 2 documents

---

## 📞 Communication

**Daily:** 9:00 AM standup  
**Weekly:** Friday review (if needed)  
**Blockers:** Immediate Slack ping + call  

**Contacts:**
- Product Owner: [via AGENTS.md]
- Architect: [via AGENTS.md]
- Team Lead: [via AGENTS.md]

---

## 🔗 Quick Links

| Document | Purpose |
|----------|---------|
| [week2-product-owner-review.md](./week2-product-owner-review.md) | Requirements (60-80 lines/section) |
| [week2-architect-review.md](./week2-architect-review.md) | Technical decisions (100-120 lines/section) |
| [week2-action-plan.md](./week2-action-plan.md) | Day-by-day execution (80-100 lines/section) |
| [AGENTS.md](../AGENTS.md) | Project context |
| [01-product-specification.md](../01-product-specification.md) | User stories (Section 8) |
| [02-api-and-data-model.md](../02-api-and-data-model.md) | API contract |

---

## 💾 Git Workflow

**Branch naming:**
```
task/FE-001-auth-integration
task/FE-002-login-ui
task/FE-003-rbac-navigation
task/FE-004-api-integration
task/BE-006-websocket-setup
task/BE-007-message-routing
task/QA-001-integration-tests
task/QA-002-e2e-tests
task/DOC-001-api-documentation
task/DOC-002-websocket-events
```

**Commit message format:**
```
[TASK ID] Brief description

Longer description if needed.

Tests: XX% coverage
Manual testing: [documented]
PR: #XXX
```

**PR merge:** Squash and merge to `dev`

---

## 🎓 Training Materials

**Required Reading (1-2 hours):**
1. Read week2-product-owner-review.md (1 hour)
2. Read week2-architect-review.md (1 hour)
3. Review AGENTS.md (30 min)

**Reference During Development:**
- TanStack Query docs: https://tanstack.com/query
- Socket.io docs: https://socket.io/docs
- BetterAuth docs: https://better-auth.com
- DaisyUI docs: https://daisyui.com

---

## ❌ Common Pitfalls to Avoid

| Pitfall | Impact | Prevention |
|---------|--------|-----------|
| Use Redux instead of TanStack Query | High bundle, overkill | Stick to TanStack Query |
| Store JWT in localStorage | Security risk (XSS) | Use HTTP-only cookies (BetterAuth) |
| No correlation ID in logs | Hard to trace errors | FE-004 injects correlation ID |
| Implement custom WebSocket | Reinventing the wheel | Use Socket.io |
| Skip error handling | App crashes | Handle all error codes (401, 403, 5xx) |
| No test coverage | Regressions | Maintain 80%+ coverage |
| Skip E2E tests | User-facing bugs | Use Playwright for critical flows |

---

## 📈 Progress Tracking

**Track using GitHub Project:**
- Create task for each day's work
- Move to "In Progress" when starting
- Move to "Done" when PR merged
- Update daily standup with status

**Example status:**
```
Day 1-2: FE-001 ✅ Done (PR #XX merged)
Day 2-3: FE-002 🔄 In Progress (70% complete)
Day 4-5: BE-006 ⏳ Ready (start Monday)
```

---

## 🎉 Week 2 Complete Criteria

**All tasks done when:**
1. ✅ All 10 tasks merged to `dev`
2. ✅ All tests passing (coverage ≥80%)
3. ✅ Zero merge conflicts
4. ✅ Production build succeeds
5. ✅ Architect sign-off on all PRs
6. ✅ Documentation updated
7. ✅ Manual testing documented
8. ✅ No `any` types in code
9. ✅ No console warnings/errors
10. ✅ Ready for Week 3 sprint

**Expected Date:** Friday, January 31 EOD

---

## 📝 Document Metadata

**Created:** 2026-01-31  
**Type:** Quick Reference  
**Status:** ✅ Ready  
**Last Updated:** 2026-01-31

**Print this page or keep browser tab open during development** 🔖

---

*For detailed information, see full Week 2 planning documents:*
- *Product Owner Review (detailed requirements)*
- *Architect Review (technical decisions)*
- *Action Plan (execution timeline)*
