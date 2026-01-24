# Week 1 Product Owner Review - Detailed Findings

**Date:** 2026-01-24  
**Reviewed by:** Product Owner  
**Developer:** Fullstack Developer  
**Status:** ✅ APPROVED with clarifications  

---

## Executive Summary

Product Owner reviewed 7 tasks initially marked "Ready" for Week 1 development. After thorough analysis, **4 tasks were approved** for immediate development, **3 tasks were deferred** to backlog due to dependency issues.

**Key Finding:** BE-026 (Environment Configuration) deferral created a blocking chain affecting BE-020 (R2 Storage) and BE-025 (Email Service).

---

## Task Status Review Results

### ✅ APPROVED FOR WEEK 1 (4 Tasks)

| Task ID | Issue # | Title | Priority | Estimated Hours |
|---------|---------|-------|----------|-----------------|
| BE-027 | #107 | Set up structured logging infrastructure | P0 | 6h |
| BE-003 | #18 | Implement BetterAuth for authentication | P0 | 10h |
| BE-005 | #20 | Implement RBAC middleware | P0 | 6h |
| BE-004 | #19 | Implement forgot password flow | P1 | 6h |

**Total Estimated Effort:** 28 hours (3.5 days at 8h/day)

---

### 📦 DEFERRED TO BACKLOG (3 Tasks)

| Task ID | Issue # | Title | Reason | Impact |
|---------|---------|-------|--------|--------|
| BE-026 | #108 | Create environment configuration scaffolding | Strategic deferral per GOV-002 | Blocks BE-025, BE-020 |
| BE-020 | #106 | Set up Cloudflare R2 storage | Depends on BE-026 | No attachment support Week 1 |
| BE-025 | #105 | Set up email service (Nodemailer/SendGrid) | Depends on BE-026 | Email mocked via console.log |

**Deferral Decision:** Governance decision GOV-002 moved environment configuration to backlog to reduce Week 1 scope and focus on core authentication/authorization.

---

## Approved Execution Order

### Phase A: Foundation (Day 1-2)

```
BE-027: Structured Logging Infrastructure (6h)
├── Reason: Needed for all subsequent features
├── Deliverables:
│   ├── Pino logger configuration
│   ├── Correlation ID middleware
│   ├── Request logging middleware
│   └── Audit logger service
└── Dependencies: None
```

### Phase B: Authentication & Authorization (Day 3-4)

```
BE-003: BetterAuth Implementation (10h)
├── Endpoints:
│   ├── POST /api/auth/login
│   ├── POST /api/auth/logout
│   └── JWT/session management
├── Dependencies: BE-027 (for auth event logging)
└── Can run PARALLEL with BE-005

BE-005: RBAC Middleware (6h)
├── Decorators:
│   ├── @RequireRole('admin')
│   ├── @RequireRole(['admin', 'super_admin'])
│   └── @RequirePermission('conversations.assign')
├── Dependencies: BE-002 (Done), BE-003 (parallel start OK)
└── Can run PARALLEL with BE-003
```

### Phase C: Password Recovery (Day 5)

```
BE-004: Forgot Password Flow (6h)
├── Endpoints:
│   ├── POST /api/auth/forgot-password
│   └── POST /api/auth/reset-password
├── Dependencies: BE-003 (MUST complete first)
└── Workaround: Console.log email (no BE-025)
```

### Optional: WebSocket (Day 5+)

```
BE-016: Socket.io WebSocket Server (8h)
├── Events: message.received, message.sent, message.failed
├── Dependencies: BE-003 (for JWT auth)
└── Recommendation: DEFER to Week 2 Day 1
```

---

## Detailed Acceptance Criteria Clarifications

### 1. BE-003: BetterAuth Authentication (#18)

#### Required Endpoints

**POST /api/auth/login**
```json
// Request
{
  "email": "user@example.com",
  "password": "password123"
}

// Response Success (200)
{
  "user": {
    "id": "uuid-string",
    "email": "user@example.com",
    "role": "admin",
    "status": "active"
  },
  "accessToken": "jwt-access-token",
  "refreshToken": "jwt-refresh-token"
}

// Response Error - Invalid Credentials (401)
{
  "error": "Invalid credentials"
}

// Response Error - Disabled Account (403)
{
  "error": "Account is disabled"
}
```

