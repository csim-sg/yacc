# GitHub Backlog Triage (GH-032-207)

**Date**: February 25, 2026  
**Analysis Scope**: 176 GitHub issues (GH-032 through GH-207)  
**Status**: Ready for prioritization and assignment

---

## Executive Summary

### Key Findings

**176 total issues analyzed:**
- ✅ **80+ Phase 1 Features**: Mostly CLOSED (MVP core complete)
- 🚧 **65 Open Issues**: Active work across tech debt, testing, infrastructure, documentation
- ✅ **25 Closed**: Reference/completed items
- ⚠️ **1 Phase 2 Blocker**: GH-112 (UUID refactor for tags/routing rules)

### Critical Discovery: Phase 2 Blocker

**GH-112** - UUID refactor incomplete for tags/raw_payloads/routing_rule_executions
- **Problem**: Schema uses serial IDs, but types expect UUIDs (mismatch)
- **Impact**: Blocks Phase 2 collaboration features (tags, routing rules, notes)
- **Action**: Schedule as **first task after Phase 1 release**

### Release Blockers (Must Fix Before Phase 1 Release)

| Category | Blocker | Issue |
|----------|---------|-------|
| **Type Safety** | `any` types in backend/frontend | GH-166, GH-167 |
| **Architecture** | Broken logger/auth wiring | GH-165 |
| **API Contract** | BE-007 PR issues (3 items) | GH-199, GH-203, GH-204 |
| **Build/Test** | Schema casing, TS config | GH-164, GH-175 |
| **QA/Testing** | Integration/E2E tests | GH-195, GH-196, GH-197 |
| **Infrastructure** | Docker, migrations, staging | HD-001, HD-004, HD-008, HD-009 |
| **Security** | Security review | HD-007 |

---

## Categorized Backlog (Prioritized)

### 1. PHASE 2 BLOCKERS (1 item) ⚠️

**GH-112: UUID refactor incomplete for tags/raw_payloads/routing_rule_executions**
- **Severity**: Blocker
- **Reason**: Schema inconsistency (serial IDs vs UUID types) breaks Phase 2 features
- **Ready Now**: NO - Schedule after Phase 1 release (first Phase 2 task)
- **Owner**: Backend
- **Estimate**: 1-2 days
- **Action**: Create Phase 2 Epic, add as first task

---

### 2. TECH DEBT (14 items) 🔴 HIGH PRIORITY

**Type Safety Issues (CI/CD Blockers):**

| Issue | Title | Owner | Estimate | Ready? | Action |
|-------|-------|-------|----------|--------|--------|
| GH-166 | Eliminate `any` in backend | Backend | 4-6 hrs | YES ✅ | Start now - blocks type-check |
| GH-167 | Eliminate `any` in frontend | Frontend | 3-4 hrs | YES ✅ | Start now - blocks type-check |
| GH-164 | Fix schema filename casing | Backend | 2 hrs | YES ✅ | Fix (Attachment vs attachment) |
| GH-175 | Fix TypeScript config | Backend | 1 hr | YES ✅ | Change moduleResolution to "bundler" |

**Architecture Alignment:**

| Issue | Title | Owner | Estimate | Ready? | Action |
|-------|-------|-------|----------|--------|--------|
| GH-165 | Backend arch alignment | Backend | 6-8 hrs | YES ✅ | Fix logger/auth wiring - CRITICAL |

**Code Quality:**

| Issue | Title | Owner | Estimate | Ready? | Action |
|-------|-------|-------|----------|--------|--------|
| GH-173 | Fix config duplicate exports | Backend | 2 hrs | YES ✅ | Fix r2.ts, redis.ts, email.ts |
| GH-174 | Fix messageRetryWorker imports | Backend | 1 hr | YES ✅ | Fix broken imports |
| GH-176 | Standardize logger in configs | Backend | 2 hrs | YES ✅ | Use correct logger import path |
| GH-139 | WebSocket constants (ADR-005) | Frontend | 1 hr | NO ⏳ | After type-check fixes |
| GH-168 | Remove barrel exports | Full-stack | 6-8 hrs | NO ⏳ | After type-check fixes |

**Security & Standards:**

| Issue | Title | Owner | Estimate | Ready? | Action |
|-------|-------|-------|----------|--------|--------|
| GH-171 | Replace console with pino | Backend | 2-3 hrs | YES ✅ | Remove console.*, use logger |
| GH-170 | Remove .env.test from git | DevOps | 30 min | YES ✅ | Add to .gitignore + use env injection |
| GH-169 | Remove package-lock.json | DevOps | 30 min | YES ✅ | Delete conflicting lock file |
| GH-172 | Frontend auth token storage | Frontend | N/A | NO ⏳ | ADR decision needed (localStorage vs HttpOnly) |

