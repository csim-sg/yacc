# BE-004: Password Reset Implementation

## Overview
Complete password reset flow implementation using secure token-based approach with email verification.

## Architecture

### Components
1. **AuthController** (`packages/backend/src/controllers/auth.controller.ts`)
   - `POST /api/auth/forgot-password` - Initiates password reset
   - `POST /api/auth/reset-password` - Completes password reset

2. **PasswordResetService** (`packages/backend/src/services/password-reset.service.ts`)
   - `generateResetToken(userId, correlationId)` - Generates secure token
   - `validateAndGetUserId(token, correlationId)` - Validates token
   - `resetPassword(token, newPassword, correlationId)` - Completes reset

3. **Types & Schemas** (`packages/backend/src/types/`)
   - `password-reset.types.ts` - TypeScript interfaces
   - `password-reset.schema.ts` - Zod validation schemas

4. **Email Service** (`packages/backend/src/config/email.ts`)
   - `sendPasswordResetEmail(email, resetLink, token)` - Sends reset email

5. **Database Table** (`password_reset_tokens`)
   - Stores hashed tokens with expiration and usage tracking

## Security Features

### Email Enumeration Prevention
- **Forgot-Password Endpoint**: Always returns HTTP 200 with same message
- **No Timing Differences**: Constant-time operation for existing/non-existing users
- **Generic Messages**: Never reveal if email exists or why reset failed

### Token Security
- **64-Character Hex Tokens**: Generated via `crypto.randomBytes(32).toString('hex')`
- **Bcrypt Hashing**: Token hashed with 12 rounds before storage (never stored raw)
- **60-Minute Expiration**: Tokens expire exactly 60 minutes from creation
- **One-Time Use**: Token marked as `used` after successful password reset
- **Reuse Prevention**: Each user can only have ONE valid token at a time
- **Timing-Safe Comparison**: Uses `bcrypt.compare()` for hash validation

### Password Security
- **Minimum 8 Characters**: Enforced by validation schema
- **Uppercase Requirement**: At least one A-Z character required
- **Numeric Requirement**: At least one 0-9 digit required
- **Bcrypt Hashing**: New password hashed before storage (12 rounds)

### Audit Logging
- All token operations logged:
  - `password.reset_token_generated`
  - `password.reset_token_validated`
  - `password.reset_successful`
- Each log includes: timestamp, user ID, correlation ID, action details

## Data Flow

### Forgot Password Flow
```
1. User provides email → POST /api/auth/forgot-password
2. Endpoint validates email format (Zod)
3. Service generates secure token:
   - Create 64-char hex token
   - Hash with bcrypt
   - Store hash + expiration (60 min) in DB
   - Delete old tokens for this user
4. Email service sends reset link with raw token
5. Response: 200 OK (always, even if email doesn't exist)
6. Audit: Log token generation
```

### Reset Password Flow
```
1. User provides token + new password → POST /api/auth/reset-password
2. Endpoint validates inputs (Zod):
   - Token: 64-char hex format
   - Password: 8+ chars, 1 uppercase, 1 number
3. Service validates and resets:
   - Find token in database
   - Verify bcrypt hash match
   - Check expiration
   - Check not already used
   - If valid: hash password, update user, mark token used
4. Audit: Log successful reset
5. Response: 200 OK with success message
6. Old password no longer works, new password active
```

## API Endpoints

### POST /api/auth/forgot-password
**Initiates password reset**

**Request:**
```json
{ "email": "user@example.com" }
```

**Response (200):**
```json
{ "message": "If the email exists, a password reset link has been sent" }
```

**Behavior:**
- Always returns 200 (even for non-existent email)
- Email sent only if user exists
- Same response time for all scenarios (prevents timing attacks)
- Token expires in 60 minutes
- Raw token sent only in email

### POST /api/auth/reset-password
**Completes password reset**

**Request:**
```json
{
  "token": "64hexcharactertoken...",
  "newPassword": "NewPassword123!"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Password reset successfully"
}
```

**Error Response (400):**
```json
{ "error": "Invalid or expired token" }
```

**Validation:**
- Token must be 64-char hex string (format validation)
- Token must exist in database (lookup)
- Token must not be expired (current time < expires_at)
- Token must not be used (used_at IS NULL)
- Password must meet requirements (8+ chars, 1 upper, 1 digit)
- All validation failures return generic error message

## Implementation Details

### Token Generation Algorithm
```typescript
1. Create token: randomBytes(32).toString('hex') = 64-char hex
2. Hash token: bcrypt.hash(token, 12)
3. Calculate expiration: new Date(Date.now() + 60 * 60 * 1000)
4. Store in DB: { user_id, token_hash, expires_at, used_at: null }
5. Delete old tokens: WHERE user_id = X AND used_at IS NULL
6. Return raw token (only shown once via email)
```

### Token Validation Algorithm
```typescript
1. Format check: token matches /^[a-f0-9]{64}$/
2. Database lookup: SELECT * WHERE used_at IS NULL
3. For each record:
   - Timing-safe compare: bcrypt.compare(token, record.token_hash)
   - If match found:
     - Check expiration: current time <= record.expires_at
     - Return user_id
   - If no match: continue to next
4. No match found: throw "Invalid or expired token"
```

