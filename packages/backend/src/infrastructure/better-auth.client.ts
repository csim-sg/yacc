/**
 * BetterAuth Client (Singleton)
 *
 * Initializes and provides access to BetterAuth
 * Follows ADR-005: Infrastructure folder for client initialization
 */

import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { bearer } from 'better-auth/plugins';
import type { Auth } from 'better-auth/types';
import { dbClient } from './db.client';
import { users, session, verification, account } from './db.schema';
import { config } from '../config/config';

const secret = config.auth.betterAuthSecret;

/**
 * Initialize BetterAuth singleton
 */
export const auth = betterAuth({
  database: drizzleAdapter(dbClient, {
    provider: 'pg',
    schema: { users, session, verification, account },
  }),
  secret: secret,
  session: {
    expiresIn: config.auth.accessTokenTtlSeconds * 1000, // Convert to ms
    refreshAgeInDays: Math.floor(config.auth.refreshTokenTtlSeconds / 86400), // Convert seconds to days
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
  trustedOrigins: [process.env.FRONTEND_URL || config.frontend.url],
});

/**
 * Get BetterAuth instance (for type safety)
 */
export function getAuthInstance(): Auth {
  return auth;
}
