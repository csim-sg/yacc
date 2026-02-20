# INT-011..INT-014 Deliverables Index

**Created**: 2026-02-20  
**Status**: ✅ **COMPLETE & READY TO CODE**  
**Total Lines**: 3,061 lines across 4 documents + 1 original prep

---

## 📦 DELIVERABLE FILES

### 1. **INT-011-014-README.md** (286 lines)
**Type**: Navigation Guide  
**Purpose**: Understanding which document to read and when  
**Audience**: Everyone (start here)  
**Read Time**: 15 minutes  

**Contents**:
- Quick start instructions per role (backend, frontend, QA, architect)
- Key changes at a glance (table format)
- Learning path for each developer
- Common questions + FAQs
- When to escalate
- Next steps

**Use When**: First document to read; it guides you to the right spec document

---

### 2. **INT-011-014-IMPLEMENTATION-SUMMARY.md** (315 lines)
**Type**: Quick Reference  
**Purpose**: Visual summary of what's changing and how  
**Audience**: Developers starting a phase  
**Read Time**: 20 minutes  

**Contents**:
- Requirement mapping (IRC uniqueness + sidebar UX)
- Concrete file changes (backend, frontend, common)
- Phase & timeline table (1-8, 60-75 hours)
- Verification commands (copy/paste ready)
- Decision points (clarifications made)
- Success criteria checklist

**Use When**: Before starting each phase; reviewing requirements

---

### 3. **PREP_INT_011_014_UPDATED.md** (830 lines)
**Type**: Complete Execution Plan  
**Purpose**: Source of truth for implementation details  
**Audience**: Developers, QA, project leads  
**Read Time**: 1.5 hours  

**Contents**:
- Executive summary (2 new requirements confirmed)
- Requirement details (INT-011, INT-012, INT-013, INT-014, FE-Sidebar)
- Updated data model (schema changes)
- Backend task breakdown (8 detailed phases)
- Frontend task breakdown (5 detailed phases)
- QA task breakdown (unit, integration, E2E tests)
- Git workflow (one branch, 9 commits, one PR)
- Verification plan (commands + expected output)
- Risk mitigation (risks & solutions)
- Deliverables checklist

**Use When**: Detailed planning; task breakdown; verification steps

---

### 4. **INT-011-014-ARCHITECTURE-GUIDE.md** (1,058 lines)
**Type**: Code Patterns & Examples  
**Purpose**: Concrete implementation guidance with copy/paste code  
**Audience**: Developers (while coding)  
**Read Time**: 1 hour (as reference)  

**Contents**:

**Backend Architecture**:
- Schema changes (migration file example)
- IRC ingestion service (profile-aware upsert implementation)
- Connector manager (profile ID integration)
- Error handling patterns
- DLQ integration

**Frontend Architecture**:
- New hooks (useSidebarState, useProfileConversations)
- New types (ProfileSection, ConversationItem)
- Sidebar component refactor (before/after)
- Mobile & responsive patterns

**Testing Patterns**:
- Unit test pattern (profile-aware upsert tests)
- Integration test pattern (E2E mock IRC server)
- Frontend E2E pattern (Playwright tests with data-testid)
- Mock IRC server implementation

**Architectural Decisions**:
- Profile identity strategy
- Error handling approach
- Mock server rationale
- State management approach

**Use When**: Coding implementation; looking for patterns; copy/paste code examples

---

## 📊 DOCUMENTATION SUMMARY

| Document | Lines | Type | Audience | Read Time |
|----------|-------|------|----------|-----------|
| **INT-011-014-README.md** | 286 | Navigation | Everyone | 15 min |
| **INT-011-014-IMPLEMENTATION-SUMMARY.md** | 315 | Reference | Developers | 20 min |
| **PREP_INT_011_014_UPDATED.md** | 830 | Plan | Developers/QA | 1.5 hrs |
| **INT-011-014-ARCHITECTURE-GUIDE.md** | 1,058 | Code | Developers | 1 hr (ref) |
| **TOTAL** | **2,489** | — | — | **~3-4 hrs** |

