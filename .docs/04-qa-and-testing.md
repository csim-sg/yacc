# 04. QA & Testing Guide

**YACC - Acceptance Criteria, Test Cases, Regression Suite**

---

## Table of Contents

1. [Testing Overview](#1-testing-overview)
2. [Acceptance Criteria Summary](#2-acceptance-criteria-summary)
3. [Test Case Categories](#3-test-case-categories)
4. [Regression Test Suite](#4-regression-test-suite)
5. [Testing Priorities](#5-testing-priorities)

---

## 1. Testing Overview

**Scope Reference**: See `.docs/01-product-specification.md` for authoritative MVP scope and acceptance criteria.

### Test Types

| Type | When | Tool | Coverage |
|------|------|------|----------|
| **Unit** | Component logic | Jest | Services, utilities, helpers |
| **Integration** | API endpoints, DB | Jest + Supertest | Endpoint behavior, DB interactions |
| **E2E** | User workflows | Playwright | Full user journeys (login → reply → audit log) |
| **Performance** | Search, bulk ops | Custom scripts | Measure response times, throughput |
| **Security** | Auth, RBAC, SQL injection | Manual + tools | Permission enforcement, input validation |

### PR Gating: Required Checks (Interim Policy)

**Status**: ✅ Implemented in PR #274 (GOV-029)

**Backend CI now enforces three required checks** before PR merge to `dev`:

| Check | Command | Required | Status | Notes |
|-------|---------|----------|--------|-------|
| **lint-changed** | `eslint <changed-files>` | ✅ YES | Required | New code must be lint-clean (no changed-files lint debt) |
| **test-unit** | `pnpm test src/services/__tests__/irc-ingestion.service.test.ts` | ✅ YES | Required | Curated stable unit tests (IRC ingestion service) |
| **test-smoke** | `pnpm test tests/QA-001-integration.spec.ts` | ✅ YES | Required | Curated stable integration test (smoke suite) |
| **test-full** | `pnpm test` (all tests) | ⚠️ NO | Informational | May fail on baseline; `continue-on-error: true`; timeout 15m |

**Rationale**: Dev baseline has test instability + lint debt. Required checks ensure new code quality while full suite provides signal for baseline issues.

**Exit Plan**: See GOV-029 (two conditions: lint cleanup + test stabilization)

### Unit Test Suite File List

**Curated stable unit tests that must pass before PR merge:**

| File | Purpose | Test Count | Status |
|------|---------|-----------|--------|
| `src/services/__tests__/irc-ingestion.service.test.ts` | IRC message ingestion | 17 | ✅ 100% Stable |

**How to add more unit tests to required suite**: 
- Test only passes reliably on dev baseline
- No flaky timeouts or platform-specific failures
- Fast execution (< 100ms per test)
- Update table above when adding tests
- Clear exit condition: when test becomes unstable, remove it

### Smoke Suite File List

**Curated tests that must pass before PR merge:**

| File | Purpose | Category |
|------|---------|----------|
| `tests/QA-001-integration.spec.ts` | Core integration sanity checks | Smoke/Integration |

**How to add more smoke tests**: 
- Keep list minimal (< 5 tests) to maintain speed
- Test critical user flows only (auth → inbox → messaging)
- All smoke tests must complete in < 2 minutes total
- Update table above when adding tests

### Test Data Setup

```typescript
// fixtures/users.ts
export const superAdmin = { email: 'admin@test.com', role: 'super_admin', password: 'test123' };
export const manager = { email: 'manager@test.com', role: 'manager', password: 'test123' };
export const user = { email: 'user@test.com', role: 'user', password: 'test123' };

// fixtures/conversations.ts
export const telegramConv = { channel: 'telegram', externalThreadId: 't-123' };
export const ircConv = { channel: 'irc', externalThreadId: 'irc-456' };
```

### Phase 1 Scope Notes

- WebSocket real-time updates ship at the end of Phase 1.
- Message retry queue (BullMQ + backoff) ships at the end of Phase 1.
- Telegram and IRC integration testing are both Phase 1 scope.
- Phase 1 UI channel filters must show Telegram + IRC only.

### Phase 1 Runnable Test Checklist

#### Prereqs

- Local `.env` configured (DB, Redis, JWT secret, IRC creds).
- Database migrated and server + web apps running.
- Seed data loaded for users, conversations, and messages.

#### Seed Data

- Users: `super_admin`, `admin`, `manager`, `user` with known passwords.
- Conversations: 1 Telegram placeholder (for UI), 1 IRC channel thread.
- Messages: 3 inbound, 1 outbound (pending) for status checks.

#### Execution Order

- Run Jest unit tests first, then Jest integration, then Playwright E2E.
- Reset DB between Jest integration and Playwright runs.

#### Jest Unit/Integration IDs

- Auth: `1.1_AC1_ValidLoginCreatesSession`, `1.1_AC2_InvalidPasswordReturns401`, `1.3_AC1_RoleBasedAccessEnforced`.
- Inbox: `2.1_AC1_InboxShowsSingleQueue`, `2.2_AC1_FiltersByChannel`, `2.3_AC1_TimelineChronological`.
- Messaging: `4.1_AC1_ReplySendsToChannel`, `4.1_AC3_MessageStatusTracked`.
- IRC: `5.2_AC1_IRCInboundMessagesAppear`.

#### Playwright E2E IDs

- `REGR_001` Login + inbox load.
- `REGR_002` Send reply + delivery status.
- `REGR_004` IRC inbound message.

---

## 2. Acceptance Criteria Summary

### By Story (20 Stories, 130+ ACs)

**Stories 1.1–1.3** (Auth): Login, forgot password, RBAC  
**Stories 2.1–2.3** (Inbox): List, filters, conversation view  
**Stories 3.1–3.3** (Collaboration): Notes, tags, assignments  
**Stories 4.1–4.2** (Messaging): Reply, real-time updates  
**Stories 5.1–5.2** (Integrations): Telegram, IRC  
**Stories 6.1–6.2** (Admin): User management, audit logs  
**Stories 7.1–7.2** (Rules): Auto-assignment, routing audit  
**Stories 8.1–8.2** (Bulk): Bulk assign, bulk tag  
**Stories 9.1–9.2** (Presence): Online/offline, typing  
**Story 10.1** (Localization): English default  
**Story 11.1** (Payloads): Store raw payloads  
**Stories 12–20** (New features): Search, attachments, notifications, retry, integration setup, tag creation, status management, comprehensive audit logging  

**See 01-product-specification.md Section 8 for full AC list**

---

## 3. Test Case Categories

### Category 1: Auth (5 test cases)

```
✓ 1.1.1 Valid login creates session
✓ 1.1.2 Invalid password returns 401
✓ 1.1.3 User lands on inbox after login
✓ 1.2.1 Forgot password sends email with token
✓ 1.3.1 Role-based access enforced (403 for unauthorized)
```

**JWT-only auth testing notes**
- Access token TTL: 48 hours (verify expiry, refresh required after TTL)
- Refresh token TTL: 30 days (verify expiration handling)
- Refresh token cookie is single-use with rotation (old token rejected after refresh)

### Category 2: Inbox & Conversations (10 test cases)

```
✓ 2.1.1 Inbox shows all channels in single queue
✓ 2.1.2 Unread count displayed per conversation
✓ 2.2.1 Filters (channel, tag, status) work correctly
✓ 2.2.2 Combined filters work (AND logic)
✓ 2.3.1 Timeline displays messages in chronological order
✓ 2.3.2 Message metadata visible (sender, timestamp, status)
✓ 2.3.3 Conversation status visible in header
✓ 2.3.4 Status change logged in audit trail
✓ 2.3.5 New inbound message auto-reopens resolved conversation
```

### Category 3: Collaboration (8 test cases)

```
✓ 3.1.1 Internal notes visible only to team
✓ 3.2.1 Tags added/removed from conversation
✓ 3.2.2 Tags reusable across conversations
✓ 3.2.3 Create tag on-the-fly (inline)
✓ 3.3.1 Assign conversation to user
✓ 3.3.2 Reassignment allowed (override old)
✓ 3.3.3 Assignment notification sent to assignee
✓ 3.3.4 Assigned user sees in filtered view
```

### Category 4: Messaging & Delivery (8 test cases)

```
✓ 4.1.1 Reply sends to original channel
✓ 4.1.2 Only managers + users can reply (users blocked if role=user)
✓ 4.1.3 Message status tracked (pending → sent or failed)
✓ 4.1.4 Failed message shows "Retry" button
✓ 4.2.1 New inbound message appears in inbox (<1 second)
✓ 4.2.2 Assignment change updates live
✓ 4.2.3 WebSocket reconnects on disconnect
✓ 4.2.4 Typing indicator shows in conversation view
```

### Category 5: Integrations (6 test cases)

```
✓ 5.1.1 Telegram messages appear in inbox
✓ 5.1.2 Conversation threads created per group (one thread per group)
✓ 5.1.3 Replies sent on-behalf-of system account
✓ 5.1.4 Attachments from Telegram downloaded + re-hosted
✓ 5.2.1 IRC messages appear in inbox
✓ 5.2.2 IRC auto-reconnect on disconnect
```

### Category 6: Search & Attachments (10 test cases)

```
✓ 12.1.1 Full-text search by message content
✓ 12.1.2 Full-text search by sender name
✓ 12.1.3 Search combined with filters
✓ 12.1.4 Search results sorted by relevance + recency
✓ 12.1.5 Search performance <1 second
✓ 13.1.1 Inbound attachments downloaded + re-hosted
✓ 13.1.2 Attachments displayed inline (images, previews)
✓ 13.2.1 Outbound attachment upload with progress
✓ 13.2.2 Max file size validation (5 MB)
✓ 13.2.3 File type whitelist enforced
```

### Category 7: Notifications & Retry (10 test cases)

```
✓ 14.1.1 Assignment notification created for assignee
✓ 14.2.1 @mention in note creates notification for mentioned user
✓ 14.3.1 Unread badge shows on conversation
✓ 14.4.1 Notification center shows all notifications
✓ 14.4.2 Mark notification as read
✓ 15.1.1 Failed message enqueued for retry
✓ 15.1.2 Retry schedule: 1m, 5m, 30m (3 attempts)
✓ 15.1.3 After 3 failures, moved to DLQ
✓ 15.2.1 Message shows delivery status badge
✓ 15.2.2 Failed message shows "Retry" button
```

### Category 8: Rules & Bulk Actions (8 test cases)

```
✓ 7.1.1 Rules can match by channel
✓ 7.1.2 Rules can match by keyword
✓ 7.1.3 Rules execute first match only
✓ 7.2.1 Rule execution logged in audit trail
✓ 8.1.1 Bulk assign (max 100) with best-effort handling
✓ 8.1.2 Partial failures reported (success count + failures)
✓ 8.2.1 Bulk tag action applies to all selected
```

### Category 9: Admin & Audit (8 test cases)

```
✓ 6.1.1 Create/edit user (role, status)
✓ 6.1.2 User deactivation prevents login
✓ 6.1.3 Role change takes effect immediately
✓ 6.2.1 Audit log includes: actor, action, entity, timestamp
✓ 6.2.2 Audit log covers assignments, tags, notes, status changes
✓ 6.2.3 Audit logs queryable by actor, action, entity_type
✓ 6.2.4 Export audit logs to CSV
✓ 20.2.1 Search audit logs by conversation or user ID
```

### Category 10: Integration Setup (4 test cases)

```
✓ 16.1.1 Telegram: admin form input, test button, status display
✓ 16.1.2 Telegram: webhook URL returned on success
✓ 16.2.1 IRC: admin form input, test button, status display
✓ 16.2.2 IRC: auto-reconnect status shown
```

---

## 4. Regression Test Suite

**Run these 12 test cases before every release:**

| # | Test Case | Story | Critical |
|---|-----------|-------|----------|
| REGR_001 | Login + Inbox Load | 1.1, 2.1 | 🔴 |
| REGR_002 | Send Reply + Delivery Status | 4.1, 15.2 | 🔴 |
| REGR_003 | Telegram Inbound Message | 5.1 | 🔴 |
| REGR_004 | IRC Inbound Message | 5.2 | 🔴 |
| REGR_005 | Tag Conversation | 3.2, 17.1 | 🟠 |
| REGR_006 | Assign + Notification | 3.3, 14.1 | 🟠 |
| REGR_007 | Bulk Assign + Partial Failure | 19.1 | 🟠 |
| REGR_008 | Search + Filters | 12.1, 2.2 | 🟠 |
| REGR_009 | Message Retry | 15.1, 15.2 | 🟠 |
| REGR_010 | Audit Log Query + Export | 20.2 | 🟠 |
| REGR_011 | WebSocket Reconnect | 4.2 | 🟠 |
| REGR_012 | Rules Execution | 7.1, 7.2 | 🟠 |

**Run frequency**: Before every production release

---

## 5. Testing Priorities

### Critical (🔴 High Priority)
**Must pass before MVP launch:**

- ✅ Authentication (login, logout, forgot password)
- ✅ Inbox list & filtering (core workflow)
- ✅ Send/receive messages (core messaging)
- ✅ Conversation view & status changes
- ✅ Telegram + IRC ingestion (Phase 1 integrations)
- ✅ Real-time updates (WebSocket, end of Phase 1)
- ✅ Message retry queue (end of Phase 1)
- ✅ Notifications (assignment, @mention)
- ✅ Audit logging (compliance)

**Target**: 95%+ pass rate, 0 critical bugs

---

### Important (🟠 Medium Priority)
**Should test before launch, but non-blocking:**

- ✅ Search (full-text + filters)
- ✅ Attachments (upload/download)
- ✅ Rules & routing engine
- ✅ Bulk actions (with partial failure handling)
- ✅ Admin features (user management, audit log viewer)
- ✅ Presence & typing indicators

**Target**: 90%+ pass rate

---

### Nice-to-Have (🟡 Low Priority)
**Can defer to post-MVP testing:**

- Performance testing (search <1s, bulk <5s)
- Load testing (concurrent users)
- RTL support (post-MVP)
- Localization (post-MVP)

---

## Test Naming Convention

```
[STORY_ID]_[AC#]_[DESCRIPTION]

Examples:
✓ 1.1_AC1_ValidLoginCreatesSession
✓ 1.1_AC2_InvalidPasswordReturns401
✓ 2.2_AC3_CombineFiltersWorkCorrectly
✓ 4.1_AC6_MessageStatusTracked
✓ 12.1_AC1_FullTextSearchByContent
✓ 15.1_AC1_FailedMessageEnqueuedForRetry
```

---

## Test Case Template

```typescript
describe('Story 1.1: Login', () => {
  describe('AC1: Valid credentials create session', () => {
    test('should create session and return JWT', async () => {
      // Setup
      const user = await createUser('user@test.com', 'password123');

      // Action
      const response = await post('/auth/login', {
        email: 'user@test.com',
        password: 'password123',
      });

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.data.token).toBeDefined();
      expect(response.body.data.user.id).toBe(user.id);
    });
  });

  describe('AC2: Invalid credentials return 401', () => {
    test('should reject invalid password', async () => {
      await createUser('user@test.com', 'correct-password');

      const response = await post('/auth/login', {
        email: 'user@test.com',
        password: 'wrong-password',
      });

      expect(response.status).toBe(401);
      expect(response.body.code).toBe('invalid_credentials');
    });
  });
});
```

---

## Playwright E2E Example

```typescript
// tests/e2e/inbox.spec.ts
import { test, expect } from '@playwright/test';

test('user can send message and see delivery status', async ({ page }) => {
  // Setup: login
  await page.goto('http://localhost:3000/login');
  await page.fill('input[name="email"]', 'user@test.com');
  await page.fill('input[name="password"]', 'password123');
  await page.click('button:has-text("Login")');

  // Wait for inbox to load
  await page.waitForURL('**/conversations');

  // Action: open conversation
  await page.click('text=John Smith');  // conversation participant

  // Action: send reply
  await page.fill('textarea[placeholder="Type message..."]', 'Hello world');
  await page.click('button:has-text("Send")');

  // Assert: message appears with sending status
  await expect(page.locator('text=Hello world')).toBeVisible();
  await expect(page.locator('[data-test="message-status"][data-status="pending"]')).toBeVisible();

  // Wait for delivery
  await page.waitForTimeout(2000);

  // Assert: status changes to sent
  await expect(page.locator('[data-test="message-status"][data-status="sent"]')).toBeVisible();
});
```

---

**Version**: 1.0  
**Last Updated**: January 17, 2026  
**Status**: Complete & Ready for QA
