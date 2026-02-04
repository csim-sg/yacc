/**
 * BetterAuth Configuration
 * 
 * Aligned with BetterAuth best practices:
 * - Email/password authentication enabled
 * - JWT (Bearer plugin) for API auth
 * - Session management (48h TTL, 30-day refresh)
 * 
 * NOTE: Custom JWT utilities removed - use BetterAuth's
 * built-in JWT and session management instead.
 */

import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { bearer } from 'better-auth/plugins';
import { dbClient } from '../infrastructure/db.client';
import { users, session, verification, account } from '../infrastructure/db.schema';

// Get TTL from env vars (with defaults)
const ACCESS_TOKEN_TTL = parseInt(process.env.ACCESS_TOKEN_TTL_SECONDS || '172800'); // 48h default

export const auth = betterAuth({
  database: drizzleAdapter(dbClient, {
    provider: 'pg',
    schema: {
      user: users,
      session: session,
      verification: verification,
      account: account,
    },
  }),

  // Secret for signing tokens
  secret: process.env.BETTER_AUTH_SECRET || process.env.JWT_SECRET || 'dev-secret-change-in-production',

  // Session configuration
  session: {
    expiresIn: ACCESS_TOKEN_TTL, // Access token TTL (48h default)
    updateAge: 24 * 60 * 60, // Update session every 24h
    refreshAgeInDays: 30, // 30-day refresh token TTL
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60, // 5 minutes
    },
  },

  // Email/password authentication
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false, // Set true when email service ready
    minPasswordLength: 8, // Minimum 8 characters
    sendResetPassword: async ({ user, url }) => {
      // Integrate with email service
      // Note: BetterAuth sends reset links via its built-in password reset flow
      // Our custom /forgot-password endpoint also triggers email via our service
      console.log(`[BetterAuth] Password reset link for ${user.email}: ${url}`);
      // In Phase 2, integrate with emailService.sendPasswordResetEmail()
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
