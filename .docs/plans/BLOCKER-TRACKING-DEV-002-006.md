# 🔴 BLOCKER TRACKING: DEV-002-006 Backend Refactoring

**Created**: 2026-02-22  
**Last Updated**: 2026-02-22  
**Status**: ⏳ IN PROGRESS  
**Overall Progress**: 0% → Tracking blocker fixes

---

## 📊 BLOCKER SUMMARY

| Category | Count | Severity | Status | Est. Time |
|----------|-------|----------|--------|-----------|
| **Lint Errors** | 3 | 🟡 HIGH | ⏳ PENDING | ~15 min |
| **Test Failures** | 55 | 🔴 CRITICAL | ⏳ PENDING | ~2-4 hrs |
| **Coverage Verification** | 1 | 🟡 HIGH | ⏳ PENDING | ~5 min |
| **TOTAL BLOCKERS** | **59** | — | **⏳ PENDING** | **~3-5 hrs** |

---

## 🔴 BLOCKER #1: Lint Errors (3 fixes required)

### Blocker Details
**Status**: ⏳ PENDING FIX  
**Severity**: 🟡 HIGH (blocking merge)  
**Effort**: ~15 minutes  
**Owner**: FullStack Developer  

### Individual Lint Errors

#### Error 1.1: Unused Import in Test File
**Location**: `packages/backend/src/infrastructure/__tests__/irc.adapter.spec.ts:6`  
**Error Type**: `@typescript-eslint/no-unused-vars`  
**Message**: Remove unused import `InboundMessageEvent`  
**Status**: ⏳ PENDING  
**Fix**: 
```typescript
// Before
import type { InboundMessageEvent, OutboundMessagePayload } from '../../types/gateway.types';

// After (if truly unused in test)
import type { OutboundMessagePayload } from '../../types/gateway.types';
```

**Verification**: 
```bash
grep -n "InboundMessageEvent" packages/backend/src/infrastructure/__tests__/irc.adapter.spec.ts
# Should find 0 matches if truly unused
```

---

#### Error 1.2: Multiple Classes in Single Test File
**Location**: `packages/backend/src/services/__tests__/gateway-exchange.spec.ts:7`  
**Error Type**: `max-classes-per-file`  
**Message**: Multiple classes in single file (MockAdapter + test suite)  
**Status**: ⏳ PENDING  
**Fix**: Extract `MockAdapter` to separate utility file
```typescript
// Create: packages/backend/tests/utils/MockAdapter.ts
export class MockAdapter extends EventEmitter implements PlatformAdapter {
  // Implementation here
}

// Then import in spec file
import { MockAdapter } from '../utils/MockAdapter';
```

**Verification**:
```bash
# Should show MockAdapter in separate file
ls -la packages/backend/tests/utils/MockAdapter.ts
```

---

#### Error 1.3: Unused Parameter in Gateway-Exchange
**Location**: `packages/backend/src/services/gateway-exchange.ts:452`  
**Error Type**: `@typescript-eslint/no-unused-vars`  
**Message**: Unused parameter `correlationId` in private method  
**Status**: ⏳ PENDING  
**Fix**: Prefix with underscore
```typescript
// Before
private async logToDLQ(correlationId: string, entry: any) {
  // not used
}

// After
private async logToDLQ(_correlationId: string, entry: any) {
  // not used
}

// OR remove if truly unnecessary
private async logToDLQ(entry: any) {
  // ...
}
```

**Verification**:
```bash
grep -n "_correlationId\|correlationId" packages/backend/src/services/gateway-exchange.ts
```

---

### Fix Checklist

- [ ] Error 1.1: Remove unused import from irc.adapter.spec.ts
- [ ] Error 1.2: Extract MockAdapter to separate file (tests/utils/MockAdapter.ts)
- [ ] Error 1.3: Prefix unused parameter with underscore OR remove it
- [ ] Verify: `pnpm --filter @yacc/backend lint` passes (zero errors)
- [ ] Status Update: Mark this blocker as FIXED ✅

---

## 🔴 BLOCKER #2: Test Failures (55 failures)

### Blocker Details
**Status**: ⏳ PENDING FIX  
**Severity**: 🔴 CRITICAL (blocking merge)  
**Effort**: ~2-4 hours  
**Owner**: FullStack Developer  
**Root Cause**: Tests written for old `irc-ingestion.service` pattern; now delegated to `gateway-exchange`

