# GOV-015: PR #227 – Week 1 Completion, Entrypoint Refactor, BE-007 Tests

**Date:** 2026-02-07  
**PR:** #227 (feat: Week 1 complete, BE-007 tag filter, inbox tests, app in index)  
**Architect:** Enterprise/Solution Architect  
**Status:** Approved (after code review fixes)  
**Decision:** Planning docs aligned with actual completion date (2026-02-07); backend entrypoint refactored for testability; BE-007 integration tests made deterministic.  
**Impacted:** `.docs/plans/00-INDEX.md`, `.docs/plans/06-tasks.md`, `packages/backend/src/index.ts`, `packages/backend/src/controllers/conversations.controller.ts`, `packages/backend/src/middleware/rateLimit.middleware.ts`, `packages/backend/tests/BE-007-inbox-api.spec.ts`  

---

## Summary

PR #227 marks Week 1 (BE-007, BE-008, FE-008, FE-009) complete and implements three critical backend improvements:

1. **Entrypoint Refactoring**: Express app initialization and `useExpressServer` setup moved into `src/index.ts` for test exportability; `app` exported for supertest integration tests.
2. **Query Parameter Validation**: Added explicit validation for `tagId`, `page`, `limit` and other query params with proper error handling (BadRequestError on invalid values).
3. **BE-007 Integration Tests**: Tests now create their own test user (via BetterAuth sign-in) and seed test conversations programmatically; deterministic without depending on pre-seeded fixtures.

---

## Code Changes Approved

| Component | Change | Rationale |
|-----------|--------|-----------|
| `src/index.ts` | Typed SocketControllers container (no `any`); app exported for tests | Enables supertest without test-only hacks; complies with no-`any` architecture rule. |
| `src/controllers/conversations.controller.ts` | Added `validateListConversationsQuery()` + `parsePositiveInt()`; validation for `tagId`, `page`, `limit`, channel, status, priority, sortBy, sortOrder | Returns 400 on invalid inputs; eliminates silent NaN bugs; complies with input validation standard. |
| `src/middleware/rateLimit.middleware.ts` | Removed custom `keyGenerator` from all limiters (login, reset, api) | Avoids deprecated `req.connection.remoteAddress`; prevents IPv6 key generator issues; consistent behavior across all endpoints. |
| `tests/BE-007-inbox-api.spec.ts` | Tests create user via `createTestUser(app, { email, password, role })`; seed conversations with `seedTestConversations(userId, count)` | No silent skip; tests fail fast if prerequisites missing; deterministic in CI without pre-seeded DB state. |
| `tests/test-helpers.ts` | Added `createTestApp()`, `createTestUser(app, opts)`, `seedTestConversations(userId, count)` | Provides reusable test infrastructure; supports multiple BE integration test suites. |

---

## Architecture Decisions

### Decision 1: Entrypoint App Export for Testing

**What:** `export { app }` from `src/index.ts` for supertest import.

**Why:** 
- Enables integration tests without a running server
- Decouples app initialization from server startup (via `NODE_ENV !== 'test'` check)
- Cleaner than test-specific hacks in middleware

**Compliance:** ✅ Permitted use of index.ts for test infrastructure export (not violating "no barrel exports" rule; this is library wiring, not general imports).

---

### Decision 2: Query Parameter Validation Inline in Controller

**What:** `validateListConversationsQuery(query)` function validates all query params before passing to service.

**Why:**
- Catches malformed inputs early (page, limit, tagId must be positive integers)
- Returns 400 Bad Request as per standard error handling
- Type-safe casting after validation (eliminates silent NaN)

**Trade-off:** Manual validation vs. routing-controllers DTO decorator; chosen for simplicity and clarity.

---

### Decision 3: Test Determinism via In-Test Setup

**What:** BE-007 tests create their own user and seed data inside `beforeAll()`.

**Why:**
- Tests are self-contained and don't depend on pre-seeded fixtures
- CI can run tests without a bootstrap step
- Test failures are clear (if user creation fails, the whole suite fails fast, not silently skipped)
- Matches "deterministic testing" standard

---

## Risks & Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|-----------|
| **Entrypoint app export enables test-only code paths** | Low | Medium | `NODE_ENV !== 'test'` gate ensures start() only runs in production/development; code is clean (no hacks). |
| **Query validation incomplete** | Low | Low | Validation covers all known query params; new params must include validation before merging. |
| **Test setup flakes if DB/Redis unavailable** | Medium | Medium | Tests fail fast with actionable error (not silently skipped); CI must run docker-compose before test suite. |

---

## Governance Decisions

| Item | Decision |
|------|----------|
| **Docs timeline** | Week 1 marked complete 2026-02-07; docs reflect actual merge date, not future-dated ranges. |
| **Planning doc changes** | PR #227 updates governed docs (00-INDEX.md, 06-tasks.md); this GOV entry provides audit trail. |
| **No-any compliance** | SocketControllers container typed with generic `<T>` (no `any`); eslint-disable removed. |
| **Query validation** | All query params validated; malformed inputs return 400; silent bugs (NaN) eliminated. |
| **Test determinism** | BE-007 tests create their own fixtures; no dependency on pre-seeded state. |

---

## Follow-ups

1. **CI/CD:** Document docker-compose prerequisite for BE integration tests in backend tests README (DONE).
2. **Test coverage:** Run `pnpm --filter @yacc/backend test -- --run tests/BE-007-inbox-api.spec.ts` to verify 85%+ coverage (expected: 24 tests, ~100% pass rate).
3. **Regression testing:** Existing auth + service tests must still pass (no breakage from refactors).
4. **Future BE tests:** New integration suites should use `createTestApp()` + `createTestUser()` pattern for consistency.

---

**Version:** 1.1  
**Status:** Approved  
**Related:** PR #227, BE-007, ADR-005 (config/infrastructure pattern)

---

**Version:** 1.0  
**Status:** Active  
**Related:** PR #227, GOV-008, .docs/plans/00-INDEX.md