**POST /api/auth/logout**
```json
// Request
// Headers: Authorization: Bearer {accessToken}

// Response Success (204)
// No content

// Response Error - Unauthorized (401)
{
  "error": "Unauthorized"
}
```

#### Token Configuration

| Setting | Value | Environment Variable |
|---------|-------|---------------------|
| Access Token TTL | 48 hours | `ACCESS_TOKEN_TTL_HOURS=48` |
| Refresh Token TTL | 30 days | `REFRESH_TOKEN_TTL_DAYS=30` |
| Password Hashing | argon2id | (BetterAuth default) |

#### User Status Rules

| User Status | Login Behavior | HTTP Status | Error Message |
|-------------|---------------|-------------|---------------|
| `active` | Login succeeds | 200 | N/A |
| `disabled` | Login rejected | 403 | "Account is disabled" |
| User not found | Login rejected | 401 | "Invalid credentials" |
| Wrong password | Login rejected | 401 | "Invalid credentials" |

#### Security Requirements

1. **Password Validation** (NOT enforced in login, only in registration/reset):
   - Minimum 8 characters
   - At least 1 uppercase letter
   - At least 1 number
   - Special characters optional

2. **Rate Limiting** (deferred to Phase 2):
   - 5 failed login attempts → 15-minute lockout
   - Implement in BE-006 (User Management)

3. **Session Management**:
   - JWT stored in HTTP-only cookies (BetterAuth default)
   - Refresh token rotation on access token renewal

---

### 2. BE-004: Forgot Password Flow (#19)

#### Required Endpoints

**POST /api/auth/forgot-password**
```json
// Request
{
  "email": "user@example.com"
}

// Response (ALWAYS 200 - prevent email enumeration)
{
  "message": "If the email exists, a password reset link has been sent"
}

// Behavior:
// 1. Check if email exists in database
// 2. Generate reset token: crypto.randomBytes(32).toString('hex')
// 3. Store token with 60-minute expiry
// 4. WEEK 1 WORKAROUND: Log to console
//    console.log(`[EMAIL MOCK] Reset link: ${FRONTEND_URL}/reset-password?token=${token}`)
// 5. FUTURE (BE-025 unblocked): Send actual email
```

**POST /api/auth/reset-password**
```json
// Request
{
  "token": "64-char-hex-string",
  "newPassword": "NewPassword123"
}

// Response Success (200)
{
  "message": "Password updated successfully"
}

// Response Error - Invalid/Expired Token (400)
{
  "error": "Invalid or expired reset token"
}

// Response Error - Password Validation Failed (400)
{
  "error": "Password must be at least 8 characters with 1 uppercase and 1 number"
}
```

#### Token Management

| Aspect | Implementation |
|--------|---------------|
| **Generation** | `crypto.randomBytes(32).toString('hex')` (64 hex chars) |
| **Storage** | Database table `password_reset_tokens` |
| **TTL** | 60 minutes from creation |
| **One-time use** | Delete token immediately after successful reset |
| **Cleanup** | Scheduled job to delete expired tokens (>60min old) |

#### Database Schema (if not exists)

```sql
CREATE TABLE password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(64) NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_reset_token ON password_reset_tokens(token);
CREATE INDEX idx_reset_expiry ON password_reset_tokens(expires_at);
```

#### Email Template (DEFERRED - Console.log for Week 1)

**Subject:** Reset Your YACC Password

**WEEK 1 Implementation:**
```typescript
console.log(`
========================================
PASSWORD RESET REQUEST
========================================
User: ${user.email}
Reset Link: ${process.env.FRONTEND_URL}/reset-password?token=${token}
Expires: ${expiresAt.toISOString()} (60 minutes)
========================================
`);
```

