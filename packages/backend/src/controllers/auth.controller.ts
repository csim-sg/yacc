/**
 * Auth Controller (Aligned with BetterAuth)
 *
 * BetterAuth provides comprehensive auth endpoints via its handler:
 * - /auth/sign-in/email (login)
 * - /auth/sign-out (logout)
 * - /auth/get-session (session)
 * - /auth/sign-up/email (register)
 *
 * This controller also handles custom password reset flow
 * for forgot-password and reset-password endpoints.
 *
 * @updated DEV-002: Now uses AuthenticationService as single entry point
 * @see ADR-005 Addendum-2 - Auth Service Consolidation
 */

import { eq } from 'drizzle-orm';
import type { Request, Response } from 'express';
import { All, JsonController, Post, Req, Res, Body, BadRequestError, UseBefore } from 'routing-controllers';
import { betterAuthClient } from '../infrastructure/better-auth.client';
import { dbClient } from '../infrastructure/db.client';
import { logger } from '../infrastructure/logger';
import { loginRateLimiter, passwordResetRateLimiter } from '../middleware/rateLimit.middleware';
import { users } from '../schemas/user.schema';
import { authenticationService } from '../services/authentication.service';
import { ForgotPasswordSchema, ResetPasswordSchema } from '../types/passwordReset.schema';

interface AuthenticatedRequest extends Request {
  correlationId?: string;
}

// TODO: Implement EmailService in infrastructure layer
// import { emailService } from '../infrastructure/email.client';

@JsonController('/api/auth')
export class AuthController {
  /**
   * POST /auth/forgot-password
   * Request password reset email (ALWAYS returns 200 to prevent email enumeration)
   * Rate limited to prevent abuse
   *
   * Request: { "email": "user@example.com" }
   * Response: { "message": "If an email exists, a password reset link has been sent" }
   */
  @Post('/forgot-password')
  @UseBefore(passwordResetRateLimiter)
  async forgotPassword(@Body() body: unknown, @Req() req: AuthenticatedRequest): Promise<{ message: string }> {
    const correlationId = req.correlationId || 'unknown';

    try {
      // Validate input using Zod schema
      const { email } = ForgotPasswordSchema.parse(body);

      // Try to find user
      const userResult = await dbClient.select().from(users).where(eq(users.email, email)).limit(1);
      const user = userResult[0];

      // IMPORTANT: Always return success to prevent email enumeration
      if (!user) {
        logger.debug('Forgot password attempt with non-existent email - correlationId: %s', correlationId);
        return {
          message: 'If an email exists, a password reset link has been sent',
        };
      }

        // Generate token using authentication service (DEV-002)
        const _token = await authenticationService.initiatePasswordReset(user.id, correlationId);

         // TODO: Send email via emailService when implemented
         // const resetLink = `${appConfig.APP_FRONTEND_URL}/reset-password?token=${_token}`;
         // await emailService.sendPasswordResetEmail(email, resetLink);

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
   * POST /auth/reset-password
   * Reset password using token
   * Rate limited to prevent abuse
   *
   * Request: { "token": "64-char-hex-token", "newPassword": "NewPassword123!" }
   * Response: { "success": true, "message": "Password reset successfully" }
   * Error: 400 { "error": "Invalid or expired token" }
   */
  @Post('/reset-password')
  @UseBefore(passwordResetRateLimiter)
  async resetPasswordHandler(
    @Body() body: unknown,
    @Req() req: AuthenticatedRequest,
  ): Promise<{ success: boolean; message: string }> {
    const correlationId = req.correlationId || 'unknown';

    try {
      // Validate input using Zod schema
      const { token, newPassword } = ResetPasswordSchema.parse(body);

      // Reset password using authentication service (DEV-002)
      await authenticationService.completePasswordReset(token, newPassword, correlationId);

      logger.info('Password reset successful - correlationId: %s', correlationId);

      return {
        success: true,
        message: 'Password reset successfully',
      };
    } catch (error: unknown) {
      logger.error('Reset password error - correlationId: %s, error: %s', correlationId, error instanceof Error ? error.message : String(error));

      // Return generic error to prevent token enumeration
      throw new BadRequestError('Invalid or expired token');
    }
  }

  /**
   * POST /auth/sign-in/email
   * BetterAuth sign-in endpoint
   * Rate limited to prevent brute force attacks
   *
   * Delegates to BetterAuth handler with rate limiting
   */
  @Post('/sign-in/email')
  @UseBefore(loginRateLimiter)
  async handleSignInEmail(@Req() req: Request, @Res() res: Response): Promise<void> {
    return this.delegateToAuth(req, res);
  }

   /**
    * Handle all other BetterAuth routes
    * Routes: /sign-up/email, /sign-out, /get-session, etc.
    *
    * This wildcard route MUST be last so custom routes above take precedence
    * 
    * BetterAuth provides:
    * - /sign-out (logout)
    * - /get-session (session retrieval)
    * - /sign-up/email (registration)
    * - /refresh-token (token refresh with Bearer plugin)
    */
   @All('/*')
    async handleAuth(@Req() req: Request, @Res() res: Response): Promise<void> {
      return this.delegateToAuth(req, res);
    }

    /**
     * Helper method to delegate requests to BetterAuth handler
     * Reads body from request and converts to BetterAuth format
     * @private
     */
    private async delegateToAuth(req: Request, res: Response): Promise<void> {
     const correlationId = req.correlationId || 'unknown';

     try {
       // Convert Express request to BetterAuth format
       // Need full URL for Request constructor
       const protocol = req.protocol || 'http';
       const host = req.get('host') || 'localhost:3000';
       const fullUrl = `${protocol}://${host}${req.originalUrl || req.url}`;

       // Convert Express headers to fetch Request compatible format
       const headersRecord: Record<string, string> = {};
       Object.entries(req.headers).forEach(([key, value]) => {
         if (typeof value === 'string') {
           headersRecord[key] = value;
         } else if (Array.isArray(value)) {
           headersRecord[key] = value.join(';');
         }
       });

       // Prepare body: req.body is parsed by bodyParserMiddleware
       let body: string | undefined;
       if (req.method !== 'GET' && req.method !== 'HEAD') {
         // routing-controllers may pass body as object or string
         // BetterAuth expects it as a string
         if (typeof req.body === 'string') {
           body = req.body;
         } else if (req.body) {
           body = JSON.stringify(req.body);
         }
       }

       const request = new Request(fullUrl, {
         method: req.method,
         headers: headersRecord,
         body: body,
       });

       const response = await betterAuthClient.handler(request);

       // Log BetterAuth response for debugging
       const responseBody = await response.text();
       if (response.status >= 400) {
         logger.warn(
           { correlationId, status: response.status, body: responseBody },
           'BetterAuth returned error response'
         );
       }

       // Set headers from response
       response.headers.forEach((value: string, key: string) => {
         // Skip content-length header as express will set it
         if (key.toLowerCase() !== 'content-length') {
           res.setHeader(key, value);
         }
       });

       // Set status
       res.status(response.status);
       
       // Set content-type if not already set
       if (!res.getHeader('content-type') && responseBody) {
         res.setHeader('content-type', 'application/json');
       }
       
       res.send(responseBody);
     } catch (error: unknown) {
       const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
       logger.error('BetterAuth handler error - correlationId: %s, error: %s', correlationId, errorMessage);

       // Only send error response if headers haven't been sent
       if (!res.headersSent) {
         res.status(500).json({ error: errorMessage });
       }
     }
   }
}