**Summary**: 11 ready to start now, 3 blocked on type-check fixes. **Recommend parallel execution** of all "YES" items.

---

### 3. PR REVIEW ISSUES (7 items, 3 still open) 🟠 HIGH PRIORITY

**BE-007 PR Defects (Must Fix Before Merge):**

| Issue | Title | Status | Owner | Action |
|-------|-------|--------|-------|--------|
| GH-199 | Response contract mismatch | OPEN | Backend | Fix: align pageSize/total with spec |
| GH-203 | Missing observability (logs/metrics) | OPEN | Backend | Add: structured logs, metrics, traces |
| GH-204 | Generic error instead of HTTP errors | OPEN | Backend | Fix: use BadRequestError/NotFoundError |
| GH-200 | Global /api prefix used | CLOSED ✅ | Backend | Already fixed |
| GH-201 | `any` in conversation.service | CLOSED ✅ | Backend | Already fixed |
| GH-202 | Missing RBAC for sendMessage | CLOSED ✅ | Backend | Already fixed |

**Summary**: 3 open issues blocking BE-007 PR merge. **All must be fixed before Phase 1 release**.

---

### 4. TESTING/QA (20 items) 🟡 NON-BLOCKING FOR FEATURES

**Integration Tests (Jest/Supertest):**

| Issue | Title | Owner | Estimate | Blocker? | Ready? |
|-------|-------|-------|----------|----------|--------|
| GH-195 | Integration tests (BE-007-010) | QA | 12-15 hrs | NO | YES ✅ (when BE-007 ready) |
| GH-197 | WebSocket integration tests | QA | 10-12 hrs | NO | YES ✅ (when BE-017-019 ready) |

**E2E Tests (Playwright):**

| Issue | Title | Owner | Estimate | Blocker? | Ready? |
|-------|-------|-------|----------|----------|--------|
| GH-196 | E2E tests (inbox, messaging) | QA | 15-18 hrs | NO | YES ✅ (when FE-008-011 ready) |

**Summary**: Non-blocking for feature development but **required for Phase 1 release**. Can start in parallel with final backend/frontend polish.

---

### 5. DOCUMENTATION (19 items) 🟢 MEDIUM PRIORITY

**Critical API/Schema Alignment:**

| Issue | Title | Owner | Estimate | Ready? | Blocker? |
|-------|-------|-------|----------|--------|----------|
| GH-118/119/120 | Align audit log scope | Product/Docs | 2-3 hrs | YES ✅ | NO (clarification only) |
| GH-206 | Clarify auth endpoint prefix | Architect | 30 min | YES ✅ | YES - blocks endpoint decision |
| GH-207 | Enforce /api prefix on endpoints | Backend | 4-6 hrs | AFTER GH-206 | YES - affects all routes |

**Implementation Guides:**

| Issue | Title | Owner | Estimate | Ready? |
|-------|-------|-------|----------|--------|
| DOC-007 | Environment variables reference | Docs | 2 hrs | YES ✅ |
| DOC-008 | Deployment guide | Docs | 4 hrs | NO ⏳ (after infra ready) |
| DOC-003/004 | IRC integration guides | Docs | 4-6 hrs | NO ⏳ (after INT-001 ready) |
| DOC-005 | Quick reference updates | Docs | 2 hrs | NO ⏳ (after endpoints final) |

**Planning Documents:**

| Issue | Title | Owner | Estimate | Ready? |
|-------|-------|-------|----------|--------|
| HD-010/011 | Phase 1 handoff + Phase 2 meeting | Product | 3-4 hrs | NO ⏳ (at Phase 1 completion) |
| HD-012 | Archive Phase 1 artifacts | DevOps | 1 hr | NO ⏳ (post-Phase 1) |

**Summary**: 5 items ready to start, 6 blocked on dependencies. **DOC-007 can start immediately**.

---

### 6. INFRASTRUCTURE/DEVOPS (15 items) 🔴 HIGH PRIORITY

**CI/CD & Testing Infra:**

| Issue | Title | Owner | Estimate | Ready? | Blocker? |
|-------|-------|-------|----------|--------|----------|
| HD-005 | Set up CI/CD pipeline | DevOps | 6-8 hrs | NO ⏳ | YES (blocks PR checks) |
| HD-008 | Deploy to staging | DevOps | 4-6 hrs | NO ⏳ | YES (required for release) |
| HD-009 | Run QA regression on staging | QA | 3-4 hrs | NO ⏳ | YES (release blocker) |

**Docker & Environment:**

