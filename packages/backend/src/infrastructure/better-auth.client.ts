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
import { users } from '../schemas/user.schema';
import { session, verification, account } from '../schemas/betterAuth.schema';
import { appConfig } from '../config/appConfig';

/**
 * BetterAuth singleton - export directly, no wrapper functions
 */
export const betterAuthClient = betterAuth({
  database: drizzleAdapter(dbClient, {
    provider: 'pg',
    schema: { users, session, verification, account },
  }),
  secret: appConfig.BETTER_AUTH_SECRET,
  session: {
    expiresIn: appConfig.ACCESS_TOKEN_TTL_SECONDS * 1000, // Convert to ms
    refreshAgeInDays: Math.floor(appConfig.REFRESH_TOKEN_TTL_SECONDS / 86400), // Convert seconds to days
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
    useSecureCookies: appConfig.APP_ENV === 'production',
    generateId: () => crypto.randomUUID(),
  },
  trustedOrigins: [appConfig.APP_FRONTEND_URL],
});
