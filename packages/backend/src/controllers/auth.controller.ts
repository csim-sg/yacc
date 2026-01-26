/**
 * Auth Controller (Aligned with BetterAuth)
 * 
 * BetterAuth provides comprehensive auth endpoints via its handler:
 * - /api/auth/sign-in/email (login)
 * - /api/auth/sign-out (logout)
 * - /api/auth/get-session (session)
 * - /api/auth/sign-up/email (register)
 * 
 * This controller also handles custom password reset flow
 * for forgot-password and reset-password endpoints.
 *
 * NOTE: simple-auth.controller.ts has been removed because BetterAuth
 * already provides these endpoints through the wildcard handler.
 */

import { All, Controller, Post, Req, Res, Body } from 'routing-controllers';
import type { Request, Response } from 'express';
import { auth } from '../config/auth';
import { db } from '../config/db';
import { ForgotPasswordSchema, ResetPasswordSchema } from '../types/password-reset.schema';
import {
  generateResetToken,
  resetPassword,
} from '../services/password-reset.service';
import { emailService } from '../config/email';

/**
 * Extended Express Request with correlation ID
 * Properly typed to avoid 'any' type violations
 */
interface AuthRequest extends Request {
  correlationId?: string;
  headers: {
    authorization?: string;
  };
}

@Controller('/api/auth')
export class AuthController {
  /**
   * POST /api/auth/forgot-password
   * Request password reset email (ALWAYS returns 200 to prevent email enumeration)
   *
   * Request: ForgotPasswordRequest { "email": "user@example.com" }
   * Response: ForgotPasswordResponse { "message": "..." }
   * 
   * @see packages/common/src/requests/password-reset.request.ts
   * @see packages/common/src/responses/password-reset.response.ts
   */
  @Post('/forgot-password')
  async forgotPassword(@Body() body: typeof ForgotPasswordSchema, @Req() req: AuthRequest): Promise<{ message: string }> {
    const correlationId = req.correlationId || 'unknown';

    try {
      // Validate input using Zod schema
      const { email } = ForgotPasswordSchema.parse(body);

      // Try to find user
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      // IMPORTANT: Always return success to prevent email enumeration
      if (!user) {
        console.debug('Forgot password attempt with non-existent email', {
          correlationId,
          email,
        });
        return {
          message: 'If an email exists, a password reset link has been sent',
        };
      }

      // Generate token using password reset service
      const token = await generateResetToken(user.id, correlationId);

      // Send email
      const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${token}`;
      await emailService.sendPasswordResetEmail(email, resetLink, token);

      console.info('Password reset token generated and email sent', {
        correlationId,
        userId: user.id,
      });

      // Return same response as if email didn't exist (prevent enumeration)
      return {
        message: 'If an email exists, a password reset link has been sent',
      };
    } catch (error: unknown) {
      // Log error but still return success response (prevent enumeration)
      console.error('Forgot password error', {
        correlationId,
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        message: 'If an email exists, a password reset link has been sent',
      };
    }
  }

  /**
   * POST /api/auth/reset-password
   * Reset password using token
   *
   * Request: ResetPasswordRequest { "token": "64-char-hex-token", "newPassword": "NewPassword123!" }
   * Response: ResetPasswordResponse { "success": true, "message": "Password reset successfully" }
   * Error: 400 { "error": "Invalid or expired token" }
   * 
   * @see packages/common/src/requests/password-reset.request.ts
   * @see packages/common/src/responses/password-reset.response.ts
   */
  @Post('/reset-password')
  async resetPasswordHandler(
    @Body() body: typeof ResetPasswordSchema,
    @Req() req: AuthRequest,
  ): Promise<{ success: boolean; message: string }> {
    const correlationId = req.correlationId || 'unknown';

    try {
      // Validate input using Zod schema
      const { token, newPassword } = ResetPasswordSchema.parse(body);

      // Reset password (throws if token invalid/expired)
      await resetPassword(token, newPassword, correlationId);

      console.info('Password reset successful', { correlationId });

      return {
        success: true,
        message: 'Password reset successfully',
      };
    } catch (error: unknown) {
      console.error('Reset password error', {
        correlationId,
        error: error instanceof Error ? error.message : String(error),
      });

      // Return generic error to prevent token enumeration
      throw new Error('Invalid or expired token');
    }
  }

  /**
   * Handle all BetterAuth routes
   * Routes: /sign-in/email, /sign-up/email, /sign-out, /get-session, etc.
   *
   * This wildcard route MUST be last so custom routes above take precedence
   * 
   * BetterAuth provides:
   * - /sign-in/email (login)
   * - /sign-out (logout)
   * - /get-session (session retrieval)
   * - /sign-up/email (registration)
   * - /refresh-token (token refresh with Bearer plugin)
   */
  @All('/*')
  async handleAuth(@Req() req: AuthRequest, @Res() res: Response): Promise<void> {
    // Convert Express request to BetterAuth format
    // Need full URL for Request constructor
    const protocol = req.protocol || 'http';
    const host = req.get('host') || 'localhost:3000';
    const fullUrl = `${protocol}://${host}${req.originalUrl || req.url}`;

    const request = new Request(fullUrl, {
      method: req.method,
      headers: req.headers as HeadersInit,
      body: req.method !== 'GET' && req.method !== 'HEAD' ? JSON.stringify(req.body) : undefined,
    });

    try {
      const response = await auth.handler(request);

      // Set headers
      response.headers.forEach((value: string, key: string) => {
        res.setHeader(key, value);
      });

      // Set status
      res.status(response.status);

      // Send body
      const body = await response.text();
      res.send(body);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
      console.error('BetterAuth handler error', {
        correlationId: req.correlationId,
        error: errorMessage,
      });
      
      res.status(500).json({ error: errorMessage });
    }
  }
}
