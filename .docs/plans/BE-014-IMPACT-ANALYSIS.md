# BE-014 Impact Analysis: Exponential Backoff Retry Queue + Dead Letter Queue (DLQ)

**Date**: 2026-02-09  
**Status**: IMPACT ANALYSIS - AWAITING PO CLARIFICATION  
**Task**: BE-014 (Exponential Backoff Retry Queue + DLQ Implementation)  
**Estimated Effort**: 6-8 hours  
**Planned Start**: Feb 11, 2026  
**Planned Completion**: Feb 12, 2026  

---

## Executive Summary

BE-014 completes the message delivery reliability system by implementing:
1. **Database persistence** for failed messages (DLQ table)
2. **Automated retry worker** for exponential backoff (1m, 5m, 30m)
3. **Integration layer** connecting retry logic with message status tracking
4. **Operations endpoints** for DLQ review and manual retry
5. **Comprehensive test suite** (20+ tests covering all failure scenarios)

**Current State**: 
- ✅ Queue infrastructure (BullMQ + Redis) exists and configured
- ✅ Message status tracking service implemented (BE-011)
- ✅ Message send/receive API ready (BE-009/010)
- ✅ Message retry worker skeleton in place
- ✅ DLQ service layer (partially complete)
- ❌ DLQ database table NOT created
- ❌ Retry worker NOT fully integrated with message service
- ❌ DLQ query endpoints NOT implemented
- ❌ Tests NOT written

**Business Value**:
- Users see automatic message delivery retry (no manual intervention for transient failures)
- Operations team can review & debug persistent failures
- Transparent failure tracking for audit & troubleshooting
- Exponential backoff prevents overwhelming Telegram/IRC APIs

---

## Dependency Map

```
BE-014 (THIS TASK)
│
├─ DEPENDS ON:
│  ├─ BE-009/010 ✅ COMPLETE
│  │  └─ Message send API, connector dispatch
│  ├─ BE-011 ✅ COMPLETE (PR #241 in review)
│  │  └─ Message status tracking, emit WebSocket events
│  ├─ Queue Infrastructure ✅ READY
│  │  └─ BullMQ + Redis (configured in queues.client.ts)
│  └─ Message Service ✅ EXISTS
│     └─ Must integrate retry logic when message.send() fails
│
└─ ENABLES:
   ├─ BE-012 (Manual Retry Endpoint) ⏳ TODO
   │  └─ POST /conversations/:id/messages/:msgId/retry
   │  └─ Depends on: BE-014 DLQ table + service methods
   ├─ BE-017/018/019 (WebSocket Events) ⏳ TODO
   │  └─ `message.retry_scheduled`, `queue.message_dlq` events
   │  └─ Depends on: BE-014 retry job creation + DLQ entries
   └─ Observability/Monitoring ⏳ FUTURE
      └─ DLQ alert thresholds, retry metrics
```

---

## Current Implementation State (Baseline)

### ✅ What Already Exists

#### 1. **Queue Infrastructure** (`queues.client.ts`)
- ✅ BullMQ queue initialized with correct config
- ✅ Exponential backoff settings: 1m, 5m, 30m (3 attempts max)
- ✅ `enqueueRetry()` function ready
- ✅ `getRetryQueue()` getter
- ✅ Connection pooling with Redis

#### 2. **Message Status Tracking** (`messageStatusTracker.ts`)
- ✅ Status transition state machine (pending → sent/failed)
- ✅ `trackSentMessage()`, `trackFailedMessage()` methods
- ✅ WebSocket event emission hooks
- ❌ **Gap**: `enqueueRetryIfNeeded()` TODO — only logs, doesn't enqueue

#### 3. **Retry Worker Skeleton** (`messageRetryWorker.ts`)
- ✅ Worker singleton instance pattern
- ✅ Job processor structure
- ✅ Connector registry pattern
- ✅ Event handlers (completed, failed, error)
- ❌ **Gap**: Full job processing logic is TODOs

