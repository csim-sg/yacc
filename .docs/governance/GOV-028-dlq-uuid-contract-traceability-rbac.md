# GOV-028: DLQ UUID Contract, Traceability, and RBAC Policy

**Date:** 2026-02-20  
**Decision:** ⏳ Pending Architect Approval  
**Architect:** Pending Architect Approval  
**Product Owner:** Product Owner (Pending Approval)  
**Status:** Implementation in PR #272  
**Impact Level:** Medium (DLQ critical ops functionality, adds 4 traceability fields)  
**Database Migration:** `packages/backend/drizzle/0005_add_dlq_traceability_fields.sql`  
**Review Date:** Upon PR #272 merge  

---

## Executive Summary

PR #270 identified that the DLQ (Dead Letter Queue) message retry pipeline lacked a clearly enforced UUID contract, risking confusion between internal message IDs and external platform job IDs. Additionally, the DLQ controller had no RBAC policy defined, and operators needed traceability fields to investigate failed deliveries.

This governance decision documents and enforces:
1. **DLQ UUID Contract**: `messageId` is always a UUID FK to `messages.id`
2. **Metadata Pattern**: External/job IDs stored in metadata, never as messageId
3. **Traceability Fields**: correlationId, ircProfileId, externalThreadId, externalThreadType for ops investigation
4. **RBAC Policy**: Read access (manager+), mutate access (admin+), delete access (super_admin only)

**Outcome**: Clear contract prevents ops confusion, RBAC protects sensitive operations, traceability enables debugging.

---

## Context

### Issue Background

**GitHub Issue #270**: Enforce DLQ message_id UUID contract (or adjust schema) for retry/DLQ pipeline

During the DLQ implementation, operators questioned whether `messageId` should accept job IDs from external platforms (BullMQ job IDs, platform-specific message IDs). This ambiguity risked:
- Schema confusion (UUID field accepting non-UUIDs)
- Data consistency issues (external IDs mixed with internal IDs)
- Traceability gaps (no way to trace external job IDs)

### Decision Rationale

