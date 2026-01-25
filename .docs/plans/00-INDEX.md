# Week 1 Planning Documents - Complete Index

**Date:** 2026-01-24  
**Session:** Pre-Development Planning & Review  
**Status:** ✅ Complete - Ready for Execution  

---

## 📋 Document Overview

This directory contains comprehensive planning documentation for Week 1 development, including:
- Product Owner requirements and acceptance criteria
- Architect technical decisions and code examples
- Execution roadmap with blocking requirements
- Quick reference and navigation guide

**Total Documentation:** 4 files, ~3,900 lines, ~114 KB

---

## 📚 Document Catalog

### 1. README.md (Quick Reference)

**Purpose:** Navigation hub and quick reference  
**Size:** 12 KB  
**Read Time:** 5 minutes  

**What's Inside:**
- ✅ Approved tasks summary (4 core + 3 deferred)
- 🚨 Blocking requirements checklist (4 items)
- 📖 Document navigation guide (where to find what)
- ✅ Progress tracking checklists (pre-dev + dev)
- 🔍 Quick information finder (FAQ-style)
- 📞 Contact points (who to ask for what)

**When to Read:** Start here for overview and navigation

---

### 2. week1-product-owner-review.md (Requirements)

**Purpose:** Product requirements, business rules, acceptance criteria  
**Size:** 30 KB  
**Read Time:** 20-30 minutes  

**What's Inside:**
- **Section 1:** Approval summary (4 approved, 3 deferred)
- **Section 2:** Approved execution order (BE-027 → BE-003/005 → BE-004)
- **Section 3:** Detailed acceptance criteria
  - 3.1: BE-003 (BetterAuth) - endpoints, tokens, user status rules
  - 3.2: BE-004 (Forgot Password) - endpoints, token management, email mock
  - 3.3: BE-005 (RBAC) - permission matrix, decorators, resource-level auth
  - 3.4: BE-027 (Logging) - Pino, correlation ID, middleware order
- **Section 4:** Business rules (email provider, R2 storage limits, security)
- **Section 5:** Out of scope (what NOT to implement)
- **Section 6:** Testing requirements (80-95% coverage per task)
- **Section 7:** Detailed test scenarios per task
- **Section 8:** PR checklist (before submitting)
- **Section 9:** Approved workarounds (console.log, hardcoded config, JWT fallback)
- **Section 10:** Follow-up actions (BE-026 reschedule, etc.)
- **Section 11:** Risk register (high/medium risks)
- **Section 12:** Success criteria (definition of done)
- **Section 13:** Next steps (immediate actions)
- **Appendix A:** Environment variables (.env.example)
- **Appendix B:** API contract updates

**When to Read:**
- Before starting any task (understand requirements)
- When acceptance criteria unclear
- When business rules needed
- When testing approach uncertain

**Key Sections for Quick Reference:**
- Permission Matrix: Section 3.3 (table format)
- Testing Requirements: Section 6 (per-task breakdown)
- Workarounds: Section 9 (3 approved workarounds with expiry)
- Environment Variables: Appendix A

---

### 3. week1-architect-review.md (Technical Architecture)

**Purpose:** Technical decisions, architecture compliance, code examples  
**Size:** 49 KB  
**Read Time:** 40-60 minutes  

**What's Inside:**
- **Section 1:** Execution order validation (approved sequence)
- **Section 2:** Technology stack decisions
  - 2.1: Logging (Winston → Pino) - **CRITICAL FINDING**
    - Full Pino logger implementation (code)
    - Correlation ID middleware (code)
    - Request logging middleware (code)
    - NPM dependencies to install
    - Migration checklist (6 steps)
  - 2.2: BetterAuth + Drizzle (approved, enhancements suggested)
  - 2.3: RBAC (custom decorators required)
    - RequireRole decorator (full code)
    - RequirePermission decorator (full code)
    - Permission matrix (code)
    - Usage examples (code)
  - 2.4: Password hashing (argon2id via BetterAuth - approved)
