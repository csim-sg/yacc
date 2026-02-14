# Phase 2 Acceptance Testing - Implementation Guide

## Overview

This guide explains how to implement and run the comprehensive Phase 2 acceptance test suite targeting **90 test scenarios** and **90%+ coverage** of Phase 2 user stories and acceptance criteria.

## Architecture

```
Frontend (Playwright)
    ↓ (login, navigate, interact)
UI Components ← (data-testid selectors)
    ↓ (API calls)
REST API (40+ endpoints)
    ↓ (create, update, query)
PostgreSQL Database
    ↓ (read fixtures)
Test Fixtures (seeded by seed-test-fixtures.ts)
```

## Test Files Structure

```
packages/frontend/tests/
├── acceptance/
│   └── phase2/
│       ├── README.md                      # Coverage matrix, test organization
│       ├── IMPLEMENTATION-GUIDE.md        # This file
│       ├── phase2-master.spec.ts          # 38 comprehensive scenarios
│       ├── tags.spec.ts                   # ~12 tags scenarios (template)
│       ├── notes-mentions.spec.ts         # ~14 notes scenarios (template)
│       ├── assignments.spec.ts            # ~10 assignments scenarios (template)
│       ├── routing-rules.spec.ts          # ~16 routing rules scenarios (template)
│       ├── notifications.spec.ts          # ~12 notifications scenarios (template)
│       ├── bulk-actions.spec.ts           # ~14 bulk actions scenarios (template)
│       └── audit-logs-export.spec.ts      # ~14 audit logs scenarios (template)
├── helpers/
│   ├── auth.ts                           # Login/logout, TEST_USERS
│   ├── api.ts                            # API request wrappers
│   ├── selectors.ts                      # data-testid selectors (SELECTORS)
│   └── fixtures.ts                       # Test data, FIXTURE_IDS
├── global-setup.ts                       # Runs seed-test-fixtures
└── playwright.config.ts                  # Playwright configuration
```

## Database Setup (Docker Compose)

### 1. Start services
```bash
docker-compose up -d
```

Starts:
- PostgreSQL 15 (port 5432)
- Redis 7 (port 6379)
- Mailhog (ports 1025, 8025)

### 2. Run migrations
```bash
cd packages/backend
pnpm db:migrate
```

### 3. Seed fixtures (auto-run before tests)
```bash
pnpm db:fixtures
# OR manually:
cd packages/backend
tsx scripts/seed-test-fixtures.ts
```

**Seeded Data**:
- 4 users (super_admin, admin, manager, user) with password `admin123`
- 2 conversations (Telegram, IRC)
- 3 routing rules (2 active, 1 disabled)
- 105 bulk test conversations
- Sample tags, notes, notifications, audit logs

## Running Tests

### Prerequisites
```bash
# 1. Install dependencies
pnpm install

# 2. Start Docker services
docker-compose up -d

# 3. Start backend dev server
pnpm --filter @yacc/backend dev

# 4. Start frontend dev server (in another terminal)
pnpm --filter @yacc/frontend dev
```

### Run All Phase 2 Tests
```bash
pnpm --filter @yacc/frontend test -- tests/acceptance/phase2
```

### Run Specific Tests
```bash
# By feature
pnpm --filter @yacc/frontend test -- phase2-master.spec.ts

# By test name pattern
pnpm --filter @yacc/frontend test -- phase2-master.spec.ts -g "Tags"

# Single test
pnpm --filter @yacc/frontend test -- phase2-master.spec.ts -g "HP-T001"
```

### Debug Modes

#### Headed Mode (see browser interactions)
```bash
pnpm --filter @yacc/frontend test -- phase2-master.spec.ts --headed
```

#### UI Mode (interactive test explorer)
```bash
pnpm --filter @yacc/frontend test -- phase2-master.spec.ts --ui
```

#### Debug Mode (pause on failure)
```bash
pnpm --filter @yacc/frontend test -- phase2-master.spec.ts --debug
```

#### Slow Motion (1 second delay per action)
```bash
pnpm --filter @yacc/frontend test -- phase2-master.spec.ts --headed --slow-mo=1000
```

### Watch Mode (re-run on file changes)
```bash
pnpm --filter @yacc/frontend test -- --watch
```

## Test Naming Convention

Tests follow naming pattern: `{TYPE}-{FEATURE}{NUMBER}: {Description}`

