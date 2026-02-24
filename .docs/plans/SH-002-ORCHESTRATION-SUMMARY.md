# 🎯 SH-002 + DEV-016/017/018 Orchestration Summary

## ✅ Status: READY FOR DEVELOPMENT

**Date**: 2026-02-24  
**Phase**: 1.6 (Code Hygiene & API Standardization)  
**Timeline**: 8-9 days (sequential)  
**Team**: 1 FullStack Developer + Code Reviewer

---

## 📋 Orchestration Workflow Complete

### ✅ Step 1: Gap Analysis (DONE)
- **Architect** reviewed all 4 tasks
- Identified dependencies, breaking changes, execution order
- Flagged 4 critical decisions (DEV-016 Option A/B, SH-002 Zod scope, DEV-017/018 merge timing)
- Created detailed execution plan with risk assessment

### ✅ Step 2: Product Owner Review (DONE)
- **PO** validated business intent and phase alignment
- Confirmed 95%+ requirements coverage
- Enhanced acceptance criteria with user perspective
- Identified frontend coordination needs for DEV-017
- Documented all acceptance criteria (50+ checkboxes per task)

**Output**: `.docs/plans/PO-ASSESSMENT-SH-002-DEV-016-017-018.md` (30KB, 707 lines)

### ✅ Step 3: Gap Resolution (DONE)
- All gaps identified by Architect/PO have been addressed
- 4 critical decisions made:
  1. ✅ **DEV-016 Option A APPROVED** (file rename only, non-breaking)
  2. ✅ **SH-002 Scope**: TypeScript types only (Zod deferred to SH-004)
  3. ✅ **DEV-017/018**: Keep separate (dependency chain)
  4. ✅ **Frontend Coordination**: Required for DEV-017 (simultaneous PRs)

---

## 🚀 Ready for Development Kickoff

### Development Tasks (Execution Order)

| # | Task | Owner | Duration | Dependencies | Status |
|---|------|-------|----------|--------------|--------|
| 1️⃣ | **SH-002**: Define API types (common/requests/responses) | FullStack Dev | 3 days | SH-001 ✅ | 🟢 Ready |
| 2️⃣ | **DEV-017**: Standardize list contracts (all endpoints) | FullStack Dev | 2 days | SH-002 | 🔴 Blocked |
| 3️⃣ | **DEV-018**: PaginationRequest helper (Drizzle utilities) | FullStack Dev | 2 days | DEV-017 | 🔴 Blocked |
| 4️⃣ | **DEV-016**: Controller naming (file rename, non-breaking) | FullStack Dev | 1 day | DEV-018 | 🔴 Blocked |

**Total Timeline**: 8 days sequential + 1 day code review = **9 days**

### Phase Timing
```
Week 4 (Phase 1.6):
├─ Mon: SH-002 starts
├─ Thu: DEV-017 starts (after SH-002 PR merged)
├─ Sat: DEV-018 starts
└─ Mon (Week 5): DEV-016 starts

Week 5 (Phase 2 prep):
├─ Tue: All code reviews complete
├─ Wed: All PRs merged to dev
└─ Thu: Phase 2 development can begin
```

---

## 📝 FullStack Developer Handoff