### Test Failure Breakdown

#### Category A: Message API Tests (18 failures)
**File**: `tests/BE-009-010-message-api.spec.ts`  
**Status**: ⏳ PENDING  

**Root Cause**: Tests expect direct adapter calls; now flow through gateway-exchange

**Fix Strategy**:
1. Mock `gateway-exchange.handleInbound()` and `handleOutbound()`
2. Mock adapter registry (for outbound dispatch)
3. Verify WebSocket events emitted correctly
4. Verify DLQ logging on errors

**Example Fix**:
```typescript
// Before
const adapter = connectorManager.getAdapter('irc');
await adapter.send(message);

// After
jest.mock('../services/gateway-exchange', () => ({
  GatewayExchange: class {
    handleOutbound = jest.fn().mockResolvedValue({ id: 'msg-1' })
  }
}));

const message = await messageService.sendMessage(...);
expect(gatewayExchange.handleOutbound).toHaveBeenCalled();
```

**Verification**:
```bash
pnpm --filter @yacc/backend test -- tests/BE-009-010-message-api.spec.ts
```

---

#### Category B: Message Status Tracking (13 failures)
**File**: `tests/BE-011-message-status-tracking.spec.ts`  
**Status**: ⏳ PENDING  

**Root Cause**: Status updates now handled by gateway-exchange, not direct service calls

**Fix Strategy**:
1. Mock gateway-exchange to emit status change events
2. Verify message.status updated in DB
3. Verify WebSocket event emitted on status change

**Verification**:
```bash
pnpm --filter @yacc/backend test -- tests/BE-011-message-status-tracking.spec.ts
```

---

#### Category C: Tags CRUD (12 failures)
**File**: `tests/BE-P2-001-tags-crud.spec.ts`  
**Status**: ⏳ PENDING  

**Root Cause**: Likely unrelated to DEV-002-006 refactoring (returns 404)  
**Investigation**: May be pre-existing issue or routing problem

**Fix Strategy**:
1. Run test in isolation to check if pre-existing
2. If new issue: Check tags controller routing
3. If pre-existing: Note as separate issue for follow-up

**Verification**:
```bash
pnpm --filter @yacc/backend test -- tests/BE-P2-001-tags-crud.spec.ts
```

---

#### Category D: Routing Rules (5 failures)
**File**: `src/__tests__/routing-rules.spec.ts`  
**Status**: ⏳ PENDING  

**Root Cause**: Rules engine may not work with new gateway-exchange pattern

**Fix Strategy**:
1. Verify rules engine hook is called by gateway-exchange
2. Mock rules engine evaluation
3. Verify rule actions applied correctly

**Verification**:
```bash
pnpm --filter @yacc/backend test -- src/__tests__/routing-rules.spec.ts
```

---

#### Category E: Retry Worker (3 failures)
**File**: `src/workers/__tests__/messageRetryWorker.test.ts`  
**Status**: ⏳ PENDING  
**Error**: "No adapter registered for platform: undefined"

**Root Cause**: Retry worker missing adapter mocks

**Fix Strategy**:
```typescript
// Mock adapters in test setup
jest.mock('../infrastructure/irc.adapter', () => ({
  IrcAdapter: class {
    send = jest.fn().mockResolvedValue({ success: true, externalMessageId: 'ext-1' })
  }
}));

// Or mock gateway-exchange instead
jest.mock('../services/gateway-exchange', () => ({
  GatewayExchange: class {
    handleOutbound = jest.fn().mockResolvedValue({ id: 'msg-1' })
  }
}));
```

**Verification**:
```bash
pnpm --filter @yacc/backend test -- src/workers/__tests__/messageRetryWorker.test.ts
```

---

#### Category F: Integrations Runtime (1 failure)
**File**: `tests/unit/services/integrations-runtime.service.test.ts`  
**Status**: ⏳ PENDING  
**Error**: Mock constructor issue

**Fix Strategy**:
1. Review mock setup for adapters
2. Ensure AdapterRegistry properly initialized
3. Verify mock adapter instances

**Verification**:
```bash
pnpm --filter @yacc/backend test -- tests/unit/services/integrations-runtime.service.test.ts
```