*Plus original prep document (PREP_INT_011_014.md, 572 lines) for historical reference*

---

## 🎯 READING SEQUENCE

### First Time? Start Here:
1. **INT-011-014-README.md** (15 min)
   - Understand what each document is for
   - Find your role's learning path

2. **INT-011-014-IMPLEMENTATION-SUMMARY.md** (20 min)
   - Understand what's changing
   - Review the timeline

3. **PREP_INT_011_014_UPDATED.md** (1.5 hours, skim if busy)
   - Read your role's section (Backend/Frontend/QA)
   - Understand file mappings and verification steps

### While Coding:
- **INT-011-014-ARCHITECTURE-GUIDE.md** (reference)
  - Look up code patterns
  - Copy/paste examples
  - Check testing patterns

---

## ✅ WHAT'S DOCUMENTED

### Requirements
- ✅ IRC conversation uniqueness: `UNIQUE(ircProfileId, externalThreadId)`
- ✅ DM support reserved: `UNIQUE(ircProfileId, externalUserId)`
- ✅ Frontend sidebar: Profile-grouped accordion layout
- ✅ Mobile behavior: Collapse to icons, expand on tap

### Backend Changes
- ✅ Schema: Add `ircProfileId` + unique indexes + migration
- ✅ Ingestion: Profile-aware conversation upsert
- ✅ Services: Profile filtering in queries
- ✅ Connector: Pass `ircProfileId` to ingestion
- ✅ Error handling: Verify correlation IDs, DLQ integration
- ✅ Unit tests: 90%+ coverage for connector
- ✅ Integration tests: Multi-profile E2E scenarios

### Frontend Changes
- ✅ New types: ProfileSection, ConversationItem
- ✅ New hooks: useSidebarState, useProfileConversations
- ✅ Component: Sidebar refactored to accordion layout
- ✅ Mobile: Responsive collapse/expand behavior
- ✅ Real-time: WebSocket integration for unread badges
- ✅ E2E tests: Playwright tests for sidebar UX

### QA Tasks
- ✅ Unit tests for profile-aware upsert
- ✅ Error handling unit tests
- ✅ Integration tests for multi-profile scenarios
- ✅ E2E tests for sidebar (Playwright)
- ✅ Coverage targets: 90%+ connector, 85%+ overall

### Verification
- ✅ Test commands (backend, frontend, all)
- ✅ Expected output examples
- ✅ Migration testing steps
- ✅ Coverage report format

### Git Strategy
- ✅ Branch name: `task/INT-011-014-irc-completion-with-sidebar`
- ✅ Commits: 9 logical commits
- ✅ PR strategy: Single PR to `dev`, squash-merge
- ✅ Commit messages follow "WHY" pattern

### Risks & Mitigation
- ✅ 6 risks identified with severity + mitigation
- ✅ Race condition handling (transaction + retry)
- ✅ Regression test strategy
- ✅ Rate limiting deferred with clear reasoning

---

## 🗂️ FILE MAPPING

### Files to Create
```
packages/backend/src/services/__tests__/irc-ingestion.service.test.ts
packages/backend/src/__tests__/irc-integration.test.ts
packages/frontend/src/types/sidebar.types.ts
packages/frontend/src/hooks/useSidebarState.ts
packages/frontend/src/hooks/useProfileConversations.ts
packages/frontend/e2e/sidebar.spec.ts
```

### Files to Modify
```
packages/common/src/db/schema.ts
packages/backend/src/services/irc-ingestion.service.ts
packages/backend/src/services/conversation.service.ts
packages/backend/src/connectors/irc.connector.ts
packages/backend/src/connectors/__tests__/irc.connector.test.ts
packages/frontend/src/components/Sidebar.tsx
packages/frontend/src/api/conversations.ts (if needed)
```

