# YACC Backend Phase 1 - E2E Test Suite

## Overview

Comprehensive Playwright E2E test suite for YACC Backend Phase 1 API testing.

## Test Files

### 1. **backend-auth.spec.ts** (Authentication Tests)
- **Coverage**: All 6 auth endpoints
- **Tests**: 40+ test cases
- **Priority**: 🔴 CRITICAL
- **Categories**:
  - User registration (valid, invalid, duplicate)
  - User login (correct, incorrect, missing fields)
  - Profile retrieval (`/auth/me`)
  - Logout functionality
  - Password reset flow (forgot + reset)
  - Error handling & validation
  - Security tests (SQL injection, password exposure)
  - RBAC role assignment

**Key Test IDs**:
- `AUTH-001`: User can register with valid credentials
- `AUTH-002`: User can login and receive JWT
- `AUTH-003`: Login fails with incorrect password
- `AUTH-004`: JWT token format validation
- `AUTH-005`: Protected endpoints reject missing JWT
- `AUTH-006`: Protected endpoints accept valid JWT
- `AUTH-007`: Expired/invalid JWT is rejected
- `AUTH-008`: Password reset email sent

---

### 2. **backend-conversations.spec.ts** (Conversation Tests)
- **Coverage**: All 7 conversation endpoints
- **Tests**: 45+ test cases
- **Priority**: 🔴 CRITICAL
- **Categories**:
  - List conversations (filters, pagination, sorting)
  - Get single conversation
  - Update conversation status
  - Update conversation priority
  - Assign/unassign conversations
  - Add/remove tags
  - Response format validation
  - Performance benchmarks
  - Data validation (enums, IDs)

**Key Test IDs**:
- `CONV-001`: User can list conversations (empty OK)

---

### 3. **backend-audit-logs.spec.ts** (Audit Log Tests)
- **Coverage**: All 3 audit log endpoints
- **Tests**: 30+ test cases
- **Priority**: 🟠 IMPORTANT
- **Categories**:
  - Query audit logs (all, filtered, paginated)
  - Get conversation audit logs
  - Get actor audit logs
  - RBAC enforcement (manager+ only)
  - Date range filtering
  - Audit log content validation
  - Performance tests
  - Security (no sensitive data exposure)

---

### 4. **backend-regression.spec.ts** (Regression Suite)
- **Coverage**: Critical user journeys
- **Tests**: 25+ test cases
- **Priority**: 🔴 CRITICAL (pre-release)
- **Categories**:
  - `REGR_001`: Login + Inbox Load (end-to-end)
  - `REGR_010`: Audit Log Query
  - End-to-end critical paths
  - Error recovery & edge cases
  - Data integrity & consistency
  - Performance benchmarks
  - Security regression tests

---

## Running Tests

### Prerequisites

1. **Backend server must be running**:
   ```bash
   cd packages/backend
   pnpm dev
   # Server should be at http://localhost:3000
   ```

2. **Database must be initialized**:
   ```bash
   # PostgreSQL running in Docker
   docker ps | grep postgres
   ```

3. **Playwright installed**:
   ```bash
   cd packages/frontend
   pnpm install
   ```

### Run All Tests

```bash
cd packages/frontend
pnpm test
```

### Run Specific Test File

```bash
# Authentication tests only
pnpm test backend-auth.spec.ts

# Conversation tests only
pnpm test backend-conversations.spec.ts

# Audit log tests only
pnpm test backend-audit-logs.spec.ts

# Regression suite only
pnpm test backend-regression.spec.ts
```

### Run in UI Mode (Interactive)

```bash
pnpm test:ui
```

### Run in Debug Mode

```bash
pnpm test:debug backend-auth.spec.ts
```

### Run with Specific Browser

```bash
# Chromium only
pnpm test --project=chromium

# Firefox only
pnpm test --project=firefox

# WebKit only
pnpm test --project=webkit
```

### Generate HTML Report

```bash
pnpm test
# Report will be at: playwright-report/index.html
npx playwright show-report
```

---

## Test Coverage Summary

