# Phase 2 Acceptance Testing Suite

This directory contains comprehensive Playwright acceptance tests for Phase 2 features (Tags, Notes, Assignments, Routing Rules, Notifications, Bulk Actions, Audit Logging) covering **~90 test scenarios** targeting **90%+ coverage** of critical user flows and edge cases.

## Test Organization

Each feature has its own test file organized by user flows + edge cases:

```
phase2/
├── tags.spec.ts              # ~12 scenarios (create, apply, remove, filter, RBAC)
├── notes-mentions.spec.ts    # ~14 scenarios (create, edit, delete, @mentions, notifications)
├── assignments.spec.ts       # ~10 scenarios (assign, reassign, notifications, RBAC)
├── routing-rules.spec.ts     # ~16 scenarios (create, first-match-wins, disable, execution logs)
├── notifications.spec.ts     # ~12 scenarios (list, read, dismiss, mark-all-read)
├── bulk-actions.spec.ts      # ~14 scenarios (assign, tag, status, max 100, partial failure)
├── audit-logs-export.spec.ts # ~14 scenarios (query, filter, export CSV, RBAC)
└── README.md                 # This file
```

## Running Tests

### Run all Phase 2 tests
```bash
pnpm --filter @yacc/frontend test -- tests/acceptance/phase2
```

### Run specific feature tests
```bash
pnpm --filter @yacc/frontend test -- tags.spec.ts
```

### Run with UI (debug mode)
```bash
pnpm --filter @yacc/frontend test -- tags.spec.ts --ui
```

### Run with headed browser (watch interactions)
```bash
pnpm --filter @yacc/frontend test -- tags.spec.ts --headed
```

## Test Fixtures

All tests use deterministic fixtures seeded by the backend:

**Setup**: `global-setup.ts` runs `pnpm run db:fixtures` which executes `seed-test-fixtures.ts`

**Fixture Data**:
- 4 test users (super_admin, admin, manager, user) with role=`admin123`
- 2 conversations (Telegram assigned to super_admin, IRC unassigned)
- 3 routing rules (1 active, 1 active, 1 disabled)
- 105 bulk test conversations (for testing max 100 limit)
- Tags, notes, audit logs, notifications (sample data)

**Fixture IDs** (see `helpers/fixtures.ts`):
```typescript
FIXTURE_IDS.users.superAdmin     // '00000000-0000-0000-0000-000000000001'
FIXTURE_IDS.users.admin          // '00000000-0000-0000-0000-000000000002'
FIXTURE_IDS.users.manager        // '00000000-0000-0000-0000-000000000003'
FIXTURE_IDS.users.user           // '00000000-0000-0000-0000-000000000004'
FIXTURE_IDS.conversations.telegram // '00000000-0000-0000-0000-000000001001'
FIXTURE_IDS.conversations.irc      // '00000000-0000-0000-0000-000000001002'
```

## Test Helpers

Located in `../helpers/`:

- **auth.ts** - Login/logout, user credentials (`TEST_USERS`)
- **api.ts** - API request wrappers (createTag, applyTag, getNotifications, etc.)
- **selectors.ts** - Centralized `data-testid` selectors (`SELECTORS`)
- **fixtures.ts** - Test data IDs and constants (`FIXTURE_IDS`, `FIXTURE_DATA`)

## Coverage Matrix

### Tags (~12 scenarios)
- ✅ Create tag (unique name)
- ✅ Create tag (duplicate name → validation error)
- ✅ Invalid color validation
- ✅ Apply tag (new)
- ✅ Apply tag (idempotent)
- ✅ Remove tag (present)
- ✅ Remove tag (not present → still 200)
- ✅ Tag filter (returns only tagged conversations)
- ✅ Tag filter (empty result)
- ✅ RBAC: user cannot apply/remove (403)
- ✅ RBAC: super_admin can always apply/remove
- ✅ Audit: tag.created, conversation.tag_added, conversation.tag_removed

### Notes & @Mentions (~14 scenarios)
- ✅ Create note (persists on refresh)
- ✅ Create note (appears in timeline)
- ✅ @mention single user (notification created, unread badge increments)
- ✅ @mention multiple users
- ✅ @mention unknown username (validation error, no notification)
- ✅ Notes pagination
- ✅ Notes empty state
- ✅ Edit note (owner can edit)
- ✅ Edit note (non-owner 403)
- ✅ Delete note (owner can delete)
- ✅ Delete note (non-owner 403)
- ✅ Click notification (navigates to conversation)
- ✅ Audit: note.created, note.updated, note.deleted

### Assignments (~10 scenarios)
- ✅ Assign unassigned conversation
- ✅ Reassign (override old assignee)
- ✅ Assignee sees in "assigned to me" filter
- ✅ Assignee receives notification
- ✅ Notification persists across reload
- ✅ Notification marked as unread until viewed
- ✅ RBAC: user cannot assign (403)
- ✅ RBAC: manager/admin/super_admin can assign
- ✅ Audit: conversation.assigned with old/new metadata
- ✅ Clear assignment

