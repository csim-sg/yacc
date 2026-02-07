# BE-004: Forgot Password Flow - Development Guide

**Date**: January 25, 2026  
**Task**: BE-004 - Forgot Password Flow Implementation  
**Estimated Time**: 6 hours  
**Status**: Ready to Start  
**Priority**: High (Blocking BE-004, Week 1 core task)  

---

## 📋 Task Overview

### What is BE-004?
Implement the complete forgot password flow for YACC, allowing users to reset their password via email link without exposing whether an email exists (email enumeration prevention).

### Why is it Important?
- Security-critical feature (password reset)
- Required for MVP (Week 1)
- Blocks user management workflows
- Prerequisites complete (BE-003 done)

### Dependencies
- ✅ **BE-003 Complete**: BetterAuth authentication framework installed
- ✅ **BE-003 Complete**: User model and database schema in place
- ✅ **BE-003 Complete**: Password validation service available
- ⏳ **BE-025 Deferred**: Email service (WORKAROUND: console.log mock per GOV-008)

---

## 🎯 Acceptance Criteria (7 Core Requirements)

### AC 1: Forgot Password Endpoint (POST /auth/forgot-password)
- **Endpoint**: `POST /auth/forgot-password`
- **Request**: `{ "email": "user@example.com" }`
- **Response**: Always `200 OK` (even if email doesn't exist)
- **Response Body**: `{ "message": "If the email exists, a password reset link has been sent" }`
- **Why 200?**: Prevent email enumeration attacks (don't reveal if email exists)
- **Email Generation**: Send email via console.log (GOV-008 workaround)
- **Token Included**: Reset link contains 64-char hex token

### AC 2: Token Generation & Storage
- **Token Format**: 64 random hex characters (crypto.randomBytes(32).toString('hex'))
- **TTL**: 60 minutes (3600 seconds)
- **Storage**: `password_reset_tokens` table with columns:
  - `id` (primary key)
  - `user_id` (FK to users)
  - `token` (hashed with bcrypt)
  - `created_at` (timestamp)
  - `expires_at` (timestamp = created_at + 60 min)
- **Duplicate Prevention**: Delete any existing valid token for user before creating new one

### AC 3: Reset Password Endpoint (POST /auth/reset-password)
- **Endpoint**: `POST /auth/reset-password`
- **Request**: 
  ```json
  {
    "token": "64-char-hex-string",
    "newPassword": "NewPassword123!"
  }
  ```
- **Response Success (200)**:
  ```json
  {
    "success": true,
    "message": "Password reset successfully"
  }
  ```
- **Response Error (400)**: 
  ```json
  {
    "error": "Invalid or expired token"
  }
  ```
- **Password Requirements** (from BE-003):
  - Minimum 8 characters
  - At least 1 uppercase letter
  - At least 1 number
  - Reuse existing `PasswordValidationService`

### AC 4: Token Validation Logic
- **Valid Token**: 
  - Exists in database
  - Not expired (expires_at > now)
  - Has not been used (no used_at timestamp set)
- **Invalid Token Scenarios**:
  - Token doesn't exist → Return 400 "Invalid or expired token"
  - Token expired → Return 400 "Invalid or expired token"
  - Token already used → Return 400 "Invalid or expired token"
- **Security**: Never reveal WHY token is invalid (prevents enumeration)

### AC 5: Password Reset Process
- **Steps**:
  1. Validate token (AC 4 rules)
  2. Validate password meets requirements
  3. Hash new password
  4. Update user password_hash in database
  5. Mark token as used (set used_at = now)
  6. Log audit entry (password.reset, user_id, actor_id=system)
  7. Return 200 success
- **Error Handling**: Return 400 if any step fails

### AC 6: Email Mock (Console.log)
- **Workaround**: Per GOV-008, console.log email instead of sending
- **Implementation**: Create `EmailService` stub that logs email details
- **Email Content**: Include plain-text reset link
- **Example Output**:
  ```
  [EMAIL] Forgot Password Email
  To: user@example.com
  Subject: Reset Your YACC Password
  Reset Link: https://app.example.com/reset-password?token=abc123...xyz789
  ```
- **Production Note**: Replace with real email service in BE-025

### AC 7: Audit Logging
- **Log Events**:
  - `password.forgot_requested` (user_id, email) when forgot-password called
  - `password.reset_successful` (user_id, actor_id=system) when reset succeeds
  - `password.reset_failed` (user_id, reason) when reset fails
- **Audit Table**: Use existing `audit_logs` table
- **Correlation ID**: Include in all logs for tracing

---

## 🛠️ Technical Implementation Details

### Database Schema Update

**File**: `packages/common/src/db/schema.ts`

Add new table:
```typescript
export const passwordResetTokens = pgTable('password_reset_tokens', {
  id: serial('id').primaryKey(),
  user_id: serial('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  token_hash: text('token_hash').notNull(), // bcrypt hash of token
  expires_at: timestamp('expires_at').notNull(),
  used_at: timestamp('used_at'), // null if unused, timestamp if used
  created_at: timestamp('created_at').defaultNow(),
});

// Add composite index for lookups
export const passwordResetTokenIndex = createIndex('idx_password_reset_user_id')
  .on(passwordResetTokens.user_id)
  .where(sql`used_at IS NULL`); // Only index unused tokens
```

**Migration**: Create Drizzle migration
```bash
npm run db:generate -- --name add_password_reset_tokens
```

### File Structure

Create these files in `packages/backend/src/`:

```
src/
├── types/
│   └── password-reset.types.ts (NEW)
├── services/
│   └── password-reset.service.ts (NEW)
├── controllers/
│   └── password-reset.controller.ts (NEW - extends auth.controller.ts)
├── middleware/
│   └── (no changes)
└── tests/
    ├── password-reset.service.test.ts (NEW)
    └── password-reset.controller.test.ts (NEW)
```

Also update:
```
packages/common/src/
├── db/
│   └── schema.ts (UPDATE - add table)
├── types/
│   └── password-reset.types.ts (NEW)
├── schemas/
│   └── password-reset.schema.ts (NEW)
```

### Type Definitions

**File**: `packages/common/src/types/password-reset.types.ts`

```typescript
export interface ForgotPasswordRequest {
  email: string;
}

export interface ForgotPasswordResponse {
  message: string;
}

export interface ResetPasswordRequest {
  token: string;
  newPassword: string;
}

export interface ResetPasswordResponse {
  success: boolean;
  message: string;
}

export interface PasswordResetToken {
  id: string;
  userId: string;
  tokenHash: string; // Never expose raw token
  expiresAt: Date;
  usedAt?: Date;
  createdAt: Date;
}
```

### Validation Schemas (Zod)

**File**: `packages/common/src/schemas/password-reset.schema.ts`

```typescript
import { z } from 'zod';
import { PASSWORD_SCHEMA } from './auth.schema'; // Reuse from BE-003

export const ForgotPasswordSchema = z.object({
  email: z.string().email('Invalid email format').trim().toLowerCase(),
});

export const ResetPasswordSchema = z.object({
  token: z.string()
    .length(64, 'Invalid token format')
    .regex(/^[a-f0-9]{64}$/, 'Invalid token format'),
  newPassword: PASSWORD_SCHEMA, // Minimum 8 chars, 1+ uppercase, 1+ number
});

export type ForgotPasswordInput = z.infer<typeof ForgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof ResetPasswordSchema>;
```

### Service Implementation

**File**: `packages/backend/src/services/password-reset.service.ts`

```typescript
import { randomBytes, timingSafeEqual } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { db } from '@yacc/common/db';
import { passwordResetTokens, users } from '@yacc/common/db/schema';
import { eq, lt, and, isNull } from 'drizzle-orm';
import { PasswordValidationService } from './password-validation.service';
import { AuditService } from './audit.service';

export class PasswordResetService {
  constructor(
    private passwordValidationService: PasswordValidationService,
    private auditService: AuditService,
  ) {}

  /**
   * Generate a password reset token for user
   * Returns the raw token (only shown once to user via email)
   */
  async generateResetToken(userId: string, correlationId: string): Promise<string> {
    // Delete any existing valid tokens for this user
    await db
      .delete(passwordResetTokens)
      .where(
        and(
          eq(passwordResetTokens.user_id, userId),
          isNull(passwordResetTokens.used_at),
          lt(passwordResetTokens.expires_at, new Date()),
        ),
      );

    // Generate new token
    const token = randomBytes(32).toString('hex'); // 64-char hex
    const tokenHash = await bcrypt.hash(token, 12);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 60 min from now

    // Store hashed token
    await db.insert(passwordResetTokens).values({
      user_id: userId,
      token_hash: tokenHash,
      expires_at: expiresAt,
    });

    // Log action
    await this.auditService.log({
      correlationId,
      userId,
      action: 'password.reset_token_generated',
      entityType: 'user',
      entityId: userId,
      metadata: { expiresAt },
    });

    return token; // Return raw token to send via email
  }

  /**
   * Validate reset token - verify it's valid, not expired, not used
   * Returns userId if valid, throws if invalid
   */
  async validateAndGetUserId(token: string, correlationId: string): Promise<string> {
    if (!token || token.length !== 64) {
      throw new Error('Invalid or expired token');
    }

    // Find all non-used tokens
    const records = await db
      .select()
      .from(passwordResetTokens)
      .where(isNull(passwordResetTokens.used_at));

    // Compare each token hash with input (timing-safe comparison)
    for (const record of records) {
      const isMatch = await bcrypt.compare(token, record.token_hash);
      
      if (isMatch) {
        // Check expiration
        if (new Date() > record.expires_at) {
          throw new Error('Invalid or expired token');
        }

        await this.auditService.log({
          correlationId,
          userId: record.user_id,
          action: 'password.reset_token_validated',
          entityType: 'user',
          entityId: record.user_id,
        });

        return record.user_id;
      }
    }

    // No matching token found
    throw new Error('Invalid or expired token');
  }

  /**
   * Reset password for user with valid token
   */
  async resetPassword(
    token: string,
    newPassword: string,
    correlationId: string,
  ): Promise<void> {
    // Validate token
    const userId = await this.validateAndGetUserId(token, correlationId);

    // Validate password requirements
    const validation = await this.passwordValidationService.validate(newPassword);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, 12);

    // Update user password
    await db
      .update(users)
      .set({ password_hash: passwordHash })
      .where(eq(users.id, userId));

    // Mark token as used
    await db
      .update(passwordResetTokens)
      .set({ used_at: new Date() })
      .where(eq(passwordResetTokens.token_hash, await this.hashToken(token)));

    // Log successful reset
    await this.auditService.log({
      correlationId,
      userId, // actor
      action: 'password.reset_successful',
      entityType: 'user',
      entityId: userId,
    });
  }

  /**
   * Helper: Hash token for comparison
   */
  private async hashToken(token: string): Promise<string> {
    return bcrypt.hash(token, 12);
  }
}
```

### Controller Implementation

**File**: `packages/backend/src/controllers/password-reset.controller.ts`

```typescript
import { Controller, Post, Body, Logger } from 'routing-controllers';
import { Service } from 'typedi';
import { ForgotPasswordRequest, ResetPasswordRequest } from '@yacc/common/types';
import { ForgotPasswordSchema, ResetPasswordSchema } from '@yacc/common/schemas';
import { PasswordResetService } from '../services/password-reset.service';
import { EmailService } from '../services/email.service';
import { Request } from 'express';

interface AuthRequest extends Request {
  correlationId?: string;
}

@Service()
@Controller('/auth')
export class PasswordResetController {
  constructor(
    private passwordResetService: PasswordResetService,
    private emailService: EmailService,
  ) {}

  /**
   * POST /auth/forgot-password
   * Request password reset email (ALWAYS returns 200 to prevent email enumeration)
   */
  @Post('/forgot-password')
  async forgotPassword(
    @Body() body: ForgotPasswordRequest,
    req: AuthRequest,
  ) {
    const correlationId = req.correlationId || 'unknown';
    
    try {
      // Validate input
      const { email } = ForgotPasswordSchema.parse(body);

      // Try to find user
      const user = await db.query.users.findFirst({
        where: (u) => eq(u.email, email),
      });

      // IMPORTANT: Always return success to prevent email enumeration
      if (!user) {
        return {
          message: 'If the email exists, a password reset link has been sent',
        };
      }

      // Generate token
      const token = await this.passwordResetService.generateResetToken(
        user.id,
        correlationId,
      );

      // Send email
      const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;
      await this.emailService.sendPasswordResetEmail(email, resetLink);

      // Return same response as if email didn't exist (prevent enumeration)
      return {
        message: 'If the email exists, a password reset link has been sent',
      };
    } catch (error) {
      // Log error but still return success response
      Logger.error('Forgot password error', {
        correlationId,
        error: error.message,
      });

      return {
        message: 'If the email exists, a password reset link has been sent',
      };
    }
  }

  /**
   * POST /auth/reset-password
   * Reset password using token
   */
  @Post('/reset-password')
  async resetPassword(
    @Body() body: ResetPasswordRequest,
    req: AuthRequest,
  ) {
    const correlationId = req.correlationId || 'unknown';

    try {
      // Validate input
      const { token, newPassword } = ResetPasswordSchema.parse(body);

      // Reset password
      await this.passwordResetService.resetPassword(token, newPassword, correlationId);

      return {
        success: true,
        message: 'Password reset successfully',
      };
    } catch (error) {
      Logger.error('Reset password error', {
        correlationId,
        error: error.message,
      });

      return new BadRequestException('Invalid or expired token');
    }
  }
}
```

### Email Service Mock

**File**: `packages/backend/src/services/email.service.ts`

```typescript
import { Logger } from 'routing-controllers';

export class EmailService {
  /**
   * Mock email sending via console.log (GOV-008 workaround)
   * Will be replaced by real service in BE-025
   */
  async sendPasswordResetEmail(email: string, resetLink: string): Promise<void> {
    // Console.log email details (workaround until BE-025)
    console.log(
      `
[EMAIL] Password Reset Request
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
To: ${email}
Subject: Reset Your YACC Password
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Hello,

You requested a password reset for your YACC account.

Click the link below to reset your password:
${resetLink}

This link will expire in 60 minutes.

If you did not request a password reset, please ignore this email.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      `.trim(),
    );

    Logger.info('Password reset email sent', { to: email });
  }
}
```

---

## 🧪 Testing Strategy

### Test Coverage Target
- **Minimum**: 85% code coverage
- **Focus**: Service and controller logic
- **Database**: Use in-memory or test database

### Unit Tests (Service)

**File**: `packages/backend/src/services/password-reset.service.test.ts`

```typescript
describe('PasswordResetService', () => {
  let service: PasswordResetService;
  let validationService: PasswordValidationService;
  let auditService: AuditService;

  beforeEach(() => {
    // Setup mocks
    validationService = mock(PasswordValidationService);
    auditService = mock(AuditService);
    service = new PasswordResetService(validationService, auditService);
  });

  describe('generateResetToken', () => {
    it('should generate 64-char hex token', async () => {
      const token = await service.generateResetToken('user-123', 'corr-id');
      expect(token).toHaveLength(64);
      expect(token).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should store hashed token in database', async () => {
      const token = await service.generateResetToken('user-123', 'corr-id');
      const record = await db.query.passwordResetTokens.findFirst({
        where: (t) => eq(t.user_id, 'user-123'),
      });
      expect(record).toBeDefined();
      expect(record!.tokenHash).toBeDefined(); // Should be hashed
      expect(record!.tokenHash).not.toBe(token); // Not equal to raw token
    });

    it('should set expiration to 60 minutes from now', async () => {
      const before = new Date();
      await service.generateResetToken('user-123', 'corr-id');
      const after = new Date();

      const record = await db.query.passwordResetTokens.findFirst({
        where: (t) => eq(t.user_id, 'user-123'),
      });

      const expectedMin = new Date(before.getTime() + 59 * 60 * 1000);
      const expectedMax = new Date(after.getTime() + 61 * 60 * 1000);

      expect(record!.expiresAt.getTime()).toBeGreaterThanOrEqual(expectedMin.getTime());
      expect(record!.expiresAt.getTime()).toBeLessThanOrEqual(expectedMax.getTime());
    });

    it('should delete existing tokens for user', async () => {
      // Create first token
      const token1 = await service.generateResetToken('user-123', 'corr-id');
      
      // Create second token (should delete first)
      const token2 = await service.generateResetToken('user-123', 'corr-id');

      // Count unused tokens
      const records = await db
        .select()
        .from(passwordResetTokens)
        .where(
          and(
            eq(passwordResetTokens.user_id, 'user-123'),
            isNull(passwordResetTokens.used_at),
          ),
        );

      expect(records).toHaveLength(1); // Only one unused token
    });
  });

  describe('validateAndGetUserId', () => {
    it('should return userId for valid token', async () => {
      const token = await service.generateResetToken('user-123', 'corr-id');
      const userId = await service.validateAndGetUserId(token, 'corr-id');
      expect(userId).toBe('user-123');
    });

    it('should throw for non-existent token', async () => {
      await expect(
        service.validateAndGetUserId('invalid-token-1234567890', 'corr-id'),
      ).rejects.toThrow('Invalid or expired token');
    });

    it('should throw for expired token', async () => {
      // Create token
      const token = await service.generateResetToken('user-123', 'corr-id');

      // Manually expire it
      await db
        .update(passwordResetTokens)
        .set({ expires_at: new Date(Date.now() - 1000) })
        .where(eq(passwordResetTokens.user_id, 'user-123'));

      await expect(
        service.validateAndGetUserId(token, 'corr-id'),
      ).rejects.toThrow('Invalid or expired token');
    });

    it('should throw for used token', async () => {
      const token = await service.generateResetToken('user-123', 'corr-id');

      // Mark as used
      await db
        .update(passwordResetTokens)
        .set({ used_at: new Date() })
        .where(eq(passwordResetTokens.user_id, 'user-123'));

      await expect(
        service.validateAndGetUserId(token, 'corr-id'),
      ).rejects.toThrow('Invalid or expired token');
    });
  });

  describe('resetPassword', () => {
    it('should update user password', async () => {
      // Setup: Create user and token
      const userId = 'user-123';
      const newPassword = 'NewPassword123!';
      const token = await service.generateResetToken(userId, 'corr-id');

      // Mock validation
      when(validationService.validate(newPassword)).thenResolve({
        valid: true,
      });

      // Reset password
      await service.resetPassword(token, newPassword, 'corr-id');

      // Verify user password changed
      const user = await db.query.users.findFirst({
        where: (u) => eq(u.id, userId),
      });
      expect(user!.passwordHash).toBeDefined();
      expect(user!.passwordHash).not.toBe(originalHash);
    });

    it('should mark token as used', async () => {
      const token = await service.generateResetToken('user-123', 'corr-id');

      when(validationService.validate(anything())).thenResolve({
        valid: true,
      });

      await service.resetPassword(token, 'NewPassword123!', 'corr-id');

      const record = await db.query.passwordResetTokens.findFirst({
        where: (t) => eq(t.user_id, 'user-123'),
      });

      expect(record!.usedAt).toBeDefined();
    });

    it('should throw for invalid password', async () => {
      const token = await service.generateResetToken('user-123', 'corr-id');

      when(validationService.validate('weak')).thenResolve({
        valid: false,
        error: 'Password too short',
      });

      await expect(
        service.resetPassword(token, 'weak', 'corr-id'),
      ).rejects.toThrow('Password too short');
    });
  });
});
```

### Integration Tests (Controller)

**File**: `packages/backend/src/controllers/password-reset.controller.test.ts`

```typescript
describe('PasswordResetController', () => {
  let app: Express;
  let controller: PasswordResetController;

  beforeEach(async () => {
    // Setup Express app with controller
    app = express();
    app.use(express.json());
    // Register controller...
  });

   describe('POST /auth/forgot-password', () => {
     it('should return 200 for valid email', async () => {
       const response = await request(app)
         .post('/auth/forgot-password')
         .send({ email: 'user@example.com' });

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('If the email exists');
    });

     it('should return 200 for non-existent email (prevent enumeration)', async () => {
       const response = await request(app)
         .post('/auth/forgot-password')
         .send({ email: 'nonexistent@example.com' });

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('If the email exists');
    });

     it('should send email with reset link', async () => {
       const emailSpy = jest.spyOn(emailService, 'sendPasswordResetEmail');

       await request(app)
         .post('/auth/forgot-password')
         .send({ email: 'user@example.com' });

      expect(emailSpy).toHaveBeenCalledWith(
        'user@example.com',
        expect.stringContaining('/reset-password?token='),
      );
    });

     it('should reject invalid email format', async () => {
       const response = await request(app)
         .post('/auth/forgot-password')
         .send({ email: 'invalid-email' });

      expect(response.status).toBe(400);
    });
  });

  describe('POST /auth/reset-password', () => {
    it('should reset password with valid token', async () => {
      // Generate valid token
      const token = await passwordResetService.generateResetToken('user-id', 'corr-id');

       const response = await request(app)
         .post('/auth/reset-password')
         .send({
           token,
           newPassword: 'NewPassword123!',
         });

       expect(response.status).toBe(200);
       expect(response.body.success).toBe(true);
     });

     it('should reject invalid token', async () => {
       const response = await request(app)
         .post('/auth/reset-password')
        .send({
          token: 'invalid-token-123',
          newPassword: 'NewPassword123!',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid or expired token');
    });

    it('should reject weak password', async () => {
      const token = await passwordResetService.generateResetToken('user-id', 'corr-id');

       const response = await request(app)
         .post('/auth/reset-password')
         .send({
           token,
           newPassword: 'weak', // Too short, no uppercase, no number
         });

      expect(response.status).toBe(400);
    });

    it('should reject expired token', async () => {
      // Create token, then expire it manually
      const token = await passwordResetService.generateResetToken('user-id', 'corr-id');
      
      // Manually expire
      await db.update(passwordResetTokens)
        .set({ expires_at: new Date(Date.now() - 1000) })
        .where(eq(passwordResetTokens.user_id, 'user-id'));

       const response = await request(app)
         .post('/auth/reset-password')
         .send({
           token,
           newPassword: 'NewPassword123!',
         });

       expect(response.status).toBe(400);
       expect(response.body.error).toContain('Invalid or expired token');
     });

     it('should mark token as used after reset', async () => {
       const token = await passwordResetService.generateResetToken('user-id', 'corr-id');

       await request(app)
         .post('/auth/reset-password')
        .send({
          token,
          newPassword: 'NewPassword123!',
        });

       // Try to reuse token - should fail
       const response2 = await request(app)
         .post('/auth/reset-password')
         .send({
           token,
           newPassword: 'AnotherPassword123!',
         });

      expect(response2.status).toBe(400);
      expect(response2.body.error).toContain('Invalid or expired token');
    });
  });
});
```

---

## 📮 Manual Testing (Postman)

### Test 1: Forgot Password - Valid Email
```
POST http://localhost:3000/auth/forgot-password
Content-Type: application/json

{
  "email": "admin@example.com"
}

Expected Response (200):
{
  "message": "If the email exists, a password reset link has been sent"
}

Expected Action:
  - Console log shows email with reset link
  - Password reset token created in database (expires_at = now + 60 min)
  - Audit log entry created
```

### Test 2: Forgot Password - Non-Existent Email
```
POST http://localhost:3000/auth/forgot-password
Content-Type: application/json

{
  "email": "nonexistent@example.com"
}

Expected Response (200):
{
  "message": "If the email exists, a password reset link has been sent"
}

Expected Action:
  - NO email sent (user doesn't exist)
  - NO token created
  - Response identical to Test 1 (prevents enumeration)
```

### Test 3: Reset Password - Valid Token
```
POST http://localhost:3000/auth/reset-password
Content-Type: application/json

{
  "token": "<token-from-console-log>",
  "newPassword": "NewPassword123!"
}

Expected Response (200):
{
  "success": true,
  "message": "Password reset successfully"
}

Expected Actions:
  - User password hash updated
  - Token marked as used (used_at timestamp set)
  - Audit log entry created
  - Login works with new password
```

### Test 4: Reset Password - Expired Token
```
POST http://localhost:3000/auth/reset-password
Content-Type: application/json

{
  "token": "<expired-token>",
  "newPassword": "NewPassword123!"
}

Expected Response (400):
{
  "error": "Invalid or expired token"
}

Expected Action:
  - No password change
  - Error does NOT reveal whether token is expired or invalid (prevents enumeration)
```

### Test 5: Reset Password - Already Used Token
```
POST http://localhost:3000/auth/reset-password
Content-Type: application/json

{
  "token": "<already-used-token>",
  "newPassword": "AnotherPassword123!"
}

Expected Response (400):
{
  "error": "Invalid or expired token"
}

Expected Action:
  - Same generic error as invalid/expired token
  - Prevents enumeration of which tokens have been used
```

---

## 📊 Implementation Checklist

### Pre-Development (1-2 hours)
- [ ] Review this guide and understand all requirements
- [ ] Review BE-003 implementation (BetterAuth, password validation)
- [ ] Check existing password validation service implementation
- [ ] Verify test database setup
- [ ] Verify email service mock approach

### Development (4-5 hours)

#### Phase 1: Setup (30 min)
- [ ] Create feature branch: `feature/BE-004-forgot-password`
- [ ] Create all required files (services, controller, types, schemas)
- [ ] Add database schema and create migration

#### Phase 2: Implementation (2-3 hours)
- [ ] Implement `PasswordResetService` (token generation, validation, reset)
- [ ] Implement `PasswordResetController` (endpoints)
- [ ] Implement `EmailService` mock
- [ ] Update `password-reset.types.ts` in common package
- [ ] Update `password-reset.schema.ts` in common package

#### Phase 3: Testing (1-1.5 hours)
- [ ] Write unit tests for service (token generation, validation, reset)
- [ ] Write integration tests for controller (both endpoints)
- [ ] Achieve ≥85% code coverage
- [ ] Fix any failing tests

#### Phase 4: Manual Testing (30 min)
- [ ] Test 5 scenarios with Postman (see above)
- [ ] Verify console.log email output
- [ ] Verify token expiration
- [ ] Verify token reuse prevention
- [ ] Verify audit logging

### Post-Development (1 hour)
- [ ] Update documentation (.docs/02-api-and-data-model.md)
- [ ] Create PR with description and test results
- [ ] Request architect review
- [ ] Address feedback
- [ ] Merge to dev

---

## 🔍 Code Review Checklist (Self-Check)

Before creating PR, verify:

- [ ] **No `any` types**: All types properly defined
- [ ] **Flat structure**: Services, controller, types in correct folders
- [ ] **One definition per file**: Each file has one class/interface
- [ ] **Config pattern**: Configuration in `config/` folder (not in code)
- [ ] **Security**:
  - [ ] Email enumeration prevented (always return 200)
  - [ ] Tokens never exposed in logs/responses
  - [ ] Passwords hashed before storage
  - [ ] Token hashes compared with bcrypt (timing-safe)
- [ ] **Testing**: 
  - [ ] ≥85% coverage
  - [ ] All edge cases tested
  - [ ] Error scenarios covered
- [ ] **Error Handling**:
  - [ ] Proper HTTP status codes (200, 400)
  - [ ] Generic error messages (no enumeration hints)
  - [ ] Correlation IDs in logs
- [ ] **Documentation**:
  - [ ] Updated API docs (.docs/02-api-and-data-model.md)
  - [ ] Updated schema docs
  - [ ] Clear commit messages
- [ ] **Database**:
  - [ ] Schema updated
  - [ ] Migration created
  - [ ] No schema conflicts with other packages

---

## 🎯 Success Criteria (Definition of Done)

✅ **Task is DONE when**:
1. All 7 acceptance criteria implemented
2. All tests pass (100% of test suites)
3. Code coverage ≥85% for all new files
4. Manual testing passes all 5 scenarios
5. PR reviewed and approved by architect
6. All architect feedback addressed
7. PR merged to dev branch
8. Documentation updated
9. Planning documents updated (BE-004 marked DONE)

---

## 📞 Common Issues & Solutions

### Issue: Token comparison always fails
**Cause**: Comparing raw token with bcrypt hash directly  
**Solution**: Use `bcrypt.compare(rawToken, storedHash)`

### Issue: Email enumeration possible
**Cause**: Returning different responses for existing vs non-existing emails  
**Solution**: ALWAYS return 200 with same message for both cases

### Issue: Tokens not expiring properly
**Cause**: Not checking `expires_at` before using token  
**Solution**: Always verify `new Date() <= expires_at` in validation

### Issue: Token reuse possible
**Cause**: Not marking token as used after reset  
**Solution**: Set `used_at = now` immediately after successful reset

### Issue: Tests failing with timezone issues
**Cause**: Using `Date` directly (timezone-dependent)  
**Solution**: Use UTC timestamps or mock `Date.now()`

---

## 📚 References

- **Requirements**: `.docs/plans/week1-product-owner-review.md` Section 3.2
- **Architecture**: `.docs/plans/week1-architect-review.md` Section 3
- **BE-003 Reference**: `.docs/plans/BE-003-completed-task.md` (completed task)
- **Code Constraints**: `AGENTS.md` → "Your Preferences & Constraints"
- **Backend Guide**: `packages/backend/AGENTS.md`
- **Governance**: `.docs/governance/GOV-008-week1-workarounds.md`

---

**Created**: January 25, 2026  
**Status**: Ready for Development  
**Estimated Duration**: 6 hours  
**Blocking**: None (BE-003 complete)  
**Next Task**: BE-005 (RBAC) or BE-004 Merge → BE-006  

