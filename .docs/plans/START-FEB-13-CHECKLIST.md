# Phase 2 Day 7 Start Checklist (February 13, 2026)

**Target Start Time**: 9:00 AM UTC  
**Duration**: Day 7 is ~8 hours (backend 4-5h + frontend parallel 4-5h)  
**Next Update**: 5:00 PM UTC (EOD checkpoint)

---

## ✅ Pre-Work Setup (Do Before 9:00 AM)

### 1. Verify Current State
```bash
# From project root
git status
# Expected: On feature/BE-ASSIGN-NOTIFY-PHASE2 with no uncommitted changes

git log --oneline -5
# Expected: Latest commits are the 3 completed backend features

git branch -a | grep feature/BE
# Expected: See feature/BE-TAGS-NOTES-PHASE2, feature/BE-ASSIGN-NOTIFY-PHASE2, feature/BE-ROUTING-RULES-PHASE2
```

### 2. Pull Latest Dev Branch
```bash
git checkout dev
git pull origin dev
# Ensure you have latest from remote
```

### 3. Run Phase 2 Backend Test Suite
```bash
# From packages/backend
pnpm test

# Expected: All 133+ tests passing
# Expected: Coverage ≥85%
# Expected: 0 TypeScript errors
```

### 4. Create Tomorrow's Work Branches
```bash
# Branch 1: Backend Bulk + Audit (Backend Developer)
git checkout -b feature/BE-BULK-AUDIT-PHASE2

# Branch 2: Frontend Tags/Notes (Frontend Developer - parallel)
git checkout -b feature/FE-TAGS-NOTES-UI

# Branch 3: Frontend Assign/Notify (Frontend Developer - Day 8)
# (Will create after FE-TAGS-NOTES-UI is started)
```

---

## 🎯 Day 7 Execution Plan (Feb 13)

### BACKEND: BE-BULK-AUDIT-PHASE2 (4-5 hours)
**Branch**: `feature/BE-BULK-AUDIT-PHASE2`  
**Files to Create**: 6 files (2 controllers, 2 services, 2 test files)

#### Task 1: BE-BULK-ACTIONS-01 (2 hours)
```typescript
// controllers/bulk-actions.controller.ts
POST /conversations/bulk
  Input: { conversationIds: [], action: 'assign'|'tag'|'status', data: {...} }
  Output: { successCount, failureCount, failures: [{id, reason}] }
  RBAC: manager+ only
  Audit: bulk_action_applied

// services/bulk-actions.service.ts
function bulkAssign(conversationIds, userId, assigneeId)
function bulkTag(conversationIds, tagId)
function bulkUpdateStatus(conversationIds, status)

// __tests__/bulk-actions.test.ts (10+ tests)
Test: Valid bulk assign
Test: Partial failure (some conversations not found)
Test: RBAC enforcement (user can't bulk assign)
Test: Max 100 conversations limit
Test: Audit logging
```

**Success Criteria**:
- ✅ 10+ tests passing
- ✅ ≥85% coverage
- ✅ RBAC enforced (manager+ only)
- ✅ Partial failures handled gracefully
- ✅ Audit logged

---

#### Task 2: BE-AUDIT-QUERY (2-3 hours)
```typescript
// controllers/audit-logs.controller.ts
GET /api/audit-logs
  Query: actor, action, entity_type, entity_id, dateFrom, dateTo
  RBAC: manager+ only
  Response: { items: [{id, actor, action, entity_type, metadata, created_at}], total, page }

GET /api/conversations/:id/audit-logs
  RBAC: manager+ only
  Returns audit logs for conversation only

POST /api/audit-logs/export
  Query: Same filters as GET
  RBAC: admin+ only
  Response: CSV file

// services/audit-logs.service.ts
function queryAuditLogs(filters, pagination)
function exportAuditLogsCSV(filters)
function getConversationAuditLogs(conversationId)

// __tests__/audit-logs.test.ts (15+ tests)
Test: Query by actor
Test: Query by action type
Test: Query by entity_type + entity_id
Test: Date range filtering
Test: RBAC enforcement (user can't query)
Test: Export to CSV format
Test: Pagination
Test: Performance (index usage)
```

**Success Criteria**:
- ✅ 15+ tests passing
- ✅ ≥85% coverage
- ✅ RBAC enforced (manager+ for query, admin+ for export)
- ✅ CSV export works
- ✅ Performance optimized (index on entity_type, created_at DESC)

---

#### Task 3: Update Docs (30 min)
- [ ] Update `.docs/02-api-and-data-model.md` with 4 new endpoints
- [ ] Add request/response examples
- [ ] Document error codes

---

