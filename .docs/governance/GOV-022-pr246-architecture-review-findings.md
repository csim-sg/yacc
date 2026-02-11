# GOV-022: PR #246 Architecture Review Findings & Remediation

Date: 2026-02-11
Change / PR / ADR ID: PR #246 (BE-P2-001: Backend Tags CRUD)
Decision: **BLOCK** — Changes requested before merge
Reason: Critical security, architecture, and compliance violations identified
Architect / EA Validator: Enterprise Architecture Validator (Solution Architect)
Impacted Systems: Backend API, authorization, WebSocket, audit logging
Risk Level: **CRITICAL** (security boundary violation)
Follow-up Required: **YES** — Developer must fix all blocking issues + re-request review

---

## 1. Critical Blocking Issues

### 1.1 Missing Resource-Level Authorization (SECURITY)

**Finding**: Tag add/remove operations only check role (admin/manager/user) but NOT conversation access.

**Risk**: A user can add/remove tags on conversations they don't have access to (authorization boundary violation).

**Example violation**:
```
User A (access to Conversation 1 only) can:
  POST /api/conversations/2/tags  ← Conversation 2 not assigned to User A
  → System checks role ("user" → allowed) but NOT conversation access
  → SUCCESS: tag added to Conversation 2 (unauthorized!)
```

**Root cause**: TagController + TagService lack conversation authorization checks.

**Fix**:
1. Add conversation access check in TagController before calling TagService
2. Alternatively, move check to TagService as a guard clause
3. Use existing conversation authorization middleware/pattern (if available from Phase 1.4)
4. Verify user has read access to conversation OR is admin/manager

**ADR Reference**: Follows "Standard Identity & Access" principle (AGENTS.md); authorization MUST be enforced at service layer, not just frontend.

---

### 1.2 WebSocket Event Bypasses Backlog Helper (ARCHITECTURE)

**Finding**: TagService calls raw gateway directly instead of using typed helper with replay backlog semantics.

**Current code**:
```typescript
// packages/backend/src/services/tag.service.ts
getWebSocketGateway().emitToConversation(...)
```

**Risk**: Breaks "1-hour replay/backlog" semantics from Phase 1.4 WebSocket infrastructure (ADR-012).

**Correct pattern** (from socket-controllers):
```typescript
// Should use: packages/backend/src/services/websocket/websocket-gateway.ts:emitToConversation()
// This ensures events are stored in backlog for client reconnect
```

**Fix**: Replace direct gateway calls with typed helper that enforces backlog storage.

**ADR Reference**: ADR-012 (socket-controllers WebSocket event handling); ADR-005 (infrastructure pattern).

---

### 1.3 Audit Logging Not Enforced (COMPLIANCE)

**Finding**: `auditService.logAction()` calls are best-effort; return values ignored.

**Current code**:
```typescript
// No error handling on audit call
auditService.logAction(...);  // If this fails, system continues silently
```

**Risk**: System can emit WebSocket events + return success WITHOUT audit record (non-repudiation broken).

**Fix**:
1. Make audit logging transactional (throw error if audit fails)
2. Wrap in try-catch or use async/await with error propagation
3. Ensure audit log is persisted BEFORE WebSocket event is emitted

**ADR Reference**: ADR-004 (audit logging strategy); ADR-008 (governance/audit trail).

---

### 1.4 Tests Failing (RED)

**Finding**: `pnpm --filter @yacc/backend test` returns RED due to WebSocket + gateway test failures.

**Status**: PR is not merge-ready until tests green.

**Fix**: Debug and resolve test failures (likely WebSocket gateway mock/stub issues).

---

## 2. Non-Blocking Issues (Fix Before Merge)

### 2.1 Code Organization: One-Definition-Per-File Violation

**Finding**: TagService mixes interfaces + class in single file.

**Current**:
- `packages/backend/src/services/tag.service.ts` contains both interfaces and implementation

**Expected** (per AGENTS.md):
- Interfaces → `packages/backend/src/types/tag.types.ts`
- Class → `packages/backend/src/services/tag.service.ts`

