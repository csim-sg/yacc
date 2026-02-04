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
 */

import { All, Controller, Post, Req, Res, Body } from 'routing-controllers';
import type { Response } from 'express';
import { auth } from '../infrastructure/better-auth.client';
import { dbClient } from '../infrastructure/db.client';
import { users } from '../infrastructure/db.schema';
import { eq } from 'drizzle-orm';
import { EmailService } from '../config/email';
import { generateResetToken, resetPassword } from '../services/passwordReset.service';
import { logger } from '../infrastructure/logger';
import { ForgotPasswordSchema, ResetPasswordSchema } from '../types/passwordReset.schema';

// Initialize email service singleton
const emailService = new EmailService();

@Controller('/api/auth')
export class AuthController {
  /**
   * POST /api/auth/forgot-password
   * Request password reset email (ALWAYS returns 200 to prevent email enumeration)
   *
   * Request: { "email": "user@example.com" }
   * Response: { "message": "If an email exists, a password reset link has been sent" }
   */
  @Post('/forgot-password')
  async forgotPassword(@Body() body: unknown, @Req() req: Request): Promise<{ message: string }> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const correlationId = (req as any).correlationId || 'unknown';

    try {
      // Validate input using Zod schema
      const { email } = ForgotPasswordSchema.parse(body);

      // Try to find user
      const userResult = await dbClient.select().from(users).where(eq(users.email, email)).limit(1);
      const user = userResult[0];

      // IMPORTANT: Always return success to prevent email enumeration
      if (!user) {
        logger.debug('Forgot password attempt with non-existent email - correlationId: %s, email: %s', correlationId, email);
        return {
          message: 'If an email exists, a password reset link has been sent',
        };
      }

      // Generate token using password reset service
      const token = await generateResetToken(user.id, correlationId);

       // Send email
       const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${token}`;
       await emailService.sendPasswordResetEmail(email, resetLink);

      logger.info('Password reset token generated and email sent - correlationId: %s, userId: %s', correlationId, user.id);

      // Return same response as if email didn't exist (prevent enumeration)
      return {
        message: 'If an email exists, a password reset link has been sent',
      };
    } catch (error: unknown) {
      // Log error but still return success response (prevent enumeration)
      logger.error('Forgot password error - correlationId: %s, error: %s', correlationId, error instanceof Error ? error.message : String(error));

      return {
        message: 'If an email exists, a password reset link has been sent',
      };
    }
  }

  /**
   * POST /api/auth/reset-password
   * Reset password using token
   *
   * Request: { "token": "64-char-hex-token", "newPassword": "NewPassword123!" }
   * Response: { "success": true, "message": "Password reset successfully" }
   * Error: 400 { "error": "Invalid or expired token" }
   */
  @Post('/reset-password')
  async resetPasswordHandler(
    @Body() body: unknown,
    @Req() req: Request,
  ): Promise<{ success: boolean; message: string }> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const correlationId = (req as any).correlationId || 'unknown';

    try {
      // Validate input using Zod schema
      const { token, newPassword } = ResetPasswordSchema.parse(body);

      // Reset password (throws if token invalid/expired)
      await resetPassword(token, newPassword, correlationId);

      logger.info('Password reset successful - correlationId: %s', correlationId);

      return {
        success: true,
        message: 'Password reset successfully',
      };
    } catch (error: unknown) {
      logger.error('Reset password error - correlationId: %s, error: %s', correlationId, error instanceof Error ? error.message : String(error));

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async handleAuth(@Req() req: any, @Res() res: Response): Promise<void> {
    const correlationId = req.correlationId || 'unknown';

    try {
      // Convert Express request to BetterAuth format
      // Need full URL for Request constructor
      const protocol = req.protocol || 'http';
      const host = req.get('host') || 'localhost:3000';
      const fullUrl = `${protocol}://${host}${req.originalUrl || req.url}`;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const request = new (globalThis as any).Request(fullUrl, {
        method: req.method,
        headers: req.headers,
        body: req.method !== 'GET' && req.method !== 'HEAD' ? JSON.stringify(req.body) : undefined,
      });

      const response = await auth.handler(request);

      // Set headers from response
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const headers = response.headers as any;
      headers.forEach((value: string, key: string) => {
        res.setHeader(key, value);
      });

      // Set status
      res.status(response.status);

      // Send body
      const body = await response.text();
      res.send(body);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
      logger.error('BetterAuth handler error - correlationId: %s, error: %s', correlationId, errorMessage);

      res.status(500).json({ error: errorMessage });
    }
  }
}
