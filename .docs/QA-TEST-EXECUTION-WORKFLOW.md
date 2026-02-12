# QA Test Execution Workflow: PR #249

**Purpose**: Step-by-step guide for executing 80 QA test scenarios  
**Test Framework**: Manual Playwright E2E + browser automation  
**Duration**: 8-9 hours across Feb 13-14  
**Success Criteria**: ≥75/80 pass (93%+)  

---

## 🎯 Execution Strategy

### Three-Tier Approach

**Tier 1 (Critical Path)**: 34 scenarios - MUST PASS
- Focuses on core functionality
- RBAC enforcement, Audit Logs, Assignments, Bulk Actions
- Blocks merge if failures found

**Tier 2 (Important)**: 26 scenarios - SHOULD PASS
- Supports Phase 2 features
- Routing Rules, Tags, Notes, Status, Integration
- Can defer low-severity to Phase 3

**Tier 3 (Edge Cases)**: 20 scenarios - OPTIONAL
- Error handling, UI/UX, Performance
- Can be deferred if time-boxed

---

## 📋 Pre-Test Checklist (15 min)

### Environment Verification

```bash
# 1. Check Docker (should have 3 running)
docker ps | grep -E "postgres|redis|mailhog"

# 2. Check backend connectivity
curl -s http://localhost:3000/api/health | jq .

# 3. Check frontend is serving
curl -s http://localhost:5173 | head -20

# 4. Verify database
psql postgresql://user:password@localhost/yacc -c "SELECT COUNT(*) FROM users;"
```

### Test User Creation

Create 4 test users with script:

```bash
#!/bin/bash
# File: create-test-users.sh

BASE_URL="http://localhost:3000"
USERS=(
  "super_admin@test.com:SuperAdmin123!"
  "admin@test.com:Admin123!"
  "manager@test.com:Manager123!"
  "user@test.com:User123!"
)

for user in "${USERS[@]}"do
  IFS=':' read -r email password <<< "$user"
  echo "Creating user: $email"
  
  curl -X POST "$BASE_URL/api/auth/register" \
    -H "Content-Type: application/json" \
    -d "{\"email\": \"$email\", \"password\": \"$password\", \"name\": \"Test User\"}"
  
  echo "✓ Created $email"
done
```

### Test Data Seeding

```bash
#!/bin/bash
# File: seed-test-data.sh

# Login as super_admin@test.com first
AUTH_TOKEN="<token-from-login>"
BASE_URL="http://localhost:3000"

# Create 3 tags
echo "Creating tags..."
curl -X POST "$BASE_URL/api/tags" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Bug","color":"#dc2626"}'

curl -X POST "$BASE_URL/api/tags" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Feature","color":"#2563eb"}'

echo "✓ Test data seeded"
```

---

## 🧪 Test Execution Flow

### Phase 1: RBAC Testing (1 hour)

**Objective**: Verify access control across all user roles

**Setup**: 4 browser windows/tabs with logins:
- Tab 1: super_admin@test.com
- Tab 2: admin@test.com
- Tab 3: manager@test.com
- Tab 4: user@test.com

**Test Sequence**:

```
1. Navigate all to: http://localhost:5173/audit-logs
   - Super Admin: ✅ Page loads
   - Admin: ✅ Page loads
   - Manager: ✅ Page loads
   - User: ❌ Access denied / 403
   
   RESULT: [ ] PASS [ ] FAIL

2. Check Export button (Audit Logs)
   - Super Admin: ✅ Export button visible + enabled
   - Admin: ✅ Export button visible + enabled
   - Manager: ⚠️ Export button visible but disabled + "Admin only" tooltip
   - User: ❌ No access to page
   
   RESULT: [ ] PASS [ ] FAIL

3. Navigate to: /routing-rules
   - Super Admin: ✅ Page loads
   - Admin: ✅ Page loads
   - Manager: ❌ Access denied
   - User: ❌ Access denied
   
   RESULT: [ ] PASS [ ] FAIL

[Continue for all 8 RBAC scenarios...]
```

**Log Template** (copy to `.docs/QA-EXECUTION-LOG.md`):

```markdown
### A1: Super Admin Full Access ✅ PASS
- Super Admin accessed Audit Logs: ✅ Yes
- Super Admin accessed Routing Rules: ✅ Yes
- Export button visible and enabled: ✅ Yes
- All admin features accessible: ✅ Yes
**Notes**: All super admin access working correctly
```

---

### Phase 2: Feature Testing (2 hours)

#### Audit Logs Feature (B1-B8)

**Scenario B1: Load & Display**
```
1. Login as admin@test.com
2. Navigate to Audit Logs page
3. Verify page loads successfully
   - [ ] Page displays within 2 seconds
   - [ ] "Audit Logs" header visible
   - [ ] Loading spinner appeared and disappeared
   - [ ] At least 5 audit log entries visible
   - [ ] Column headers: Actor, Action, Entity, Timestamp visible
   
RESULT: [ ] PASS [ ] FAIL
NOTES: [Any observations]
```

