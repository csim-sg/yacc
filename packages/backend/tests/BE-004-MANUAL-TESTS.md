# BE-004 Password Reset - Manual Testing Guide

## Overview
This document provides manual test scenarios for the password reset functionality. These tests validate the security features, token handling, and end-to-end flows.

## Test Environment Setup

### Prerequisites
1. Backend running: `npm run dev` in `packages/backend/`
2. Database populated with test user
3. Postman or similar HTTP client
4. Console access to capture token from email logs

### Test User Credentials
- **Email**: `test@example.com`
- **Password**: `InitialPassword123!`
- **User ID**: Created during test

### Base URLs
- **Backend API**: `http://localhost:3000/api`
- **Frontend**: `http://localhost:5173` (if running)

---

## Scenario 1: Valid Password Reset Flow

### Objective
Complete a valid password reset from request to successful password change.

### Steps

#### 1.1 Request Password Reset
```
POST /api/auth/forgot-password
Content-Type: application/json

{
  "email": "test@example.com"
}
```

**Expected Response**:
```json
{
  "message": "If the email exists, a password reset link has been sent"
}
```

**Status**: ✅ 200 OK

#### 1.2 Capture Reset Token
1. Check backend console output for email logs
2. Look for pattern: `token:` followed by 64-character hex string
3. Example token output in console:
```
📧 EMAIL SERVICE (Console Transport - Phase 1)
============================================================
TO: test@example.com
SUBJECT: Reset Your YACC Password
...
Or copy this link:
http://localhost:3000/reset-password?token=abc123def456...xyz (64 hex chars)
```

#### 1.3 Reset Password with Token
```
POST /api/auth/reset-password
Content-Type: application/json

{
  "token": "abc123def456...xyz",
  "newPassword": "NewPassword123!"
}
```

**Expected Response**:
```json
{
  "success": true,
  "message": "Password reset successfully"
}
```

**Status**: ✅ 200 OK

#### 1.4 Verify Password Changed
1. Attempt login with old password:
```
POST /api/auth/sign-in/email
Content-Type: application/json

{
  "email": "test@example.com",
  "password": "InitialPassword123!"
}
```

**Expected**: ❌ 401 Unauthorized (old password no longer works)

2. Attempt login with new password:
```
POST /api/auth/sign-in/email
Content-Type: application/json

{
  "email": "test@example.com",
  "password": "NewPassword123!"
}
```

**Expected**: ✅ 200 OK (new password works)

### Assertion Checklist
- [ ] Forgot-password returns 200
- [ ] Token is 64 hex characters
- [ ] Reset-password returns success
- [ ] Old password no longer works
- [ ] New password allows login

---

## Scenario 2: Email Enumeration Prevention

### Objective
Verify that the API doesn't leak whether an email exists in the system.

### Steps

#### 2.1 Request for Existing Email
```
POST /api/auth/forgot-password
Content-Type: application/json

{
  "email": "test@example.com"
}
```

**Note**: Use a known existing email

**Response 1**:
```json
{
  "message": "If the email exists, a password reset link has been sent"
}
```

**Record**:
- Status: 200
- Response time: ___ ms
- Response headers: ___ 

#### 2.2 Request for Non-Existent Email
```
POST /api/auth/forgot-password
Content-Type: application/json

{
  "email": "nonexistent-user-9999@example.com"
}
```

**Note**: Use a randomly generated non-existent email

**Response 2**:
```json
{
  "message": "If the email exists, a password reset link has been sent"
}
```

**Record**:
- Status: 200
- Response time: ___ ms
- Response headers: ___

#### 2.3 Compare Responses
1. Response bodies are identical ✅
2. Response times are similar (no timing attack) ✅
3. HTTP status codes are identical (both 200) ✅
4. Response headers are identical ✅

#### 2.4 Error Message Analysis
Verify that error messages don't leak email existence:
- ❌ "Email not found"
- ❌ "Email already registered"
- ❌ "User does not exist"
- ✅ Generic "If the email exists..." message

### Assertion Checklist
- [ ] Existing email returns 200
- [ ] Non-existent email returns 200
- [ ] Response messages are identical
- [ ] No timing difference detected
- [ ] Error messages are generic

---

## Scenario 3: Token Expiration

### Objective
Verify that expired tokens are rejected.

### Steps

#### 3.1 Request Password Reset
```
POST /api/auth/forgot-password
Content-Type: application/json

{
  "email": "test@example.com"
}
```

