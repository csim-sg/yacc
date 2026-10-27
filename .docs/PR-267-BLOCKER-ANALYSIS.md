# PR #267 Blocker Analysis & Fix Plan

**Date**: 2026-02-21  
**PR**: feat(INT-011-014): IRC profile-scoped mapping, error handling, tests, and sidebar  
**Branch**: feature/int-011-014-irc-mapping  
**Status**: Analysis Complete - Awaiting Fix Execution

---

## Summary

PR #267 has completed conflict resolution and lint fixes but has **30+ failing tests** across 5 categories. All failures are **isolated to test/response handling**, not core IRC integration logic (INT-011, INT-014).

**Estimated Fix Time**: 2-3 hours  
**Risk Level**: LOW (changes isolated to test infrastructure)

---

## Root Causes (Ranked by Priority)

### 🔴 P1: Type Casting in Routing Rules Service (8 tests)

**File**: `packages/backend/src/services/routing-rules.service.ts`  
**Lines**: 70-71  
**Confidence**: HIGH

**Problem**:
```typescript
// ❌ CURRENT (WRONG)
conditions: conditions as unknown,
actions: actions as unknown,

// ✅ SHOULD BE
conditions: conditions as RoutingCondition[],
actions: actions as RoutingAction[],
```

**Why It Fails**: When `conditions` is cast to `unknown`, the rules engine can't iterate over it as an array. Loop attempts fail with "conditions is not iterable" error.

**Test Pattern**: 
- `expected undefined to be defined` - Rule evaluation returns nothing
- `expected 'normal' to be 'high'` - Priority action not applied
- `conditions is not iterable` - Loop fails

**Impact**: Rules engine completely non-functional

---

### 🔴 P1: Response Serialization in Message Controller (8+ tests)

**File**: `packages/backend/src/controllers/message.controller.ts`  
**Confidence**: MEDIUM

**Problem**: Using `@Res() res: Response` with manual `res.json()` calls causes test client to receive `undefined` response body.

**Test Pattern**: 
- `expected undefined to deeply equal []` - res.body.messages is undefined
- `expected undefined to be 'pending'` - Missing status field
- Message body fields are missing from response

**Why It Fails**: 
- routing-controllers doesn't auto-serialize response when using `@Res()`
- Manual `res.json()` may not work as expected with test framework
- OR: response is sent but test framework isn't capturing it properly

**Suspected Solutions**:
- Option A (Recommended): Remove `@Res()` decorator and return object directly
- Option B: Verify `res.json()` return value and proper serialization

---

### 🟡 P2: Fixture Seeding FK Violation (1 critical failure)

**File**: `packages/backend/scripts/seed-test-fixtures.ts`  
**Lines**: 569, 582, 595  
**Confidence**: HIGH

**Error**: 
```
Key (conversation_id)=(00000000-0000-0000-0000-000000001001) 
is not present in table "conversations"
```

**Problem**: Notifications seeding inserts reference hardcoded conversation IDs that don't exist in fixture data.

**Current Code Pattern**:
```typescript
// Likely has hardcoded IDs instead of FIXTURE variables
conversationId: "00000000-0000-0000-0000-000000001001", // ❌ WRONG
```

**Should Be**:
```typescript
conversationId: FIXTURE.conversations.telegram.id,  // ✅ CORRECT
```

**Impact**: Frontend E2E tests can't run - fixture seeding fails during global setup

---

### 🟡 P2: Tag Controller 404 Errors (4 tests)

**Files**: 
- `packages/backend/src/controllers/index.ts`
- `packages/backend/src/controllers/tags.controller.ts`

**Confidence**: MEDIUM

**Problem**: Tag endpoints return 404 instead of expected status codes.

**Test Pattern**:
- `expected 404 to be 201` - POST /conversations/:id/tags fails
- `expected 404 to be 200` - DELETE /conversations/:id/tags/:tagId fails

**Suspected Cause**: 
- Tag controller not properly exported from index.ts OR
- Route prefix misconfiguration affecting tag routes

---

## Test Failure Breakdown

