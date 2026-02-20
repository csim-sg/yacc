# Preparation for INT-011..INT-014 Implementation

**Date**: 2026-02-20  
**Target Tasks**: INT-011, INT-012, INT-013, INT-014  
**Status**: 🔴 **AWAITING CONFIRMATION from Architect + PO** (No coding until confirmed)  

---

## 📋 EXECUTIVE SUMMARY

### What INT-011..INT-014 Do
These 4 tasks complete the IRC integration feature set:
- **INT-011**: Channel mapping (one conversation per IRC channel)
- **INT-012**: Error handling & DLQ integration
- **INT-013**: Unit tests (90%+ coverage)
- **INT-014**: Integration tests (end-to-end with mock IRC server)

### Current State
- ✅ INT-001..INT-010 **COMPLETED** (PR #263 merged Feb 15-20, 2026)
- 🔴 INT-011..INT-014 **NOT STARTED**
- Dependencies fully satisfied (INT-001-010 provide all prerequisites)

### What Needs Confirmation
1. **INT-011 Scope**: Is "one conversation per channel" the ONLY requirement, or are there multi-network scenarios?
2. **INT-012 Scope**: DLQ exists (via BE-015); do we need NEW DLQ features specific to IRC errors?
3. **INT-013/014 Scope**: Mock IRC server approach—use existing patterns or introduce new test utilities?
4. **Testing Coverage**: Should tests focus on IRC-specific flows only, or also cover Telegram parity?
5. **Timeline**: Can INT-011..014 be done sequentially in one PR to `dev`, or split across multiple PRs?

---

## 🎯 REQUIREMENT RECAP

### INT-011: Channel Mapping (P0, Backend, ~8-10 hours)

**Description**: Map IRC channels to conversations; one conversation per channel.

**Acceptance Criteria** (from `.docs/06-tasks.md`):
- Channel joins create/update conversations
- `external_thread_id` = channel name
- No duplicate conversations per channel

**Deliverables** (from plan):
- One conversation per channel
- Channel name = `external_thread_id`
- Channel join creates conversation
- Member list → conversation participants

**Implementation Areas**:
- ✅ **Already exists**: `irc-ingestion.service.ts` upserts conversations for each channel
- ✅ **Already exists**: `conversation.schema.ts` has `externalThreadId` field (supports unique index on channel + externalThreadId)
- ⏳ **Needs verification**: Is the current implementation sufficient, or are there gaps?

**Dependencies**:
- INT-002 (Ingestion) ✅ DONE
- BE-002 (Schema) ✅ DONE

---

### INT-012: Error Handling & DLQ (P1, Backend, ~6-8 hours)

**Description**: Handle IRC connection errors with logging, DLQ for failed messages, exponential backoff, rate limiting.

**Acceptance Criteria**:
- Connection errors logged with correlation ID
- Failed messages moved to DLQ
- DLQ processing works
- Rate limiting enforced

**Deliverables** (from plan):
- Connection errors logged with correlation ID ✅ (already in INT-001 IRC connector)
- Failed messages moved to DLQ ✅ (INT-003 delivery + BE-015 retry queue)
- Exponential backoff for retries ✅ (INT-004)
- Rate limiting enforcement ⏳ (NEW - may need implementation)

**Implementation Areas**:
- 🔵 **Potential Gap**: Rate limiting enforcement — where should this be implemented?
  - Options: IRC connector (send throttling), message retry worker (BullMQ rate limiting), API endpoint (request rate limit)?
  - **Ask Architect**: What rate limit applies to IRC? Per-channel? Per-network? Shared across all channels?

**Dependencies**:
- INT-001 (Connector) ✅ DONE
- BE-015 (DLQ/Retry Queue) ✅ DONE (BullMQ configured)

---

### INT-013: Unit Tests for IRC Connector (P1, Backend, ~10-12 hours)

**Description**: Comprehensive unit test coverage for IRC connector.

**Acceptance Criteria**:
- 90%+ code coverage for IRC connector
- All code paths tested
- Edge cases covered

**Deliverables** (from plan):
- 90%+ code coverage
- Mock IRC client events
- Test connection states
- Test message handling
- Test error scenarios

**Test Structure** (from existing patterns):
- **Location**: `packages/backend/src/connectors/__tests__/irc.connector.test.ts` (partially exists)
- **Existing**: Some tests already in place (28/28 tests passing for INT-001)
- **Pattern**: Vitest + vi.mock for IRC framework, EventEmitter for events
- **Coverage Tool**: `pnpm test:coverage`

**Implementation Areas**:
- Unit tests for connection/disconnection
- Tests for authentication (nick + password)
- Tests for message send/receive
- Tests for error scenarios (timeout, connection reset, auth failure)
- Tests for reconnection logic (exponential backoff)
- Edge cases: CRLF injection, message truncation, self-echo detection

**Dependencies**:
- INT-003 (Delivery) ✅ DONE

---

### INT-014: Integration Tests for IRC Connector (P1, Backend, ~10-15 hours)

**Description**: End-to-end integration tests using mock IRC server.

**Acceptance Criteria**:
- E2E flows working
- All scenarios covered
- Integration with DB validated

**Deliverables** (from plan):
- Mock IRC server setup
- End-to-end message flow test
- Connection/disconnection test
- Error scenario test
- Reconnection test

**Test Structure** (from existing patterns):
- **Location**: `packages/backend/src/__tests__/irc-integration.test.ts` (or similar)
- **Existing**: Integration patterns visible in `ircIntegration.spec.ts` (tests for INT-005, INT-009)
- **Pattern**: Test database setup, IRC connector instance, mock server emulation
- **Scenarios**:
  1. Connect to IRC server, receive message → conversation + message created in DB
  2. Send message from UI → IRC channel receives it
  3. Disconnect from IRC → status updated, auto-reconnect scheduled
  4. Connection error → DLQ created, retry scheduled
  5. Reconnection after 5 attempts fail → incident logged

**Mock IRC Server Approach**:
- Options:
  1. ✅ **Existing pattern** (easier): Use `irc-framework` mock + EventEmitter (like unit tests)
  2. 🆕 **New pattern** (more realistic): Spin up real IRC test server (e.g., Ergo, UnrealIRCd in Docker)
  - **Ask Architect**: Which approach preferred? (Trade-off: simplicity vs. realism)

**Dependencies**:
- INT-001-012 ✅ DONE

---

## 📊 IMPLEMENTATION MAPPING

### Files to Create

| File | Task | Purpose |
|------|------|---------|
| `packages/backend/src/connectors/__tests__/irc.connector.test.ts` | INT-013 | Unit tests for IRC connector (expand existing skeleton) |
| `packages/backend/src/__tests__/irc-integration.test.ts` | INT-014 | Integration tests with mock IRC server |
| (Possibly) `packages/backend/src/config/irc-rate-limit.config.ts` | INT-012 | Rate limiting configuration (if needed) |

### Files to Modify

| File | Task | Changes |
|------|------|---------|
| `packages/backend/src/connectors/irc.connector.ts` | INT-011/012 | Verify channel mapping logic, add error handling if gaps exist |
| `packages/backend/src/services/irc-ingestion.service.ts` | INT-011 | Verify conversation upsert logic for channels |
| `packages/backend/src/services/messageRetryWorker.ts` or similar | INT-012 | Integrate DLQ for IRC errors (or verify existing integration) |
| (Possibly) `packages/backend/src/infrastructure/irc-rate-limiter.ts` | INT-012 | Implement rate limiting (if needed) |

### No Changes Needed (Already Complete)

- ✅ `packages/backend/src/schemas/conversation.schema.ts` — `externalThreadId` field exists
- ✅ `packages/backend/src/services/conversation.service.ts` — conversation listing works
- ✅ `packages/backend/src/workers/messageRetryWorker.ts` — retry + DLQ infrastructure exists
- ✅ `packages/backend/src/connectors/irc.connector.ts` — core connector exists

---

## 🔴 BLOCKERS & GAPS

### Blocker #1: Rate Limiting Scope (INT-012)

**Issue**: "Rate limiting enforcement" is mentioned in INT-012, but:
- No rate limiting config/service exists yet
- Unclear where limit should apply (IRC send? API requests? Per-channel? Global?)
- No test utilities for rate limit verification exist

**Mitigation Options**:
1. **Ask Architect**: Define rate limiting requirement clearly
2. **Or**: Defer rate limiting to separate issue (Phase 2)
3. **Or**: Implement simple token bucket per channel in IRC connector

**Action**: ❓ **AWAITING CONFIRMATION**

---

### Blocker #2: Channel Mapping Completeness (INT-011)

**Issue**: `irc-ingestion.service.ts` already creates conversations per channel.
- Is the current implementation sufficient for INT-011, or are there gaps?
- Should we add conversation participants (member list) to metadata?
- Should we handle channel topic/description as conversation title?

**Mitigation**:
1. Review `irc-ingestion.service.ts` line 100+ for completeness
2. Compare against Telegram connector for parity
3. Ask Architect if additional metadata needed

**Action**: ❓ **AWAITING CONFIRMATION**

---

### Blocker #3: Mock IRC Server Strategy (INT-014)

**Issue**: Two approaches for mock IRC server:
1. **EventEmitter approach** (current unit test pattern) — simpler, faster
2. **Real IRC test server** (Docker/Ergo) — more realistic, more setup

**Mitigation**:
- Ask Architect which approach fits MVP timeline
- If using EventEmitter: reuse existing mock patterns
- If using real server: may add 2-3 hours setup + CI/CD integration

**Action**: ❓ **AWAITING CONFIRMATION**

---

### Blocker #4: Coverage Target Clarity (INT-013)

**Issue**: 90%+ coverage target — but which parts?
- IRC connector only? (400 lines)
- Ingestion service? (200 lines)
- Both combined? (600 lines)
- What counts as "covered"? (statements, branches, lines?)

**Mitigation**:
1. Use Vitest coverage report: `pnpm test:coverage`
2. Focus on critical paths: connection, message handling, error scenarios
3. Ask Architect if 90% is statement-based or branch-based

**Action**: ❓ **AWAITING CONFIRMATION**

---

## 📈 PROPOSED SEQUENTIAL EXECUTION PLAN

### Phase: INT-011 (Channel Mapping) — ~10 hours

1. **Review existing logic** (1-2 hours)
   - Read `irc-ingestion.service.ts` → verify conversation upsert logic
   - Read `irc.connector.ts` → verify channel join handling
   - Check for any gaps vs. acceptance criteria

2. **Implement/Fix channel mapping** (4-6 hours)
   - Add conversation creation on channel join (if not already done)
   - Verify `externalThreadId` = channel name (likely already done)
   - Add channel metadata (topic, member list) if needed
   - Ensure unique constraint prevents duplicates
   - Write unit tests for upsert logic (ensure idempotency)

3. **Test & verify** (2-3 hours)
   - Run unit tests: `pnpm test` (verify 85%+ coverage)
   - Run linter: `pnpm lint`
   - Manual test: connect IRC, join channel, check conversation created

4. **Commit & prepare for review**
   - Branch: `task/INT-011-channel-mapping`
   - Commit message: "INT-011: Implement IRC channel-to-conversation mapping with atomic upsert and metadata"
   - PR target: `dev`

---

### Phase: INT-012 (Error Handling & DLQ) — ~8 hours

1. **Audit existing error handling** (2-3 hours)
   - Check `irc.connector.ts` for error logging (correlation IDs)
   - Check `irc-ingestion.service.ts` for error propagation
   - Check `messageRetryWorker.ts` for DLQ integration
   - Identify gaps in rate limiting

2. **Implement missing pieces** (3-4 hours)
   - If rate limiting missing: create `services/irc-rate-limiter.service.ts`
   - Add rate limit checks in connector send method
   - Verify DLQ integration (should be via retry worker)
   - Add tests for error scenarios

3. **Test & verify** (1-2 hours)
   - Unit tests for error handling
   - Integration test for DLQ flow
   - Verify correlation ID propagation in logs

4. **Commit & prepare for review**
   - Branch: `task/INT-012-error-handling-dlq` (rebase from INT-011 or separate)
   - Commit message: "INT-012: Add error handling, DLQ integration, and rate limiting for IRC connector"
   - PR target: `dev`

---

### Phase: INT-013 (Unit Tests) — ~12 hours

1. **Expand existing unit test skeleton** (4-6 hours)
   - Location: `packages/backend/src/connectors/__tests__/irc.connector.test.ts`
   - Expand mock IRC client to cover all scenarios
   - Add tests for:
     - Connection states (connected, retrying, disconnected, failed)
     - Message send/receive
     - Authentication (nick + password)
     - Error scenarios (timeout, connection reset, auth failure)
     - Reconnection logic (exponential backoff)
     - Edge cases (CRLF injection, message length, self-echo)

2. **Measure coverage** (2-3 hours)
   - Run: `pnpm test:coverage`
   - Target: 90%+ for IRC connector
   - Identify untested branches, add tests

3. **Unit tests for INT-011 & INT-012** (2-3 hours)
   - Channel mapping unit tests (conversation upsert)
   - Error handling unit tests (correlation IDs, DLQ)
   - Rate limiter unit tests (if created)

4. **Verify existing tests still pass** (1-2 hours)
   - Run full test suite: `pnpm test`
   - Ensure no regressions

5. **Commit & prepare for review**
   - Branch: `task/INT-013-unit-tests` (or rebase if combined)
   - Commit message: "INT-013: Add comprehensive unit tests for IRC connector (90%+ coverage)"
   - PR target: `dev`

---

### Phase: INT-014 (Integration Tests) — ~15 hours

1. **Design integration test setup** (2-3 hours)
   - Decide on mock IRC server approach (EventEmitter vs. real server)
   - Design test database seeding (user, conversation setup)
   - Plan test scenarios:
     1. Connect → receive message → DB updated
     2. Send message → IRC channel receives
     3. Disconnect → auto-reconnect scheduled
     4. Connection error → DLQ created
     5. Max retries → incident logged, status = failed

2. **Implement integration tests** (8-10 hours)
   - Location: `packages/backend/src/__tests__/irc-integration.test.ts`
   - Mock IRC server implementation (or real server in Docker)
   - Test database seeding + cleanup
   - Implement all 5 scenarios above
   - Verify DB consistency (messages, conversations, DLQ entries)

3. **Verify end-to-end flows** (2-3 hours)
   - Connect IRC connector in test
   - Simulate channel join → conversation creation
   - Simulate inbound message → ingestion → DB update
   - Simulate send message → IRC channel
   - Verify WebSocket events emitted (if applicable)

4. **Run full test suite & coverage** (2-3 hours)
   - Run: `pnpm test` (all tests pass)
   - Run: `pnpm test:coverage` (85%+ overall, 90%+ connector)
   - Fix any regressions

5. **Commit & prepare for review**
   - Branch: `task/INT-014-integration-tests` (or combined)
   - Commit message: "INT-014: Add end-to-end integration tests for IRC connector with mock server"
   - PR target: `dev`

---

## 🔀 GIT STRATEGY

**Recommended Approach**: One feature branch, split into logically separate commits, ONE PR to `dev`.

```bash
# Create feature branch from dev
git checkout dev
git pull origin dev
git checkout -b task/INT-011-014-irc-completion

# Commit 1: INT-011 implementation + tests
git commit -m "INT-011: Implement IRC channel-to-conversation mapping with atomic upsert and metadata"

# Commit 2: INT-012 implementation + tests
git commit -m "INT-012: Add error handling, DLQ integration, and rate limiting for IRC connector"

# Commit 3: INT-013 unit tests
git commit -m "INT-013: Add comprehensive unit tests for IRC connector (90%+ coverage)"

# Commit 4: INT-014 integration tests
git commit -m "INT-014: Add end-to-end integration tests for IRC connector with mock server"

# Push and create PR
git push origin task/INT-011-014-irc-completion
# Create PR on GitHub against dev branch
```

**Alternative**: Separate PRs per task (if they need independent review/approval).

---

## ✅ VERIFICATION PLAN

### Pre-Merge Checklist

Before creating PR, verify all of the following MUST PASS:

```bash
# 1. Run all tests
pnpm --filter @yacc/backend test

# Expected: ✓ All tests pass (28+ tests from INT-001-010 + new INT-011-014)
# Expected: Coverage ≥ 85% overall, ≥ 90% for IRC connector

# 2. Check coverage report
pnpm --filter @yacc/backend test:coverage

# Expected: 90%+ coverage for:
# - packages/backend/src/connectors/irc.connector.ts
# - packages/backend/src/services/irc-ingestion.service.ts
# - packages/backend/src/services/irc-rate-limiter.service.ts (if created)

# 3. Lint code
pnpm --filter @yacc/backend lint

# Expected: No errors, no warnings
# Expected: No `any` types used
# Expected: Flat folder structure (no nested api/, domain/)

# 4. Type check
pnpm --filter @yacc/backend build

# Expected: TypeScript compiles without errors
# Expected: No type mismatches in IRC connector, ingestion, or tests

# 5. Run from clean state (simulate CI/CD)
rm -rf packages/backend/dist && \
rm -rf packages/backend/node_modules/.vitest && \
pnpm --filter @yacc/backend test && \
pnpm --filter @yacc/backend lint && \
pnpm --filter @yacc/backend build

# Expected: All steps pass
```

### Example Output for PASS Status

```
✓ src/connectors/__tests__/irc.connector.test.ts (45 tests) 1.2s
✓ src/__tests__/irc-integration.test.ts (18 tests) 2.3s
✓ src/services/__tests__/irc-ingestion.service.test.ts (12 tests) 800ms
✓ ... (other existing tests)

Test Files  24 passed (24)
     Tests  220 passed (220)
  Start at  02:00:00
  Duration  45.23s

Coverage summary:
- packages/backend/src/connectors/irc.connector.ts: 92.5% (18/19 branches)
- packages/backend/src/services/irc-ingestion.service.ts: 88.7% (42/47 statements)
- Overall: 87.3%

✓ Linter: 0 errors, 0 warnings
✓ TypeScript: No errors
```

---

## 🎯 DELIVERABLES CHECKLIST

### For Each Task (INT-011 → INT-012 → INT-013 → INT-014)

- [ ] Code implemented (zero `any` types, flat structure, one-def-per-file)
- [ ] Unit tests written (≥ 85% coverage)
- [ ] Integration tests written (for INT-013/014)
- [ ] All tests passing (`pnpm test`)
- [ ] Linter passing (`pnpm lint`)
- [ ] TypeScript strict mode passing (`pnpm build`)
- [ ] Coverage ≥ 90% for IRC connector
- [ ] Documentation updated (`.docs/` files if needed)
- [ ] Clear commit message (WHY, not WHAT)
- [ ] No breaking changes to existing tests
- [ ] No regressions in INT-001-010 tests

### For PR

- [ ] Title: `INT-011-014: Complete IRC integration with mapping, error handling, and tests`
- [ ] Description includes:
  - Summary of changes (INT-011 mapping, INT-012 error handling, INT-013/014 tests)
  - Reference to acceptance criteria from `.docs/06-tasks.md`
  - Coverage report (90%+ for connector)
  - Test results (all passing)
  - No breaking changes
- [ ] Assigned to Architect for review
- [ ] Target branch: `dev`
- [ ] Merge method: Squash and merge (one commit per task, or one commit total if combined)

---

## 🚨 RISKS & MITIGATION

| Risk | Severity | Mitigation |
|------|----------|-----------|
| Rate limiting scope unclear | 🟡 Medium | Ask Architect ASAP; if unclear, defer to Phase 2 |
| Channel mapping already complete but not tested | 🟢 Low | Review code first; if gaps, extend; tests will validate |
| Mock IRC server strategy impacts timeline | 🟡 Medium | Choose EventEmitter (faster) unless Architect requires real server |
| 90% coverage hard to reach | 🟡 Medium | Focus on critical paths first; expand if time permits |
| Regression in INT-001-010 tests | 🔴 High | Run full test suite after each commit; fix immediately |

---

## 📝 QUESTIONS FOR ARCHITECT + PO

**BEFORE STARTING IMPLEMENTATION**, please clarify:

1. **INT-011 Scope**:
   - Is current channel mapping logic (one conversation per channel) sufficient?
   - Should we add conversation metadata (topic, member count, etc.)?
   - Any multi-network scenarios to handle?

2. **INT-012 Scope**:
   - What rate limiting applies to IRC? (messages/second? per-channel? global?)
   - Should we defer rate limiting to Phase 2, or implement now?
   - Any existing rate limiting patterns in Telegram connector to follow?

3. **INT-013/014 Testing**:
   - For INT-014 mock IRC server: prefer EventEmitter (simpler) or real test server (more realistic)?
   - Coverage target: 90% statement-based or branch-based?
   - Should INT-013/014 include Telegram connector parity tests, or IRC-only?

4. **Timeline & PR Strategy**:
   - Can INT-011-014 be done in one PR to `dev`, or need separate PRs per task?
   - Any dependencies on QA (Playwright E2E tests) before merging?

5. **Documentation Updates**:
   - Should `.docs/02-api-and-data-model.md` be updated with IRC-specific endpoint details?
   - Any ADR needed for channel mapping or error handling approach?

---

## 📌 FINAL STATUS

🔴 **AWAITING CONFIRMATION** from Architect + PO on:
- INT-011 completeness
- INT-012 rate limiting scope
- INT-013/014 testing approach
- PR strategy
- Documentation needs

✅ **READY TO PROCEED** once:
- Architect confirms INT-011 gap analysis
- Architect clarifies INT-012 rate limiting
- Architect selects INT-014 mock server strategy
- PO reviews acceptance criteria alignment

**Next Action**: Share this document with Architect + PO, get feedback, then start coding.

---

**Prepared by**: FullStack Developer (Claude Code)  
**Date**: 2026-02-20  
**Time Estimate**: 45-55 hours total (10+8+12+15 + verification + review cycles)  