**Fix**: Extract TagTypes to dedicated file.

---

### 2.2 TypeScript: `any` Type Usage

**Finding**: Integration test contains `(t: any)` type cast.

**Location**: `packages/backend/tests/BE-P2-001-tags-crud.spec.ts`

**Fix**: Replace with proper TypeScript type from test framework (e.g., `Vitest` test function signature).

---

### 2.3 Idempotency Race Condition

**Finding**: Tag add uses "select-then-insert" pattern, which is race-prone under concurrency.

**Current pattern** (unsafe):
```typescript
const existing = await db.select(...).where(...);
if (!existing) {
  await db.insert(...);  // Race condition: another thread inserts between check and insert
}
```

**Safe pattern** (Drizzle):
```typescript
await db.insert(...).onConflictDoNothing();  // Atomic conflict handling
```

**Fix**: Use Drizzle `onConflictDoNothing()` or equivalent for atomic idempotency.

---

### 2.4 Test Coverage Gaps

**Finding**: Integration tests missing critical coverage.

**Gaps**:
1. WebSocket `conversation.updated` event emission verification (not tested)
2. Audit log row persistence verification (not tested)
3. `super_admin` role RBAC coverage (not tested)

**Fix**: Add test cases for:
- Listening to WebSocket events and verifying payload
- Querying audit_logs table and verifying rows
- Testing all 4 roles (including super_admin)

---

## 3. Compliance Matrix (GOV-021 vs Implementation)

| Requirement | Status | Notes |
|---|---|---|
| RBAC: all 4 roles allowed | ⚠️ Partial | Role check OK, but resource auth missing |
| WebSocket `conversation.updated` | ❌ Violated | Bypasses backlog helper |
| Audit logging: tag.created, conversation.tag_added, conversation.tag_removed | ❌ Violated | Not enforced (best-effort) |
| Idempotent add | ⚠️ Unsafe | Implemented but race-prone |
| Graceful remove | ✅ OK | Handles missing tag correctly |
| Response shape | ✅ OK | Returns full conversation tags array |

---

## 4. Remediation Checklist

Before re-requesting review, developer MUST:

- [ ] **BLOCKING**
  - [ ] Add conversation authorization check (user must have access)
  - [ ] Use proper WebSocket backlog helper instead of raw gateway
  - [ ] Make audit logging transactional (throw error on failure)
  - [ ] Get `pnpm --filter @yacc/backend test` green

- [ ] **NON-BLOCKING**
  - [ ] Extract TagTypes to dedicated types/tag.types.ts file
  - [ ] Remove `any` type cast from integration test
  - [ ] Replace "select-then-insert" with atomic `onConflictDoNothing()`
  - [ ] Add test cases for WebSocket emission, audit log persistence, all 4 roles

---

## 5. Re-Review Process

Once remediation complete:
1. Developer pushes fixes to feature/BE-P2-001-tags
2. Developer requests re-review in PR comments
3. Architect verifies all issues addressed + tests green
4. Architect APPROVES or requests additional changes
5. Upon APPROVE, merge to dev

---

## 6. Pattern for Remaining Phase 2 Tickets

This review establishes the bar for all 7 remaining Phase 2 tickets (BE-P2-002 through FE-P2-002):

- **Resource-level authorization REQUIRED** on all conversation-scoped operations
- **WebSocket events MUST use backlog helper**, not raw gateway
- **Audit logging MUST be transactional** (enforce on all actions)
- **Tests MUST verify** side effects (events, audit logs, not just response codes)
- **All 4 roles MUST be tested** in RBAC scenarios

---

## 7. Approval & Sign-Off

Date: February 11, 2026
Reviewed by: Enterprise Architecture Validator
Status: **BLOCK** — Changes requested
Next review: After developer completes remediation checklist

**Condition for approval**: All blocking issues (1.1-1.4) fixed + tests green + non-blocking issues addressed.

---

**Version**: 1.0
**Status**: Active (PR in progress)
**Governance**: ADR-005, ADR-008, ADR-012, ADR-004; GOV-021 (Phase 2 gate)