**FUTURE Implementation (when BE-025 unblocked):**
```html
<!DOCTYPE html>
<html>
<head><title>Reset Your Password</title></head>
<body>
  <h2>Password Reset Request</h2>
  <p>Hi {{user.email}},</p>
  <p>You requested to reset your password. Click the link below:</p>
  <a href="{{resetUrl}}">Reset Password</a>
  <p>This link expires in 60 minutes.</p>
  <p>If you didn't request this, ignore this email.</p>
</body>
</html>
```

---

### 3. BE-005: RBAC Middleware (#20)

#### Permission Matrix (Comprehensive)

| Feature / Action | Super Admin | Admin | Manager | User |
|------------------|-------------|-------|---------|------|
| **Authentication** |
| Login / Logout | ✅ | ✅ | ✅ | ✅ |
| **Inbox Operations** |
| View all conversations | ✅ | ✅ | ✅ | ❌ (assigned only) |
| View conversation details | ✅ | ✅ | ✅ | ✅ (assigned only) |
| Search conversations | ✅ | ✅ | ✅ | ✅ (assigned only) |
| Filter conversations | ✅ | ✅ | ✅ | ✅ (assigned only) |
| **Messaging** |
| Send messages | ✅ | ✅ | ✅ | ✅ (assigned only) |
| View message history | ✅ | ✅ | ✅ | ✅ (assigned only) |
| Retry failed messages | ✅ | ✅ | ✅ | ❌ |
| **Collaboration** |
| Assign conversations | ✅ | ✅ | ✅ | ❌ |
| Reassign conversations | ✅ | ✅ | ✅ | ❌ |
| Create tags | ✅ | ✅ | ✅ | ✅ |
| Apply tags | ✅ | ✅ | ✅ | ✅ |
| Add notes | ✅ | ✅ | ✅ | ✅ |
| @mention in notes | ✅ | ✅ | ✅ | ✅ |
| Change conversation priority | ✅ | ✅ | ✅ | ❌ |
| Change conversation status | ✅ | ✅ | ✅ | ✅ (assigned only) |
| **Admin Panel** |
| Manage users (CRUD) | ✅ | ❌ | ❌ | ❌ |
| Manage roles | ✅ | ❌ | ❌ | ❌ |
| Manage integrations | ✅ | ❌ | ❌ | ❌ |
| Configure routing rules | ✅ | ❌ | ❌ | ❌ |
| **Audit & Monitoring** |
| View audit logs | ✅ | ✅ | ✅ | ❌ |
| Export audit logs | ✅ | ✅ | ✅ | ❌ |
| View raw payloads | ✅ | ✅ | ✅ | ❌ |
| Download raw payloads | ✅ | ✅ | ✅ | ❌ |

#### Implementation Requirements

**1. Decorator-Based Authorization**

```typescript
// Required decorators to create:

// Single role check
@RequireRole('super_admin')
async deleteUser(@Param('id') id: string) { ... }

// Multiple roles (OR logic)
@RequireRole(['admin', 'super_admin'])
async createUser(@Body() dto: CreateUserDto) { ... }

// Permission-based (fine-grained)
@RequirePermission('conversations.assign')
async assignConversation(@Body() dto: AssignDto) { ... }
```

**2. Middleware Behavior**

```typescript
// Execution flow:
1. Extract JWT from Authorization header
2. Validate token (via BetterAuth)
3. Fetch user from database (includes role)
4. Attach user to request object: req.user = { id, email, role }
5. Check required role(s) against user.role
6. If authorized: proceed to controller
7. If unauthorized: throw ForbiddenError (403)
8. Log unauthorized attempts to audit log
```

**3. Week 1 Scope - Endpoints to Protect**

| Endpoint | Required Role(s) | Permission |
|----------|-----------------|------------|
| `GET /api/conversations` | All roles | View conversations (users: assigned only) |
| `GET /api/conversations/:id` | All roles | View conversation details (users: assigned only) |
| `POST /api/conversations/:id/assign` | admin, super_admin, manager | `conversations.assign` |
| `POST /api/conversations/:id/messages` | All roles | Send message (users: assigned only) |
| `GET /api/audit-logs` | manager, admin, super_admin | `audit.view` |
| `POST /api/users` | super_admin | `users.create` |
| `DELETE /api/users/:id` | super_admin | `users.delete` |

