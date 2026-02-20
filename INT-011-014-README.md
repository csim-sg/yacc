# INT-011..INT-014 Implementation Package

**Status**: ✅ **READY TO CODE**  
**Created**: 2026-02-20  
**Scope**: IRC conversation uniqueness + frontend sidebar UX  

---

## 📦 What's Included

This directory contains **complete implementation prep** for INT-011..INT-014:

1. **PREP_INT_011_014_UPDATED.md** (73 sections)
   - ✅ **Main planning document** with all requirements, file mappings, task breakdown, verification commands
   - Use this as the **source of truth** for implementation sequence
   - References to each file that needs changes

2. **INT-011-014-IMPLEMENTATION-SUMMARY.md** (Visual summary)
   - ✅ **Quick reference** for requirements, file changes, task breakdown
   - One-page checklist for kickoff
   - Decision points and success criteria

3. **INT-011-014-ARCHITECTURE-GUIDE.md** (Code examples)
   - ✅ **Concrete code patterns** for all major changes
   - Schema migrations, service implementations, React components
   - Testing patterns (unit, integration, E2E)
   - Architectural decisions with trade-offs

4. **This File** (You are here)
   - ✅ **Navigation guide** to the 3 documents above

---

## 🚀 QUICK START

### For Backend Developer

1. Read: `INT-011-014-IMPLEMENTATION-SUMMARY.md` (10 min)
2. Read: `PREP_INT_011_014_UPDATED.md` → "Backend Task Breakdown" section (30 min)
3. Reference: `INT-011-014-ARCHITECTURE-GUIDE.md` → "Backend Architecture" while coding
4. Follow: Sequential phases in PREP document (Phase 1 → Phase 4)

### For Frontend Developer

1. Read: `INT-011-014-IMPLEMENTATION-SUMMARY.md` (10 min)
2. Read: `PREP_INT_011_014_UPDATED.md` → "Frontend Sidebar UX" section (20 min)
3. Reference: `INT-011-014-ARCHITECTURE-GUIDE.md` → "Frontend Architecture" while coding
4. Follow: Phases 5-8 (after backend Phase 4 completes)

### For QA/Test Writer

1. Read: `INT-011-014-IMPLEMENTATION-SUMMARY.md` (10 min)
2. Read: `PREP_INT_011_014_UPDATED.md` → "QA Task Breakdown" section (20 min)
3. Reference: `INT-011-014-ARCHITECTURE-GUIDE.md` → "Testing Patterns" for examples
4. Create tests alongside development (Phases 3, 4, 7, 8)

### For Architect (Review)

1. Skim: `INT-011-014-IMPLEMENTATION-SUMMARY.md` → "Decision Points" (5 min)
2. Deep-dive: `INT-011-014-ARCHITECTURE-GUIDE.md` → all sections (30 min)
3. Validate: All architectural decisions align with constraints
4. Approve: Kick off Phase 1

---

## 📋 KEY CHANGES AT A GLANCE

### Backend
| File | Change | Type |
|------|--------|------|
| `packages/common/src/db/schema.ts` | Add `ircProfileId` + unique indexes | Schema |
| `irc-ingestion.service.ts` | Profile-aware conversation upsert | Logic |
| `conversation.service.ts` | Add profile filtering | Logic |
| `irc.connector.ts` | Pass `ircProfileId` to ingestion | Logic |
| Unit tests | Expand to 90%+ coverage | Tests |
| Integration tests | Multi-profile E2E scenarios | Tests |

### Frontend
| File | Change | Type |
|------|--------|------|
| `types/sidebar.types.ts` | NEW: Profile section types | Types |
| `hooks/useSidebarState.ts` | NEW: Accordion state management | Logic |
| `hooks/useProfileConversations.ts` | NEW: Profile-grouped fetching | Logic |
| `components/Sidebar.tsx` | Refactor to accordion layout | Component |
| E2E tests | Add sidebar UX tests | Tests |

---

## 🎯 PHASES & TIMELINE