**Types**:
- **HP** = Happy Path (primary workflow)
- **EDGE** = Edge Case (boundaries, empty states, idempotency)
- **RBAC** = Role-Based Access Control (permission checks)
- **AUD** = Audit (logging verification)
- **ERR** = Error Handling (validation, conflicts)
- **RT** = Real-Time (WebSocket, concurrency)

**Examples**:
- `HP-T001: Create tag with unique name`
- `EDGE-B003: Bulk action with 101+ - validation error`
- `RBAC-R004: Admin cannot manage rules - 403`
- `AUD-A006: Assignment logged in audit trail`

## Implementing Additional Tests

### Template: New Test File
```typescript
import { test, expect } from '@playwright/test';
import { loginAs, logout, TEST_USERS } from '../../helpers/auth';
import { /* API helpers */ } from '../../helpers/api';
import { SELECTORS } from '../../helpers/selectors';
import { FIXTURE_IDS } from '../../helpers/fixtures';

test.describe('Phase 2: Feature Name', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, TEST_USERS.superAdmin);
    await page.goto('/inbox');
  });

  test('HP-F001: Happy path scenario', async ({ page }) => {
    // Arrange
    const conversation = await getConversation(page, FIXTURE_IDS.conversations.telegram);

    // Act
    await doSomething(page, conversation.id);

    // Assert
    const result = await verify(page, conversation.id);
    expect(result).toBeTruthy();
  });

  test('RBAC-F002: Permission denied scenario', async ({ page }) => {
    await logout(page);
    await loginAs(page, TEST_USERS.user);

    const response = await page.request.post(
      `http://localhost:3000/api/protected-endpoint`,
      { data: { /* payload */ } }
    );

    expect(response.status()).toBe(403);
  });
});
```

### Template: API Helper
```typescript
export async function doSomething(
  page: Page,
  conversationId: string,
  options?: any
): Promise<any> {
  const response = await apiRequest(page, {
    method: 'POST',
    endpoint: `/conversations/${conversationId}/action`,
    body: options,
  });

  if (response.status !== 200 && response.status !== 201) {
    throw new Error(`Action failed: ${response.status}`);
  }

  return response.data;
}
```

## Handling Common Testing Scenarios

### 1. Login and Navigate
```typescript
test.beforeEach(async ({ page }) => {
  await loginAs(page, TEST_USERS.superAdmin); // Uses fixture credentials
  await page.goto('/inbox');
});
```

### 2. API Calls with Error Handling
```typescript
const tags = await getTags(page); // Helper wraps error handling
if (tags.length === 0) {
  throw new Error('No tags found');
}
```

### 3. UI Interaction and Assertion
```typescript
// Click a button
await page.locator(SELECTORS.tags.createButton).click();

// Fill a form
await page.locator(SELECTORS.tags.nameInput).fill('New Tag');

// Wait for and assert text
await expect(page.locator(SELECTORS.notifications.badge)).toContainText('5');
```

### 4. RBAC Testing
```typescript
// Test permission denied
const response = await page.request.post(endpoint, { data });
expect(response.status()).toBe(403); // Forbidden

// Test RBAC across roles
await logout(page);
await loginAs(page, TEST_USERS.user);
// ... test user can/cannot do something
```

### 5. Audit Log Verification
```typescript
await doSomething(page); // Create/update something

const logs = await getAuditLogs(page, { action: 'something.done' });
const myLog = logs.find(l => l.metadata.someId === expectedId);

expect(myLog).toBeTruthy();
expect(myLog.actorId).toBe(FIXTURE_IDS.users.superAdmin);
```

### 6. Bulk Operations
```typescript
const ids = getBulkConversationIds(50); // Get 50 fixture conversation IDs
const result = await bulkAction(page, {
  conversationIds: ids,
  action: 'assign',
  value: FIXTURE_IDS.users.manager,
});

