/**
 * Simple Auth Controller (MVP)
 * Temporary workaround for BetterAuth integer ID incompatibility
 * Uses custom JWT generation with existing password hashing
 */

import { Body, Controller, Get, Post, Req } from 'routing-controllers';
import { db } from '@yacc/backend/infrastructure/db/client';
import { users } from '@yacc/backend/infrastructure/db/schema';
import { eq } from 'drizzle-orm';
import { verifyPassword } from '@yacc/backend/infrastructure/auth/password';
import crypto from 'crypto';

interface LoginRequest {
  email: string;
  password: string;
}

interface LoginResponse {
  user: {
    id: number;
    email: string;
    name: string;
    role: string;
    status: string;
    emailVerified: boolean;
  };
  session: {
    id: string;
    token: string;
    expiresAt: string;
  };
}

@Controller('/api/simple-auth')
export class SimpleAuthController {
  /**
   * Login with email/password
   * POST /api/simple-auth/login
   */
  @Post('/login')
  async login(@Body() body: LoginRequest, @Req() req: any): Promise<LoginResponse> {
    const { email, password } = body;

    // Find user
    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);

    if (!user) {
      throw { status: 401, error: 'Invalid email or password' };
    }

    // Verify password
    const isValid = verifyPassword(password, user.passwordHash);
    if (!isValid) {
      throw { status: 401, error: 'Invalid email or password' };
    }

    // Generate session token (simple JWT-like token for MVP)
    const sessionId = crypto.randomUUID();
    const token = Buffer.from(
      JSON.stringify({
        userId: user.id,
        email: user.email,
        role: user.role,
        iat: Date.now(),
        exp: Date.now() + 48 * 60 * 60 * 1000, // 48 hours
      })
    ).toString('base64url');

    // Set token in response header
    req.res.setHeader('set-auth-token', token);

    // Send cookie for refresh token simulation
    req.res.cookie('yacc-auth.refresh_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        status: user.status,
        emailVerified: user.emailVerified || false,
      },
      session: {
        id: sessionId,
        token,
        expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
      },
    };
  }

  /**
   * Get current session
   * GET /api/simple-auth/session
   */
  @Get('/session')
  async getSession(@Req() req: any): Promise<LoginResponse | null> {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.substring(7);
    
    try {
      // Decode token
      const payload = JSON.parse(Buffer.from(token, 'base64url').toString());

      // Check expiration
      if (payload.exp < Date.now()) {
        return null;
      }

      // Find user
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, payload.userId))
        .limit(1);

      if (!user) {
        return null;
      }

      return {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          status: user.status,
          emailVerified: user.emailVerified || false,
        },
        session: {
          id: crypto.randomUUID(),
          token,
          expiresAt: new Date(payload.exp).toISOString(),
        },
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Logout
   * POST /api/simple-auth/logout
   */
  @Post('/logout')
  async logout(@Req() req: any): Promise<{ success: boolean }> {
    // Clear cookie
    req.res.clearCookie('yacc-auth.refresh_token');
    return { success: true };
  }
}