- **Section 3:** Code organization standards
  - 3.1: Required directory structure (tree diagram)
  - 3.2: Violations detected (Winston, missing middleware, missing decorators)
  - 3.3: Type augmentation requirements (express.d.ts, auth.types.ts)
  - 3.4: One definition per file (compliance check)
- **Section 4:** Integration patterns
  - 4.1: BetterAuth + routing-controllers (current implementation + enhancements)
  - 4.2: Logger injection (correlation ID via AsyncLocalStorage)
  - 4.3: RBAC + BetterAuth (flow diagram)
- **Section 5:** Testing approach
  - 5.1: Framework (Jest configuration)
  - 5.2: Test directory structure
  - 5.3: Test database setup (code)
  - 5.4: Coverage targets per task
- **Section 6:** Approved workarounds
  - 6.1: Hardcoded log config (approved MVP only)
  - 6.2: JWT secret fallback (approved with production validation)
  - 6.3: Email mock (console.log approved)
  - 6.4: Technical debt register
- **Section 7:** Branching & PR workflow
  - 7.1: Branch naming convention
  - 7.2: Branch creation (from main)
  - 7.3: Parallel work (what's allowed)
  - 7.4: PR creation & merge (squash and merge)
  - 7.5: PR review process
- **Mandatory Requirements:** ADR-004, GOV-008, Winston→Pino, Decorators
- **Architecture Compliance Checklist:** 10 items checked
- **Final Decision:** Conditional approval
- **Next Steps:** Immediate actions for developer, architect, PO
- **Risk Register:** High/medium risks with mitigation
- **Appendix:** NPM dependencies required

**When to Read:**
- Before starting any implementation
- When architecture decision needed
- When integration pattern unclear
- When code organization uncertain

**Key Sections for Quick Reference:**
- Pino Implementation: Section 2.1 (3 files, full code)
- Decorator Implementation: Section 2.3 (2 files, full code)
- Directory Structure: Section 3.1 (violations highlighted)
- Testing Strategy: Section 5 (Jest config, test DB setup)

---

### 4. week1-action-plan.md (Execution Roadmap)

**Purpose:** Step-by-step execution guide with templates  
**Size:** 23 KB  
**Read Time:** 30-40 minutes  

**What's Inside:**
- **Executive Summary:** Approval status, conditions
- **Approved Tasks:** 4 core + 1 optional + 3 deferred
- **Blocking Requirements (4 items):**
  - 1. Create ADR-004 (Logging Strategy)
    - **FULL TEMPLATE PROVIDED** (ready to copy/paste)
    - Includes context, decision, alternatives, consequences, Mermaid diagram
  - 2. Create GOV-008 (Workarounds Tracking)
    - **FULL TEMPLATE PROVIDED** (ready to copy/paste)
    - Includes 3 workarounds with expiry dates, technical debt register
  - 3. Replace Winston with Pino
    - Step-by-step migration checklist (6 steps)
    - References architect review for full code
  - 4. Create Decorators Directory
    - Step-by-step creation checklist (3 steps)
    - References architect review for full code
- **Execution Timeline:**
  - Day 0 (Today): Unblock development (4 hours)
    - Hour-by-hour breakdown
  - Day 1: BE-027 Structured Logging (6h)
  - Day 2-3: BE-003 + BE-005 Parallel (16h total)
  - Day 4: BE-004 Forgot Password (6h)
- **Success Criteria:** Pre-dev + Week 1 completion checklists
- **Quality Gates:** Per-task gates (tests, coverage, linting, review)
- **Risk Management:** High/medium priority risks with mitigation
- **Communication Plan:** Daily updates, milestone updates
- **Rollback Plan:** If Pino migration fails, if BetterAuth issues
- **Next Steps:** Immediate actions for developer, architect, PO
- **Document References:** Links to all related docs

**When to Read:**
- **RIGHT NOW** (start here after README)
- When planning daily work
- When tracking progress
- When risk identified

**Key Sections for Quick Reference:**
- ADR-004 Template: Section "Blocking Requirements #1" (copy/paste ready)
- GOV-008 Template: Section "Blocking Requirements #2" (copy/paste ready)
- Timeline: Section "Execution Timeline" (hour-by-hour)
- Checklists: Section "Success Criteria"

---

## 🎯 How to Use These Documents

### For Quick Overview (15 minutes)
1. Read `README.md` (5 min)
2. Skim `week1-action-plan.md` Executive Summary + Timeline (10 min)

### For Understanding Requirements (45 minutes)
1. Read `README.md` (5 min)
2. Read `week1-product-owner-review.md` Sections 1-3 (30 min)
3. Read `week1-action-plan.md` Blocking Requirements (10 min)

### For Technical Implementation (90 minutes)
1. Read `README.md` (5 min)
2. Read `week1-architect-review.md` Sections 1-3 (45 min)
3. Read `week1-action-plan.md` Migration Checklists (20 min)
4. Review code examples in architect review (20 min)

### For Day-to-Day Execution (10 minutes/day)
1. Check `week1-action-plan.md` Timeline for today's tasks (5 min)
2. Check `README.md` Progress Checklist (2 min)
3. Update status in this index (3 min)

---

## ✅ Progress Tracking

### Pre-Development Phase (Day 0)

**Estimated:** 4 hours  
**Status:** ⏳ Pending  

- [ ] Read README.md (5 min)
- [ ] Read week1-action-plan.md (15 min)
- [ ] Create ADR-004 using template (30 min)
- [ ] Create GOV-008 using template (20 min)
- [ ] Request approvals from Architect + PO (10 min)
- [ ] Remove Winston: `npm uninstall winston` (2 min)
- [ ] Install Pino: `npm install pino pino-http pino-pretty` (3 min)
- [ ] Create `infrastructure/logging/logger.ts` (20 min)
- [ ] Create `api/middleware/correlation-id.middleware.ts` (30 min)
- [ ] Create `api/middleware/request-logging.middleware.ts` (20 min)
- [ ] Delete `utils/logger.ts` (1 min)
- [ ] Update all imports (10 min)
- [ ] Create `api/decorators/require-role.decorator.ts` (20 min)
- [ ] Create `api/decorators/require-permission.decorator.ts` (20 min)
- [ ] Write logging tests (60 min)
- [ ] Write decorator tests (20 min)
- [ ] Verify all tests pass (30 min)
- [ ] **READY TO START BE-027** ✅

---

### Development Phase (Days 1-4)

**Estimated:** 28 hours (3.5 days)  
**Status:** 🟢 In Progress (3 of 4 core tasks completed)  
**Completed Tasks:** BE-001, BE-002, BE-013, BE-027, BE-003, BE-004  
**Current Task:** BE-005 (RBAC)  
**Next Task:** Frontend Integration  

#### Day 1: BE-027 Structured Logging

- [x] Create branch `task/BE-027-structured-logging`
- [x] Verify Pino implementation complete
- [x] Write integration tests (HTTP logging flow)
- [x] Manual testing + documentation
- [x] Create PR with ADR-004 reference
- [x] Request Architect review
- [x] PR merged
- [x] **BE-027 DONE** ✅

#### Day 2-3: BE-003 + BE-005 (Parallel)

**BE-003: BetterAuth (10h)** ✅ DONE
- [x] Create branch `task/BE-003-betterauth`
- [x] Implement login endpoint (POST /api/auth/login)
- [x] Implement logout endpoint (POST /api/auth/logout)
- [x] Implement JWT token management
- [x] Implement user status validation
- [x] Implement password validation (8+ chars, uppercase, number)
- [x] Implement Express type augmentations
- [x] Fix middleware registration (use routing-controllers)
- [x] Write tests (95%+ coverage)
- [x] Manual testing (Postman: 4 scenarios)
- [x] Create PR (PR #152)
- [x] Request Architect review
- [x] Request Product Owner review
- [x] Address all AC violations
- [x] Create ADR-005 (Infrastructure/Config Pattern)
- [x] Update GOV-008
- [x] PR merged
- [x] **BE-003 DONE** ✅

**BE-005: RBAC (6h) - Parallel**
- [ ] Create branch `task/BE-005-rbac`
- [ ] Verify decorators created (Day 0)
- [ ] Implement RBAC middleware
- [ ] Test permission matrix
- [ ] Write tests (95%+ coverage)
- [ ] Manual testing (Postman: Permission matrix)
- [ ] Create PR
- [ ] Request Architect review
- [ ] PR merged
- [ ] **BE-005 DONE** ⏳ Next

#### Day 4: BE-004 Forgot Password

- [x] Create branch `task/BE-004-forgot-password`
- [x] Implement forgot password endpoint (POST /api/auth/forgot-password)
- [x] Implement reset password endpoint (POST /api/auth/reset-password)
- [x] Implement token generation (64 hex, 60min TTL)
- [x] Implement email service integration (Nodemailer)
- [x] Write tests (85%+ coverage)
- [x] Implement Vitest migration (Jest→Vitest 20% faster)
- [x] Manual testing via curl
- [x] Create PR #153
- [x] Request Architect review
- [x] PR merged (squash merge)
- [x] **BE-004 DONE** ✅

---

### Week 1 Completion Criteria

- [x] BE-027 Structured Logging - ✅ DONE (PR merged)
- [x] BE-003 BetterAuth - ✅ DONE (PR #152 merged)
- [x] BE-004 Forgot Password - ✅ DONE (PR #153 merged)
- [ ] BE-005 RBAC - ⏳ Next (ready to start)
- [x] Test coverage ≥80% (overall) - ✅ Met (BE-004: 85%+)
- [x] Test coverage ≥90% (logging) - ✅ Met (BE-027: 90%+)
- [x] Test coverage ≥95% (auth) - ✅ Met (BE-003: 95%+)
- [x] All integration tests pass - ✅ 40/40 passing
- [x] Manual testing documented in PRs - ✅ All PRs include manual testing
- [x] No Winston references in codebase - ✅ Replaced with Pino
- [x] Technical debt tracked in GOV-008 - ✅ GOV-008 + GOV-010 created
- [ ] Production deployment checklist updated - ⏳ Pending
- [ ] **WEEK 1 COMPLETE** ⏳ 75% done (BE-005 remaining)

---

## 🚨 Critical Issues & Blockers

### Active Blockers

| Issue | Severity | Impact | Resolution |
|-------|----------|--------|------------|
| ADR-004 not created | Critical | Cannot proceed with BE-027 | Create using template |
| GOV-008 not created | High | Technical debt untracked | Create using template |
| Winston in codebase | Critical | BE-027 cannot complete | Replace with Pino |
| Decorators missing | High | BE-005 cannot complete | Create 2 decorator files |

### Resolved Issues

| Issue | Resolution Date | How Resolved |
|-------|----------------|--------------|
| Week 1 scope unclear | 2026-01-24 | Product Owner review completed |
| Architecture undecided | 2026-01-24 | Architect review completed |
| No execution plan | 2026-01-24 | Action plan created |

---

## 📊 Key Metrics

### Documentation Coverage

| Aspect | Coverage | Status |
|--------|----------|--------|
| Requirements (AC) | 50+ criteria defined | ✅ Complete |
| Technical Decisions | 20+ code examples | ✅ Complete |
| Testing Strategy | 30+ test scenarios | ✅ Complete |
| Templates Provided | 2 (ADR-004, GOV-008) | ✅ Complete |
| Migration Guides | 2 (Pino, Decorators) | ✅ Complete |

### Approval Status

| Stakeholder | Status | Conditions |
|-------------|--------|------------|
| Product Owner | ✅ Approved | None (all requirements clear) |
| Architect | ⚠️ Conditional | ADR-004 + GOV-008 + Pino + Decorators |
| QA | ⏳ Pending | Awaiting implementation |

### Task Status

| Status | Count | Percentage |
|--------|-------|------------|
| Product Owner | ✅ Approved | None (all requirements clear) |
| Architect | ✅ Approved | ADR-004 + GOV-008 + Pino + Decorators + Infrastructure Config Pattern |
| QA | ⏳ Pending | Awaiting implementation |
| 
| ### Task Status
| 
| | Status | Count | Percentage |
|--------|-------|------------|
| Done (BE-001, 002, 013, 027, 028) | 5 | 45% |
| Ready (BE-004, 005, 027) | 3 | 27% |
| Backlog (BE-020, 025, 026) | 3 | 27% |
| **Total Week 1 Scope** | **11** | **100%** |

---

## 🔗 External References

### GitHub
- [Week 1 Project Board](https://github.com/users/csim-sg/projects/1/views/1)
- [BE-027 Issue](https://github.com/csim-sg/yacc/issues/107)
- [BE-003 Issue](https://github.com/csim-sg/yacc/issues/18)
- [BE-005 Issue](https://github.com/csim-sg/yacc/issues/20)
- [BE-004 Issue](https://github.com/csim-sg/yacc/issues/19)

### Internal Documentation
- [Phase 1 Execution Guide](../06-phase1-execution-guide.md)
- [Product Specification](../01-product-specification.md)
- [API & Data Model](../02-api-and-data-model.md)
- [Implementation Guide](../03-implementation-guide.md)

### To Be Created
- `.docs/architecture/ADR-004-logging-strategy.md`
- `.docs/governance/GOV-008-week1-workarounds.md`

---

## 📞 Contact & Support

### Questions & Approvals

| Topic | Contact | Document Reference |
|-------|---------|-------------------|
| Requirements unclear | @product-owner | week1-product-owner-review.md |
| Architecture questions | @architect | week1-architect-review.md |
| Testing approach | @qa-tester | week1-product-owner-review.md Section 7 |
| ADR-004 approval | @architect | week1-action-plan.md |
| GOV-008 approval | @architect + @product-owner | week1-action-plan.md |

---

## 🔄 Document Updates

| Date | Document | Change | Author |
|------|----------|--------|--------|
| 2026-01-24 | All | Initial creation | Fullstack Developer |
| 2026-01-24 | 00-INDEX.md | Index created | Fullstack Developer |

---

## 📝 Notes for Future Sessions

### What Works
- ✅ Comprehensive planning documents reduce ambiguity
- ✅ Templates (ADR-004, GOV-008) accelerate governance
- ✅ Code examples in architect review enable fast implementation
- ✅ Clear blocking requirements prevent wasted effort

### Lessons Learned
- 🎓 Always check existing code before planning (Winston detected late)
- 🎓 Architect and Product Owner reviews should run in parallel
- 🎓 Templates save significant time (50 minutes vs 2+ hours)
- 🎓 Detailed acceptance criteria reduce back-and-forth

### Recommendations for Week 2+
- 📌 Run planning session 1 day before week starts
- 📌 Create governance documents (ADR, GOV) during planning
- 📌 Verify tech stack alignment before task creation
- 📌 Include full code examples in architecture reviews

---

## ✅ Index Complete

**Total Planning Documentation:**
- 📄 Files: 5 (including this index)
- 📏 Lines: ~4,300
- 💾 Size: ~125 KB
- 🕐 Read Time: 2-3 hours (complete)
- ⏱️ Skim Time: 30 minutes (summaries only)

**Status:** Ready for execution  
**Next Action:** Read README.md → Start Day 0 pre-development

---

**Created:** 2026-01-24  
**Last Updated:** 2026-01-24  
**Status:** ✅ Complete - Ready for Use