expect(result.successCount).toBeGreaterThan(0);
```

## Fixture Data Reference

### Users
```typescript
TEST_USERS.superAdmin  // admin@yacc.local / admin123
TEST_USERS.admin       // admin2@yacc.local / admin123
TEST_USERS.manager     // manager@yacc.local / admin123
TEST_USERS.user        // user@yacc.local / admin123
```

### Fixture IDs
```typescript
FIXTURE_IDS.users.superAdmin           // '00000000-0000-0000-0000-000000000001'
FIXTURE_IDS.conversations.telegram     // '00000000-0000-0000-0000-000000001001'
FIXTURE_IDS.conversations.irc          // '00000000-0000-0000-0000-000000001002'
FIXTURE_IDS.routingRules.autoAssignVip // '00000000-0000-0000-0000-000002001'
```

### Bulk Conversation IDs
```typescript
getBulkConversationIds(100)  // Returns 100 IDs
getBulkConversationId(5)     // Returns 6th bulk conversation ID
```

## Debugging Tips

### 1. Enable Headed Mode to See Browser
```bash
pnpm test -- phase2-master.spec.ts --headed
```

### 2. Pause Test Execution
```typescript
await page.pause(); // Pauses test, opens debugger
```

### 3. Log Network Requests
```typescript
page.on('request', request => console.log(request.url()));
page.on('response', response => console.log(response.status(), response.url()));
```

### 4. Check Console Messages
```typescript
page.on('console', msg => console.log('PAGE LOG:', msg.text()));
```

### 5. View Playwright Traces
Tests save traces in `trace/` folder. Open in Playwright Inspector:
```bash
npx playwright show-trace trace/trace.zip
```

### 6. Screenshot for Debugging
```typescript
await page.screenshot({ path: 'screenshot.png', fullPage: true });
```

## Common Issues & Solutions

### Issue: "Selector not found"
**Solution**: Ensure frontend components have `data-testid` attributes matching `SELECTORS` object.

### Issue: "API request failed 401 Unauthorized"
**Solution**: Ensure `loginAs()` completed successfully. Check cookies/session in browser.

### Issue: "Fixture data not found"
**Solution**: Verify `pnpm db:fixtures` ran. Check database: `SELECT * FROM users;`

### Issue: "Test timeout"
**Solution**: Increase timeout in test:
```typescript
test('...', async ({ page }) => {
  // ...
}, { timeout: 30000 }); // 30 seconds
```

### Issue: "Flaky tests (sometimes fail)"
**Solution**: 
1. Use explicit waits instead of arbitrary delays
2. Retry transient failures (Playwright auto-retries on CI)
3. Check for race conditions (async operations)

## CI/CD Integration

### GitHub Actions
Tests run automatically on PR:
```yaml
- name: Run Phase 2 Acceptance Tests
  run: pnpm --filter @yacc/frontend test -- tests/acceptance/phase2
```

**Configuration** (in `playwright.config.ts`):
- Single-worker mode in CI (`workers: 1`)
- 2 retries on failure
- HTML report artifact uploaded
- Traces saved for debugging

### Local Pre-Commit Verification
```bash
# Before committing tests
pnpm test -- tests/acceptance/phase2 --headed

# Or quick smoke test (tags only)
pnpm test -- tags.spec.ts
```

## Test Report

Tests generate `playwright-report/` with:
- Summary of passes/failures
- Timeline of test execution
- Screenshot on failure
- Trace files for debugging

Open report:
```bash
npx playwright show-report
```

## Performance Baseline

Expected test execution times:
- Single test: ~5 seconds
- Full suite (90 tests): ~7-8 minutes
- Full suite with 2x retries (CI): ~10-12 minutes

## Metrics

Track these KPIs:
- **Pass Rate**: Target 100% (all scenarios passing)
- **Flakiness**: Target <1% (retries needed)
- **Coverage**: Target 90%+ of Phase 2 acceptance criteria
- **Execution Time**: Target <10 minutes for full suite

## Next Steps

1. **Run the suite**: `pnpm test -- tests/acceptance/phase2`
2. **Review failures**: Check `playwright-report/` for details
3. **Debug issues**: Use `--headed --debug` modes
4. **Add feature tests**: Copy templates to extend suite
5. **Integrate in CI**: Add to GitHub Actions workflow

## Support

For issues:
1. Check `playwright-report/` for test failures
2. Review `.docs/04-qa-and-testing.md` for strategy
3. Check backend logs: `pnpm --filter @yacc/backend dev`
4. Inspect database: `docker exec -it yacc-postgres psql -U yacc_user -d yacc_inbox`

---

**Last Updated**: 2026-02-13  
**Status**: Ready for implementation  
**Target Coverage**: 90 test scenarios, 90%+ Phase 2 acceptance criteria