**Scenario B2: Pagination**
```
1. From Audit Logs page
2. Count visible logs (should be ≤20 per page)
3. Click "Next" button
   - [ ] Next page loads
   - [ ] Previous button becomes enabled
   - [ ] New entries load
   - [ ] Page number indicator updates
4. Click "Previous" button
   - [ ] Returns to first page
   - [ ] Entries match first page

RESULT: [ ] PASS [ ] FAIL
NOTES: [Any observations]
```

**Scenario B3: Filtering**
```
1. From Audit Logs page
2. Click "Filter by Action" dropdown
   - [ ] Dropdown shows available actions
   - [ ] Can select an action (e.g., "create", "update")
   - [ ] Results filter to only selected action
   - [ ] Pagination resets to page 1
   - [ ] Count of results shows correctly

RESULT: [ ] PASS [ ] FAIL
NOTES: [Any observations]
```

**[Continue for B4-B8...]**

---

#### Assignments Feature (D1-D10)

**Scenario D1: Open Assignment Section**
```
1. Login as manager@test.com
2. Navigate to a conversation (Inbox → Click conversation)
3. Look at right panel
   - [ ] Right panel visible (on desktop lg+ screens)
   - [ ] "Assignment" section visible
   - [ ] Current assignee shown (or "Unassigned")
   - [ ] User dropdown/list available for selection

RESULT: [ ] PASS [ ] FAIL
NOTES: [Any observations]
```

**Scenario D2: Assign Conversation (Manager)**
```
1. Manager on conversation page
2. In Assignment section, select a user from dropdown
   - [ ] Dropdown opens
   - [ ] User list shows available users
   - [ ] Can click to select
3. Verify assignment
   - [ ] Conversation updates immediately
   - [ ] Selected user now shown as assignee
   - [ ] No page refresh needed
   - [ ] Inbox list reflects change

RESULT: [ ] PASS [ ] FAIL
NOTES: [Check network tab for POST /api/conversations/[id]/assign]
```

**[Continue for D3-D10...]**

---

### Phase 3: Bulk Actions Testing (1.5 hours)

**Scenario H1: Bulk Actions Bar Display**
```
1. Login as admin@test.com
2. Navigate to Inbox
3. Click checkbox on first conversation
   - [ ] Checkbox becomes checked
   - [ ] Bulk Actions Bar appears below header
   - [ ] Shows "1 selected"
   - [ ] Action buttons visible: Assign, Tag, Status
   - [ ] "Clear selection" button present

RESULT: [ ] PASS [ ] FAIL
NOTES: [Bar appears immediately or with delay?]
```

**Scenario H3: Bulk Assign**
```
1. Select 3 conversations (check 3 boxes)
   - [ ] Count shows "3 selected"
2. Click "Assign" button
   - [ ] User dropdown opens
   - [ ] No "Unassigned" option (MVP constraint)
   - [ ] Shows placeholder or user list
3. Select a user
   - [ ] All 3 conversations update to show new assignee
   - [ ] UI updates immediately
   - [ ] Each shows assignment success

RESULT: [ ] PASS [ ] FAIL
NOTES: [Check network tab for batched mutations]
```

**[Continue for H4-H8...]**

---

## 🛠️ Tools & Utilities

### Browser DevTools Checklist

For each test, use DevTools to verify:

```javascript
// Console Tab
- No errors (red X)
- No warnings about missing data
- Auth header present in requests

// Network Tab
- All API requests return 2xx or expected error codes
- Response times reasonable (<1s for list, <500ms for actions)
- No 401/403 for authorized users
- No failed requests

// Application Tab
- LocalStorage has auth token
- Cookies present (if session-based)
- No stale/corrupted data

// Performance Tab (if needed)
- Page loads in <2 seconds
- No long tasks blocking UI
```

### Screenshot Guidelines

Take screenshots for:
- ✅ Each passing test (optional, but good for documentation)
- ❌ Every failing test (REQUIRED for defect report)
- ⚠️ UI issues or unexpected behavior
- 🔄 Permission denials or access control mismatches

### Browser Automation (Playwright)

If writing automated tests:

```typescript
// Example: Test Audit Logs Export
import { test, expect } from '@playwright/test';

test('audit logs export for admin', async ({ page }) => {
  // Login
  await page.goto('http://localhost:5173/login');
  await page.fill('input[name="email"]', 'admin@test.com');
  await page.fill('input[name="password"]', 'Admin123!');
  await page.click('button[type="submit"]');
  
  // Wait for navigation
  await page.waitForURL('/inbox');
  
  // Navigate to audit logs
  await page.goto('http://localhost:5173/audit-logs');
  
  // Verify page loaded
  await expect(page.locator('h1')).toContainText('Audit Logs');
  
  // Click export
  const exportBtn = page.locator('button:has-text("Export")');
  await expect(exportBtn).toBeEnabled();
  
  // Listen for download
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    exportBtn.click()
  ]);
  
  // Verify file
  expect(download.suggestedFilename()).toMatch(/audit.*\.csv/);
});
```