| Issue | Title | Owner | Estimate | Ready? | Blocker? |
|-------|-------|-------|----------|--------|----------|
| HD-001 | Docker Compose configuration | DevOps | 3-4 hrs | NO ⏳ | YES - blocked by BE-020 (R2) |
| HD-002 | Production Docker image (backend) | DevOps | 2-3 hrs | NO ⏳ | YES - blocked by BE-025 (email) |
| HD-003 | Production Docker image (frontend) | DevOps | 1-2 hrs | NO ⏳ | YES (release blocker) |
| HD-004 | Database migration scripts | DevOps | 2-3 hrs | YES ✅ | YES (ready when BE-002 final) |
| HD-006 | Production env template | DevOps | 1 hr | DONE ✅ | N/A |

**Security & Review:**

| Issue | Title | Owner | Estimate | Ready? | Blocker? |
|-------|-------|-------|----------|--------|----------|
| HD-007 | Security review | Security/Architect | 4-6 hrs | NO ⏳ | YES (after BE-005 complete) |

**Summary**: 3 items blocked on deferred Phase 1 features (BE-020, BE-025). **HD-004 can start when BE-002 finalized**. Others have clear blockers.

---

### 7. PHASE 1 FEATURES (80+ items) ✅ MOSTLY CLOSED

**Sample Completed Features:**
- ✅ GH-183: BE-007 Inbox API
- ✅ GH-184: BE-008 Conversation Detail
- ✅ GH-185: BE-009/010 Message Send/Retrieve
- ✅ GH-186/187/188: BE-017/018/019 WebSocket Events
- ✅ GH-189/190/191: FE-008/009/010 UI Pages
- ✅ GH-192/193/194: FE-013/014/015 WebSocket Listeners
- ✅ GH-109: BE-028 Shared Types Package
- ✅ GH-105: BE-025 Email Service
- ✅ GH-107: BE-027 Structured Logging

**Status**: ~90% of Phase 1 features implemented. Remaining work is tech debt, testing, and infrastructure.

---

## Actionable Items Summary

### 🔴 START THIS WEEK (Type Safety & Architecture)

**Backend Developer:**
```
1. GH-166 - Eliminate `any` in backend (4-6 hrs)
2. GH-175 - Fix TypeScript config (1 hr)
3. GH-164 - Fix schema casing (2 hrs)
4. GH-173 - Fix config exports (2 hrs)
5. GH-174 - Fix messageRetryWorker imports (1 hr)
6. GH-176 - Standardize logger (2 hrs)
7. GH-165 - Backend arch alignment (6-8 hrs) ⚠️ CRITICAL
```

**Frontend Developer:**
```
1. GH-167 - Eliminate `any` in frontend (3-4 hrs)
2. GH-171 - Replace console with pino (2-3 hrs)
```

**DevOps:**
```
1. GH-170 - Remove .env.test from git (30 min)
2. GH-169 - Remove package-lock.json (30 min)
```

**Documentation:**
```
1. DOC-007 - Environment variables guide (2 hrs)
```

**Total**: ~35-40 hours, parallelizable, **blocks Phase 1 release if not done**.

---

### 🟠 ARCHITECT DECISIONS NEEDED (BEFORE NEXT WEEK)

| Issue | Decision | Impact | Recommendation |
|-------|----------|--------|-----------------|
| GH-206 | Auth endpoint prefix: `/auth` vs `/api/auth`? | Affects 40+ endpoints | Architect review + governance |
| GH-172 | Frontend auth token storage strategy | Security decision | localStorage vs HttpOnly cookie ADR |
| GH-205 | Migrate WebSocket to socket-controllers? | Architecture refactor | Defer to Phase 2 (nice-to-have) |

---

### 🟡 CAN START WHEN DEPENDENCIES READY

| Issue | Dependency | Owner | When? |
|-------|-----------|-------|-------|
| GH-199/203/204 | BE-007 PR ready | Backend | This week |
| GH-195/196/197 | Backend/frontend features ready | QA | This week (parallel with fixes) |
| HD-004 | BE-002 finalized | DevOps | When schema locked |
| HD-001 | BE-020 (R2) implemented | DevOps | Phase 2 (deferred) |
| HD-002 | BE-025 (email) implemented | DevOps | Phase 2 (deferred) |
| HD-008/009 | QA-001-012 passing | DevOps/QA | After tests ready |

---

### ✅ POST-PHASE 1 (After Release)

| Issue | Reason | When |
|-------|--------|------|
| GH-112 | Phase 2 blocker (UUID refactor) | First Phase 2 task |
| GH-168 | Remove barrel exports (type-check done first) | Week 1 Phase 2 |
| GH-139 | WebSocket constants refactor | After type-check complete |
| GH-172 | Token storage ADR | Phase 2 tech decisions |
| HD-010/011/012 | Handoff, Phase 2 planning, archive | At Phase 1 completion |
| DOC-003/004/005/008 | Implementation guides | As features stabilize |

