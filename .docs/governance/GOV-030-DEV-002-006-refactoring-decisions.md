# GOV-030: DEV-002-006 Backend Refactoring Architectural Decisions

**Date**: 2026-02-22  
**Decision Maker**: Enterprise Architect  
**Stakeholders**: Product Owner, FullStack Developer (Backend Lead)  
**Status**: APPROVED  
**Related**: ADR-005 Addendum-2, GitHub Issues #277-280, #292

---

## Summary

This governance log captures architectural decisions made for backend refactoring tasks **DEV-002 through DEV-006**. These decisions resolve blocking ambiguities identified during gap analysis and provide clear implementation guidance for developers.

**Context**: After completing BE-003 (Telegram) and BE-004 (IRC), technical debt analysis revealed:
- Service layer confusion (4 auth services with unclear boundaries)
- Connector/adapter duplication violating ADR-005 (flat folder structure)
- No unified gateway for inbound/outbound message orchestration
- Inconsistent event patterns between platforms

**Product Owner Decision**: Execute DEV-002-006 refactoring FIRST before Phase 2 features to prevent compounding technical debt.

---

## Decisions Recorded

### 1. Event-Driven Pattern: Node.js EventEmitter

**Choice**: Use standard Node.js `EventEmitter` for adapter-to-gateway communication.

**Rationale**:
- KISS principle: Built-in, zero dependencies, widely understood
- Sufficient for MVP: Single-tenant, 2 platforms, low message volume
- Team familiarity: Standard Node.js pattern, minimal learning curve
- Testability: Easy to mock/spy with Vitest
- Migration path: Can upgrade to RxJS in Phase 2 if backpressure handling needed

**Rejected Alternatives**:
- RxJS Observables (adds complexity without MVP benefit)
- Custom observer pattern (maintenance burden without compelling advantage)

**Implementation Impact**:
- `PlatformAdapter` extends `EventEmitter`
- Emits `message:inbound`, `adapter:connected`, `adapter:disconnected`, `adapter:error`
- `GatewayExchange` subscribes via `adapter.on('message:inbound', handler)`

**Risk**: Low. If Phase 2 multi-tenant shows backpressure issues, interfaces support migration to RxJS.

---

### 2. ConnectorManager Scope: Delete `connectors/` Folder Entirely

**Choice**: Remove `src/connectors/` folder, consolidate all platform logic in `infrastructure/`.

**Rationale**:
- **ADR-005 Compliance**: Flat folder structure mandates no nested layers
- **Eliminates Duplication**: Current `connectors/*.connector.ts` duplicates adapter logic
- **Clear Separation**: `infrastructure/` for singleton clients (adapters), `services/` for business logic
- **Single Source of Truth**: All platform-specific code in `infrastructure/*.adapter.ts`