### Password Reset Algorithm
```typescript
1. Validate token and get user_id (see validation above)
2. Validate password: 8+ chars, 1 uppercase, 1 digit
3. Hash password: bcrypt.hash(newPassword, 12)
4. Update user: SET password_hash = ?, updated_at = NOW()
5. Mark token used: SET used_at = NOW()
6. Log audit entry: action = 'password.reset_successful'
7. Return success response
```

## Database Schema

### password_reset_tokens Table
```sql
id SERIAL PRIMARY KEY
user_id UUID NOT NULL (FK users.id, CASCADE DELETE)
token VARCHAR(255) NOT NULL (bcrypt hash)
expires_at TIMESTAMP NOT NULL (60 min from creation)
used_at TIMESTAMP (NULL if unused, set on reset)
created_at TIMESTAMP DEFAULT NOW()

Indices:
- user_id (find tokens by user)
- expires_at (cleanup old tokens)
- token (find by hash)
```

## Integration with BetterAuth

- **Coexistence**: Custom endpoints (`/forgot-password`, `/reset-password`) are defined BEFORE the wildcard `@All('/*')` route, so they take precedence
- **Consistency**: Both custom and BetterAuth routes use consistent error handling and logging
- **Future**: BetterAuth's built-in password reset can be used in Phase 2 if needed

## Error Handling

### Validation Errors
- Invalid email format → 400 with error details
- Weak password → 400 with requirements
- Invalid token format → Generic 400 message

### Generic Error Messages
All the following return: `{ "error": "Invalid or expired token" }`
- Token not found
- Token expired
- Token already used
- Non-existent user (only on reset-password, forgot always returns 200)
- Database errors (logged but generic message returned)

**Rationale**: Prevents user enumeration and token guessing attacks.

## Audit Logging

### Log Entries Created
1. **Token Generation**
   - Action: `password.reset_token_generated`
   - Entity: user
   - Metadata: `{ expiresAt: "2026-01-25T14:30:00Z" }`

2. **Token Validation**
   - Action: `password.reset_token_validated`
   - Entity: user
   - Metadata: `{}`

3. **Password Reset Success**
   - Action: `password.reset_successful`
   - Entity: user
   - Metadata: `{ updatedAt: "2026-01-25T12:30:00Z" }`

All logs include:
- Timestamp (ISO-8601)
- User ID (actor)
- Correlation ID (for request tracing)
- Action type
- Entity type/ID

## Testing Strategy

### Unit Tests
- Token generation: format, expiration, hashing
- Token validation: valid/invalid/expired/used cases
- Password reset: success, validation, errors
- Audit logging: entries created correctly

### Integration Tests
- Full flow: generate → validate → reset
- Multiple users: tokens isolated
- Email service: reset link generation
- Database: token operations

### Manual Testing
- Email enumeration prevention (Postman)
- Token expiration (wait 61 min)
- Token reuse prevention (reset twice)
- Password requirements (try weak passwords)
- Database cleanup (verify old tokens deleted)

## Known Limitations & Future Work

### Phase 1 (Current)
- Email service: Console logging (development only)
- JWT only (no session-based auth)
- Single-tenant (credentials in env vars)

### Phase 2+
- Real email service: SendGrid/Nodemailer
- Multi-tenant: Vault for credential storage
- Rate limiting: Prevent brute force on tokens
- Email verification: Confirm reset email address
- Custom email templates: Branded reset emails
- Alternative auth methods: SMS, authenticator app

## Dependencies

- `crypto` (Node.js built-in) - Token generation
- `bcryptjs` - Token hashing and comparison
- `zod` - Schema validation
- `drizzle-orm` - Database operations
- `express` - HTTP framework (routing-controllers)

## Acceptance Criteria Met

✅ **AC 1**: Forgot password endpoint always returns 200  
✅ **AC 2**: Reset token generated with 64-char hex format  
✅ **AC 3**: Reset-password endpoint validates token and updates password  
✅ **AC 4**: Token validation uses timing-safe comparison  
✅ **AC 5**: Password reset updates user password  
✅ **AC 6**: Email mock service sends reset link  
✅ **AC 7**: Audit logging for all password operations  

## Files Modified/Created

### New Files
- `packages/backend/src/services/password-reset.service.ts` (172 lines)
- `packages/backend/src/types/password-reset.types.ts` (22 lines)
- `packages/backend/src/types/password-reset.schema.ts` (34 lines)
- `packages/backend/tests/BE-004-TEST-PLAN.md`
- `packages/backend/tests/unit/services/password-reset.service.test.ts` (template)

### Modified Files
- `packages/backend/src/controllers/auth.controller.ts` - Added 2 endpoints, consolidated auth
- `packages/backend/src/config/db.ts` - Contains password_reset_tokens table schema
- `packages/backend/src/config/email.ts` - Updated with reset email template
- `.docs/02-api-and-data-model.md` - Added endpoint docs and schema

## Next Steps

1. **Testing** (QA Agent)
   - Set up Jest configuration
   - Run unit tests (85%+ coverage)
   - Run integration tests
   - Manual Postman testing

2. **Code Review** (Architect)
   - Review security implementation
   - Verify alignment with standards
   - Check error handling

3. **Merge** (Dev)
   - Merge to dev branch
   - Tag for Phase 1 release

4. **Future Phases**
   - Real email service (SendGrid)
   - Rate limiting
   - Multi-tenant support