#### 4. **DLQ Service** (`message-queue-dlq.service.ts`)
- ✅ DLQ entry retrieval (20+ test-worthy methods)
- ✅ Pattern analysis (top failure reasons, error stats)
- ✅ Bulk retry logic
- ✅ Auto-cleanup (old entries)
- ❌ **Gap**: Currently reads from `messageQueueService`, not persistent Postgres table

#### 5. **Type Definitions** (`message-queue.types.ts`)
- ✅ `SendMessageJobPayload` Zod schema
- ✅ `DLQEntry` Zod schema
- ✅ `JobCompletionResult`, `JobRetryMetadata` types
- ✅ Retry configuration constants (RETRY_CONFIG, QUEUE_NAMES)
- ✅ Failure reason enum

### ❌ What's Missing (BE-014 Scope)

#### 1. **DLQ Database Table**
```sql
CREATE TABLE dead_letter_queue (
  id UUID PRIMARY KEY,
  message_id UUID UNIQUE NOT NULL REFERENCES messages(id),
  conversation_id UUID NOT NULL REFERENCES conversations(id),
  payload JSONB NOT NULL,  -- Original SendMessageJobPayload
  failure_reason VARCHAR(50) NOT NULL,  -- max_retries_exceeded, validation_error, etc.
  total_attempts INT NOT NULL,
  last_error TEXT,
  failed_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  resolved_at TIMESTAMP,  -- NULL if unresolved, set when ops clears
  resolved_by UUID REFERENCES users(id),  -- Who resolved it
  resolution_notes TEXT,
  
  INDEX(conversation_id),
  INDEX(failed_at),
  INDEX(resolved_at)
);
```

#### 2. **Retry Worker Integration**
- Missing: Fetch message details from database
- Missing: Call connector.sendMessage() with full retry logic
- Missing: Update message status based on retry result
- Missing: Enqueue next retry or move to DLQ
- Missing: Emit WebSocket events

#### 3. **Message Service Integration**
- Missing: Call `enqueueRetry()` when message.send() fails
- Missing: Track retry attempts & failure reasons
- Missing: Move to DLQ after 3 failed attempts
- Missing: Emit `message.retry_scheduled` WebSocket event

#### 4. **DLQ Query Endpoints**
- Missing: `GET /dlq` — list all DLQ entries (paginated)
- Missing: `GET /dlq/:messageId` — get single DLQ entry
- Missing: `POST /dlq/:messageId/retry` — manual retry from DLQ
- Missing: `DELETE /dlq/:messageId` — mark as resolved
- Missing: `GET /dlq/stats` — DLQ statistics & pattern analysis

#### 5. **Tests** (20+ cases needed)
- Unit tests: Worker job processing (success, failure, DLQ move)
- Unit tests: DLQ service operations (CRUD, stats, patterns)
- Integration tests: End-to-end message lifecycle (send → fail → retry → DLQ)
- Integration tests: Exponential backoff timing
- E2E tests: WebSocket events emitted at each stage
- Edge cases: Network errors, timeout, validation errors, platform-specific errors

---

## Architectural Decisions & Constraints

### 1. **DLQ Storage: Database vs. Redis**

**Decision**: ✅ **Postgres table** (approved in PHASE-2-Q&A)

**Rationale**:
- Redis is volatile (restarts lose data)
- DLQ is audit/compliance requirement (1-year retention)
- Operations need historical analysis + persistent queryability
- Postgres FTS supports pattern analysis
- Drizzle ORM for type-safe queries

**Implication for BE-014**:
- Must create migration: `CREATE TABLE dead_letter_queue`
- Must implement: `saveToDLQ()` method that persists to Postgres
- Must implement: `getDLQEntries()` method that queries Postgres (not just Redis)
- Old BullMQ DLQ is ephemeral; Postgres DLQ is permanent

### 2. **Retry Backoff Strategy: Fixed vs. Exponential**

**Decision**: ✅ **Exponential backoff** (1m → 5m → 30m)