**Note**: Capture the token from console

#### 3.2 Manually Expire Token (Database)
```sql
-- In your database client
UPDATE password_reset_tokens
SET expires_at = NOW() - INTERVAL '1 second'
WHERE user_id = 'test-user-id';
```

#### 3.3 Attempt Reset with Expired Token
```
POST /api/auth/reset-password
Content-Type: application/json

{
  "token": "abc123def456...xyz",
  "newPassword": "ExpiredTokenPassword123!"
}
```

**Expected Response**:
```json
{
  "error": "Invalid or expired token"
}
```

**Status**: ❌ 400 Bad Request

**Important**: Response should NOT say "token is expired" or "token has expired" (prevents enumeration)

#### 3.4 Natural Expiration Test (Optional - takes 1 hour)
1. Request password reset at time T
2. Wait 61 minutes
3. Try to use token
4. Verify same generic error message

### Assertion Checklist
- [ ] Expired token is rejected
- [ ] Response is generic error message
- [ ] No "expired" keyword in error
- [ ] Status is 400 (not 401 or 403)

---

## Scenario 4: Token Reuse Prevention

### Objective
Verify that tokens can only be used once.

### Steps

#### 4.1 Request Password Reset
```
POST /api/auth/forgot-password
Content-Type: application/json

{
  "email": "test@example.com"
}
```

**Capture token from console**

#### 4.2 First Password Reset (Success)
```
POST /api/auth/reset-password
Content-Type: application/json

{
  "token": "abc123def456...xyz",
  "newPassword": "FirstReset123!"
}
```

**Expected Response**:
```json
{
  "success": true,
  "message": "Password reset successfully"
}
```

**Status**: ✅ 200 OK

#### 4.3 Second Reset Attempt with Same Token
```
POST /api/auth/reset-password
Content-Type: application/json

{
  "token": "abc123def456...xyz",
  "newPassword": "SecondReset456!"
}
```

**Expected Response**:
```json
{
  "error": "Invalid or expired token"
}
```

**Status**: ❌ 400 Bad Request

**Important**: Response doesn't say "already used" (prevents enumeration)

#### 4.4 Verify First Password Still Works
```
POST /api/auth/sign-in/email
Content-Type: application/json

{
  "email": "test@example.com",
  "password": "FirstReset123!"
}
```

**Expected**: ✅ 200 OK (first password change was successful)

### Assertion Checklist
- [ ] First reset succeeds
- [ ] Second reset fails
- [ ] Error message is generic
- [ ] No "already used" message
- [ ] First password change is persistent

---

## Scenario 5: Password Requirements Validation

### Objective
Verify that password requirements are enforced.

### Steps

#### 5.1 Request Password Reset
```
POST /api/auth/forgot-password
Content-Type: application/json

{
  "email": "test@example.com"
}
```

**Capture token from console**

#### 5.2 Test: Too Short (< 8 characters)
```
POST /api/auth/reset-password
Content-Type: application/json

{
  "token": "abc123def456...xyz",
  "newPassword": "Pass1"
}
```

**Expected Response**:
```json
{
  "error": "Password must be at least 8 characters"
}
```

**Status**: ❌ 400 Bad Request

#### 5.3 Test: No Uppercase Letter
```
POST /api/auth/reset-password
Content-Type: application/json

{
  "token": "abc123def456...xyz",
  "newPassword": "password123"
}
```

**Expected Response**:
```json
{
  "error": "Password must contain at least 1 uppercase letter"
}
```

**Status**: ❌ 400 Bad Request

#### 5.4 Test: No Number
```
POST /api/auth/reset-password
Content-Type: application/json

{
  "token": "abc123def456...xyz",
  "newPassword": "PasswordWithout"
}
```

**Expected Response**:
```json
{
  "error": "Password must contain at least 1 number"
}
```

**Status**: ❌ 400 Bad Request

#### 5.5 Test: Valid Password
```
POST /api/auth/reset-password
Content-Type: application/json

{
  "token": "abc123def456...xyz",
  "newPassword": "ValidPassword123"
}
```

**Expected Response**:
```json
{
  "success": true,
  "message": "Password reset successfully"
}
```

**Status**: ✅ 200 OK

### Assertion Checklist
- [ ] 7-char password rejected
- [ ] Lowercase-only rejected
- [ ] Digit-free rejected
- [ ] Error messages specific
- [ ] Valid password accepted