### Routing Rules (~16 scenarios)
- ✅ Create rule (active)
- ✅ Create rule (disabled)
- ✅ Update rule priority
- ✅ Update rule status (active ↔ disabled)
- ✅ Delete rule
- ✅ First-match-wins: higher priority wins
- ✅ First-match-wins: only one execution record
- ✅ Disabled rule does not execute
- ✅ Manual override path (rule doesn't re-apply)
- ✅ Rule execution logs query by rule id
- ✅ Rule execution logs query by conversation id
- ✅ RBAC: super_admin can manage rules
- ✅ RBAC: admin cannot manage rules (403)
- ✅ RBAC: manager/user cannot access (403)
- ✅ Audit: rule.created, rule.updated, rule.deleted, rule.executed

### Notifications (~12 scenarios)
- ✅ List notifications
- ✅ Filter unread notifications
- ✅ Filter by type (assignment, mention)
- ✅ Mark read (single)
- ✅ Dismiss (single)
- ✅ Mark all read
- ✅ Badge count updates
- ✅ Badge persists across sessions
- ✅ Click notification (navigates)
- ✅ RBAC: cannot read/dismiss someone else's (403)
- ✅ Pagination

### Bulk Actions (~14 scenarios)
- ✅ Select up to 100 conversations
- ✅ Bulk assign (all selected)
- ✅ Bulk tag (all selected)
- ✅ Bulk status change (open/pending/resolved)
- ✅ Max 100: exactly 100 succeeds
- ✅ Max 100: 101+ shows validation error
- ✅ Best-effort partial: invalid IDs show failures
- ✅ Failures array returned
- ✅ UI renders success/failure counts
- ✅ RBAC: user cannot bulk action (403)
- ✅ RBAC: manager/admin/super_admin can
- ✅ Audit: bulk_action_applied per entity
- ✅ Cancel bulk action
- ✅ Clear selection

### Audit Logs & Export (~14 scenarios)
- ✅ Query by actor
- ✅ Query by action
- ✅ Query by entity_type
- ✅ Query by entity_id
- ✅ Query by date range (dateFrom/dateTo)
- ✅ Pagination
- ✅ Conversation audit trail (convenience view)
- ✅ Export CSV (admin+)
- ✅ CSV headers present
- ✅ Formula-injection escaping
- ✅ Export filtered results
- ✅ RBAC: manager cannot export (403)
- ✅ RBAC: user cannot view (403)
- ✅ File download works

## Test Data Requirements

Tests use deterministic fixture IDs to avoid random data issues:

- All conversation IDs: `00000000-0000-0000-0000-{12-digit-number}`
- All user IDs: `00000000-0000-0000-0000-{12-digit-number}`
- Bulk test IDs: `3000–3104` (105 conversations)

## Handling Real-Time Events

For rule execution, notification delivery, WebSocket updates:

**Approach**: Use UI/API-driven triggers (not WebSocket event injection)
1. Trigger via real app actions (assignment, note mention)
2. Assert notifications/badges/UI updates
3. Assert audit entries

**Test-only Backend Endpoint** (if needed):
- Only enabled in `NODE_ENV=test`
- Documented in `.docs/04-qa-and-testing.md`
- Inaccessible in production builds

## Test Best Practices

1. **Use fixtures instead of creating data** - Reduces DB overhead
2. **Reuse fixture IDs** - Makes tests predictable and auditable
3. **Wait for elements explicitly** - Don't rely on arbitrary delays
4. **Check RBAC early** - Test permission denied scenarios first
5. **Verify audit logs** - Ensure every action is logged
6. **Test edge cases** - Empty results, max limits, partial failures
7. **Cleanup after tests** - Clear selections, close dialogs, etc.

## Common Assertions

```typescript
// Check notification appears
await expect(page.locator(SELECTORS.notifications.badge)).toContainText('2');

// Check tag applied
const tagElements = page.locator(SELECTORS.tags.tagItem);
await expect(tagElements).toContainText('VIP');

// Check audit entry created
const logs = await getAuditLogs(page, { action: 'conversation.assigned' });
expect(logs.length).toBeGreaterThan(0);

// Check RBAC error
const response = await apiRequest(page, {
  method: 'POST',
  endpoint: `/conversations/${conversationId}/assign`,
  body: { userId: managerId },
});
expect(response.status).toBe(403);
```

## Debugging Tips

1. **Enable headed mode**: `--headed` flag to watch browser
2. **Slow down tests**: `--slow-mo=1000` to see interactions
3. **Debug single test**: `test.only('name', async () => { ... })`
4. **Pause on failure**: `page.pause()` in test code
5. **View traces**: Playwright saves traces in `trace/` folder
6. **Check console logs**: `page.on('console', msg => console.log(msg))`

## Database Setup for Tests

Tests rely on seeded fixtures. To reset database between runs:

```bash
# Reset and reseed fixtures
docker-compose down -v && docker-compose up -d
pnpm db:migrate
pnpm db:fixtures
```

## CI/CD Integration

In GitHub Actions:
- Tests run in single-worker mode (`workers: 1`)
- With retries on transient failures (`retries: 2`)
- Artifacts uploaded (HTML report, traces) on failure

## Known Issues & Workarounds

- **WebSocket delays**: Tests wait 3 seconds max for real-time updates
- **Audit log queries**: Eventual consistency may require small delays
- **Bulk action partial failures**: Invalid IDs mixed with valid ones required

## Metrics & Reporting

Test results reported in:
- `playwright-report/` (HTML report)
- `trace/` (Playwright trace files for debugging)
- `.json` format for CI consumption

**Target**: 90 test scenarios covering 90%+ of Phase 2 acceptance criteria.

---

**Last Updated**: 2026-02-13  
**Maintained By**: QA Team  
**Status**: Phase 2 acceptance in progress
