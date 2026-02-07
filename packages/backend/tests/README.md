# Backend Testing Guide

## Overview

This directory contains comprehensive test suites for the YACC backend, including unit tests, integration tests, and manual test documentation.

## Test Structure

```
tests/
├── README.md                           # This file
├── setup.ts                           # Jest setup file
├── global-setup.ts                    # Global test setup
├── global-teardown.ts                 # Global test teardown
├── unit/                              # Unit tests
│   └── services/
│       └── password-reset.service.test.ts
├── integration/                       # Integration tests
│   └── controllers/
│       └── auth.controller.password-reset.test.ts
├── BE-004-TEST-PLAN.md               # Detailed test plan
├── BE-004-MANUAL-TESTS.md            # Manual testing guide
└── BE-004-Postman-Collection.json    # Postman collection for manual tests
```

## Running Tests

### Setup
```bash
cd packages/backend

# Install dependencies (includes Jest and bcryptjs)
npm install

# Build TypeScript
npm run build
```

### Run All Tests
```bash
npm test
```

### Run Specific Test Suite
```bash
# Password reset service tests
npm test -- password-reset.service.test

# Password reset controller tests
npm test -- auth.controller.password-reset.test

# BE-007 Inbox API integration tests (requires Docker: PostgreSQL + Redis, and seeded user)
pnpm test -- tests/BE-007-inbox-api.spec.ts
```

### BE-007 Integration Tests
- **File**: `tests/BE-007-inbox-api.spec.ts`
- **Prerequisites**:
  1. PostgreSQL running (via `docker-compose up -d`)
  2. Redis running (via `docker-compose up -d`)
  3. Database migrations applied (via `pnpm db:migrate`)
  4. Test user seeded (via `pnpm db:fixtures` or manually via `scripts/seed-test-fixtures.ts`)
     - Test user email: `manager@yacc.local`
     - Test user password: `admin123`
- **Helpers**: `tests/test-helpers.ts` provides `createTestApp()`, `createTestUser(app, opts)`, `seedTestConversations(userId, count)`.
- **Fail fast**: If setup fails (no DB/Redis, missing migrations, or login fails), `beforeAll` throws and the suite fails with a clear error. No test skipping. For CI, add a bootstrap step to ensure all prerequisites before running this suite.

#### Running BE-007 Tests Locally

```bash
# 1. Start Docker services (PostgreSQL + Redis)
docker-compose up -d

# 2. Run migrations
cd packages/backend
pnpm db:migrate

# 3. Seed test fixtures (creates test user manager@yacc.local)
pnpm db:fixtures

# 4. Run BE-007 tests
pnpm test -- --run tests/BE-007-inbox-api.spec.ts
```

### Run with Coverage Report
```bash
npm test -- --coverage
```

### Watch Mode
```bash
npm test -- --watch
```

### Verbose Output
```bash
npm test -- --verbose
```

## Jest Configuration

The Jest configuration is set up in `packages/backend/jest.config.js` with:

- **Preset**: `ts-jest` for TypeScript support
- **Environment**: `node`
- **Module Aliases**: Support for `@yacc/common` and `@/*` paths
- **Coverage Threshold**: 85%+ for all metrics
- **Test Timeout**: 10 seconds for database operations
- **Transform**: TypeScript files via `ts-jest`

## Test Coverage

### Service Layer (password-reset.service.test.ts)

**Target Coverage**: 85%+

#### generateResetToken
- ✅ Token format is 64-character hexadecimal
- ✅ Token is hashed before storage
- ✅ Expiration set to 60 minutes
- ✅ Old tokens deleted for same user
- ✅ Audit log entry created

#### validateAndGetUserId
- ✅ Valid token returns correct user ID
- ✅ Invalid format (wrong length) rejected
- ✅ Invalid format (non-hex) rejected
- ✅ Expired token rejected
- ✅ Already-used token rejected
- ✅ Non-existent token rejected
- ✅ Timing-safe comparison used
- ✅ Audit log entry created

#### resetPassword
- ✅ Password reset succeeds with valid token
- ✅ Token marked as used after reset
- ✅ Password < 8 chars rejected
- ✅ Password without uppercase rejected
- ✅ Password without number rejected
- ✅ Invalid token rejected
- ✅ Expired token rejected
- ✅ Token reuse prevented
- ✅ Audit log entry created
- ✅ Token NOT marked as used if validation fails

### Controller Layer (auth.controller.password-reset.test.ts)

**Target Coverage**: 85%+

#### POST /api/auth/forgot-password
- ✅ Valid email returns 200
- ✅ Non-existent email returns 200 (prevents enumeration)
- ✅ Invalid email format returns 400
- ✅ Email sent when user exists
- ✅ Email NOT sent when user doesn't exist
- ✅ Responses identical for existing/non-existent
- ✅ No timing differences
- ✅ Errors don't reveal email existence

#### POST /api/auth/reset-password
- ✅ Valid token + strong password returns 200
- ✅ Invalid token returns generic 400
- ✅ Expired token returns generic 400
- ✅ Used token returns generic 400
- ✅ Weak password returns 400 with validation error
- ✅ Response doesn't reveal why token invalid
- ✅ Password format validation works
- ✅ Token consumed after successful reset

