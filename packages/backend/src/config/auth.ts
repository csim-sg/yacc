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

  // Secret for signing tokens
  secret: process.env.BETTER_AUTH_SECRET || process.env.JWT_SECRET || 'dev-secret-change-in-production',

  // Session configuration
  session: {
    expiresIn: ACCESS_TOKEN_TTL, // Access token TTL (48h default)
    updateAge: 24 * 60 * 60, // Update session every 24h
    refreshAgeInDays: 30, // ✅ AC 5: Refresh token TTL 30 days
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60, // 5 minutes
    },
  },

  // Email/password authentication
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false, // Set true when email service ready
    minPasswordLength: 8, // ✅ AC 6: Minimum 8 characters
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

// JWT utilities for simple auth controller (legacy)
// TODO: Remove when simple auth is deprecated
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

export interface JWTPayload {
  userId: string;
  email: string;
  role: string;
  iat?: number;
  exp?: number;
}

/**
 * Sign a JWT token
 */
export function signToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });
}

/**
 * Verify a JWT token
 */
export function verifyToken(token: string): JWTPayload {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  } catch (error: any) {
    throw new Error('Invalid or expired token');
  }
}

/**
 * Extract token from Authorization header
 */
export function extractToken(authHeader?: string): string | null {
  if (!authHeader) {
    return null;
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }

  return parts[1];
}

/**
 * Decode token without verification (for debugging)
 */
export function decodeToken(token: string): JWTPayload | null {
  try {
    return jwt.decode(token) as JWTPayload;
  } catch {
    return null;
  }
}