**Rejected Alternatives**:
- Keep as thin wrappers (violates flat structure, adds unnecessary indirection)
- Rename to `adapters/` (just renames the problem, doesn't solve architecture issue)

**Implementation Impact**:
- DEV-004: Delete `src/connectors/irc.connector.ts` and `src/connectors/telegram.connector.ts`
- DEV-004: Move logic to `infrastructure/irc.adapter.ts` and `infrastructure/telegram.adapter.ts`
- DEV-004: Update imports in `message.service.ts`, `outboundMessageRetry.worker.ts`, `gateway-exchange.ts`

**Migration Path**: No backward compatibility layer needed (internal refactoring, no API changes).

**Risk**: Low. All changes are internal, no user-facing impact.

---

### 3. Auth Service Consolidation: Thin Wrapper Pattern

**Choice**: Create `authentication.service.ts` as thin wrapper delegating to existing services.

**Rationale**:
- **KISS Principle**: Minimal refactoring, low risk, MVP-focused
- **Single Entry Point**: Controllers call one service instead of four
- **Preserves Tested Logic**: `login.service.ts`, `passwordReset.service.ts` remain intact
- **Future-Proof**: Easy to add 2FA/passkeys in Phase 2 without re-architecting

**Rejected Alternatives**:
- Session Orchestrator (over-engineers for MVP, no complex auth workflows yet)
- Auth Facade (unnecessary abstraction, no 2FA/passkeys in MVP)

**Implementation Impact**:
- DEV-002: Create `services/authentication.service.ts` with methods:
  - `login(email, password)` → delegates to `login.service.ts`
  - `logout(sessionId)` → delegates to `login.service.ts`
  - `initiatePasswordReset(email)` → delegates to `passwordReset.service.ts`
  - `completePasswordReset(token, newPassword)` → delegates to `passwordReset.service.ts`
  - `getCurrentUser(userId)` → delegates to `users.service.ts`
- DEV-002: Update auth controllers to import `AuthenticationService`
- Files kept unchanged: `login.service.ts`, `passwordReset.service.ts`, `passwordValidation.service.ts`, `users.service.ts`

**Risk**: Low. Thin wrapper adds minimal complexity, preserves existing behavior.

---

### 4. Event Ordering Guarantees: Best-Effort Ordering

**Choice**: Process inbound events directly without per-conversation queuing.

**Rationale**:
- **KISS Principle**: Direct event handling, no queuing complexity
- **MVP Traffic**: Single-tenant, 2 platforms, low volume → race conditions unlikely
- **Database Guarantees**: PostgreSQL ACID transactions ensure write consistency
- **UI Resilience**: Frontend sorts by `receivedAt` timestamp (handles out-of-order display)
- **Idempotency**: Duplicate detection via `externalMessageId` prevents double-processing

**Rejected Alternatives**:
- FIFO per conversation (adds queuing complexity not justified by MVP scale)
- Global FIFO (creates bottleneck, unacceptable for real-time app)

**Implementation Impact**:
- DEV-003: `GatewayExchange.handleInbound()` processes events directly
- DEV-003: Database transaction ensures atomic conversation + message creation
- DEV-003: Idempotency check prevents duplicate insertion
- DEV-005: UI always sorts messages by `receivedAt` timestamp

**Safeguards**:
- Database index on `messages.received_at` for fast sorting
- Idempotency check before inserting message
- Transaction atomicity (conversation + message in single commit)

**Migration Path**: If Phase 2 multi-tenant shows race conditions, add BullMQ per-conversation queues.

**Risk**: Low. MVP traffic unlikely to trigger race conditions. Database + UI handle edge cases.

---

### 5. Error Handling Strategy: DLQ + Simplified Circuit Breaker

**Choice**: Hybrid approach combining dead-letter queue (DLQ) with circuit breaker pattern.

**Rationale**:
- **Prevents Infinite Loops**: Failed events logged to DLQ, not retried immediately
- **Manual Recovery**: Ops reviews DLQ, fixes root cause, replays messages
- **Circuit Breaker Safety**: If 5+ consecutive failures, adapter disconnects (prevents cascade)
- **Audit Trail**: All failures logged with full context (`correlationId`, `rawPayload`)

**Rejected Alternatives**:
- Immediate retry (risks infinite loops without exponential backoff)
- Full circuit breaker (Hystrix-style, over-engineers for MVP)

**Implementation Impact**:
- DEV-003: Create `dead_letter_queue` database table
- DEV-003: On error in `handleInbound()`, log to DLQ
- DEV-003: Increment error counter per platform
- DEV-003: If error counter ≥ 5, disconnect adapter (requires manual ops restart)

**DLQ Schema**:
```sql
CREATE TABLE dead_letter_queue (
  id UUID PRIMARY KEY,
  platform VARCHAR(20),
  event_payload JSONB,
  error_message TEXT,
  error_stack TEXT,
  correlation_id VARCHAR(100),
  created_at TIMESTAMP,
  replayed_at TIMESTAMP,
  replay_status VARCHAR(20)
);
```

**Recovery Process** (Manual in MVP):
1. Ops reviews DLQ via SQL query
2. Ops fixes root cause (e.g., missing user, schema issue)
3. Ops marks entry for replay
4. Cron job or manual script replays event
5. Status updated to success/failed

**Future Enhancement**: Phase 2 admin UI for DLQ review + replay button.

**Risk**: Medium. Circuit breaker false positives could trigger during transient network issues. Mitigation: Set threshold to 5 consecutive failures (not total), log all triggers for ops review.

---

## Impact Assessment

### Timeline
- **Total Effort**: 12 days (DEV-002: 2d, DEV-003: 3d, DEV-004: 2d, DEV-005: 3d, DEV-006: 2d)
- **Start Date**: 2026-02-22 or 2026-02-23 (after ADR approval)
- **End Date**: ~2026-03-10 (before Phase 2 features)

### Risk Level
- **Overall**: Low
- **Rationale**: Internal refactoring, no API changes, preserves existing behavior
- **Dependencies**: BE-003 (Telegram) and BE-004 (IRC) both complete ✅

### User Impact
- **End Users**: None (no UI changes, no API changes)
- **Developers**: Improved code clarity, easier to add new platforms
- **Ops**: New DLQ monitoring required (manual in MVP, automated in Phase 2)

### Technical Debt
- **Reduction**: High (eliminates connector/service confusion, aligns with ADR-005)
- **Prevention**: Blocks future debt by establishing clear patterns before Phase 2

---

## Approval Chain

| Role | Name | Status | Date |
|------|------|--------|------|
| **Architect** | Enterprise Architect | ✅ APPROVED | 2026-02-22 |
| **Product Owner** | (To be obtained) | ⏳ PENDING | - |
| **Backend Lead** | FullStack Developer | ⏳ PENDING | - |

**Next Steps**:
1. Product Owner reviews ADR-005 Addendum-2 + this governance log
2. Product Owner approves or requests changes
3. Architect hands off to FullStack Developer for implementation
4. Developer starts DEV-002 (authentication service consolidation)

---

## Related Issues & Documents

### GitHub Issues
- #277: DEV-002 - Consolidate Auth Services
- #278: DEV-003 - Create Gateway-Exchange
- #279: DEV-004 - Move Platform Adapters to Infrastructure
- #280: DEV-005 - Refactor Inbound Message Pipeline
- #292: DEV-006 - Standardize Adapter Registration

### Documentation
- **ADR-005 Addendum-2**: Full interface definitions and implementation requirements
- **ADR-005**: Config vs Infrastructure Pattern (original decision)
- **`.docs/plans/00-INDEX.md`**: Task tracking and status
- **`.docs/03-implementation-guide.md`**: Tech stack decisions

---

## Monitoring & Success Criteria

### Key Metrics (To Monitor During/After Implementation)
- **Test Coverage**: ≥85% for all new/modified code
- **TypeScript Strict Mode**: Zero `any` types in new code
- **API Contract Stability**: All existing endpoints return same responses
- **Performance**: No degradation in message latency (< 500ms inbound, < 2s outbound)
- **Regression**: All 12 regression tests pass after each task

### Success Indicators
- ✅ All 6 tasks (DEV-002 to DEV-006) complete with ACs met
- ✅ Zero `any` types in new/modified code
- ✅ Flat folder structure compliance (no `connectors/` folder)
- ✅ All adapters implement `PlatformAdapter` interface
- ✅ All existing features still work (regression suite passes)

### Failure Indicators (Escalate to Architect)
- ❌ Test coverage drops below 85%
- ❌ Any regression test fails
- ❌ TypeScript compiler errors with `any` types
- ❌ API breaking changes detected
- ❌ Performance degradation > 20%

---

## Post-Implementation Review (To Be Completed After DEV-006)

**Scheduled Date**: ~2026-03-10 (after all tasks complete)

**Review Checklist**:
- [ ] All ACs met across DEV-002-006
- [ ] Regression suite passes (12 tests)
- [ ] Test coverage ≥85% verified
- [ ] Performance benchmarks unchanged
- [ ] DLQ monitoring operational
- [ ] Developer handoff documentation updated
- [ ] Lessons learned captured (for Phase 2 planning)

**Responsible**: Enterprise Architect + Product Owner

---

**Document Status**: APPROVED  
**Effective Date**: 2026-02-22  
**Review Date**: 2026-03-10 (post-implementation)