**Rationale**:
- Prevents overwhelming Telegram/IRC APIs during outages
- Industry standard (AWS SQS, Google Cloud Tasks use this)
- Configured in queues.client.ts already

**Implication for BE-014**:
- BullMQ handles backoff automatically
- No manual delay scheduling needed
- Next retry time is deterministic: `nextRetryTime = now + [60s, 300s, 1800s][attemptNumber]`

### 3. **Max Attempts: Uniform vs. Per-Message-Type**

**Decision**: ❌ **Uniform 3 attempts** (need PO confirmation)

**Question for PO**:
- Should all message types (Telegram, IRC) retry 3 times?
- Or different limits per platform (e.g., IRC network errors more retryable)?
- **Current:** Assumes uniform 3 attempts for MVP simplicity
- **Suggestion**: Accept uniform for MVP; add config per platform in Phase 2

**Implication for BE-014**:
- `RETRY_CONFIG.MAX_ATTEMPTS = 3` applies globally
- No per-message-type logic needed now
- Easy to enhance later (move to message schema if needed)

### 4. **DLQ Endpoint Scope: Include or Defer?**

**Decision**: ⚠️ **Pending PO decision**

**Question for PO**:
- Include DLQ query endpoints in BE-014 or defer to separate task?
  - **Option A**: Include (adds 2-3 hours, total 8-10 hours)
    - `GET /dlq`, `GET /dlq/stats`, `POST /dlq/:id/retry`, `DELETE /dlq/:id`
    - Complete ops workflow in one PR
  - **Option B**: Defer to BE-015 (keeps BE-014 scoped, cleaner separation)
    - BE-014: Database + worker integration + tests
    - BE-015: DLQ query controller + endpoints

**Current assumption for BE-014**: **Option A** (include endpoints, extends scope to 8-10h)

---

## Detailed Task Breakdown

### Task 1: Create DLQ Database Table & Migration (1.5 hours)
**Owner**: Backend Developer  
**Acceptance Criteria**:
- [ ] Migration file created: `migrations/XXX-create-dead-letter-queue.sql`
- [ ] Table schema matches ADR-005 design (fields, indexes, constraints)
- [ ] Drizzle schema updated: `packages/common/src/db/schema.ts`
- [ ] Migration runs successfully: `pnpm db:migrate`
- [ ] Table visible in Drizzle Studio

**Deliverables**:
```sql
CREATE TABLE dead_letter_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID UNIQUE NOT NULL,
  conversation_id UUID NOT NULL,
  payload JSONB NOT NULL,
  failure_reason VARCHAR(50) NOT NULL,
  total_attempts INT NOT NULL,
  last_error TEXT,
  failed_at TIMESTAMP NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMP,
  resolved_by UUID,
  resolution_notes TEXT,
  FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id),
  FOREIGN KEY (resolved_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_conversation_id (conversation_id),
  INDEX idx_failed_at (failed_at),
  INDEX idx_resolved_at (resolved_at),
  INDEX idx_message_id (message_id)
);
```

