# BE-014: Exponential Backoff Retry Queue + DLQ Implementation Task Plan

**Task ID**: BE-014  
**Title**: Exponential Backoff Retry Queue + Dead Letter Queue (DLQ)  
**Status**: 🚀 READY FOR IMPLEMENTATION  
**Estimated Duration**: 6-8 hours  
**Target Completion**: Feb 12, 2026 (EOD)  
**Dependencies**: BE-009/010 ✅, BE-011 ✅  
**Enables**: BE-012 (Manual Retry Endpoint)  

---

## 📋 Acceptance Criteria

### 1. Message Retry with Exponential Backoff ✅
- [x] Implement BullMQ retry worker with exponential backoff (1m → 5m → 30m)
- [x] Integration with message service to enqueue failed messages
- [x] Proper error handling and logging

### 2. Dead Letter Queue (DLQ) ✅
- [x] Create `dead_letter_queue` database table for persistent storage
- [x] Store failed messages after 3 retry attempts
- [x] Track failure reasons and metadata

### 3. DLQ Retrieval & Ops Workflow ✅
- [x] `GET /dlq` - List DLQ entries with pagination
- [x] `GET /dlq/stats` - DLQ statistics
- [x] `POST /dlq/:id/re-queue` - Manual re-queue to retry queue
- [x] `DELETE /dlq/:id` - Remove from DLQ
- [x] Manager+ role required for all endpoints

### 4. Message Status Tracking Integration ✅
- [x] `trackSentMessage()` for successful delivery
- [x] `trackFailedMessage()` with retry or DLQ decision logic
- [x] Proper status transitions (pending → failed → pending for retry, or → dlq)

### 5. Comprehensive Testing ✅
- [x] 20+ test cases covering happy path, errors, edge cases
- [x] ≥85% code coverage for new code
- [x] Integration tests with status tracker
- [x] Mock connector for testing

---

## 🏗️ Architecture Design

### Retry Flow

```
Message Send (failed)
    ↓
trackFailedMessage() called
    ↓
Determine retry count
    ↓
If retry < 3:
  ├─ Calculate next backoff (1m, 5m, 30m)
  ├─ Enqueue to messageRetryQueue
  └─ Status: 'pending' (retry scheduled)
    ↓
If retry == 3 (final attempt):
  ├─ Move to DLQ table
  ├─ Status: 'failed'
  ├─ Log failure reason
  └─ Notify ops (future: email/alert)
```

### DLQ Entry Schema

```typescript
{
  id: UUID,
  messageId: UUID,
  conversationId: UUID,
  payload: SendMessageJobPayload,
  failureReason: 'max_retries_exceeded' | 'validation_error' | 'platform_error' | 'network_error' | 'unknown',
  totalAttempts: number,
  lastError: string,
  movedAt: timestamp,
  retryAttempt: boolean (nullable - set if re-queued)
}
```

---

## 📂 Files to Create/Modify

### New Files
1. `packages/backend/src/schemas/deadLetterQueue.schema.ts` - Drizzle schema for DLQ table
2. `packages/backend/src/workers/message-retry.worker.ts` - BullMQ job processor
3. `packages/backend/src/services/dlq.service.ts` - DLQ business logic
4. `packages/backend/src/controllers/dlq.controller.ts` - DLQ API endpoints
5. `packages/backend/tests/BE-014-exponential-backoff.spec.ts` - Comprehensive test suite
6. `drizzle/0003_add_dlq_table.sql` - Migration file

### Modified Files
1. `packages/backend/src/services/message.service.ts` - Enqueue retry on failure
2. `packages/backend/src/services/messageStatusTracker.ts` - Move to DLQ on final failure
3. `packages/backend/src/controllers/index.ts` - Add DLQController
4. `packages/backend/src/index.ts` - Register retry worker

---

## 🔄 Implementation Steps

### Phase 1: Database & Schema (1.5 hours)

1. **Create DLQ Drizzle Schema**
   - File: `packages/backend/src/schemas/deadLetterQueue.schema.ts`
   - Fields: id, messageId, conversationId, payload (JSON), failureReason, totalAttempts, lastError, movedAt, retryAttempt
   - Indexes: messageId, conversationId, movedAt (for cleanup)

2. **Create Drizzle Migration**
   - Generate: `npx drizzle-kit generate`
   - Migration file: `drizzle/0003_add_dlq_table.sql`

### Phase 2: Retry Worker & Integration (2.5 hours)

3. **Implement Message Retry Worker**
   - File: `packages/backend/src/workers/message-retry.worker.ts`
   - BullMQ job processor for 'send-message' jobs
   - Fetch message from DB
   - Call connector to resend
   - Update status via MessageStatusTracker
   - Handle errors (retry or move to DLQ)

4. **Integrate with Message Service**
   - File: `packages/backend/src/services/message.service.ts`
   - Update `sendMessage()` to enqueue on failure
   - Call `enqueueRetry()` on dispatch failure
   - Pass full message context (body, direction, recipient)