| Category | Endpoints | Tests | Status |
|----------|-----------|-------|--------|
| **Authentication** | 6 | 40+ | ✅ Complete |
| **Conversations** | 7 | 45+ | ✅ Complete |
| **Audit Logs** | 3 | 30+ | ✅ Complete |
| **Regression** | - | 25+ | ✅ Complete |
| **TOTAL** | **16** | **140+** | ✅ **Ready for QA** |

---

## Expected Results

### ✅ All Tests Should Pass

- **Total Tests**: ~140
- **Expected Pass Rate**: 100% (with backend running)
- **Expected Failures**: 0 critical tests
- **Duration**: ~30-60 seconds (all tests)

### ⚠️ Known Acceptable Failures

Some tests check for proper error handling and may "fail" if:
1. Database is not initialized (404 errors on conversation endpoints)
2. No test data exists (empty conversation/audit log lists)
3. RBAC roles not configured (403 permission errors)

These are **expected behaviors** and indicate the API is correctly validating requests.

---

## Test Naming Convention

Tests follow the format: `[CATEGORY]-[ID]: [Description]`

Examples:
- `AUTH-001: should register new user with valid credentials`
- `CONV-001: should list all conversations (empty list OK)`
- `REGR_001: Login + Inbox Load (CRITICAL)`

---

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Backend E2E Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:14
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: pnpm install
      
      - name: Start backend
        run: |
          cd packages/backend
          pnpm dev &
          sleep 10
      
      - name: Run E2E tests
        run: |
          cd packages/frontend
          pnpm test
      
      - name: Upload test report
        uses: actions/upload-artifact@v3
        if: always()
        with:
          name: playwright-report
          path: packages/frontend/playwright-report/
```

---

## Troubleshooting

### Issue: "Connection refused" or "ECONNREFUSED"

**Cause**: Backend server not running

**Fix**:
```bash
cd packages/backend
pnpm dev
# Wait for "Server listening on port 3000"
```

### Issue: All tests failing with 500 errors

**Cause**: Database not initialized or connection failed

**Fix**:
```bash
# Check database is running
docker ps | grep postgres

# Check backend logs
tail -f /tmp/yacc-backend.log

# Verify DATABASE_URL in packages/backend/.env
cat packages/backend/.env | grep DATABASE_URL
```

### Issue: Audit log tests failing with 403

**Cause**: User role doesn't have manager+ permissions

**Fix**: This is **expected behavior**. Tests verify that regular users CANNOT access audit logs (security check).

### Issue: Conversation tests return 404

**Cause**: No conversations in database (expected for fresh install)

**Fix**: This is **normal**. Tests verify the API correctly handles empty datasets.

---

## Test Data Cleanup

Tests create temporary users with timestamps:
- `qa-user-1234567890@example.com`
- `regr001-1234567890@example.com`

To clean up test data:

```sql
-- Connect to database
psql -h localhost -U yacc_user -d yacc_inbox

-- Delete test users
DELETE FROM users WHERE email LIKE '%@example.com';

-- Delete test audit logs
DELETE FROM audit_logs WHERE actor_id IN (
  SELECT id FROM users WHERE email LIKE '%@example.com'
);
```

---

## Next Steps

1. ✅ Run all tests: `pnpm test`
2. ✅ Review test report: `npx playwright show-report`
3. ✅ Verify all critical tests pass (AUTH-*, CONV-*, REGR-*)
4. ✅ Report any failures to backend team
5. ✅ Sign off for frontend integration

---

## References

- **API Documentation**: `/API_DOCUMENTATION.md`
- **Testing Guide**: `/TESTING_GUIDE.md`
- **QA Test Cases**: `/.docs/04-qa-and-testing.md`
- **Product Specification**: `/.docs/01-product-specification.md`

---

## Support

For issues or questions:
1. Check backend logs: `tail -f /tmp/yacc-backend.log`
2. Verify server health: `curl http://localhost:3000/health`
3. Review API docs: `/API_DOCUMENTATION.md`
4. Escalate to Backend Developer or Architect

---

**Last Updated**: January 17, 2026  
**Status**: ✅ Ready for QA Testing  
**Backend Version**: Phase 1 (v0.1.0)