---

#### Category G: Old Connector Tests (3 failures)
**File**: `src/connectors/__tests__/irc.connector.test.ts`  
**Status**: ⏳ EXPECTED (deprecated code)  
**Note**: Can be deleted (old pattern replaced by adapters)

**Action**: Delete entire `src/connectors/` folder after merge (cleanup PR)

---

### Fix Checklist

- [ ] **Message API Tests**: Update to mock gateway-exchange (18 fixes)
- [ ] **Message Status Tracking**: Mock status change events (13 fixes)
- [ ] **Tags CRUD**: Investigate routing issue (12 fixes)
- [ ] **Routing Rules**: Wire rules engine to gateway (5 fixes)
- [ ] **Retry Worker**: Add adapter mocks (3 fixes)
- [ ] **Integrations Runtime**: Fix constructor mocks (1 fix)
- [ ] **Old Connector Tests**: Delete (mark for cleanup PR)
- [ ] Verify: `pnpm --filter @yacc/backend test` passes (all 842 tests)
- [ ] Status Update: Mark this blocker as FIXED ✅

---

## 🟡 BLOCKER #3: Test Coverage Verification

### Blocker Details
**Status**: ⏳ PENDING VERIFICATION  
**Severity**: 🟡 HIGH (blocking merge)  
**Effort**: ~5 minutes  
**Owner**: FullStack Developer  
**Blocker**: Cannot measure until all tests pass

### Coverage Requirements

**Minimum Coverage**: ≥85% on all new files

| File | Current | Target | Status |
|------|---------|--------|--------|
| `services/gateway-exchange.ts` | Unknown | ≥85% | ⏳ PENDING |
| `services/authentication.service.ts` | Unknown | ≥85% | ⏳ PENDING |
| `infrastructure/irc.adapter.ts` | Unknown | ≥85% | ⏳ PENDING |
| `infrastructure/telegram.adapter.ts` | Unknown | ≥85% | ⏳ PENDING |
| `infrastructure/types/adapter.interface.ts` | N/A (interface) | N/A | ✅ SKIP |
| `types/gateway.types.ts` | N/A (types) | N/A | ✅ SKIP |

### How to Verify

```bash
# Run full coverage report
pnpm --filter @yacc/backend test -- --coverage

# Or specific file
pnpm --filter @yacc/backend test -- --coverage packages/backend/src/services/gateway-exchange.ts

# View coverage report
open packages/backend/coverage/index.html
```

### Expected Coverage Analysis

**gateway-exchange.ts**:
- `handleInbound()` method: Multiple success/error paths
- `handleOutbound()` method: Multiple success/error paths
- `registerAdapter()` method: Event listener registration
- Error handling paths: DLQ logging, circuit breaker
- **Expected**: 90%+ (well-tested complex logic)

**authentication.service.ts**:
- Each delegated method tested
- Error handling tested
- **Expected**: 90%+ (simple wrapper, fully tested)

**irc.adapter.ts** & **telegram.adapter.ts**:
- Connect/disconnect paths
- Message transformation
- Event emission
- Error handling
- **Expected**: 85%+ (event-driven code has clear paths)

### Fix Checklist