---

## 📊 Result Tracking

### Update Execution Log

As you complete tests, update `.docs/QA-EXECUTION-LOG.md`:

```markdown
## Test Results

### Priority 1: Critical Path

**A. RBAC & Authentication**
- A1: Super Admin Full Access ✅ PASS
- A2: Admin Access ✅ PASS
- A3: Manager Limited Access ✅ PASS
- A4: User No Admin Access ✅ PASS
- A5: Unauthenticated Access ✅ PASS
- A6: Role Persistence ✅ PASS
- A7: Logout & Access Denied ✅ PASS
- A8: Token Refresh ✅ PASS

**Subtotal**: 8/8 ✅ PASS

**B. Audit Logs Page**
- B1: Load & Display ✅ PASS
- B2: Pagination ✅ PASS
- B3: Filtering ✅ PASS
- B4: Date Range ✅ PASS
- B5: Export (Admin Only) ✅ PASS
- B6: Export RBAC (Manager Blocked) ✅ PASS
- B7: Export Error Handling ❌ FAIL → Defect-001
- B8: Performance ⏳ PENDING

**Subtotal**: 6/8 (one fail, one pending)

[Continue for all test areas...]

## Defects Found

### Defect-001: Export Error Not User-Visible
- Severity: HIGH
- Feature: Audit Logs Export
- Issue: When network error occurs during export, error only logged to console, not shown to user
- Impact: Users don't know export failed; appears hung
- Reproduction: Simulate offline → click Export → observe no error message
```

---

## 🎯 Daily Timeline

### Day 1 (Feb 13)

**Morning Session (4 hours)**:
- 9:00-9:15: Environment verification
- 9:15-10:15: RBAC testing (A1-A8)
- 10:15-10:30: Break
- 10:30-12:30: Audit Logs testing (B1-B8)
- 12:30-13:30: Lunch

**Afternoon Session (3 hours)**:
- 13:30-15:00: Assignments testing (D1-D10)
- 15:00-15:15: Break
- 15:15-16:45: Bulk Actions testing (H1-H8)

**Daily Target**: Complete Priority 1 (34 tests)  
**Expected**: ~30/34 pass

---

### Day 2 (Feb 14)

**Morning Session (3 hours)**:
- 9:00-11:00: Priority 2 testing (E, F, G, I)
- 11:00-11:15: Break
- 11:15-12:30: Priority 3 testing (J, K) or defect verification

**Afternoon Session (1 hour)**:
- 13:00-14:00: Final verification + QA sign-off

**Daily Target**: Complete Priority 2 + Priority 3 (46 tests)  
**Expected**: ~40/46 pass (Priority 3 optional)

---

## ✅ Final Sign-Off

Once testing complete:

```markdown
# QA Test Completion Report: PR #249

**Date**: 2026-02-14
**Tester**: [Your Name]
**Test Plan**: .docs/QA-PR249-TEST-PLAN.md
**Results**: [X]/80 pass

## Summary

**Priority 1**: [X]/34 pass - CRITICAL PATH
**Priority 2**: [X]/26 pass - IMPORTANT
**Priority 3**: [X]/20 pass - OPTIONAL

**Pass Rate**: [X]% (Target: ≥75/80 = 93%+)

## Defects Summary

**Critical**: 0 ❌
**High**: 0 ❌
**Medium**: 0 ❌
**Low**: 0 ❌

## Recommendation

✅ **READY FOR MERGE**
- All Priority 1 tests passed
- All Critical/High defects resolved
- PR quality verified

## Sign-Off

- QA Lead: [Name] ___________
- Date: 2026-02-14 ___________
- Approved for merge: ☑ YES ☐ NO
```

---

## 🔗 Quick Reference

**Key URLs**:
- Frontend: http://localhost:5173
- Backend: http://localhost:3000
- MailHog: http://localhost:8025

**Test Credentials**:
- super_admin@test.com / SuperAdmin123!
- admin@test.com / Admin123!
- manager@test.com / Manager123!
- user@test.com / User123!

**Key Files**:
- Test Plan: `.docs/QA-PR249-TEST-PLAN.md`
- Execution Log: `.docs/QA-EXECUTION-LOG.md`
- Setup Guide: `.docs/QA-SETUP-INSTRUCTIONS.md`
- This Workflow: `.docs/QA-TEST-EXECUTION-WORKFLOW.md`

---

**Status**: Ready for QA execution  
**Start Date**: Feb 13, 2026  
**Target Completion**: Feb 14, 2026  