### Task 2: Implement Retry Worker (Message Processing Logic) (2.5 hours)
**Owner**: Backend Developer  
**Acceptance Criteria**:
- [ ] Worker fetches message details from database
- [ ] Worker calls `connector.sendMessage()` with full retry logic
- [ ] Worker handles success: updates message status to 'sent'
- [ ] Worker handles retryable errors: enqueues next retry with exponential backoff
- [ ] Worker handles non-retryable errors: moves to DLQ + updates message status
- [ ] Worker emits WebSocket events: `message.sent`, `message.failed`, `message.retry_scheduled`
- [ ] Worker handles connector errors gracefully (logs, doesn't crash)
- [ ] 0 TypeScript errors, 0 `any` types

**Deliverables**:
```typescript
// packages/backend/src/workers/messageRetryWorker.ts
export async function processRetryJob(job: Job<RetryJobData>): Promise<void> {
  // 1. Fetch message from database
  // 2. Get connector by platform
  // 3. Call connector.sendMessage()
  // 4a. SUCCESS: Update message status → 'sent', emit WebSocket event
  // 4b. RETRY: Enqueue next retry with exponential backoff
  // 4c. FAIL: Move to DLQ, emit failed event
}
```

### Task 3: Integrate with Message Status Tracker (1.5 hours)
**Owner**: Backend Developer  
**Acceptance Criteria**:
- [ ] `messageStatusTracker.trackFailedMessage()` calls `enqueueRetry()` for first/second failure
- [ ] After 3rd failure: `saveToDLQ()` instead of re-enqueuing
- [ ] Retry job includes: messageId, conversationId, platform, attemptNumber, previousError
- [ ] WebSocket events emitted: `message.retry_scheduled` on enqueue, `message.dlq` on final failure
- [ ] Message metadata updated with retry count + last error
- [ ] No broken tests (all existing tests pass)

**Integration Point**:
```typescript
// In messageStatusTracker.trackFailedMessage()
if (retryCount < MAX_ATTEMPTS) {
  await messageQueueService.enqueueRetry(jobPayload);
  // Emit: message.retry_scheduled
} else {
  await messageQueueDLQService.saveToDLQ({
    messageId, conversationId, payload, failureReason, totalAttempts, lastError
  });
  // Emit: message.dlq
}
```

### Task 4: Implement DLQ Persistence & Query Methods (1.5 hours)
**Owner**: Backend Developer  
**Acceptance Criteria**:
- [ ] `messageQueueDLQService.saveToDLQ()` persists to Postgres table
- [ ] `messageQueueDLQService.getDLQEntries()` queries Postgres (paginated)
- [ ] `messageQueueDLQService.getDLQEntry()` fetches single entry by messageId
- [ ] `messageQueueDLQService.resolveDLQEntry()` marks as resolved (with user + notes)
- [ ] `messageQueueDLQService.retryFromDLQ()` moves entry back to retry queue
- [ ] DLQ statistics & pattern analysis work with Postgres data
- [ ] Type-safe Drizzle queries, no raw SQL

**Deliverables**:
```typescript
// Update services/message-queue-dlq.service.ts
async saveToDLQ(entry: {
  messageId: string;
  conversationId: string;
  payload: SendMessageJobPayload;
  failureReason: string;
  totalAttempts: number;
  lastError: string;
}): Promise<void> {
  await dbClient.insert(deadLetterQueue).values({
    messageId: entry.messageId,
    conversationId: entry.conversationId,
    payload: entry.payload,
    failureReason: entry.failureReason,
    totalAttempts: entry.totalAttempts,
    lastError: entry.lastError,
    failedAt: new Date(),
  });
}
```

### Task 5: Create DLQ Query Controller & Endpoints (1.5 hours)
**Owner**: Backend Developer  
**Acceptance Criteria**:
- [ ] `GET /dlq` — List all DLQ entries (paginated, filters by conversation/timeframe)
- [ ] `GET /dlq/stats` — DLQ statistics (total count, by failure reason, oldest/newest)
- [ ] `GET /dlq/:messageId` — Get single DLQ entry
- [ ] `POST /dlq/:messageId/retry` — Manually retry from DLQ (reset attempt count)
- [ ] `DELETE /dlq/:messageId` — Mark as resolved (soft delete)
- [ ] RBAC: `manager+` only (admin/manager/super_admin)
- [ ] All responses include timestamps + audit fields
- [ ] Error handling: 404 if not found, 400 if invalid retry
- [ ] No TypeScript errors

**Deliverables**:
```typescript
// packages/backend/src/controllers/queue.controller.ts
@Get('/dlq')
async listDLQ(@QueryParam('page', { required: false }) page = 1) {}

@Get('/dlq/stats')
async getDLQStats() {}

@Get('/dlq/:messageId')
async getDLQEntry(@Param('messageId') messageId: string) {}

@Post('/dlq/:messageId/retry')
async retryFromDLQ(@Param('messageId') messageId: string) {}

@Delete('/dlq/:messageId')
async resolveDLQ(@Param('messageId') messageId: string) {}
```

### Task 6: Comprehensive Test Suite (2 hours)
**Owner**: Backend Developer  
**Acceptance Criteria**:
- [ ] 20+ test cases covering all scenarios
- [ ] Unit tests: Worker job processing (success, failure, DLQ)
- [ ] Unit tests: DLQ service CRUD operations
- [ ] Integration tests: Message lifecycle (send → fail → retry → DLQ)
- [ ] Integration tests: Exponential backoff timing verification
- [ ] Edge cases: Network timeout, validation error, platform error, max retries
- [ ] Mock connectors (don't call real Telegram/IRC)
- [ ] ≥ 85% code coverage
- [ ] All tests passing

**Test File Locations**:
```
packages/backend/src/workers/__tests__/messageRetryWorker.spec.ts
packages/backend/src/services/__tests__/message-queue-dlq.service.spec.ts
packages/backend/src/services/__tests__/message-status-tracker-retry-integration.spec.ts
packages/backend/src/controllers/__tests__/queue.controller.spec.ts
```

---

## Questions for Product Owner

### Q1: DLQ Query Endpoints Scope
**Question**: Should DLQ query endpoints be included in BE-014 or deferred to BE-015?

**Context**:
- **Option A** (Include in BE-014): Adds 1.5-2 hours, total 8-10 hours
  - Complete ops workflow in one task
  - Endpoints: GET /dlq, GET /dlq/stats, GET/POST/DELETE on /dlq/:id
- **Option B** (Defer to BE-015): Keeps BE-014 focused on backend logic
  - BE-014: Database + worker integration + tests (6-8 hours)
  - BE-015: DLQ controller + endpoints (2-3 hours, separate task)

**Recommendation**: **Option A** (include endpoints)
- Better user experience (ops can review DLQ immediately after deployment)
- Endpoints are simple (mostly delegating to service methods)
- Cleaner than splitting across tasks

**PO Decision**: ☐ **Option A** (include) | ☐ **Option B** (defer)

---

### Q2: Retry Limits: Uniform vs. Per-Type
**Question**: Should all message types retry 3 times, or different limits per platform?

**Context**:
- **MVP (Current)**: Uniform 3 attempts for all (Telegram, IRC)
  - Simple, sufficient for MVP
  - Hard to differentiate platform-specific errors
- **Enhanced (Phase 2)**: Different limits per platform
  - IRC network errors might need more retries
  - Telegram API errors different from IRC errors
  - Adds config table: `retry_config(platform, max_attempts)`

**Current Assumption**: Uniform 3 attempts (already configured in RETRY_CONFIG)

**PO Decision**: ☐ **Uniform 3** (MVP simplicity) | ☐ **Per-platform** (with config table)

---

### Q3: DLQ Retention & Auto-Cleanup
**Question**: How long should DLQ entries remain before auto-cleanup?

**Context**:
- **Current assumption**: 7 days (configurable)
- **Rationale**: Sufficient for ops investigation + audit trail
- **Options**:
  - 7 days (keep entries manageable, ops must action within a week)
  - 30 days (longer history, more storage)
  - 1 year (full audit compliance, matches audit log retention)
  - No auto-cleanup (manual resolution only)

**Configured In**: `DEAD_LETTER_QUEUE_RETENTION_DAYS` in config

**PO Decision**: ☐ **7 days** | ☐ **30 days** | ☐ **1 year** | ☐ **No auto-cleanup**

---

### Q4: Metrics & Monitoring
**Question**: What metrics should we track for DLQ messages?

**Context**:
- **Implemented in BE-014**: Current code captures attempt count, error types
- **Available for tracking**:
  - Total count + by failure reason
  - Average attempts before failure
  - Most common error messages
  - Conversations with highest failure rates
  - Time-to-DLQ (how long before message reaches DLQ)

**Suggested Metrics** (for Phase 2 monitoring):
- Alert if: >5 messages in DLQ in 1 hour
- Alert if: Message takes >2 hours to reach DLQ
- Report: Daily DLQ stats (count, top errors, affected conversations)

**PO Decision**: Include detailed metrics in BE-014 tests? ☐ **Yes** | ☐ **Defer to Phase 2**

---

## Impact on Other Tasks

### Blockers for BE-012 (Manual Retry Endpoint)
- **Dependency**: BE-014 DLQ table + service methods
- **Status**: BE-012 cannot start until BE-014 is complete
- **Est. Delay**: If BE-014 runs Feb 11-12, BE-012 starts Feb 12 (1-day slip)

### WebSocket Events (BE-017/018/019)
- **New Events to Emit**:
  - `message.retry_scheduled` — When message enqueued for retry
  - `queue.message_dlq` — When message moved to DLQ
  - `queue.dlq_updated` — When ops marks DLQ entry as resolved
- **Integration**: Already have emit points in messageStatusTracker
- **No Blocking**: These tasks can proceed in parallel; messages will emit when BE-014 ready

### Frontend Impact (FE-010 Reply Composer)
- **Status Badge**: Already shows message status (pending/sent/failed)
- **Retry Button**: Needs to appear when message is failed
  - Can call `POST /conversations/:id/messages/:msgId/retry` (BE-012)
  - Backend will check: is message in retry queue or DLQ?
  - If retryable: enqueue, show "Retrying..." status
  - If in DLQ: show "Failed - contact admin"
- **No Breaking Changes**: Frontend continues working, just UX improves

---

## Testing Strategy

### Unit Tests (8-10 tests)
- Worker successfully processes job (happy path)
- Worker handles connector timeout → enqueue next retry
- Worker handles non-retryable error (validation) → move to DLQ
- Worker handles max retries exceeded → move to DLQ + update message status
- DLQ service: Save, retrieve, resolve, retry operations
- DLQ statistics calculation (counts, patterns, averages)

### Integration Tests (8-10 tests)
- End-to-end: Message send fails → retry 1 → success
- End-to-end: Message send fails 3 times → DLQ
- Exponential backoff: Verify retry delays (1m, 5m, 30m)
- Database integrity: DLQ entries match queued jobs
- Concurrent retries: Multiple messages retrying simultaneously
- WebSocket events emitted at each stage

### E2E Tests (4-6 tests)
- UI shows "Retrying" status on message
- Ops can view DLQ in admin panel
- Ops can manually retry from DLQ
- Manual retry resets attempt counter (retries from 1)
- Resolved entries removed from active DLQ list

### Edge Cases (5+ tests)
- Message with large attachments (5 MB)
- Connector returns platform-specific error (Telegram API rate limit, IRC timeout)
- Database constraint violations (duplicate message_id in DLQ)
- Redis connection lost mid-retry
- Worker process crashes (BullMQ resumes on restart)

---

## Deployment & Rollout Considerations

### Database Migration
- **Script**: `pnpm db:migrate` runs automatically on deployment
- **Rollback**: If needed, migration can be reversed (DROP TABLE dead_letter_queue)
- **Zero-downtime**: Migration adds new table; no data loss from existing tables

### Worker Restart
- **Graceful Shutdown**: Worker closes queue connections before exit
- **Job Resumption**: BullMQ persists job state in Redis; unfinished jobs resume on restart
- **Message Status**: No messages retried twice (BullMQ ensures idempotency via jobId)

### Monitoring & Alerts
- **SLO**: Message delivery success rate ≥95% (after 3 retries)
- **Alert**: If >5 messages in DLQ per hour
- **Alert**: If worker crashes/disconnects (monitor worker health via Redis)

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| **DLQ table migration fails** | Low | High | Test migration in staging; have rollback plan |
| **Retry worker drops jobs** | Low | High | BullMQ is battle-tested; Redis persistence ensures durability |
| **Exponential backoff too aggressive** | Low | Medium | Can tune delays post-launch (1m/5m/30m are industry standard) |
| **DLQ grows unbounded** | Medium | Medium | Implement auto-cleanup (7-day retention); set alert threshold |
| **Connector errors not retryable** | Medium | Low | Categorize errors (retryable vs. fatal) in connector response; fallback to DLQ |
| **MessageStatusTracker not called for all sends** | High | High | Verify message service calls tracker for all send paths (covered in BE-009/010 PR review) |

---

## Success Criteria (Definition of Done)

### Code
- [ ] DLQ table schema migrated successfully
- [ ] Retry worker fully implements job processing (no TODOs)
- [ ] Message status tracker integrates with retry queue
- [ ] DLQ service methods query Postgres (not just Redis)
- [ ] 4 DLQ query endpoints implemented with RBAC
- [ ] 0 TypeScript errors, 0 `any` types
- [ ] All code follows architecture constraints (flat structure, one definition/file)

### Testing
- [ ] 20+ test cases written and passing
- [ ] ≥85% code coverage
- [ ] Unit tests for worker, DLQ service, endpoint controllers
- [ ] Integration tests for end-to-end message lifecycle
- [ ] Edge cases covered (timeouts, platform errors, max retries)
- [ ] All existing tests still passing (no regressions)

### Documentation
- [ ] `.docs/03-implementation-guide.md` updated with retry workflow
- [ ] Architecture decision documented in ADR (if new pattern)
- [ ] Swagger/OpenAPI docs updated for new endpoints
- [ ] `.docs/plans/00-INDEX.md` updated with BE-014 completion

### Deployment
- [ ] Migration runs successfully in staging
- [ ] Worker starts without errors
- [ ] DLQ endpoints accessible via API
- [ ] WebSocket events emitted correctly
- [ ] No breaking changes to existing endpoints

---

## Scope Clarification & Decisions

### IN SCOPE (BE-014)
- ✅ DLQ database table + migration
- ✅ Retry worker implementation (full job processing)
- ✅ Message status tracker integration
- ✅ DLQ service enhancements (Postgres queries)
- ✅ DLQ query controller + 4 endpoints
- ✅ Comprehensive test suite (20+ tests)
- ✅ WebSocket event emission hooks

### OUT OF SCOPE (Future Tasks)
- ❌ Email notifications on DLQ (Phase 2)
- ❌ Slack/PagerDuty integration (Phase 2+)
- ❌ Auto-remediation (auto-retry on specific errors) (Phase 2+)
- ❌ Advanced monitoring dashboard (Phase 2+)
- ❌ Per-platform retry config (Phase 2+)
- ❌ DLQ persistence to Elasticsearch (Phase 2+)

---

## Deliverables Checklist

### PR Deliverables
- [ ] Database migration file
- [ ] Updated Drizzle schema (common package)
- [ ] messageRetryWorker.ts — Full job processing
- [ ] messageStatusTracker.ts — Updated integration
- [ ] message-queue-dlq.service.ts — Postgres queries
- [ ] queue.controller.ts — DLQ endpoints
- [ ] Test files (4 files, 20+ tests)
- [ ] Updated documentation (.docs/)

### Code Quality
- [ ] ESLint passing
- [ ] TypeScript strict mode (0 errors)
- [ ] 0 `any` types
- [ ] 85%+ coverage
- [ ] Clear commit messages

### Documentation
- [ ] Architecture diagram updated (retry flow)
- [ ] API docs updated (new endpoints)
- [ ] Implementation guide updated
- [ ] Planning index updated (BE-014 marked COMPLETE)

---

## Questions Needing PO Answers

### CRITICAL (Must Clarify)
1. **DLQ Endpoints**: Include in BE-014 or defer to BE-015? (impacts scope by 2h)
2. **Retry Limits**: Uniform 3 attempts or per-platform config? (impacts message service integration)

### IMPORTANT (Nice-to-Have)
3. **DLQ Retention**: 7 days, 30 days, 1 year, or no auto-cleanup?
4. **Metrics**: Detailed metrics in tests, or defer to Phase 2 monitoring?

---

## Next Steps (Pending PO Confirmation)

### BEFORE START (This Week)
1. ⏳ **PO confirms answers to Q1 & Q2** (critical)
2. ⏳ **PO confirms answers to Q3 & Q4** (informational)
3. ⏳ **Architect reviews this analysis** (validates scope)
4. 📅 **Task assigned in GitHub** (create issue #XXX)
5. 🌿 **Feature branch created**: `feature/BE-014-exponential-backoff`

### WHEN APPROVED
1. Start Task 1: DLQ migration + schema (Feb 11)
2. Parallel: Task 2 & 3: Worker integration + status tracker (Feb 11)
3. Task 4 & 5: DLQ service + endpoints (Feb 12)
4. Task 6: Test suite + coverage (Feb 12)
5. PR review + merge (Feb 12, EOD)

---

## Appendices

### A. Retry Flow Diagram
```
┌─────────────────────────┐
│  Message.send() fails   │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│  messageStatusTracker.trackFailedMessage │
│  - Update message status: failed         │
│  - Track attempt count                   │
└────────┬────────────────────────────────┘
         │
         ▼
      Attempt < 3?
       /        \
      Y          N
     │            │
     ▼            ▼
  ENQUEUE        DLQ
  RETRY       MOVE TO
    │         DLQ
    ▼            │
┌─────────────┐  ▼
│ Retry Queue │ ┌──────────────────┐
│ (Redis +    │ │ dead_letter_queue│
│  BullMQ)    │ │    (Postgres)    │
│             │ └──────────────────┘
│ Wait delay: │    │
│ 1m / 5m /   │    ▼
│ 30m         │ Ops Review
└─────┬───────┘    │
      │            ├─ Manual Retry
      │            ├─ Investigate
      ▼            ├─ Mark Resolved
  messageRetry   │
  Worker()        └─ Archive
      │
   Process
    Job
      │
    Success?
    /        \
   Y          N
   │          │
   ▼          ▼
 SENT       RETRY?
  │         /    \
  │        Y      N
  ▼        │      │
Event:     │      ▼
message   │       DLQ
.sent     │      MOVE
          └─────→│
                  ▼
              Event:
              queue.dlq
```

### B. Configuration Reference
```typescript
// packages/backend/src/types/message-queue.types.ts

export const RETRY_CONFIG = {
  MAX_ATTEMPTS: 3,
  BACKOFF_DELAYS: [60000, 300000, 1800000], // 1m, 5m, 30m
  TIMEOUT_MS: 30000,
  CONCURRENCY: 5,
} as const;

export const QUEUE_NAMES = {
  MESSAGE_QUEUE: 'message-retry-queue',
  DLQ: 'message-dlq',
} as const;

// Environment variables (to add in .env)
DEAD_LETTER_QUEUE_RETENTION_DAYS=7  // Auto-cleanup old entries
DLQ_ALERT_THRESHOLD=5               // Alert if >5 in DLQ per hour
```

### C. Database Queries for Ops

```sql
-- Find all unresolved DLQ entries
SELECT * FROM dead_letter_queue WHERE resolved_at IS NULL ORDER BY failed_at DESC;

-- DLQ stats by failure reason
SELECT failure_reason, COUNT(*) as count FROM dead_letter_queue WHERE resolved_at IS NULL GROUP BY failure_reason;

-- Conversations with most failures
SELECT conversation_id, COUNT(*) as failed_count FROM dead_letter_queue WHERE resolved_at IS NULL GROUP BY conversation_id ORDER BY failed_count DESC;

-- Mark entry as resolved
UPDATE dead_letter_queue SET resolved_at = NOW(), resolved_by = $1, resolution_notes = $2 WHERE id = $3;

-- Delete old entries (older than 7 days)
DELETE FROM dead_letter_queue WHERE created_at < NOW() - INTERVAL '7 days' AND resolved_at IS NOT NULL;
```

---

**Document Version**: 1.0  
**Last Updated**: 2026-02-09  
**Status**: ⏳ AWAITING PO DECISIONS  
**Next Review**: Upon PO confirmation of Q1 & Q2