---

## Scenario 6: Invalid Token Variations

### Objective
Verify that various invalid token formats are rejected appropriately.

### Steps

#### 6.1 Test: Token Too Short
```
POST /api/auth/reset-password
Content-Type: application/json

{
  "token": "abc123",
  "newPassword": "ValidPassword123"
}
```

**Expected Response**:
```json
{
  "error": "Invalid or expired token"
}
```

**Status**: ❌ 400 Bad Request

#### 6.2 Test: Non-Hex Characters
```
POST /api/auth/reset-password
Content-Type: application/json

{
  "token": "zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz",
  "newPassword": "ValidPassword123"
}
```

**Expected Response**:
```json
{
  "error": "Invalid or expired token"
}
```

**Status**: ❌ 400 Bad Request

#### 6.3 Test: Random 64-Hex Token (Doesn't Exist)
```
POST /api/auth/reset-password
Content-Type: application/json

{
  "token": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "newPassword": "ValidPassword123"
}
```

**Expected Response**:
```json
{
  "error": "Invalid or expired token"
}
```

**Status**: ❌ 400 Bad Request

#### 6.4 Test: Empty Token
```
POST /api/auth/reset-password
Content-Type: application/json

{
  "token": "",
  "newPassword": "ValidPassword123"
}
```

**Expected Response**:
```json
{
  "error": "Invalid or expired token"
}
```

**Status**: ❌ 400 Bad Request

#### 6.5 Test: Missing Token Field
```
POST /api/auth/reset-password
Content-Type: application/json

{
  "newPassword": "ValidPassword123"
}
```

**Expected Response**:
```json
{
  "error": "Invalid or expired token"
}
```

**Status**: ❌ 400 Bad Request

### Assertion Checklist
- [ ] Short token rejected
- [ ] Non-hex rejected
- [ ] Random token rejected
- [ ] Empty token rejected
- [ ] Missing token rejected
- [ ] All errors generic

---

## Scenario 7: Email Sending Verification

### Objective
Verify that emails are sent correctly (console logs in Phase 1).

### Steps

#### 7.1 Request Password Reset
```
POST /api/auth/forgot-password
Content-Type: application/json

{
  "email": "test@example.com"
}
```

#### 7.2 Check Console Output
Look for email output in backend console:

```
📧 EMAIL SERVICE (Console Transport - Phase 1)
============================================================
TO: test@example.com
SUBJECT: Reset Your YACC Password
────────────────────────────────────────────────────────
HTML BODY:
[HTML content with reset link and button]
────────────────────────────────────────────────────────
TEXT BODY:
[Text content with reset link]
────────────────────────────────────────────────────────
============================================================
Note: Email logged to console (Phase 1). Real SMTP in Phase 2.
```

#### 7.3 Verify Email Contents
- [ ] "TO" field contains correct email
- [ ] "SUBJECT" is "Reset Your YACC Password"
- [ ] HTML body contains reset link with token
- [ ] Text body contains reset link
- [ ] Link includes full URL with token parameter
- [ ] Message states "valid for 1 hour"

#### 7.4 No Email for Non-Existent User
```
POST /api/auth/forgot-password
Content-Type: application/json

{
  "email": "nonexistent-user@example.com"
}
```

**Verify**: No email output in console for non-existent email

### Assertion Checklist
- [ ] Email sent for existing user
- [ ] Email content correct
- [ ] Reset link included
- [ ] Token correct
- [ ] No email for non-existent user

---

## Security Test Checklist

### Token Security
- [ ] Tokens are 64 hex characters
- [ ] Tokens are not stored raw (are hashed)
- [ ] Tokens expire after 60 minutes
- [ ] Tokens can only be used once
- [ ] Token validation uses timing-safe comparison
- [ ] Each user can only have one valid token at a time

### Password Security
- [ ] Passwords must be 8+ characters
- [ ] Passwords must contain uppercase letter
- [ ] Passwords must contain number
- [ ] Passwords are hashed before storage
- [ ] Old password no longer works after reset

### Email Security
- [ ] No email enumeration (same response for existing/non-existent)
- [ ] No timing attacks (response time similar)
- [ ] Generic error messages (no info leakage)
- [ ] Reset link only sent to existing users

### Error Handling
- [ ] Invalid token → generic error
- [ ] Expired token → generic error
- [ ] Used token → generic error
- [ ] Weak password → specific error with requirements
- [ ] Invalid email format → specific error