**4. Error Responses**

```json
// 401 Unauthorized (no auth token)
{
  "error": "Unauthorized",
  "message": "Authentication required"
}

// 403 Forbidden (authenticated but insufficient permissions)
{
  "error": "Forbidden",
  "message": "You do not have permission to perform this action",
  "required": "admin",
  "current": "user"
}
```

**5. Resource-Level Authorization (User role only)**

```typescript
// Users can only access assigned conversations
async getConversation(@Param('id') id: string, @Req() req: Request) {
  const conversation = await db.query.conversations.findFirst({
    where: eq(conversations.id, id)
  });
  
  // Resource-level check for User role
  if (req.user.role === 'user' && conversation.assignedUserId !== req.user.id) {
    throw new ForbiddenError('You can only view conversations assigned to you');
  }
  
  return conversation;
}
```

---

### 4. BE-027: Structured Logging (#107)

#### Key Requirements

**Logging Library:** Pino (NOT Winston)

**Components to Implement:**
1. Pino logger configuration
2. Correlation ID middleware (AsyncLocalStorage)
3. Request logging middleware
4. Audit logger service

**Middleware Order (CRITICAL):**
```typescript
app.use(correlationIdMiddleware);  // FIRST - inject correlation ID
app.use(requestLoggerMiddleware);  // SECOND - log HTTP requests
app.use(authMiddleware);            // THIRD - authenticate user
app.use(rbacMiddleware);            // FOURTH - authorize
app.use(routes);                    // LAST - route to controllers
```

**Log Structure:**
```json
{
  "level": "info",
  "time": 1706140800000,
  "correlationId": "550e8400-e29b-41d4-a716-446655440000",
  "req": {
    "method": "POST",
    "url": "/api/auth/login",
    "headers": { ... },
    "remoteAddress": "192.168.1.1"
  },
  "res": {
    "statusCode": 200
  },
  "responseTime": 142,
  "msg": "Request completed"
}
```

**Environment-Based Configuration:**
- Development: Pretty-print logs
- Production: JSON logs

---

## Business Rules & Constraints

### Email Provider (BE-025 - BLOCKED)

**Preferred:** SendGrid

**Rationale:**
- Better deliverability (95%+ inbox rate)
- Built-in analytics (open rates, click tracking)
- Rate limiting (10 emails/minute per recipient)
- Webhook support for bounce/spam reports

**Fallback:** SMTP (Gmail App Password)

**Use Case:** Local development only

**Rate Limits:**
- 10 emails/minute per recipient (SendGrid default)
- 100 emails/hour per sender (SMTP limit)

**Week 1 Workaround:** Console.log all emails

---

### R2 Storage (BE-020 - DEFERRED)

**Storage Limits:**
- Max file size: 5 MB per attachment
- Total storage: Unlimited (pay-as-you-go)

**Retention Policies:**
- **Raw payloads:** 7 days (auto-delete via lifecycle policy)
- **Attachments:** Permanent (manual delete only)

**File Type Restrictions:**
- MVP: None (accept all MIME types)
- Phase 2: Validate MIME type matches extension
- Blocked types (future): .exe, .bat, .sh, .dll

**Week 1 Impact:** No attachment support (deferred to Week 2)

---

### Security & Compliance

**Password Requirements:**
- Minimum 8 characters
- At least 1 uppercase letter
- At least 1 number
- Special characters optional

**JWT Configuration:**
- Algorithm: RS256 (asymmetric)
- Access token: 48 hours
- Refresh token: 30 days
- Storage: HTTP-only cookies

**Audit Logging Requirements:**
- Log all authentication events (login, logout, password reset)
- Log all authorization failures (403 Forbidden)
- Log all user management actions (create, update, delete)
- Retention: 1 year (configurable)

---

## Out of Scope - DO NOT IMPLEMENT

### Explicitly Excluded from Week 1

❌ **Email Templates** (BE-004)
- Reason: BE-025 (Email Service) blocked
- Workaround: Console.log reset links
- Future: HTML templates with user greeting, branding