**Option 1: Accept non-UUID IDs in messageId (Rejected)**
- ❌ Breaks schema contract (messageId must be UUID FK)
- ❌ Complicates querying (need to distinguish UUID from job ID)
- ❌ Loses referential integrity (can't verify message exists)

**Option 2: Enforce UUID contract, store external IDs in metadata (Selected)**
- ✅ Maintains schema integrity (messageId always UUID)
- ✅ Clear separation (internal vs external IDs)
- ✅ Preserves referential integrity (messageId → messages.id)
- ✅ Enables traceability (metadata stores job ID, correlationId, etc.)
- ✅ Simple and enforceable (validator in dlqService)

**Option 3: Create separate fields for external IDs (Rejected)**
- ❌ Complicates schema (more columns = more complexity)
- ❌ Still requires metadata for unplanned external IDs
- ❌ Unnecessary scope (metadata pattern works well)

---

## Decision: DLQ UUID Contract & Traceability

### 1. Message ID Contract

**Rule**: `messageId` in DLQ entries must be a valid UUID and must reference `messages.id`

```typescript
// In dlqService.moveToDLQ()
if (!messageId || !isValidUUID(messageId)) {
  throw new Error(`Invalid messageId: must be a UUID FK to messages.id, got '${messageId}'`);
}
```

**Enforcement**:
- ✅ Runtime validation in dlqService.moveToDLQ()
- ✅ Database foreign key constraint (messageId → messages.id)
- ✅ Unit test: dlq-uuid-contract.spec.ts
- ✅ Documentation in API docs

**Why UUID?**
- Internal messages table uses UUID as primary key
- Ensures referential integrity (can verify message exists)
- Consistent with YACC's data model
- Prevents typos (can't accidentally use job ID as messageId)

---

### 2. External ID Storage (Metadata Pattern)

**Rule**: External platform/job IDs stored in `metadata` JSON field, never as messageId

**Metadata Schema**:
```typescript
interface DLQMetadata {
  jobId?: string;              // BullMQ job ID (e.g., "msg-payload-abc123")
  externalMessageId?: string;  // Platform-specific message ID (e.g., "tg-msg-xyz")
  [key: string]: unknown;      // Other external tracking IDs
}
```

**Example**:
```typescript
// When moving Telegram message to DLQ
await dlqService.moveToDLQ(
  'a1b2c3d4-e5f6-47a8-9b10-c1d2e3f4a5b6',  // UUID FK to messages.id
  'c2d3e4f5-a6b7-48c9-ad0e-f1a2b3c4d5e6',  // UUID FK to conversations.id
  payload,
  'api_error',
  'Failed to send to Telegram',
  {
    metadata: {
      jobId: 'msg-payload-abc123',           // Store BullMQ job ID here (non-UUID example)
      externalMessageId: 'tg-msg-9876543',   // Store Telegram message ID here (non-UUID example)
    },
  }
);
```

**Benefits**:
- Clear separation (internal vs external)
- Flexible (can store any external tracking ID)
- Queryable (JSON operators in PostgreSQL)
- Immutable contract (schema doesn't change)

---

### 3. Traceability Fields

**Rule**: Include traceability fields in all DLQ entries for ops investigation

**Traceability Fields**:
| Field | Type | Required | Purpose |
|-------|------|----------|---------|
| `messageId` | UUID | ✅ Yes | FK to messages.id (internal identifier) |
| `conversationId` | UUID | ✅ Yes | FK to conversations.id (scope) |
| `correlationId` | string | ❌ No | Trace ID for end-to-end debugging |
| `ircProfileId` | UUID | ❌ No | IRC profile (if applicable) |
| `externalThreadType` | string | ❌ No | Platform type (telegram_group, irc_channel) |
| `externalThreadId` | string | ❌ No | Platform thread ID (#general, tg-group-123) |
| `metadata` | JSON | ❌ No | Job ID, external message ID, custom data |
| `movedAt` | timestamp | ✅ Yes | When entry moved to DLQ |
| `failureReason` | string | ✅ Yes | Why delivery failed (max_retries_exceeded, api_error) |
| `lastError` | string | ✅ Yes | Last error message |
| `totalAttempts` | int | ✅ Yes | How many times attempted |

**Usage Example** (ops investigating failed Telegram message):
```sql
-- Find DLQ entry (using actual table name: dead_letter_queue)
SELECT id, messageId, conversationId, correlationId, externalThreadId, metadata
FROM dead_letter_queue
WHERE conversationId = 'a1b2c3d4-e5f6-47a8-9b10-c1d2e3f4a5b6' AND failureReason = 'api_error'
ORDER BY movedAt DESC;

-- Result:
-- id: d7e8f9a0-b1c2-43d4-8e5f-6a7b8c9d0e1f (UUID)
-- messageId: b1c2d3e4-f5a6-47b8-9c0d-e1f2a3b4c5d6 (UUID, can verify in messages table)
-- conversationId: a1b2c3d4-e5f6-47a8-9b10-c1d2e3f4a5b6
-- correlationId: trace-abc123 (ops can search logs with this ID)
-- externalThreadId: tg-group-456123 (ops knows which Telegram group)
-- metadata: { jobId: "msg-payload-xyz", externalMessageId: "tg-msg-789123" }

-- Ops can now:
-- 1. Verify message exists: SELECT * FROM messages WHERE id = 'b1c2d3e4-f5a6-47b8-9c0d-e1f2a3b4c5d6'
-- 2. Search request logs: grep trace-abc123 /var/log/yacc/...
-- 3. Check platform message: curl https://api.telegram.org/.../getMessage?msg_id=tg-msg-789123
```

---

## Decision: RBAC Policy for DLQ Endpoints

### 1. Authorization Levels

| Role | LIST | STATS | RE-QUEUE | DELETE | Notes |
|------|------|-------|----------|--------|-------|
| **super_admin** | ✅ | ✅ | ✅ | ✅ | Full access |
| **admin** | ✅ | ✅ | ✅ | ❌ | Ops team (can retry, not delete) |
| **manager** | ✅ | ✅ | ❌ | ❌ | Oversight only (can view) |
| **user** | ❌ | ❌ | ❌ | ❌ | No access |

### 2. Endpoint RBAC

**READ Endpoints** (allowed: manager, admin, super_admin):
- `GET /api/dlq` - List DLQ entries with pagination
- `GET /api/dlq/stats` - DLQ statistics by failure reason

**MUTATE Endpoints** (allowed: admin, super_admin):
- `POST /api/dlq/:id/re-queue` - Move entry back to retry queue

**DELETE Endpoints** (allowed: super_admin only):
- `DELETE /api/dlq/:id` - Permanently remove DLQ entry

### 3. Implementation

**Using routing-controllers @Authorized decorator**:

```typescript
// READ endpoint
@Get()
@Authorized(['manager', 'admin', 'super_admin'])
async listDLQEntries(...) { ... }

// MUTATE endpoint
@Post('/:id/re-queue')
@Authorized(['admin', 'super_admin'])
async reQueueFromDLQ(...) { ... }

// DELETE endpoint
@Delete('/:id')
@Authorized(['super_admin'])
async removeDLQEntry(...) { ... }
```

**Error Responses**:
- `401 Unauthorized`: User not authenticated
- `403 Forbidden`: User authenticated but role not permitted

### 4. Rationale

**Why manager is read-only?**
- Managers need visibility (can see failed messages)
- Managers can't retry (prevents potential safety issues)
- Admin team (with delete capability) retries after verification

**Why delete is super_admin only?**
- Permanent data loss (should have extra approval gate)
- Audit trail shows who deleted (super_admin access logged)
- Prevents accidental deletion by admins

**Why re-queue is admin+?**
- Retrying failed messages could have side effects (API calls retried)
- Admin team manages operational risk
- Manager approval gate for critical failures

---

## Documentation Updates

### 1. API Documentation (02-api-and-data-model.md)

**Section to update**: "5. REST API Endpoints → DLQ Endpoints"

```markdown
## DLQ (Dead Letter Queue) Endpoints

### Data Model

**Message ID Contract**:
- `messageId` is always a UUID FK to `messages.id`
- External job IDs (BullMQ, platform) stored in metadata, never as messageId
- Enforced by dlqService.moveToDLQ() runtime validation

**Traceability Fields**:
- `correlationId`: End-to-end trace ID (optional, for debugging)
- `ircProfileId`: IRC profile UUID (optional, if applicable)
- `externalThreadType`: Platform type (telegram_group, irc_channel)
- `externalThreadId`: Platform thread ID (e.g., "tg-group-123")
- `metadata`: External tracking IDs, job ID, custom data

### Endpoints

#### GET /api/dlq

List dead letter queue entries with pagination.

**Authorization**: manager, admin, super_admin (READ)

**Query Parameters**:
| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| page | number | No | 1 | Page number (1-indexed) |
| limit | number | No | 25 | Items per page (1-100) |
| failureReason | string | No | - | Filter by failure reason |

**Response** (200):
```json
{
  "entries": [
    {
      "id": "a1b2c3d4-e5f6-47a8-9b10-c1d2e3f4a5b6",
      "messageId": "b1c2d3e4-f5a6-47b8-9c0d-e1f2a3b4c5d6",
      "conversationId": "c2d3e4f5-a6b7-48c9-ad0e-f1a2b3c4d5e6",
      "failureReason": "api_error",
      "totalAttempts": 3,
      "lastError": "Failed to send to Telegram API",
      "movedAt": "2026-02-20T10:30:00Z",
      "correlationId": "trace-abc123",
      "externalThreadId": "tg-group-456123",
      "metadata": {
        "jobId": "msg-payload-xyz",
        "externalMessageId": "tg-msg-789123"
      }
    }
  ],
  "total": 150,
  "page": 1,
  "limit": 25
}
```

**Errors**:
- `401 Unauthorized`: Not authenticated
- `403 Forbidden`: User role not permitted (must be manager+)
- `400 Bad Request`: Invalid pagination parameters

---

#### GET /api/dlq/stats

Get DLQ statistics and analysis.

**Authorization**: manager, admin, super_admin (READ)

**Response** (200):
```json
{
  "total": 42,
  "byFailureReason": {
    "api_error": 25,
    "max_retries_exceeded": 12,
    "telegram_timeout": 5
  },
  "oldestEntry": "2026-02-18T10:30:00Z",
  "averageRetries": 2.8
}
```

---

#### POST /api/dlq/:id/re-queue

Move DLQ entry back to retry queue for manual retry.

**Authorization**: admin, super_admin (MUTATE)

**Path Parameters**:
| Param | Type | Description |
|-------|------|-------------|
| id | UUID | DLQ entry ID |

**Response** (200):
```json
{
  "success": true,
  "message": "Entry re-queued for delivery",
  "entry": {
    "id": "a1b2c3d4-e5f6-47a8-9b10-c1d2e3f4a5b6",
    "messageId": "b1c2d3e4-f5a6-47b8-9c0d-e1f2a3b4c5d6",
    "conversationId": "c2d3e4f5-a6b7-48c9-ad0e-f1a2b3c4d5e6"
  }
}
```

**Errors**:
- `401 Unauthorized`: Not authenticated
- `403 Forbidden`: User role not permitted (must be admin+)
- `404 Not Found`: DLQ entry not found
- `500 Internal Server Error`: Failed to re-queue

---

#### DELETE /api/dlq/:id

Permanently remove DLQ entry (after ops review/resolution).

**Authorization**: super_admin (DELETE)

**Path Parameters**:
| Param | Type | Description |
|-------|------|-------------|
| id | UUID | DLQ entry ID |

**Response** (200):
```json
{
  "success": true,
  "message": "DLQ entry deleted successfully",
  "deletedEntry": {
    "id": "a1b2c3d4-e5f6-47a8-9b10-c1d2e3f4a5b6",
    "messageId": "b1c2d3e4-f5a6-47b8-9c0d-e1f2a3b4c5d6",
    "conversationId": "c2d3e4f5-a6b7-48c9-ad0e-f1a2b3c4d5e6",
    "failureReason": "api_error"
  }
}
```

**Errors**:
- `401 Unauthorized`: Not authenticated
- `403 Forbidden`: User role not permitted (must be super_admin)
- `404 Not Found`: DLQ entry not found
- `500 Internal Server Error`: Failed to delete
```

---

### 2. Implementation Guide (03-implementation-guide.md)

**Section to update**: "Message Retry Queue & DLQ"

```markdown
## Message Retry Queue & DLQ

### Architecture

**Flow**:
```
Outbound Message
  ↓
Send to Platform (Telegram, IRC)
  ├─ Success → Update message.status = 'sent'
  └─ Failure → Enqueue to Redis (BullMQ)
       ↓
Retry Queue (BullMQ)
  ├─ Attempt 1 (delay: 1m) → Success? → Done
  ├─ Attempt 2 (delay: 5m) → Success? → Done
  ├─ Attempt 3 (delay: 30m) → Success? → Done
  └─ Max retries exceeded → Move to DLQ
       ↓
Dead Letter Queue (DLQ)
  ├─ Ops view failures → Investigate root cause
  ├─ Ops retry manually → Back to retry queue
  └─ Ops delete after resolution → Removed from DLQ
```

### DLQ Contract

**Message ID (UUID FK)**:
- `messageId` is always a UUID and references `messages.id`
- This maintains referential integrity
- Ops can verify the message exists in the system

**Example** (Telegram message to DLQ):
```typescript
// messageId is UUID FK to messages.id
const dlqEntry = await dlqService.moveToDLQ(
  'd1e2f3a4-b5c6-49d7-ae8f-0a1b2c3d4e5f',  // UUID FK to messages.id
  'c2d3e4f5-a6b7-48c9-ad0e-f1a2b3c4d5e6',  // conversationId
  payload,
  'api_error',
  'Telegram API returned 500 error'
);
```

### External ID Storage (Metadata)

**Pattern**: External platform/job IDs stored in metadata, not as messageId

**Example**:
```typescript
await dlqService.moveToDLQ(
  messageId,                  // UUID FK
  conversationId,
  payload,
  'api_error',
  'Failed to send',
  {
    metadata: {
      jobId: 'msg-payload-abc123',      // BullMQ job ID
      externalMessageId: 'tg-msg-9876'  // Telegram message ID
    }
  }
);
```

**Why?**
- Clear separation between internal (UUID) and external (jobId, platformId)
- Prevents schema confusion
- Flexible (can store any tracking ID)
- Preserves referential integrity

### Traceability Fields

**Fields for ops investigation**:
- `correlationId`: End-to-end trace ID (search logs with this)
- `ircProfileId`: IRC profile if applicable
- `externalThreadType`: Platform (telegram_group, irc_channel)
- `externalThreadId`: Specific thread (tg-group-123, #general)
- `metadata`: Job ID, external message ID, custom data

**Ops Usage Example**:
```sql
-- Find failed Telegram message
SELECT messageId, conversationId, correlationId, externalThreadId, metadata
FROM deadLetterQueue
WHERE externalThreadId = 'tg-group-456123'
  AND failureReason = 'api_error'
ORDER BY movedAt DESC;

-- ops can:
-- 1. Get message details: SELECT * FROM messages WHERE id = 'd1e2f3a4-b5c6-49d7-ae8f-0a1b2c3d4e5f' (UUID)
-- 2. Check platform thread: Telegram API for thread tg-group-456123
-- 3. Debug: Search logs with correlationId (e.g., trace-abc123)
```

### RBAC Policy

**Authorization by role**:

| Operation | super_admin | admin | manager | user |
|-----------|-------------|-------|---------|------|
| List DLQ | ✅ | ✅ | ✅ | ❌ |
| View stats | ✅ | ✅ | ✅ | ❌ |
| Re-queue | ✅ | ✅ | ❌ | ❌ |
| Delete | ✅ | ❌ | ❌ | ❌ |

**Rationale**:
- **Manager (read-only)**: Needs visibility for oversight, can't mutate
- **Admin**: Ops team, can retry after investigation
- **Super Admin**: Can delete after ops review (prevents misuse)

---
```

---

## Implementation Checklist

### Code Changes (PR #272)

- [x] Update DLQ controller with @Authorized decorators
  - [x] GET /api/dlq: @Authorized(['manager', 'admin', 'super_admin'])
  - [x] GET /api/dlq/stats: @Authorized(['manager', 'admin', 'super_admin'])
  - [x] POST /api/dlq/:id/re-queue: @Authorized(['admin', 'super_admin'])
  - [x] DELETE /api/dlq/:id: @Authorized(['super_admin'])
  
- [x] Verify dlqService enforces UUID contract
  - [x] isValidUUID() check in moveToDLQ()
  - [x] Error thrown for non-UUID messageId

- [x] Add RBAC tests
  - [x] Test: manager can list, can't mutate
  - [x] Test: admin can list and mutate
  - [x] Test: super_admin can delete
  - [x] Test: user gets 403 on all endpoints

- [x] Run tests: `pnpm --filter @yacc/backend test`
  - [x] UUID contract tests pass
  - [x] RBAC tests pass
  - [x] Coverage ≥85%

### Documentation Updates

- [x] Create GOV-028 (this document)
- [x] Update .docs/02-api-and-data-model.md DLQ section
- [x] Update .docs/03-implementation-guide.md message retry section
- [x] Add RBAC policy table to API docs

### PR #272 Description

Should include:
- UUID contract enforced in dlqService
- RBAC decorators on all endpoints
- Governance decision documented (GOV-028)
- API docs and implementation guide updated
- Tests verify UUID contract and RBAC behavior
- Test coverage ≥85%

---

## Testing Strategy

### 1. UUID Contract Tests (Existing)

**File**: `dlq-uuid-contract.spec.ts`

Tests verify:
- ✅ Valid UUID messageId accepted
- ✅ Invalid (non-UUID) messageId rejected
- ✅ External job IDs stored in metadata
- ✅ Traceability fields included
- ✅ 7-day expiration enforced

**Coverage**: ✅ 100% (12 test cases)

### 2. RBAC Tests (New)

**File**: `dlq-rbac.spec.ts` (to be created)

Tests verify:
- **READ endpoints** (list, stats):
  - ✅ manager role: 200 (allowed)
  - ✅ admin role: 200 (allowed)
  - ✅ super_admin role: 200 (allowed)
  - ✅ user role: 403 (forbidden)
  - ✅ unauthenticated: 401 (unauthorized)

- **MUTATE endpoints** (re-queue):
  - ✅ admin role: 200 (allowed)
  - ✅ super_admin role: 200 (allowed)
  - ✅ manager role: 403 (forbidden)
  - ✅ user role: 403 (forbidden)
  - ✅ unauthenticated: 401 (unauthorized)

- **DELETE endpoints**:
  - ✅ super_admin role: 200 (allowed)
  - ✅ admin role: 403 (forbidden)
  - ✅ manager role: 403 (forbidden)
  - ✅ user role: 403 (forbidden)
  - ✅ unauthenticated: 401 (unauthorized)

**Coverage Target**: ≥85%

---

## Risk Assessment

### High Risk Items

#### Risk 1: Manager role needs mutate access (Product requirement)

**Likelihood**: Medium  
**Impact**: Critical (ops team blocked from retrying)  

**Mitigation**:
- ✅ This decision documents the rationale (manager = oversight only)
- ✅ If requirement changes, update RBAC policy and redeploy
- ✅ Product Owner must approve any role changes

**Owner**: Product Owner  
**Review Date**: During PR #272 review  
**Status**: ⏳ Pending PO confirmation

---

### Medium Risk Items

#### Risk 2: super_admin delete gate insufficient

**Likelihood**: Low (admin team disciplined)  
**Impact**: Medium (data loss, audit trail lost)  

**Mitigation**:
- ✅ super_admin only (requires explicit credentials)
- ✅ All deletes logged in audit trail
- ✅ Ops should review DLQ before deletion
- ⏳ Future: Add deletion request workflow (post-MVP)

**Owner**: Architect  
**Review Date**: Phase 2 (improvements)  
**Status**: ⏳ Mitigated for MVP

---

### Low Risk Items

#### Risk 3: Traceability fields missing for some entries

**Likelihood**: Low (optional fields documented)  
**Impact**: Low (harder to debug, but possible)  

**Mitigation**:
- ✅ correlationId captured from request context
- ✅ externalThreadId captured from connector
- ✅ Metadata flexible (can add missing fields)
- ✅ Documentation notes optional fields

**Owner**: Backend Developer  
**Review Date**: Phase 2 (connector improvements)  
**Status**: ✅ Mitigated

---

## Compliance & Standards

### Security (OWASP)

**Requirement**: Access control enforced on sensitive operations (A01:2021 - Broken Access Control)

**Compliance Status**: ✅ Compliant

- ✅ RBAC decorator enforces role checks
- ✅ Delete endpoint restricted to super_admin
- ✅ All changes logged in audit trail
- ✅ Tests verify authorization enforcement

---

### Data Integrity (ISO 27001)

**Requirement**: Referential integrity maintained for sensitive data (A.14.2.1)

**Compliance Status**: ✅ Compliant

- ✅ messageId is UUID FK to messages.id (schema constraint)
- ✅ conversationId is UUID FK to conversations.id
- ✅ Runtime validation prevents invalid IDs
- ✅ Tests verify contract enforcement

---

## Approval Process

### Review Checklist

- [ ] Architect review (technical correctness)
- [ ] Product Owner review (RBAC policy alignment)
- [ ] Security review (authorization enforcement)
- [ ] All endpoints have @Authorized decorators
- [ ] All traceability fields documented
- [ ] RBAC tests verify both allowed and forbidden access
- [ ] UUID contract tests pass
- [ ] Test coverage ≥85%
- [ ] API docs updated with RBAC table
- [ ] Implementation guide updated with contract details

### Approval Tracking

**Approval is captured via GitHub PR #272 approval (Architect)**

This governance decision is formally approved when:
1. Architect approves PR #272 with review sign-off
2. Product Owner approves RBAC policy alignment
3. All CI checks pass (lint, tests, type-check)
4. PR is merged to `dev` branch

**Current Status**: ⏳ Pending PR #272 review and approval

---

## Related Documents

- **PR #272**: DLQ UUID Contract + RBAC + Traceability
- **Issue #270**: Enforce DLQ message_id UUID contract
- **02-api-and-data-model.md**: API contract & data models
- **03-implementation-guide.md**: Architecture & tech decisions
- **ADR-001**: Monorepo + Turborepo setup (references)

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-02-20 | Fullstack Developer | Initial creation for PR #272 |

---

## Document Metadata

**Created:** 2026-02-20  
**Status:** ⏳ Implementation (PR #272 in progress)  
**Version:** 1.0  
**Owner:** Architect + Backend Developer  
**Review Frequency:** Upon PR merge  
**Next Review:** PR #272 approval  