#### Task 4: Create PR (30 min)
```bash
git add .
git commit -m "feat: implement bulk actions + audit query (BE-BULK-ACTIONS-01, BE-AUDIT-QUERY)"
git push origin feature/BE-BULK-AUDIT-PHASE2

# Then create PR in GitHub
gh pr create --title "BE-BULK-AUDIT-PHASE2: Bulk Actions + Audit Query Endpoints" \
  --body "See docs for details" \
  --base dev
```

---

### FRONTEND: FE-TAGS-NOTES-UI (4-5 hours - PARALLEL)
**Branch**: `feature/FE-TAGS-NOTES-UI`  
**Start After**: Backend structure is clear (by 10:30 AM ideally)

#### Task 1: Set Up Components (1 hour)
```typescript
// components/ConversationRightPanel.tsx
<div className="right-panel">
  <TagsPanel />
  <NotesPanel />
</div>

// components/TagsPanel.tsx (30-40% implemented)
- List existing tags
- Multi-select tag selector
- Add tag button
- Remove tag button
- (Create inline tag - Day 8)

// components/NotesPanel.tsx (30-40% implemented)
- List notes
- Create note form (basic)
- Show @mention hint
- (Full note editor - Day 8)
```

#### Task 2: Set Up API Clients (1 hour)
```typescript
// services/tags.service.ts
export function createTag(name: string)
export function getTags()
export function attachTag(conversationId, tagId)
export function detachTag(conversationId, tagId)

// services/notes.service.ts
export function createNote(conversationId, body)
export function getNotes(conversationId)
```

#### Task 3: Start E2E Tests (1.5 hours)
```typescript
// __tests__/TagsPanel.spec.ts (5+ tests)
Test: Display existing tags
Test: Select tag
Test: Remove tag
Test: (Create tag - Day 8)

// __tests__/NotesPanel.spec.ts (5+ tests)
Test: Display notes
Test: Show @mention hint
Test: (Create note - Day 8)
```

#### Task 4: Hook Up TanStack Query (1 hour)
```typescript
// hooks/useTags.ts
export function useTags()
export function useTagMutations()

// hooks/useNotes.ts
export function useNotes(conversationId)
export function useNoteMutations()
```

**Success Criteria** (EOD):
- ✅ Component structure in place
- ✅ API clients ready
- ✅ 10+ E2E tests started (passing)
- ✅ No TypeScript errors
- ✅ Ready for Day 8 continuation

---

## 📊 EOD Checkpoint (5:00 PM UTC)

### Backend Status
- [ ] BE-BULK-ACTIONS-01 complete (10+ tests, PR ready)
- [ ] BE-AUDIT-QUERY complete (15+ tests, PR ready)
- [ ] `.docs/02-api-and-data-model.md` updated
- [ ] All Phase 2 backend tests still passing (133+)
- [ ] 0 TypeScript errors

### Frontend Status
- [ ] Components structure set up (30-40% complete)
- [ ] API clients created
- [ ] 10+ E2E tests started
- [ ] 0 TypeScript errors
- [ ] Ready for Day 8 continuation

### Overall
- [ ] Update `PHASE-2-DEVELOPMENT-STATUS.md` with Day 7 progress
- [ ] Mark tasks as "IN PROGRESS" or "COMPLETE"
- [ ] Log any blockers or decisions

---

## ⚠️ Potential Blockers & Mitigations

| Risk | Mitigation |
|------|-----------|
| Bulk actions complexity | Start simple: transaction per conversation, not whole bulk |
| CSV export encoding | Use fast-csv library, test with Unicode |
| Frontend API timing | Backend should be ready by 2 PM, Frontend can use mocks until then |
| Index performance | Create index BEFORE bulk queries (use migration or manual) |
| RBAC testing explosion | Use parameterized tests to reduce duplication |

---

## 🔗 References

- **PHASE-2-DEV-START-CHECKLIST.md** - Day-by-day schedule
- **PHASE-2-DEVELOPMENT-STATUS.md** - Progress tracking (update EOD)
- **.docs/02-api-and-data-model.md** - API contract (update with new endpoints)
- **.docs/01-product-specification.md** - User story acceptance criteria
- **AGENTS.md** - Architecture & coding standards

---

## ✨ Tips for Success

1. **Backend First**: Get bulk + audit endpoints working before frontend starts
2. **Tests Early**: Write tests as you go, not at the end
3. **Documentation**: Update `.docs/02-api-and-data-model.md` same day
4. **Communication**: If you hit a blocker, escalate immediately
5. **PR Quality**: Keep PRs focused and well-described (one feature per PR)
6. **Code Review**: Reference this checklist in PR description

---

**Last Updated**: February 12, 2026 (EOD)  
**Status**: Ready for Tomorrow  
**Start Time**: February 13, 2026 @ 9:00 AM UTC