❌ **Advanced JWT Features**
- Refresh token rotation
- Token revocation list
- JWT encryption (vs signing)
- Reason: Adds complexity, not required for MVP

❌ **Multi-Factor Authentication (MFA)**
- SMS codes
- Authenticator apps (TOTP)
- Backup codes
- Reason: Phase 2 feature

❌ **Social Login (OAuth)**
- Google Sign-In
- GitHub OAuth
- Microsoft SSO
- Reason: Phase 2 feature

❌ **Advanced Audit Analytics**
- User activity dashboard
- Anomaly detection
- Compliance reports
- Reason: Phase 2 feature

❌ **Real-Time Metrics Dashboard**
- Active users count
- Login success/failure rates
- API response times
- Reason: Phase 3 feature (observability)

❌ **User Profile Management UI**
- Avatar upload
- Profile settings page
- Notification preferences
- Reason: Backend only in Phase 1, UI in Phase 2

---

## Testing Requirements

### Per-Task Testing Standards

#### BE-027: Structured Logging

**Unit Tests (90%+ coverage):**
- Logger configuration (dev vs prod format)
- Correlation ID generation (UUID v4 format)
- Log level filtering (error, warn, info, debug)
- Audit logger (correct event structure)

**Integration Tests:**
- End-to-end HTTP request logging
- Correlation ID propagation across service layers
- Log file creation (if file transport enabled)

**Manual Testing:**
```bash
# Test 1: Verify correlation ID in response
curl -i http://localhost:3000/api/health
# Expected: X-Correlation-ID header in response

# Test 2: Verify logs include correlation ID
# Check console output for correlationId field

# Test 3: Verify pretty-print in dev
NODE_ENV=development npm run dev
# Expected: Human-readable logs

# Test 4: Verify JSON in production
NODE_ENV=production npm start
# Expected: JSON logs
```

---

#### BE-003: BetterAuth Authentication

**Unit Tests (95%+ coverage):**
- JWT generation (valid structure)
- Token expiration validation
- Password hashing (argon2id)
- User status check (active vs disabled)

**Integration Tests:**
1. **Happy Path - Login Success:**
   ```bash
   POST /api/auth/login
   Body: { "email": "admin@example.com", "password": "Admin123" }
   Expected: 200, accessToken + refreshToken + user object
   ```

2. **Error Case - Invalid Credentials:**
   ```bash
   POST /api/auth/login
   Body: { "email": "admin@example.com", "password": "WrongPassword" }
   Expected: 401, { "error": "Invalid credentials" }
   ```

3. **Error Case - Disabled Account:**
   ```bash
   POST /api/auth/login
   Body: { "email": "disabled@example.com", "password": "Password123" }
   Expected: 403, { "error": "Account is disabled" }
   ```

4. **Happy Path - Logout:**
   ```bash
   POST /api/auth/logout
   Headers: Authorization: Bearer {accessToken}
   Expected: 204 No Content
   ```

**Manual Testing (Postman):**
1. Import collection: `tests/postman/auth.postman_collection.json`
2. Test scenarios:
   - Login with valid credentials → Save access token
   - Access protected endpoint with token → 200 OK
   - Logout → 204 No Content
   - Access protected endpoint after logout → 401 Unauthorized
   - Login with disabled user → 403 Forbidden

---

#### BE-005: RBAC Middleware

