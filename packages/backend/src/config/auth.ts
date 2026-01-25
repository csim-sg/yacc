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
import jwt from 'jsonwebtoken';

// CRITICAL: Production validation for JWT secret (TD-002 from GOV-008)
const jwtSecret = process.env.JWT_SECRET;

if (!jwtSecret) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'FATAL: JWT_SECRET is required in production. ' +
      'Set JWT_SECRET environment variable before starting the server.'
    );
  }
  console.warn(
    '⚠️  WARNING: Using default JWT secret for development. ' +
    'Set JWT_SECRET environment variable in production!'
  );
}

const JWT_SECRET = jwtSecret || 'your-secret-key-change-in-production';
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
  } catch (error) {
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
import crypto from 'crypto';

/**
 * Hash a password using bcrypt-like algorithm
 * Note: In production, use proper bcrypt library
 */
export function hashPassword(password: string): string {
  // Simple PBKDF2 implementation for MVP (not for production)
  // In production, use bcrypt or argon2
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto
    .pbkdf2Sync(password, salt, 100000, 64, 'sha512')
    .toString('hex');
  return `${salt}:${hash}`;
}

/**
 * Verify a password against its hash
 */
export function verifyPassword(password: string, hash: string): boolean {
  const [salt, storedHash] = hash.split(':');
  if (!salt || !storedHash) {
    return false;
  }
  const computedHash = crypto
    .pbkdf2Sync(password, salt, 100000, 64, 'sha512')
    .toString('hex');
  return computedHash === storedHash;
}

/**
 * Generate a random reset token
 */
export function generateResetToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Generate a random verification token
 */
export function generateVerificationToken(): string {
  return crypto.randomBytes(32).toString('hex');
}