- [ ] Wait for all tests to pass (Blocker #2)
- [ ] Run: `pnpm --filter @yacc/backend test -- --coverage`
- [ ] Verify each new file ≥85% coverage
- [ ] Generate coverage report (optional: share in PR)
- [ ] Status Update: Mark this blocker as VERIFIED ✅

---

## 📅 TIMELINE & MILESTONES

| Milestone | Target | Status | Notes |
|-----------|--------|--------|-------|
| **Lint Errors Fixed** | 2026-02-27 | ⏳ PENDING | ~15 min work |
| **Test Failures Fixed** | 2026-02-27 | ⏳ PENDING | ~2-4 hrs work |
| **Coverage Verified** | 2026-02-27 | ⏳ PENDING | ~5 min work |
| **All Blockers Resolved** | 2026-02-27 | ⏳ PENDING | Expected same day |
| **Re-Review Complete** | 2026-02-27 | 🔄 PENDING | ~30 min review time |
| **Merge to Dev** | 2026-02-28 | 🔄 PENDING | After final approval |

---

## 📞 DAILY STATUS UPDATES

### Template for Developer to Update

```
## Daily Blocker Status - [DATE]

### Lint Errors: [X/3 FIXED]
- [ ] Error 1.1: Remove unused import
- [ ] Error 1.2: Extract MockAdapter
- [ ] Error 1.3: Prefix unused parameter

**Time Spent**: X min
**Blocker**: None / [Describe if stuck]

### Test Failures: [X/55 FIXED]
- **Message API**: Y/18 fixed
- **Status Tracking**: Y/13 fixed
- **Tags CRUD**: Y/12 fixed
- **Routing Rules**: Y/5 fixed
- **Retry Worker**: Y/3 fixed
- **Integrations Runtime**: Y/1 fixed

**Time Spent**: X hrs
**Current Issue**: [Describe current problem]

### Coverage Verification: [STATUS]
**Status**: Waiting for tests to pass / In Progress / Complete
**Current Coverage**: XX%
**Target**: ≥85%

### Next Steps
1. [Next task]
2. [Next task]

### Blocker? 
[ ] No blockers
[ ] Stuck on: [Issue description]
[ ] Need help with: [Specific question]
```

---

## 🎯 SUCCESS CRITERIA

### Blocker Resolution Complete When

✅ **Lint**:
```bash
$ pnpm --filter @yacc/backend lint
✔ No lint errors found
```

✅ **Tests**:
```bash
$ pnpm --filter @yacc/backend test
✔ All 842 tests passing
```

✅ **Coverage**:
```bash
$ pnpm --filter @yacc/backend test -- --coverage
✔ gateway-exchange.ts: 90%+
✔ authentication.service.ts: 90%+
✔ irc.adapter.ts: 85%+
✔ telegram.adapter.ts: 85%+
✔ OVERALL: 88%+
```

### Ready for Final Review When

✅ All 3 blockers above resolved  
✅ No new issues introduced  
✅ Ready to request re-review  

---

## 🚦 WORKFLOW

```
START
  ↓
[1] Fix Lint Errors (15 min)
  ├─ Run: pnpm lint --fix
  ├─ Verify: 0 errors remain
  └─ Status: ✅ DONE
  ↓
[2] Fix Test Failures (2-4 hrs)
  ├─ Update mocks for gateway-exchange
  ├─ Run: pnpm test
  ├─ Verify: All 842 tests pass
  └─ Status: ✅ DONE
  ↓
[3] Verify Coverage (5 min)
  ├─ Run: pnpm test -- --coverage
  ├─ Verify: ≥85% on all new files
  └─ Status: ✅ DONE
  ↓
[4] Request Re-Review
  ├─ Comment on PR: "All blockers resolved, ready for final review"
  ├─ Tag: @code-reviewer
  └─ Status: ⏳ PENDING REVIEW
  ↓
[5] Final Approval
  ├─ Code Reviewer: Verifies fixes
  ├─ Approval: ✅ APPROVED
  └─ Status: ✅ APPROVED
  ↓
[6] Merge to Dev
  ├─ Action: Merge PR to dev branch
  ├─ Update: .docs/plans/00-INDEX.md
  └─ Status: ✅ MERGED
  ↓
END
```

---

## 📝 NOTES

- **Pre-existing Issues**: Tags CRUD 404 errors may be pre-existing (investigate before assuming DEV-002-006 caused them)
- **Cleanup PR**: Old connector code (`src/connectors/`) to be deleted in separate PR after merge
- **Coverage Tool**: `@vitest/coverage-v8` installed during code review; should be available for measurement
- **Test Determinism**: Ensure test setup/teardown is clean (especially for adapter mocks)

---

## 🔗 RELATED DOCUMENTS

- **Code Review Report**: (Full analysis of blockers)
- **ADR-005 Addendum-2**: `.docs/adr/ADR-005-Addendum-2-backend-refactoring-interfaces.md`
- **GOV-030**: `.docs/governance/GOV-030-DEV-002-006-refactoring-decisions.md`
- **Planning Index**: `.docs/plans/00-INDEX.md`

---

**Status**: ⏳ AWAITING DEVELOPER ACTION  
**Next Update**: After developer begins blocker fixes  
**Estimated Resolution**: 2026-02-27 (same day, ~3-5 hours total work)
