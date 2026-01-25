# BE-004 Password Reset - Test Plan

## Overview
Comprehensive test plan for the forgot password and reset password functionality.

## Test Coverage
- **Service Layer**: `password-reset.service.ts`
- **Controller Layer**: `auth.controller.ts` (forgot-password, reset-password endpoints)
- **Types**: `password-reset.schema.ts` and `password-reset.types.ts`

## Unit Tests (Service Layer)

### Token Generation Tests
- [ ] Token format is 64-character hexadecimal string
- [ ] Token is hashed before storage (never stored raw)
- [ ] Expiration is set to 60 minutes from now
- [ ] Existing valid tokens for same user are deleted
- [ ] Audit log entry created for token generation

### Token Validation Tests
- [ ] Valid token returns correct user ID
- [ ] Invalid token format (wrong length) is rejected
- [ ] Invalid token format (non-hex characters) is rejected
- [ ] Expired token is rejected
- [ ] Already used token is rejected
- [ ] Non-existent token is rejected
- [ ] Timing-safe comparison (bcrypt) is used
- [ ] Audit log entry created for validation

### Password Reset Tests
- [ ] Password reset succeeds with valid token
- [ ] Token is marked as used after reset
- [ ] Password shorter than 8 characters is rejected
- [ ] Password without uppercase letter is rejected
- [ ] Password without number is rejected
- [ ] Invalid token is rejected
- [ ] Expired token is rejected
- [ ] Token reuse is prevented
- [ ] Audit log entry created for successful reset
- [ ] Token is NOT marked as used if validation fails

### Integration Tests (Service)
- [ ] Full password reset flow (generate → validate → reset)
- [ ] Multiple users can have separate tokens
- [ ] Token of one user cannot be used by another user

## Integration Tests (Controller Layer)

### Forgot-Password Endpoint Tests
**POST /api/auth/forgot-password**

- [ ] Valid email receives success response (200)
- [ ] Non-existent email receives same success response (200) - **prevents email enumeration**
- [ ] Invalid email format is rejected (400)
- [ ] Email is sent when user exists
- [ ] Email is NOT sent when user doesn't exist
- [ ] Response is identical for existing/non-existing emails
- [ ] No timing difference between existing/non-existing users
- [ ] Errors don't leak information about email existence

### Reset-Password Endpoint Tests
**POST /api/auth/reset-password**

- [ ] Valid token and password resets password (200)
- [ ] Invalid token returns generic error (400)
- [ ] Expired token returns generic error (400)
- [ ] Used token returns generic error (400)
- [ ] Weak password returns validation error (400)
- [ ] Response doesn't reveal why token is invalid
- [ ] Password format validation works correctly
- [ ] Token is consumed after successful reset

## Manual Testing Scenarios

### Scenario 1: Valid Password Reset Flow
1. Request forgot-password with existing user email
2. Capture token from console log
3. Request reset-password with valid token and new password
4. Verify password change by attempting login with new password
5. Verify old password no longer works

### Scenario 2: Email Enumeration Prevention
1. Request forgot-password with existing user email → response 200
2. Request forgot-password with non-existent email → response 200
3. Verify responses are identical (timing, body, headers)
4. Try multiple non-existent emails
5. Verify no timing side-channel leaks

### Scenario 3: Token Expiration
1. Request forgot-password
2. Capture token
3. Wait 61+ minutes
4. Attempt reset-password with expired token
5. Verify generic error message (doesn't say "expired")

### Scenario 4: Token Reuse Prevention
1. Request forgot-password
2. Capture token
3. Reset password with token (success)
4. Try to reset password again with same token
5. Verify generic error message

### Scenario 5: Password Requirements
1. Try reset-password with 7-character password → should fail
2. Try reset-password without uppercase → should fail
3. Try reset-password without number → should fail
4. Try reset-password with valid format → should succeed

### Scenario 6: Invalid Token Variations
1. Try reset-password with invalid format (too short) → generic error
2. Try reset-password with non-hex characters → generic error
3. Try reset-password with random 64-hex token → generic error
4. Verify all return generic error message

## Security Checks

### Email Enumeration Prevention
- [ ] Forgot-password returns 200 for existing and non-existing emails
- [ ] No timing difference between existing and non-existing emails
- [ ] Error messages don't reveal email status

### Token Security
- [ ] Raw tokens never stored in database
- [ ] Tokens use bcrypt hashing
- [ ] Token comparison is timing-safe
- [ ] Tokens expire after 60 minutes
- [ ] Tokens cannot be reused
- [ ] Each user can only have one valid token at a time

### Password Security
- [ ] Minimum 8 characters enforced
- [ ] At least one uppercase letter required
- [ ] At least one number required
- [ ] Passwords are hashed before storage

### Audit Logging
- [ ] Token generation logged
- [ ] Token validation logged
- [ ] Password reset success logged
- [ ] All logs include correlation ID
- [ ] All logs include timestamp

## Test Dependencies

### QA Agent Tasks
- Set up Jest configuration for unit tests
- Create automated test suite for service layer
- Create automated test suite for controller layer
- Create Postman collection for manual testing
- Generate test coverage report (target 85%+)

## Status
- Unit tests: **CREATED** (password-reset.service.test.ts)
- Integration tests: **PENDING** (requires Jest setup)
- Manual tests: **PENDING** (delegated to QA)
- Coverage: **PENDING** (requires test execution)