### Category 1: Message API Tests (8 failures)
```
GET /conversations/:id/messages
├─ should return empty messages for new conversation
├─ should support pagination with custom page and limit
├─ should filter messages by direction
├─ should return messages ordered chronologically

POST /conversations/:id/messages
├─ should send a message successfully as user
├─ should send a message successfully as manager
├─ should handle concurrent message sends
└─ should set sender name from user email
```

**Root Cause**: Response serialization issue - res.body fields are undefined

---

### Category 2: Message Status Tracking (10 failures)
```
GET /conversations/:conversationId/messages/:messageId/status
├─ should return message status after sending (500 instead of 200)
├─ should return 404 if message does not exist (500 instead of 404)
├─ should require authentication (401 to 403)
└─ [7 more status tracking failures]

GET /conversations/:conversationId/messages
└─ should return message status in conversation message list
```

**Root Cause**: Same response serialization + missing error handling

---

### Category 3: Routing Rules (8 failures)
```
Rule Evaluation
├─ should match rule when all conditions are met (undefined vs rule id)
├─ should handle keyword contains condition (undefined vs matched rule)
├─ should handle regex matching (undefined vs matched rule)
├─ should apply priority action (normal vs high)
└─ should handle first-match-wins strategy (undefined vs rule id)

Rule Execution Logging
├─ [3 successful - not failing]
```

**Root Cause**: Type casting issue breaking conditions/actions iteration

---

### Category 4: Tags CRUD (4 failures)
```
POST /api/conversations/:id/tags
├─ should require authentication (404 instead of 401)
├─ should add tag to conversation (404 instead of 201)
├─ should be idempotent (404 instead of 201)
└─ should allow all roles to add tags (404 instead of 201)

DELETE /api/conversations/:id/tags/:tagId
├─ should remove tag from conversation (404 instead of 200)
├─ should allow all roles to remove tags (404 instead of 200)
└─ should allow super_admin to remove tags (404 instead of 200)
```

**Root Cause**: Routing/registration issue - all endpoints return 404

---

### Category 5: Frontend E2E Setup (1 critical)
```
Global Fixture Setup
└─ Failed to seed test fixtures (FK constraint violation)
```

**Root Cause**: Hardcoded conversation IDs in notifications seed

---

## Exact Files to Modify

### Must Change (Minimal Scope)
1. `packages/backend/src/services/routing-rules.service.ts` - Lines 70-71 (type casting)
2. `packages/backend/src/controllers/message.controller.ts` - Response handling
3. `packages/backend/scripts/seed-test-fixtures.ts` - Fixture conversation IDs

### Likely Need Changes
4. `packages/backend/src/controllers/index.ts` - Controller registration
5. `packages/backend/src/controllers/tags.controller.ts` - Route verification

### Do NOT Change
- IRC connector code (INT-011, INT-014 logic is working)
- DLQ implementation (traceContext fix already applied)
- WebSocket gateway
- Any integration-specific code

---

## Minimal Fix Plan

### Phase 1: Type Safety (30 min) - HIGH CONFIDENCE
**File**: `packages/backend/src/services/routing-rules.service.ts`

1. Line 70: Change `conditions: conditions as unknown` to `conditions: conditions as RoutingCondition[]`
2. Line 71: Change `actions: actions as unknown` to `actions: actions as RoutingAction[]`
3. Verify no TypeScript errors: `pnpm type-check`
4. Run tests: `pnpm --filter @yacc/backend test -- routing-rules.spec.ts`

**Expected Result**: 8 tests pass (all routing rule tests)

---

### Phase 2: Response Serialization (45 min - 1 hour) - MEDIUM CONFIDENCE
**File**: `packages/backend/src/controllers/message.controller.ts`

**Option A (Recommended)**:
1. Remove `@Res() res: Response` parameter from all endpoint methods
2. Return object directly instead of calling `res.json()`
3. routing-controllers will auto-serialize the return value
4. For errors, throw appropriate exceptions instead of calling `res.status().json()`

**Option B (Alternative)**:
1. Keep `@Res()` but verify Express response serialization
2. Add explicit `return res;` after `res.json()` calls
3. Check if routing-controllers version needs middleware update

