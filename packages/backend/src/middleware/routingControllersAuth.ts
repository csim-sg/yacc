/**
 * Routing-Controllers Authorization (BetterAuth)
 * Custom authorization checker and current user checker for routing-controllers
 * Uses BetterAuth session validation
 */

import { Action } from 'routing-controllers';
import type { Request } from 'express';
import { BetterAuthClient } from '../infrastructure/better-auth.client';
import { Database } from '../infrastructure/db.client';
import { users, session } from '../infrastructure/db.schema';
import { eq } from 'drizzle-orm';
import { config } from '../config/config';
import type { AuthUser } from '../types/auth.types';

/**
 * Extended Request interface with auth properties
 * Temporarily extends Request until proper type augmentation is set up
 */
interface AuthRequest extends Request {
  user?: AuthUser;
  session?: {
    id: string;
    userId: string;
    expiresAt: Date;
  };
}

// Initialize database and auth with DI pattern
const db = new Database(config.database);
const auth = new BetterAuthClient(
  db.getDrizzle(),
  { users, session, verification: users, account: users },
  {
    secret: config.auth.betterAuthSecret,
    accessTokenTtl: config.auth.accessTokenTtlSeconds,
    refreshTokenTtlDays: Math.floor(config.auth.refreshTokenTtlSeconds / 86400), // Convert seconds to days
    betterAuthSecret: config.auth.betterAuthSecret,
    trustedOrigins: [config.frontend.url],
  }
).getAuth();

/**
 * Authorization checker for routing-controllers
 * Validates BetterAuth session and checks user roles/permissions
 *
 * Used by routing-controllers @Authorized decorator
 */
export async function authorizationChecker(
  action: Action,
  roles: string[]
): Promise<boolean> {
  try {
    const request = action.request as AuthRequest;

    // BetterAuth automatically extracts Bearer token from Authorization header
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session) {
      return false;
    }

    // Fetch full user from database to get role and status
    const userId = session.user.id as string;
    const drizzle = db.getDrizzle();
    const user = await drizzle.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user) {
      return false;
    }

    // Check user status - inactive or suspended users cannot login
    if (user.status === 'inactive' || user.status === 'suspended') {
      return false;
    }

    // Attach user to request (for currentUserChecker)
    request.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      status: user.status,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
    } as AuthUser;

    // Attach session to request
    request.session = {
      id: session.session.id as string,
      userId: user.id,
      expiresAt: session.session.expiresAt as Date,
    };

    // If no specific roles required, just check if authenticated
    if (!roles || roles.length === 0) {
      return true;
    }

    // Check if user has required role
    return roles.includes(user.role);
  } catch (error) {
    return false;
  }
}

/**
 * Current user checker for routing-controllers
 * Returns current authenticated user for use in controllers
 *
 * Used by routing-controllers @CurrentUser decorator
 */
export async function currentUserChecker(
  action: Action
): Promise<AuthUser | undefined> {
  try {
    const request = action.request as AuthRequest;

    // BetterAuth automatically extracts Bearer token from Authorization header
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session) {
      return undefined;
    }

    // Fetch full user from database to get role and status
    const userId = session.user.id as string;
    const drizzle = db.getDrizzle();
    const user = await drizzle.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user || user.status === 'inactive' || user.status === 'suspended') {
      return undefined;
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      status: user.status,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
    } as AuthUser;
  } catch (error) {
    return undefined;
  }
}