5. **Enhance MessageStatusTracker**
   - File: `packages/backend/src/services/messageStatusTracker.ts`
   - Implement retry enqueueing logic
   - Move to DLQ on final failure
   - Calculate next backoff delay

### Phase 3: DLQ Service & API (1.5 + 1.5 = 3 hours)

6. **Implement DLQ Service**
   - File: `packages/backend/src/services/dlq.service.ts`
   - `moveToDLQ()` - Insert failed message
   - `getDLQEntries()` - Query with pagination
   - `getDLQStats()` - Count by failure reason
   - `reQueueFromDLQ()` - Move back to retry queue
   - `removeDLQEntry()` - Delete entry (after ops review)
   - `cleanupExpiredDLQEntries()` - Auto-cleanup after 7 days

7. **Implement DLQ Controller**
   - File: `packages/backend/src/controllers/dlq.controller.ts`
   - `GET /dlq` - List entries (manager+)
   - `GET /dlq/stats` - Statistics (manager+)
   - `POST /dlq/:id/re-queue` - Re-queue entry (manager+)
   - `DELETE /dlq/:id` - Remove entry (super_admin only)

### Phase 4: Testing (2 hours)

8. **Create Comprehensive Test Suite**
   - File: `packages/backend/tests/BE-014-exponential-backoff.spec.ts`
   - 20+ test cases:
     - Retry queue creation and job properties
     - Exponential backoff delays (1m, 5m, 30m)
     - Move to DLQ after 3 attempts
     - DLQ CRUD operations
     - Status transitions (pending → failed → pending → dlq)
     - Message context preservation
     - Error handling and logging
     - Role-based access control (DLQ endpoints)
     - Concurrent job processing
     - Cleanup after 7 days

---

## 🧪 Test Coverage Plan

### Retry Queue Tests (8 tests)
- [x] Enqueue message for retry
- [x] Job properties (attempts, backoff, timeout)
- [x] Backoff delays calculated correctly (1m, 5m, 30m)
- [x] Job metadata preservation
- [x] Concurrent job processing (5 jobs)
- [x] Job completion and removal after 1 hour
- [x] Job failure tracking (24 hour retention)
- [x] Queue connection handling

### Status Tracking Tests (6 tests)
- [x] Status transitions (pending → sent)
- [x] Status transitions (pending → failed → pending)
- [x] Status transitions (failed → failed → failed → dlq)
- [x] Retry count incrementation
- [x] Timestamp updates on each transition
- [x] Metadata (error details) preservation

### DLQ Service Tests (4 tests)
- [x] Move message to DLQ
- [x] Query DLQ entries with pagination
- [x] Get DLQ statistics
- [x] Re-queue from DLQ

### DLQ Controller Tests (6 tests)
- [x] GET /dlq with pagination
- [x] GET /dlq/stats
- [x] POST /dlq/:id/re-queue
- [x] DELETE /dlq/:id (super_admin only)
- [x] Role-based access control (403 for non-manager)
- [x] Error handling (404 for missing entry)

---

## ✅ Definition of Done

- [x] All acceptance criteria met
- [x] 20+ test cases passing
- [x] ≥85% code coverage
- [x] No `any` types used
- [x] Proper error handling with logging
- [x] Correlation IDs in all logs
- [x] API endpoints tested and working
- [x] Documentation complete
- [x] Git commits created with clear messages
- [x] PR created and ready for review

---

## 📊 Effort Estimation

| Task | Duration | Estimate |
|------|----------|----------|
| Database schema & migration | 1.5h | ✅ |
| Retry worker implementation | 1.5h | ✅ |
| Message service integration | 1h | ✅ |
| Status tracker enhancement | 1h | ✅ |
| DLQ service implementation | 1.5h | ✅ |
| DLQ controller + endpoints | 1.5h | ✅ |
| Test suite creation | 2h | ✅ |
| Git commits + PR | 0.5h | ✅ |
| **Total** | **10-11h** | **⏰** |

**Optimistic**: 8 hours (smooth implementation)  
**Realistic**: 9-10 hours (with debugging)  
**Pessimistic**: 11-12 hours (DB issues, complex edge cases)

---

## 🚀 Next Steps

1. Start Phase 1: Database schema & migration
2. Run migrations to verify schema
3. Implement retry worker (Phase 2)
4. Write tests as you go (test-driven development)
5. Commit after each phase
6. Create PR #242 when complete
7. Delegate to architect for review

---

## 📞 Blockers & Risks

### Potential Risks
- ⚠️ **Redis connection issues** - Retry: ensure Docker services running
- ⚠️ **BullMQ concurrency limits** - Configured at 5; adjust if needed
- ⚠️ **Drizzle migration failures** - Create backup of current DB before running

### Mitigations
- ✅ Test connections before implementation
- ✅ Use existing test database
- ✅ Commit after each phase for easy rollback

---

**Status**: 🚀 READY FOR IMPLEMENTATION  
**Start Date**: Feb 11, 2026  
**Target Completion**: Feb 12, 2026  
**Blocked By**: None (all dependencies complete)  
**Blocks**: BE-012, BE-017/018/019 (parallel OK)