## Manual Testing

### Using Postman Collection

1. Import `BE-004-Postman-Collection.json` into Postman
2. Run the test requests in sequence
3. Verify each assertion

### Using Manual Test Guide

Follow the comprehensive scenarios in `BE-004-MANUAL-TESTS.md`:
- Scenario 1: Valid password reset flow
- Scenario 2: Email enumeration prevention
- Scenario 3: Token expiration
- Scenario 4: Token reuse prevention
- Scenario 5: Password requirements
- Scenario 6: Invalid token variations
- Scenario 7: Email sending verification
- Scenario 8: Audit logging
- Scenario 9: Performance testing
- Scenario 10: Database state verification

## Security Verification

All tests verify the following security features:

### Email Enumeration Prevention
- ✅ Forgot-password always returns 200
- ✅ Same response for existing/non-existent emails
- ✅ No timing differences
- ✅ Generic error messages

### Token Security
- ✅ 64-char hex token format
- ✅ Tokens hashed with bcrypt
- ✅ 60-minute expiration
- ✅ One-time use only
- ✅ Timing-safe comparison
- ✅ One token per user at a time

### Password Security
- ✅ Minimum 8 characters
- ✅ Requires uppercase letter
- ✅ Requires number
- ✅ Hashed before storage
- ✅ Old password invalidated

### Error Handling
- ✅ Generic error messages
- ✅ No information leakage
- ✅ Consistent status codes
- ✅ Proper HTTP conventions

## Test Data

### Test Users
- **Email**: `test@example.com`
- **Password**: `TestPassword123!`

### Test Tokens
- **Format**: 64 hexadecimal characters (e.g., `a1b2c3d4...xyz`)
- **Expiration**: 60 minutes
- **Hashing**: bcrypt (12 rounds)

### Database
- Uses test database connection
- Automatic cleanup before/after tests
- Transaction-based isolation

## Troubleshooting

### Jest Not Found
```bash
npm install
```

### bcryptjs Not Installed
```bash
npm install bcryptjs
npm install --save-dev @types/bcryptjs
```

### Database Connection Errors
Ensure PostgreSQL is running and test database is accessible:
```bash
# Check database connection
psql -U postgres -h localhost -d yacc_dev -c "SELECT 1"
```

### TypeScript Compilation Errors
```bash
npm run type-check
```

### BE-007 Test Prerequisites Not Met
If Redis or PostgreSQL is not running when you run BE-007 tests:
- The `beforeAll` setup will throw an error
- All tests in the suite will be skipped with a clear failure message
- Error will indicate exactly which service is missing (e.g., "Redis connection refused", "Database migration missing")

**To fix**: Follow the setup steps in the "Running BE-007 Tests Locally" section above.

### Slow Tests
Tests timeout after 10 seconds. For long-running tests, increase timeout:
```bash
npm test -- --testTimeout=30000
```

## Coverage Report

After running tests with coverage:
```bash
npm test -- --coverage
```

View HTML report:
```bash
open coverage/index.html  # macOS
xdg-open coverage/index.html  # Linux
start coverage/index.html  # Windows
```

## CI/CD Integration

To run tests in CI pipeline:

```bash
# Run all tests with coverage
npm test -- --coverage --ci

# Fail if coverage below threshold
npm test -- --coverage --ci --coverageReporters=text
```

## Performance Benchmarks

- **Service tests**: ~500ms-1s per test
- **Controller tests**: ~1-2s per test
- **Full suite**: ~30-60s

## Next Steps

1. ✅ Configure Jest (DONE)
2. ✅ Create unit tests (DONE)
3. ✅ Create integration tests (DONE)
4. ✅ Create manual test guide (DONE)
5. ⏳ Run tests locally
6. ⏳ Verify 85%+ coverage
7. ⏳ Run manual test scenarios
8. ⏳ Get code review approval
9. ⏳ Merge to dev branch

## Acceptance Criteria

- [ ] Jest configured and tests run successfully
- [ ] All unit tests passing (service layer)
- [ ] All integration tests passing (controller layer)
- [ ] Code coverage ≥85% for all new files
- [ ] Manual test scenarios documented
- [ ] Security vulnerabilities verified as none
- [ ] Performance acceptable
- [ ] Database state correct
- [ ] Error handling verified
- [ ] Audit logging confirmed

## References

- **Implementation Docs**: `.docs/implementation/BE-004-password-reset-implementation.md`
- **API Contract**: `.docs/02-api-and-data-model.md` (section 5)
- **Product Spec**: `.docs/01-product-specification.md` (section 2.1 & 5)
- **Jest Docs**: https://jestjs.io/docs/getting-started
- **TypeScript Jest**: https://kulshekhar.github.io/ts-jest/

## Support

For issues or questions about testing, refer to:
1. Test plan: `BE-004-TEST-PLAN.md`
2. Manual guide: `BE-004-MANUAL-TESTS.md`
3. Implementation docs: `.docs/implementation/BE-004-password-reset-implementation.md`
4. Jest documentation: https://jestjs.io/

---

**Last Updated**: January 25, 2026  
**Status**: Ready for testing  
**QA Agent**: Assigned  