---

## Risk Assessment

### High Risk Items

| Issue | Risk | Mitigation |
|-------|------|-----------|
| **GH-165** | Broken logger/auth wiring affects all APIs | Start immediately, high priority code review |
| **GH-112** | UUID refactor blocks Phase 2 scope | Add to Phase 2 iteration as first task |
| **HD-008/009** | Staging deployment + QA regression | Get DevOps assigned early, parallel prep |
| **GH-206** | Architecture decision on auth prefix | Get Architect review this week, blocks GH-207 |

### Medium Risk Items

| Issue | Risk | Mitigation |
|-------|------|-----------|
| **GH-166/167** | `any` type elimination touches 40+ files | Break into smaller PRs (backend, frontend, frontend) |
| **HD-001/002** | Infrastructure blocked by deferred features | Document as Phase 2 work, not blocking Phase 1 |

### Low Risk Items

| Issue | Risk | Mitigation |
|-------|------|-----------|
| **GH-169/170** | File cleanup | Quick fixes, group in single PR |
| **DOC-007** | Environment guide | Can write in parallel, standalone |

---

## Timeline Recommendation

### Week 1 (This Week - Feb 25 to Mar 3)

**Frontend (GH-167, GH-171)**: 5-7 hrs → Should complete
**Backend (GH-166, GH-165, GH-173-176)**: 20-22 hrs → Should complete GH-173-176, start GH-166/165
**DevOps (GH-169, GH-170, HD-004)**: 1 hr → Should complete GH-169/170, spec HD-004
**Architect (GH-206, GH-165 review)**: 2 hrs → Decision on auth prefix, code review GH-165
**Documentation (DOC-007)**: 2 hrs → Should complete

**Milestone**: Type-check passes, no `any` types, logger/auth wiring fixed, BE-007 PR issues resolved

### Week 2 (Mar 4-10)

**Backend**: Finish GH-166 if not done
**QA**: Start GH-195, GH-196, GH-197 (parallel with final backend polish)
**DevOps**: Prepare HD-001, HD-004, create migration scripts
**Docs**: Prepare DOC-008, DOC-003/004
**Infrastructure**: Prepare CI/CD (HD-005)

**Milestone**: QA tests passing, BE-007 PR merged, staging deployment ready

### Week 3 (Mar 11-17)

**DevOps**: Deploy to staging (HD-008), run regression suite (HD-009)
**Architect**: Security review (HD-007)
**Documentation**: Complete deployment guide (DOC-008)
**Release Prep**: Final QA sign-off

**Milestone**: Phase 1 RELEASE ready

### Phase 2 Prep (Starting Mar 18)

1. **GH-112** - UUID refactor (first Phase 2 task)
2. **GH-168** - Remove barrel exports
3. Phase 2 feature development (tags, notes, assignments, routing rules)

---

## Files & References

- **Analysis Tables**: 
  - Full categorization in `/tmp/backlog_table.md`
  - Narrative analysis in `/tmp/backlog_analysis.md`
- **GitHub Project**: https://github.com/users/csim-sg/projects/1
- **Task Tracking**: `.docs/06-tasks.md` (Phase 1 vs Phase 2+ categorization)
- **Governance**: `.docs/governance/GOV-033` (Phase 1 completion), `GOV-034` (Phase 2 approval)

---

## Next Steps

1. **Architect Review** (this meeting):
   - Approve tech debt prioritization
   - Decide on GH-206 (auth endpoint prefix)
   - Review GH-165 (arch alignment)

2. **Team Assignment** (tomorrow):
   - Assign backend tech debt items (GH-166, GH-165, GH-173-176)
   - Assign frontend items (GH-167, GH-171)
   - Assign DevOps items (GH-169, GH-170, HD-004)
   - Assign QA test setup (GH-195, GH-196, GH-197)

3. **Daily Standup** (starting tomorrow):
   - Track progress on "START THIS WEEK" items
   - Monitor blockers on BE-007 PR (GH-199, GH-203, GH-204)
   - Update GitHub issue statuses

4. **Phase 2 Planning** (after Phase 1 release):
   - GH-112 (UUID refactor) as first task
   - Pull 50+ Phase 2 features from `.docs/plans/02-PHASE2-PLANNING.md`

---

**Status**: ✅ READY FOR EXECUTION  
**Last Updated**: February 25, 2026  
**Owner**: Product Owner + Architect (prioritization)  
**Reviewer**: Architect (tech debt + architecture decisions)