**Unit Tests (95%+ coverage):**
- Role decorator logic (single role, multiple roles)
- Permission check (user has/doesn't have permission)
- Error messages (correct required vs current role)

**Integration Tests:**
1. **Admin accesses admin-only endpoint:**
   ```bash
   POST /api/users
   Headers: Authorization: Bearer {adminToken}
   Body: { "email": "newuser@example.com", "role": "user" }
   Expected: 201 Created
   ```

2. **User accesses admin-only endpoint:**
   ```bash
   POST /api/users
   Headers: Authorization: Bearer {userToken}
   Body: { "email": "newuser@example.com", "role": "user" }
   Expected: 403 Forbidden
   ```

3. **User accesses assigned conversation:**
   ```bash
   GET /api/conversations/{assignedId}
   Headers: Authorization: Bearer {userToken}
   Expected: 200 OK
   ```

4. **User accesses unassigned conversation:**
   ```bash
   GET /api/conversations/{unassignedId}
   Headers: Authorization: Bearer {userToken}
   Expected: 403 Forbidden
   ```

**Manual Testing (Postman):**
1. Create test users (super_admin, admin, manager, user)
2. Test permission matrix:
   - Super Admin: All endpoints → 200/201
   - Admin: User management → 403, Conversations → 200
   - Manager: Assign conversations → 200, User management → 403
   - User: Assigned conversations → 200, Assign → 403

---

#### BE-004: Forgot Password Flow

**Unit Tests (85%+ coverage):**
- Token generation (64 hex chars)
- Token expiry calculation (60 minutes from now)
- Password validation (min 8, 1 uppercase, 1 number)
- Token cleanup (delete after successful reset)

**Integration Tests:**
1. **Happy Path - Request Reset:**
   ```bash
   POST /api/auth/forgot-password
   Body: { "email": "user@example.com" }
   Expected: 200, { "message": "If the email exists..." }
   ```

2. **Verify Console Log (Week 1 Mock):**
   ```bash
   # Check console for:
   # [EMAIL MOCK] Reset link: http://localhost:5173/reset-password?token={token}
   ```

3. **Happy Path - Reset Password:**
   ```bash
   POST /api/auth/reset-password
   Body: { "token": "{valid-token}", "newPassword": "NewPassword123" }
   Expected: 200, { "message": "Password updated successfully" }
   ```

4. **Error Case - Expired Token:**
   ```bash
   POST /api/auth/reset-password
   Body: { "token": "{expired-token}", "newPassword": "NewPassword123" }
   Expected: 400, { "error": "Invalid or expired reset token" }
   ```

5. **Error Case - Invalid Password:**
   ```bash
   POST /api/auth/reset-password
   Body: { "token": "{valid-token}", "newPassword": "weak" }
   Expected: 400, { "error": "Password must be at least 8 characters..." }
   ```

**Manual Testing (Postman + Console):**
1. Request password reset → Check console for reset link
2. Copy token from console log
3. Reset password with valid token → 200 OK
4. Attempt login with new password → 200 OK
5. Request reset again → Token should be different
6. Use old token → 400 Invalid token

---

### Minimum Coverage Requirements

| Task | Unit Tests | Integration Tests | Manual Tests |
|------|-----------|------------------|--------------|
| BE-027 | 90%+ | End-to-end logging | Verify log format |
| BE-003 | 95%+ | Login/logout flow | Postman: 4 scenarios |
| BE-005 | 95%+ | RBAC enforcement | Postman: Permission matrix |
| BE-004 | 85%+ | Password reset flow | Postman: 5 scenarios |

---

### PR Checklist (Before Submitting)

Each PR must include:

- [ ] All unit tests pass (`npm test`)
- [ ] All integration tests pass (`npm run test:integration`)
- [ ] Linting passes (`npm run lint`)
- [ ] Code coverage ≥ 80% (check `coverage/lcov-report/index.html`)
- [ ] Manual testing completed (document in PR description)
- [ ] No console errors/warnings
- [ ] API endpoints documented (update `.docs/02-api-and-data-model.md`)
- [ ] ADR referenced (if architectural decision made)
- [ ] No hardcoded secrets (use environment variables)
- [ ] TypeScript types defined (no `any` types)
- [ ] Error handling implemented (try/catch, proper error responses)
- [ ] Audit logging added (for auth events, authorization failures)

---

## Workarounds & Technical Debt

### Approved Workarounds (Week 1 Only)

#### 1. Hardcoded Log Configuration

**What:**
```typescript
const logConfig = {
  level: process.env.LOG_LEVEL || 'info',
  format: process.env.NODE_ENV === 'production' ? 'json' : 'pretty'
};
```

**Why:** BE-026 (Environment Configuration) deferred per GOV-002

**Expiry:** Phase 1 completion (when BE-026 rescheduled)

**Mitigation:** Document all env vars in `.env.example`

**Technical Debt Tracking:** GOV-008 (to be created)

---

#### 2. JWT Secret Fallback (Development Only)

**What:**
```typescript
const jwtSecret = process.env.JWT_SECRET || 'dev-secret-CHANGE-IN-PRODUCTION';

// REQUIRED: Production validation
if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
  throw new Error('JWT_SECRET is required in production');
}
```

**Why:** BE-026 (Env validation) deferred

**Expiry:** Before staging deployment

**Mitigation:** **MUST** fail startup if missing in production

**Technical Debt Tracking:** GOV-008

---

#### 3. Email Mock (Console.log)

**What:**
```typescript
// infrastructure/auth/better-auth.ts
sendResetPassword: async ({ user, url }) => {
  console.log(`
========================================
PASSWORD RESET REQUEST
========================================
User: ${user.email}
Reset Link: ${url}
Expires: ${new Date(Date.now() + 60 * 60 * 1000).toISOString()}
========================================
  `);
  // TODO: Replace with emailService.sendPasswordReset() when BE-025 unblocked
},
```

**Why:** BE-025 (Email Service) blocked by BE-026 deferral

**Expiry:** When BE-025 unblocked (Week 2+)

**Mitigation:** Replace with real email service before staging

**Technical Debt Tracking:** GOV-008

---

### Follow-up Actions Required

| Action | Owner | Deadline | Tracking |
|--------|-------|----------|----------|
| Reschedule BE-026 (Env Config) | Product Owner | Before Phase 1 completion | GOV-002 |
| Add production JWT_SECRET validation | Backend Developer | Before staging deployment | GOV-008 |
| Replace console.log with email service | Backend Developer | When BE-025 unblocked | GOV-008 |
| Document all env vars in `.env.example` | Backend Developer | Week 1 Day 1 (BE-027) | N/A |

---

## Risk Register

### High Risk

**Risk:** JWT secret leaked in production  
**Probability:** Low (if validation implemented)  
**Impact:** Critical (all sessions compromised)  
**Mitigation:** Fail startup if JWT_SECRET missing in production  
**Owner:** Backend Developer  
**Status:** ⚠️ Must implement in BE-003

---

### Medium Risk

**Risk:** Email mock forgotten in production  
**Probability:** Medium (if not tracked)  
**Impact:** High (users won't receive password reset emails)  
**Mitigation:** GOV-008 tracks workaround, automated tests check for email service  
**Owner:** Backend Developer  
**Status:** ⏳ GOV-008 creation pending

---

### Low Risk

**Risk:** Correlation ID missing in some logs  
**Probability:** Low (middleware enforces)  
**Impact:** Medium (harder to trace errors)  
**Mitigation:** Integration tests verify correlation ID propagation  
**Owner:** Backend Developer  
**Status:** ✅ Integration tests required

---

## Success Criteria

### Week 1 Completion Definition

**All 4 tasks DONE when:**

✅ BE-027: Structured Logging
- [ ] Winston replaced with Pino
- [ ] Correlation ID middleware implemented
- [ ] All logs include correlationId field
- [ ] 90%+ unit test coverage
- [ ] Integration tests pass

✅ BE-003: BetterAuth Authentication
- [ ] Login endpoint working (POST /api/auth/login)
- [ ] Logout endpoint working (POST /api/auth/logout)
- [ ] JWT tokens issued (48h access, 30d refresh)
- [ ] User status validation (active vs disabled)
- [ ] 95%+ unit test coverage
- [ ] Integration tests pass (4 scenarios)

✅ BE-005: RBAC Middleware
- [ ] @RequireRole decorator working
- [ ] @RequirePermission decorator working
- [ ] Permission matrix enforced
- [ ] Resource-level auth for User role
- [ ] 95%+ unit test coverage
- [ ] Integration tests pass (permission matrix)

✅ BE-004: Forgot Password Flow
- [ ] Request reset endpoint working (POST /api/auth/forgot-password)
- [ ] Reset password endpoint working (POST /api/auth/reset-password)
- [ ] Token generation (64 hex, 60min TTL)
- [ ] Console.log email mock implemented
- [ ] 85%+ unit test coverage
- [ ] Integration tests pass (5 scenarios)

---

### Quality Gates (All PRs)

| Gate | Requirement | Auto-Check | Blocker |
|------|-------------|-----------|---------|
| **Tests** | All pass | ✅ GitHub Actions | Yes |
| **Coverage** | ≥80% | ✅ Codecov | Yes |
| **Linting** | No errors | ✅ ESLint | Yes |
| **Types** | No `any` | ✅ TypeScript | Yes |
| **Security** | No secrets | ✅ GitGuardian | Yes |
| **Review** | Architect approval | ❌ Manual | Yes |

---

## Next Steps (Immediate Actions)

### Developer Actions (This Session)

1. **Create ADR-004** (Logging Strategy)
   - Use template from Architect review
   - Include Pino vs Winston comparison
   - Document correlation ID approach

2. **Create GOV-008** (Workarounds Tracking)
   - Use template from Architect review
   - List all 3 workarounds
   - Set expiry dates

3. **Replace Winston with Pino**
   - Update `infrastructure/logging/logger.ts`
   - Create correlation ID middleware
   - Update all imports

4. **Start BE-027 Implementation**
   - Create branch `task/BE-027-structured-logging`
   - Implement Pino configuration
   - Write tests (90%+ coverage)
   - Create PR with ADR-004 reference

---

### Product Owner Actions (Week 1)

1. **Review ADR-004** (Logging Strategy)
   - Approve or request changes
   - Confirm alignment with product requirements

2. **Reschedule BE-026** (Env Config)
   - Determine Week 2 or Week 3 slot
   - Update `.docs/06-phase1-execution-guide.md`

3. **Monitor Week 1 Progress**
   - Daily standup: Check task status
   - Unblock any requirement clarifications

---

### Architect Actions (Week 1)

1. **Review ADR-004** (Logging Strategy)
   - Approve or request technical changes
   - Ensure alignment with enterprise standards

2. **Review GOV-008** (Workarounds)
   - Approve workaround expiry dates
   - Confirm mitigation strategies

3. **Review PRs**
   - BE-027: Code review (Pino implementation)
   - BE-003, BE-005, BE-004: Code reviews
   - Ensure architectural compliance

---

## Appendix A: Environment Variables

### Required for Week 1

```bash
# .env.example (to be created in BE-027)

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/yacc_dev

# Authentication
JWT_SECRET=your-secret-key-here-change-in-production
ACCESS_TOKEN_TTL_HOURS=48
REFRESH_TOKEN_TTL_DAYS=30

# Logging
LOG_LEVEL=info
NODE_ENV=development

# Frontend URL (for password reset links)
FRONTEND_URL=http://localhost:5173

# Redis (for message retry queue)
REDIS_URL=redis://localhost:6379

# Server
PORT=3000
```

---

## Appendix B: API Contract Updates

### Endpoints to Add (Week 1)

**Authentication:**
- `POST /api/auth/login` → Login with email/password
- `POST /api/auth/logout` → Logout current session
- `POST /api/auth/forgot-password` → Request password reset
- `POST /api/auth/reset-password` → Reset password with token

**Health Check (already exists):**
- `GET /health` → Server health status
- `GET /health/db` → Database health status
- `GET /health/redis` → Redis health status

---

## Document Metadata

**Created:** 2026-01-24  
**Author:** Fullstack Developer  
**Reviewed by:** Product Owner  
**Status:** ✅ Approved  
**Next Review:** End of Week 1 (2026-01-31)  
**Related Documents:**
- `.docs/06-phase1-execution-guide.md` (execution plan)
- `.docs/01-product-specification.md` (product requirements)
- `.docs/02-api-and-data-model.md` (API contract)
- GOV-002 (BE-026 deferral decision)
- GOV-008 (Workarounds tracking - to be created)
- ADR-004 (Logging strategy - to be created)