| Phase | Task | Duration | Lead |
|-------|------|----------|------|
| 1 | INT-011: Schema + backend mapping | 10 hrs | Backend |
| 2 | INT-012: Error handling audit | 8 hrs | Backend |
| 3 | INT-013: Unit tests (backend) | 14 hrs | Backend + QA |
| 4 | INT-014: Integration tests | 18 hrs | Backend + QA |
| 5-6 | FE-Sidebar: Types + components | 12 hrs | Frontend |
| 7-8 | FE-Sidebar: E2E tests + docs | 8 hrs | Frontend + QA |

**Total**: 60-75 hours (distributed)

---

## ✅ VERIFICATION COMMANDS

```bash
# Backend
pnpm --filter @yacc/backend test              # All tests pass
pnpm --filter @yacc/backend test:coverage     # 90%+ coverage
pnpm --filter @yacc/backend lint              # No errors
pnpm --filter @yacc/backend build             # TypeScript compiles

# Frontend
pnpm --filter @yacc/frontend test             # All tests pass
pnpm --filter @yacc/frontend lint             # No errors
pnpm --filter @yacc/frontend build            # TypeScript compiles

# All
pnpm install && pnpm build && pnpm test       # Full workspace
```

---

## 🔗 DOCUMENT NAVIGATION

### PREP_INT_011_014_UPDATED.md
**Use for**: Complete execution plan with all details
- New requirements explained (IRC uniqueness, sidebar UX)
- Full file mapping (backend, frontend, common)
- Detailed task breakdown (8 phases, 75 hours)
- Verification checklist
- Risk mitigation
- **Start here**: Sections "📋 EXECUTIVE SUMMARY" → "🎯 BACKEND TASK BREAKDOWN"

### INT-011-014-IMPLEMENTATION-SUMMARY.md
**Use for**: Quick reference + visual overview
- Requirement mapping (what changed)
- Concrete file changes (table format)
- Task phases (timeline)
- Verification commands
- Decision points
- **Start here**: Section "🔄 REQUIREMENT MAPPING"

### INT-011-014-ARCHITECTURE-GUIDE.md
**Use for**: Code patterns + concrete examples
- Schema migration with migration file
- Ingestion service implementation (profile-aware upsert)
- Connector updates (profile ID passing)
- Frontend hooks and components (complete code)
- Testing patterns (unit, integration, E2E)
- **Start here**: Sections "🏗️ BACKEND ARCHITECTURE" → "🎨 FRONTEND ARCHITECTURE"

---

## 🎓 LEARNING PATH

### For Backend Developer (6 hours)

1. **Requirements** (20 min)
   - Read: `INT-011-014-IMPLEMENTATION-SUMMARY.md` → "Requirement Mapping"
   - Understand: Profile uniqueness means `UNIQUE(ircProfileId, externalThreadId)`

2. **Architecture** (40 min)
   - Read: `INT-011-014-ARCHITECTURE-GUIDE.md` → "Backend Architecture"
   - Understand: How profile ID flows from connector → ingestion → DB

3. **Task Breakdown** (30 min)
   - Read: `PREP_INT_011_014_UPDATED.md` → "Backend Task Breakdown"
   - Plan: Phases 1-4 sequencing

4. **Code Examples** (40 min)
   - Reference: `INT-011-014-ARCHITECTURE-GUIDE.md` → code sections
   - While coding: Copy patterns for schema, service, tests

5. **Verification** (20 min)
   - Reference: `INT-011-014-IMPLEMENTATION-SUMMARY.md` → "Verification Commands"
   - Run commands after each phase

### For Frontend Developer (5 hours)

1. **Requirements** (15 min)
   - Read: `INT-011-014-IMPLEMENTATION-SUMMARY.md` → "Requirement Mapping"
   - Understand: Sidebar becomes profile-grouped accordion

2. **Architecture** (30 min)
   - Read: `INT-011-014-ARCHITECTURE-GUIDE.md` → "Frontend Architecture"
   - Understand: useSidebarState + useProfileConversations hooks