### Documentation Updates
```
.docs/plans/00-INDEX.md
.docs/02-api-and-data-model.md
.docs/03-implementation-guide.md
```

---

## ⏱️ TIMELINE AT A GLANCE

| Phase | Task | Hours | Lead |
|-------|------|-------|------|
| **1** | INT-011: Schema + Backend | 10 | Backend |
| **2** | INT-012: Error Handling | 8 | Backend |
| **3** | INT-013: Unit Tests | 14 | Backend + QA |
| **4** | INT-014: Integration Tests | 18 | Backend + QA |
| **5-6** | FE-Sidebar: Hooks + Component | 12 | Frontend |
| **7-8** | FE-Sidebar: Tests + Docs | 8 | Frontend + QA |
| — | **TOTAL** | **70** | — |

---

## 🎓 LEARNING PATHS

### Backend Developer (6 hours)
1. INT-011-014-README.md (15 min) → "For Backend Developer"
2. INT-011-014-ARCHITECTURE-GUIDE.md (40 min) → "Backend Architecture"
3. PREP_INT_011_014_UPDATED.md (30 min) → "Backend Task Breakdown"
4. INT-011-014-ARCHITECTURE-GUIDE.md (40 min) → Code examples while implementing
5. INT-011-014-IMPLEMENTATION-SUMMARY.md (15 min) → Verification commands

### Frontend Developer (5 hours)
1. INT-011-014-README.md (15 min) → "For Frontend Developer"
2. INT-011-014-ARCHITECTURE-GUIDE.md (30 min) → "Frontend Architecture"
3. PREP_INT_011_014_UPDATED.md (20 min) → "Frontend Sidebar UX"
4. INT-011-014-ARCHITECTURE-GUIDE.md (40 min) → Component code
5. INT-011-014-IMPLEMENTATION-SUMMARY.md (15 min) → Verification commands

### QA/Test Writer (4 hours)
1. INT-011-014-README.md (10 min) → "For QA/Test Writer"
2. INT-011-014-ARCHITECTURE-GUIDE.md (40 min) → "Testing Patterns"
3. PREP_INT_011_014_UPDATED.md (20 min) → "QA Task Breakdown"
4. PREP_INT_011_014_UPDATED.md (1 hour) → Test scenarios + verification
5. INT-011-014-IMPLEMENTATION-SUMMARY.md (10 min) → Test checklist

### Architect (1 hour)
1. INT-011-014-IMPLEMENTATION-SUMMARY.md (20 min) → "Decision Points"
2. INT-011-014-ARCHITECTURE-GUIDE.md (40 min) → All sections
3. Validate + Approve

---

## ✨ KEY HIGHLIGHTS

### What's New in INT-011..INT-014
- **Profile-Aware Conversations**: IRC channels now scoped to profiles
- **Frontend Sidebar UX**: Accordion layout grouped by profile
- **Comprehensive Tests**: 90%+ coverage for connector, multi-profile E2E
- **Mobile Support**: Responsive sidebar collapse/expand

### Architectural Decisions Made
- ✅ Store `ircProfileId` in conversation table (not derived)
- ✅ Use EventEmitter mock for IRC tests (not real server)
- ✅ localStorage for sidebar accordion state
- ✅ Defer rate limiting to Phase 2
- ✅ Local grouping for frontend (no API change)

### No Ambiguities
- ✅ All file mappings explicit
- ✅ All schema changes with migrations
- ✅ All code patterns with examples
- ✅ All tests with assertions
- ✅ All verification commands ready

---

## 🚀 NEXT STEP

**Start with**: **INT-011-014-README.md** (15 min read)

Then jump to your role's section in **PREP_INT_011_014_UPDATED.md**

Code with **INT-011-014-ARCHITECTURE-GUIDE.md** as reference

---

**Created**: 2026-02-20  
**Status**: ✅ Complete  
**Quality**: Production-grade implementation prep  
**Ready**: Yes  