### Pre-Development Checklist
- [ ] Read `.docs/plans/PO-ASSESSMENT-SH-002-DEV-016-017-018.md` (entire document)
- [ ] Review all 4 GitHub issues (#74, #300, #301, #302)
- [ ] Verify SH-001 is complete (entity types in @yacc/common)
- [ ] Check that PR #304 is merged to dev
- [ ] Pull latest dev branch (`git pull origin dev`)

### SH-002 Acceptance Criteria (Quick Reference)
```typescript
✅ BaseListRequest exported from packages/common/src/index.ts (main export)
✅ BaseListResponse exported from packages/common/src/index.ts (main export)
✅ BaseListRequest has getOffset() method: (page - 1) * limit
⚠️ CRITICAL: getOffset() formula is (page - 1) * limit (NOT page * limit)
✅ All conversation request/response types defined
✅ All message request/response types defined
✅ All auth request/response types defined
✅ All user request/response types defined
✅ All IRC config request/response types defined
✅ All types importable via import { ... } from '@yacc/common'
✅ Zero TypeScript errors
✅ Unit tests for BaseListRequest.getOffset() with edge cases
✅ All PR descriptions reference this issue
✅ .docs/02-api-and-data-model.md updated
```

### DEV-017 Acceptance Criteria (Quick Reference)
```typescript
✅ All list endpoints return BaseListResponse<T>
✅ IListResponse interface removed
✅ All controllers use new BaseListResponse(data, total, query)
✅ Services return { data, total } consistently
✅ Response shape: { data: T[], page: 1, limit: 15, total: 100 }
✅ Zero TypeScript errors
✅ All existing tests pass
✅ Frontend team notified (parallel PR work)
✅ .docs/02-api-and-data-model.md updated
```

### DEV-018 Acceptance Criteria (Quick Reference)
```typescript
✅ PaginationRequest class created
✅ Base applyToQuery() applies .limit().offset() only
✅ Feature query classes override applyToQuery()
✅ Controllers use single query.applyToQuery(baseSelect)
✅ No manual offset/limit in controllers
✅ Unit tests for PaginationRequest
✅ Unit tests for feature query classes
✅ All integration tests pass
✅ .docs/03-implementation-guide.md updated
```

### DEV-016 Acceptance Criteria (Quick Reference)
```typescript
✅ Files renamed: assignments → assignment, bulkActions → bulk-action, etc.
✅ Tag duplicate removed (keep tag.controller.ts, delete tags.controller.ts)
✅ controllers/index.ts updated with new imports
✅ Zero TypeScript errors
✅ All tests pass
✅ API endpoints UNCHANGED (path refactoring deferred)
✅ .docs/02-api-and-data-model.md references updated
✅ Frontend works without changes
```

---

## 🔀 Branch Strategy

Create feature branches in this order:

```bash
# 1. SH-002
git checkout -b feature/SH-002-api-types dev

# 2. DEV-017 (from SH-002 after PR merged)
git checkout -b feature/DEV-017-list-contracts dev

# 3. DEV-018 (from DEV-017 after PR merged)
# NOTE: Can run in parallel with DEV-016 to save 1 day
git checkout -b feature/DEV-018-pagination-helper dev

# 4. DEV-016 (from DEV-018 after PR merged)
# OR run parallel with DEV-018 (independent tasks)
git checkout -b feature/DEV-016-controller-naming dev
```

### Optimized Parallel Path (Saves 1 Day)
```
SH-002 (3d) → DEV-017 (2d) → [DEV-018 (2d) + DEV-016 (1d) in PARALLEL]
Total: 7 days instead of 8
```

---

## 📋 Frontend Coordination (CRITICAL for DEV-017)

### When to Notify Frontend
**Timing**: As soon as DEV-017 development starts

### Message to Frontend Team
```
🚨 HEADS UP: DEV-017 (Backend API Contract Standardization) Starting

Timeline:
- Backend: 2 days to complete
- Frontend: Update API hooks to expect new BaseListResponse shape
- Merge window: SAME RELEASE (synchronized deployment)

Changes:
- All list endpoints return: { data: T[], page: 1, limit: 15, total: 100 }
- No other shape changes (backward compatible for frontend expectations)

Action Items:
1. When PR opens, review the response shape changes
2. Update your API hooks to parse new contract
3. Merge your PR same day as backend PR
4. Deployment is coordinated (no gaps between backend/frontend)

Questions? See .docs/plans/PO-ASSESSMENT-SH-002-DEV-016-017-018.md
```

---

## 🧪 Testing Requirements

### Unit Tests (Required for All Tasks)
- SH-002: Test BaseListRequest.getOffset() calculation
- DEV-017: Test response shape consistency
- DEV-018: Test PaginationRequest.applyToQuery() behavior
- DEV-016: Just file rename, minimal test changes

### Integration Tests (Required)
- DEV-017: Test list endpoints with real DB data
- DEV-018: Test Drizzle query building with filters + pagination

### Coverage Target
✅ **85%+ code coverage** for all new code

### E2E Tests (QA)
- SH-002: No E2E needed (types only)
- DEV-017: Frontend E2E after frontend PR merged
- DEV-018: No E2E needed (internal optimization)
- DEV-016: No E2E needed (file rename only)

---

## 📚 Documentation Requirements

### SH-002
- Update `.docs/02-api-and-data-model.md` (section: "Shared Types")
- Add examples of importing types from @yacc/common

### DEV-017
- Update `.docs/02-api-and-data-model.md` (section: "List Response Contract")
- Document BaseListResponse shape with examples

### DEV-018
- Update `.docs/03-implementation-guide.md` (section: "Pagination & Query Building")
- Add code examples of PaginationRequest usage

### DEV-016
- Update `.docs/02-api-and-data-model.md` (endpoint paths section)
- Document controller naming convention

---

## 🔴 CRITICAL BLOCKERS TO WATCH

### Blocker 1: BaseListRequest.getOffset() Missing or Wrong Formula
- **Impact**: DEV-018 cannot proceed; pagination will be wrong
- **Check**: Verify `packages/common/src/requests/base-list.request.ts` has `getOffset()` method
- **Formula**: MUST be `(page - 1) * limit` (pages are 1-indexed in API)
- **Fix**: If missing or formula wrong, add/correct in SH-002 task
- **Unit test**: Add tests for edge cases (page=0, page=1, page=2 etc.)

### Blocker 2: Frontend Not Coordinated for DEV-017
- **Impact**: API contract mismatch, runtime errors
- **Check**: Frontend team PR created before merging backend DEV-017
- **Fix**: Delay backend PR merge until frontend PR ready

### Blocker 3: IListResponse Still Exists After DEV-017
- **Impact**: Dual contracts, confusion
- **Check**: `grep -r "IListResponse" packages/`
- **Fix**: Ensure fully removed and replaced with BaseListResponse

### Blocker 4: Duplicate Tags Controller Not Removed in DEV-016
- **Impact**: Two controllers handle `/api/tags` (confusion, maintenance nightmare)
- **Check**: `ls packages/backend/src/controllers/tag*.controller.ts` (should be 1 file)
- **Fix**: Remove `tags.controller.ts`, keep `tag.controller.ts` only

### Blocker 5: Controller Index Imports Wrong After DEV-016
- **Impact**: TypeScript compilation fails
- **Check**: Run `pnpm --filter @yacc/backend build`
- **Fix**: Verify all renamed controllers imported in controllers/index.ts

---

## ✅ Definition of Done (Per Task)

### SH-002 Definition of Done
- [ ] All types exportable from @yacc/common
- [ ] BaseListRequest.getOffset() method working
- [ ] Zero TypeScript errors
- [ ] Unit tests passing (85%+ coverage)
- [ ] `.docs/02-api-and-data-model.md` updated
- [ ] PR created, linked to issue #74
- [ ] Code reviewer approved
- [ ] PR merged to dev

### DEV-017 Definition of Done
- [ ] All list endpoints return BaseListResponse<T>
- [ ] IListResponse removed from codebase
- [ ] Services updated to return { data, total }
- [ ] Frontend team PR created (parallel)
- [ ] All integration tests passing
- [ ] `.docs/02-api-and-data-model.md` updated
- [ ] Frontend and backend PRs ready to merge same day
- [ ] Code reviewer approved
- [ ] Both PRs merged to dev simultaneously

### DEV-018 Definition of Done
- [ ] PaginationRequest class created
- [ ] Feature query classes implement applyToQuery()
- [ ] Controllers updated to use single applyToQuery() call
- [ ] Unit tests passing (85%+ coverage)
- [ ] `.docs/03-implementation-guide.md` updated
- [ ] Code reviewer approved
- [ ] PR merged to dev

### DEV-016 Definition of Done
- [ ] 5 controller files renamed to kebab-case
- [ ] Duplicate tags.controller.ts deleted
- [ ] controllers/index.ts updated
- [ ] All tests passing
- [ ] No API endpoints changed
- [ ] `.docs/02-api-and-data-model.md` references updated
- [ ] Code reviewer approved
- [ ] PR merged to dev

---

## 📞 Support & Escalation

### If You Get Stuck
1. **Type Safety Questions**: Check ADR-005 (flat structure), ADR-014 (no-any standard)
2. **API Contract Questions**: See .docs/02-api-and-data-model.md
3. **Drizzle ORM Questions**: Reference PR #259, #267 (existing pagination examples)
4. **Frontend Impact Questions**: Reach out to frontend team directly
5. **Architectural Questions**: Escalate to @ea-architecture-validator

### Daily Standups
- Report progress on task
- Flag any blockers immediately
- Request code review when PR ready

---

## 🎉 Success Criteria

✅ All 4 tasks complete  
✅ All PRs merged to dev  
✅ Zero TypeScript errors  
✅ 85%+ test coverage  
✅ Documentation updated  
✅ Frontend coordination complete  
✅ Ready for Phase 2 development  

---

**Ready to start? Create SH-002 branch and begin!**