**Test**: `pnpm --filter @yacc/backend test -- message-api.spec.ts`

**Expected Result**: 8+ message API tests pass

---

### Phase 3: Fixture Seeding (20 min) - HIGH CONFIDENCE
**File**: `packages/backend/scripts/seed-test-fixtures.ts`

1. Review lines 564-601 (notifications seeding)
2. Verify all notification inserts use `FIXTURE.conversations.*` variables
3. Ensure no hardcoded conversation IDs (e.g., `00000000-0000-0000-0000-000000001001`)
4. Run seed: `pnpm --filter @yacc/backend run db:fixtures`

**Expected Result**: Frontend E2E tests can start (fixture setup passes)

---

### Phase 4: Tag Controller (20 min) - MEDIUM CONFIDENCE
**Files**: 
- `packages/backend/src/controllers/index.ts`
- `packages/backend/src/controllers/tags.controller.ts`

1. Verify `tags.controller.ts` exists and has proper `@JsonController()` decorator
2. Verify controller is exported in `controllers/index.ts` const array
3. Check route prefix matches API contract (`/api/conversations/:conversationId/tags`)
4. Run tests: `pnpm --filter @yacc/backend test -- tags-crud.spec.ts`

**Expected Result**: 4 tag CRUD tests pass

---

### Phase 5: Full Test Suite Verification (10 min)
1. Run entire backend test suite: `pnpm --filter @yacc/backend test`
2. Run frontend E2E: `pnpm --filter @yacc/frontend test`
3. Run lint and type check: `pnpm lint && pnpm type-check`

**Expected Result**: All tests pass, no lint errors

---

## Pre-Fix Checklist

- [ ] On correct branch: `feature/int-011-014-irc-mapping`
- [ ] All uncommitted changes saved/stashed
- [ ] Remote is up to date: `git fetch origin`
- [ ] Test database running: `docker-compose up -d`
- [ ] Database migrations current: `pnpm --filter @yacc/backend db:migrate`
- [ ] Node dependencies fresh: `pnpm install`

---

## Test Commands

```bash
# Individual test suites
pnpm --filter @yacc/backend test -- routing-rules.spec.ts
pnpm --filter @yacc/backend test -- message-api.spec.ts
pnpm --filter @yacc/backend test -- message-status-tracking.spec.ts
pnpm --filter @yacc/backend test -- tags-crud.spec.ts

# Full backend suite
pnpm --filter @yacc/backend test

# All tests
pnpm test

# Quality checks
pnpm type-check
pnpm lint
```

---

## Risk Assessment

**Overall Risk**: LOW

**Type Safety Fix**: VERY LOW RISK
- Isolated type change
- No logic modification
- Guaranteed to improve (currently broken)

**Response Serialization Fix**: LOW RISK
- Test infrastructure only
- Changes to controller response pattern
- No business logic affected
- Core IRC integration unaffected

**Fixture Seeding Fix**: VERY LOW RISK
- Data fix only
- No code logic change
- Direct error message points to fix

**Tag Controller Fix**: LOW RISK
- Registration/routing only
- No feature logic change
- Isolated to tag CRUD endpoints

---

## Scope Boundary

**Changes Included**: 
- Type casting fixes
- Response serialization fixes
- Fixture data corrections
- Controller registration verification

**NOT Included** (working correctly):
- IRC connector implementation (INT-011, INT-014)
- DLQ traceContext contract (already fixed)
- IRC profile mapping logic
- WebSocket infrastructure
- All integration code

---

## Success Criteria

✅ All 30+ failing tests pass  
✅ `pnpm test` completes with 0 failures  
✅ `pnpm lint` shows no violations  
✅ `pnpm type-check` completes successfully  
✅ Frontend E2E fixtures seed without FK violations  
✅ No new failures introduced  
✅ No changes outside PR scope

---

## Ready for Implementation

✅ Analysis Complete  
✅ Root Causes Identified  
✅ Files Pinpointed  
✅ Fix Plan Documented  
✅ Commands Prepared  
✅ Risk Assessed  

**Status**: READY FOR FIX EXECUTION

