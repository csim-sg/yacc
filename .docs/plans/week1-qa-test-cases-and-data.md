# Week 1 QA: Test Case Preparation & Test Data Setup

**Last Updated**: 2026-02-07  
**Scope**: BE-007 (Inbox API), BE-008 (Conversation Detail), FE-008 (Inbox List), FE-009 (Conversation Detail)  
**Status**: Ready for execution

---

## 1. Purpose

This document defines the **test cases** and **test data setup** for Week 1 deliverables so QA and developers can run a consistent set of checks before moving to Week 2.

---

## 2. Test Data Setup

### 2.1 Prerequisites

- **PostgreSQL** and **Redis** running (e.g. `docker compose up -d`).
- **Database migrated** (Drizzle migrations applied).
- **Backend** `.env` configured (`DATABASE_URL`, `BETTER_AUTH_SECRET`, etc.).

### 2.2 Seed Scripts

| Script | Command | Purpose |
|--------|---------|---------|
| Admin user only | `pnpm --filter @yacc/backend db:seed` | Creates `admin@yacc.local` / `admin123` if missing. |
| Full test fixtures | `pnpm --filter @yacc/backend db:fixtures` | Seeds 4 roles, 1 Telegram + 1 IRC conversation, messages, tags, notes, audit entries. |

**Location**: `packages/backend/scripts/seed-admin.ts`, `packages/backend/scripts/seed-test-fixtures.ts`

### 2.3 Test Users (after `db:fixtures`)

| Email | Password | Role |
|-------|----------|------|
| admin@yacc.local | admin123 | super_admin |
| admin2@yacc.local | admin123 | admin |
| manager@yacc.local | admin123 | manager |
| user@yacc.local | admin123 | user |

All use **Better Auth**–compatible password hashing (sign-in via `POST /auth/sign-in/email`).

### 2.4 Test Conversations & Messages (after `db:fixtures`)

- **Telegram** (fixture id 1001): title "Mock Support Thread", status resolved, tag VIP, multiple messages (inbound/outbound, pending/sent/failed), internal notes, audit log entries.
- **IRC** (fixture id 1002): channel `irc-#support`, status open, 1 inbound message.

**Note**: If your schema uses **UUID** for `conversations.id`, the seed script may need to be updated to use UUIDs instead of integer ids 1001/1002; current seed was written for integer ids. Cleanup in the seed uses `id >= 1000`.

---

## 3. Week 1 Test Cases

### 3.1 Backend: BE-007 Inbox API

**Spec**: `.docs/02-api-and-data-model.md` (GET /api/conversations)  
**Automated suite**: `packages/backend/tests/BE-007-inbox-api.spec.ts` (Vitest + Supertest)

| ID | Test case | Category (04-qa) |
|----|-----------|------------------|
| 2.1.1 | Inbox returns paginated list (single queue) | Inbox & Conversations |
| 2.2.1 | Filters: channel, status, priority, assignedUserId | Inbox & Conversations |
| 2.2.2 | Combined filters (AND logic) | Inbox & Conversations |
| — | Pagination (page, pageSize, total) | — |
| — | 401 without auth token | — |
| — | 400 for invalid query params (page, channel, status) | — |
| — | Response shape: id, channel, status, priority, tags, participants, unreadCount, etc. | — |
| — | Default sort by lastActivity desc | — |

**How to run**:

```bash
cd packages/backend
pnpm db:fixtures   # ensure test users + conversations exist
pnpm test -- tests/BE-007-inbox-api.spec.ts
```

If DB/Redis are unavailable or login fails, the suite skips tests via `itOrSkip`.

### 3.2 Backend: BE-008 Conversation Detail

**Spec**: GET /api/conversations/:id  
**Coverage**: Conversation metadata; messages are fetched via BE-009 (Week 2).

| ID | Test case | Category |
|----|-----------|----------|
| 2.3.1 | Get by id returns conversation with expected fields | Inbox & Conversations |
| 2.3.3 | Conversation status visible | Inbox & Conversations |
| — | 401 without auth | — |
| — | 403 when role cannot access | — |
| — | 404 for missing id | — |

**How to run**: Covered by backend conversation/integration tests (e.g. `backend-conversations.spec.ts` in frontend/tests or backend integration tests). Run after seed.

### 3.3 Frontend: FE-008 Inbox List

**Scope**: Inbox list page (UI scaffold with mocks per Week 1).

| ID | Test case | Notes |
|----|-----------|--------|
| 2.1.1 | Inbox shows single queue (list of conversations) | UI with mock or live API |
| 2.2.1 | Filters (channel, tag, status) available and work | When wired to BE-007 |
| FE-008 | Inbox list page loads without error | Smoke |

**How to run**: Playwright E2E in `packages/frontend/tests/` (e.g. inbox-content, inbox-filters, regression-suite). Start backend + frontend, then:

```bash
cd packages/frontend
pnpm test -- inbox-filters.spec.ts
```

### 3.4 Frontend: FE-009 Conversation Detail

**Scope**: Conversation detail page (messages timeline, reply composer scaffold with mocks).

| ID | Test case | Notes |
|----|-----------|--------|
| 2.3.1 | Timeline displays messages in chronological order | When wired to BE-008/BE-009 |
| 2.3.2 | Message metadata visible (sender, timestamp, status) | When wired |
| 2.3.3 | Conversation status visible in header | When wired |
| FE-009 | Conversation detail page loads for a conversation | Smoke |

**How to run**: Playwright E2E (e.g. `conversation-detail.spec.ts`, `regression-suite.spec.ts`).

---

## 4. Execution Order (Week 1)

1. **Start services**: `docker compose up -d` (PostgreSQL, Redis).
2. **Backend env**: Ensure `packages/backend/.env` has `DATABASE_URL`, `BETTER_AUTH_SECRET`, etc.
3. **Migrations**: `pnpm --filter @yacc/backend db:migrate` (or equivalent).
4. **Seed**: `pnpm --filter @yacc/backend db:seed` then `pnpm --filter @yacc/backend db:fixtures`.
5. **Backend unit/integration**: `pnpm --filter @yacc/backend test` (includes BE-007 when DB/Redis available).
6. **Backend server**: Start `pnpm --filter @yacc/backend dev`.
7. **Frontend E2E**: In another terminal, `pnpm --filter @yacc/frontend dev`, then `pnpm --filter @yacc/frontend test` (or run specific specs).

---

## 5. References

| Doc | Use |
|-----|-----|
| `.docs/04-qa-and-testing.md` | Full test categories, regression suite, naming convention |
| `.docs/02-api-and-data-model.md` | API contract for GET /conversations, GET /conversations/:id |
| `.docs/01-product-specification.md` | User stories and acceptance criteria |
| `packages/backend/tests/README.md` | Backend test structure, BE-007 prerequisites |
| `packages/frontend/tests/README.md` | Frontend E2E structure, backend dependency |

---

## 6. Sign-off

- [ ] Test data: seed scripts run successfully (admin + fixtures).
- [ ] BE-007: Inbox API test suite run (or skipped with reason).
- [ ] BE-008: Conversation detail covered by integration/E2E.
- [ ] FE-008 / FE-009: Inbox and conversation detail E2E/smoke run.
- [ ] Update `.docs/plans/00-INDEX.md` after execution (mark Week 1 QA task complete when run).

**Version**: 1.0  
**Governance**: GOV-008, ADR-005 apply
