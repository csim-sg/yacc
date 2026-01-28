/**
 * BetterAuth Client
 *
 * Initializes and provides access to BetterAuth
 * Follows ADR-005: Infrastructure folder for client initialization with DI
 */

import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { bearer } from 'better-auth/plugins';
import type { Auth } from 'better-auth/types';

/**
 * BetterAuth client class
 * Manages authentication with BetterAuth library
 * Uses DI pattern: accepts dependencies in constructor
 */
export class BetterAuthClient {
  private auth: Auth;

  /**
   * Initialize BetterAuth with provided dependencies
   */
  constructor(
    drizzle: any,
    schema: any,
    authConfig: {
      secret: string;
      accessTokenTtl: number;
      refreshTokenTtlDays: number;
      betterAuthSecret?: string;
      trustedOrigins?: string[];
    }
  ) {
    const secret = authConfig.betterAuthSecret || authConfig.secret;

    this.auth = betterAuth({
      database: drizzleAdapter(drizzle, {
        provider: 'pg',
        schema: schema,
      }),
      secret: secret,
      session: {
        expiresIn: authConfig.accessTokenTtl * 1000, // Convert to ms
        refreshAgeInDays: authConfig.refreshTokenTtlDays,
      },
      emailAndPassword: {
        enabled: true,
        requireEmailVerification: false,
        minPasswordLength: 8,
      },
      plugins: [
        bearer({
          requireSignature: true,
        }),
      ],
      advanced: {
        cookiePrefix: 'yacc-auth',
        useSecureCookies: process.env.NODE_ENV === 'production',
        generateId: () => crypto.randomUUID(),
      },
      trustedOrigins: authConfig.trustedOrigins
        ? authConfig.trustedOrigins
        : [process.env.FRONTEND_URL || 'http://localhost:5173'],
    });
  }

  /**
   * Get BetterAuth instance
   */
  getAuth(): Auth {
    return this.auth;
  }
}