3. **Task Breakdown** (30 min)
   - Read: `PREP_INT_011_014_UPDATED.md` → "Frontend Sidebar UX" + "Phase 5-7"
   - Plan: Types → Hooks → Component → Tests

4. **Code Examples** (40 min)
   - Reference: `INT-011-014-ARCHITECTURE-GUIDE.md` → component code
   - While coding: Copy patterns for hooks and Sidebar component

5. **Verification** (15 min)
   - Reference: `INT-011-014-IMPLEMENTATION-SUMMARY.md` → "Verification Commands"
   - Run commands after component done

---

## 🚨 CRITICAL SUCCESS FACTORS

- ✅ **Read requirements first**: Profile uniqueness changes how conversations are identified
- ✅ **Backend before frontend**: Schema + services must be ready before sidebar implementation
- ✅ **Profile ID propagation**: IRC connector → ingestion → DB (each step critical)
- ✅ **Testing as you go**: Unit tests for profile-aware logic, integration tests for E2E flows
- ✅ **One PR to dev**: All tasks in single branch with 8-9 logical commits

---

## ❓ COMMON QUESTIONS

**Q: Can backend and frontend work in parallel?**  
A: Partially. Frontend can start hooks/types while backend builds services. Component refactor must wait for API stability (Phase 4 complete).

**Q: What if we defer rate limiting (INT-012)?**  
A: Recommended. Mark as Phase 2; verify existing error handling works for MVP.

**Q: Do we need real IRC server for tests?**  
A: No. Use EventEmitter mock (faster, simpler). Real server can be Phase 2 upgrade.

**Q: Should Telegram also be a "profile"?**  
A: Optional. For MVP, can stay ungrouped or under "Telegram" default.

**Q: How do we handle profile name in sidebar?**  
A: Future enhancement. For MVP, use profile ID. Store profile name in `integration_configs.name`.

---

## 📞 WHEN TO ESCALATE

| Issue | Escalate To |
|-------|-------------|
| Schema design questionable | Architect |
| Frontend component architecture unclear | Architect + Frontend Lead |
| Testing approach not working | QA Lead |
| Timeline slipping | Product Owner |
| Ambiguous requirement | Architect + Product Owner |

---

## 📌 NEXT STEPS

1. **Architect Review** (1-2 hours)
   - Read: All 3 implementation documents
   - Validate: Architecture + decisions
   - Approve: Kick off Phase 1

2. **Backend Developer Kickoff** (same day)
   - Read: INT-011-014-IMPLEMENTATION-SUMMARY.md
   - Read: PREP_INT_011_014_UPDATED.md → "Backend Task Breakdown"
   - Start: Phase 1 (schema + INT-011)

3. **QA Kickoff** (Phase 3)
   - Read: PREP_INT_011_014_UPDATED.md → "QA Task Breakdown"
   - Start: Unit test framework for Phase 3

4. **Frontend Developer Kickoff** (Phase 5)
   - Read: INT-011-014-IMPLEMENTATION-SUMMARY.md
   - Start: Types + hooks (after backend Phase 4 stable)

---

## 📚 REFERENCE

| Document | Purpose | Length | Read Time |
|----------|---------|--------|-----------|
| `PREP_INT_011_014_UPDATED.md` | Complete execution plan | 600 lines | 1.5 hours |
| `INT-011-014-IMPLEMENTATION-SUMMARY.md` | Visual summary + checklist | 250 lines | 20 min |
| `INT-011-014-ARCHITECTURE-GUIDE.md` | Code patterns + examples | 800 lines | 1 hour |
| **This file** | Navigation guide | 250 lines | 15 min |

---

**Total Read Time to Understand Fully**: 3-4 hours  
**Time to Start Coding**: 30 minutes (after reading IMPLEMENTATION-SUMMARY)  
**Estimated Implementation**: 60-75 hours (backend + frontend)

---

**Created By**: FullStack Developer (Claude Code)  
**Date**: 2026-02-20  
**Status**: ✅ Ready to code  
**Questions?**: See respective documents (FAQ sections in each file)