---

## Audit Logging Verification

### Objective
Verify that all password reset operations are logged.

### Steps

#### 7.1 Check Audit Logs in Database
```sql
SELECT * FROM audit_logs 
WHERE action LIKE 'password.%' 
ORDER BY created_at DESC 
LIMIT 10;
```

#### 7.2 Verify Log Entries
Should see three types of logs for a complete reset:

1. **Token Generation**:
   - Action: `password.reset_token_generated`
   - Entity Type: `conversation` (as per implementation)
   - Entity ID: User ID
   - Metadata: `{ "expiresAt": "ISO-8601-timestamp" }`

2. **Token Validation** (optional):
   - Action: `password.reset_token_validated`
   - Entity Type: `conversation`
   - Entity ID: User ID

3. **Password Reset Success**:
   - Action: `password.reset_successful`
   - Entity Type: `conversation`
   - Entity ID: User ID

### Assertion Checklist
- [ ] Token generation logged
- [ ] Token validation logged (if called separately)
- [ ] Password reset success logged
- [ ] All logs have user ID
- [ ] All logs have timestamp
- [ ] Correlation IDs present (if implemented)

---

## Performance Testing

### Objective
Verify response times and performance.

### Steps

#### 8.1 Forgot-Password Response Time
Measure response time for:
- Existing email
- Non-existent email
- Invalid email

Expected: < 100ms difference between existing and non-existent (no timing attack)

#### 8.2 Reset-Password Response Time
Measure response time for:
- Valid token
- Invalid token
- Expired token
- Used token

Expected: < 50ms difference (no timing information leak)

### Assertion Checklist
- [ ] Forgot-password: < 200ms
- [ ] Reset-password: < 200ms
- [ ] No timing differences > 100ms
- [ ] No timing attack vectors

---

## Database State Verification

### Objective
Verify database state after each operation.

### Steps

#### 9.1 Token Storage
```sql
SELECT * FROM password_reset_tokens 
WHERE user_id = 'test-user-id' 
ORDER BY created_at DESC;
```

Verify:
- [ ] Token field contains hash (starts with $2a$, $2b$, or $2y$)
- [ ] Token field never contains raw 64-char hex
- [ ] expires_at is 60 minutes from creation
- [ ] used_at is NULL until token is used
- [ ] used_at is set after successful reset
- [ ] Old tokens are deleted when new token generated

#### 9.2 User Password
```sql
SELECT id, email, password_hash, updated_at 
FROM users 
WHERE email = 'test@example.com';
```

Verify:
- [ ] password_hash is updated after reset
- [ ] password_hash is different from before reset
- [ ] password_hash is bcrypt hash (starts with $2a$, $2b$, or $2y$)
- [ ] updated_at timestamp reflects reset time

### Assertion Checklist
- [ ] Token properly hashed
- [ ] Token expiration correct
- [ ] Token marked as used
- [ ] Old tokens cleaned up
- [ ] Password hash updated
- [ ] User updated_at timestamp updated

---

## Regression Test Suite

### Quick Validation (< 10 minutes)
Run these tests to verify no regressions:

1. ✅ Scenario 1: Valid password reset flow
2. ✅ Scenario 2: Email enumeration prevention
3. ✅ Scenario 4: Token reuse prevention
4. ✅ Scenario 5: Password requirements

### Full Validation (30+ minutes)
Run all scenarios and checklist items.

---

## Issues & Notes

Document any issues found:

| Issue | Severity | Steps | Status |
|-------|----------|-------|--------|
| | | | |

---

## Sign-off

- [ ] All scenarios passing
- [ ] All assertions checked
- [ ] Security vulnerabilities: None found
- [ ] Performance acceptable
- [ ] Database state correct

**Tested by**: _______________  
**Date**: _______________  
**Notes**: _______________  

---

## Appendix: cURL Commands

For testing without Postman:

### Forgot Password
```bash
curl -X POST http://localhost:3000/api/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'
```

### Reset Password
```bash
curl -X POST http://localhost:3000/api/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{
    "token":"abc123def456...xyz",
    "newPassword":"NewPassword123!"
  }'
```

### Check Database
```bash
# PostgreSQL
psql -U postgres -h localhost -d yacc_dev \
  -c "SELECT * FROM password_reset_tokens ORDER BY created_at DESC LIMIT 5;"
```
