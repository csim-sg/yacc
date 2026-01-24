/**
 * BetterAuth Configuration
 * JWT-only auth with Bearer plugin, refresh token rotation
 */

import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { bearer } from 'better-auth/plugins';
import { db } from '../db/client';
import * as schema from '../db/schema';

// Get TTL from env vars (with defaults)
const ACCESS_TOKEN_TTL = parseInt(process.env.ACCESS_TOKEN_TTL_SECONDS || '172800'); // 48h default
// Note: REFRESH_TOKEN_TTL is managed automatically by BetterAuth via session.expiresIn

// CRITICAL: Production validation for JWT secret (TD-002 from GOV-008)
const jwtSecret = process.env.BETTER_AUTH_SECRET || process.env.JWT_SECRET;

if (!jwtSecret) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'FATAL: JWT_SECRET or BETTER_AUTH_SECRET is required in production. ' +
      'Set one of these environment variables before starting the server.'
    );
  }
  console.warn(
    '⚠️  WARNING: Using default JWT secret for development. ' +
    'Set JWT_SECRET or BETTER_AUTH_SECRET environment variable in production!'
  );
}

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: {
      user: schema.users,
      session: schema.session,
      verification: schema.verification,
      account: schema.account,
    },
  }),

  // Secret for signing tokens (with dev fallback)
  secret: jwtSecret || 'dev-secret-change-in-production',

  // Session configuration
  session: {
    expiresIn: ACCESS_TOKEN_TTL, // Access token TTL (48h default)
    updateAge: 24 * 60 * 60, // Update session every 24h
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60, // 5 minutes
    },
  },

  // Email/password authentication
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false, // Set true when email service ready
    minPasswordLength: 6,
    sendResetPassword: async ({ user, url }) => {
      // TODO: Integrate with email service
      console.log(`[Auth] Password reset for ${user.email}: ${url}`);
    },
  },

  // Bearer token plugin for API auth
  plugins: [
    bearer({
      requireSignature: true, // Enable signed tokens for security
    }),
  ],

  // Advanced options
  advanced: {
    cookiePrefix: 'yacc-auth',
    useSecureCookies: process.env.NODE_ENV === 'production',
    generateId: () => crypto.randomUUID(), // Use UUIDs for sessions
  },

  // CORS for frontend
  trustedOrigins: [process.env.FRONTEND_URL || 'http://localhost:5173'],

  // Base URL
  baseURL: process.env.BACKEND_URL || 'http://localhost:3000',
});
