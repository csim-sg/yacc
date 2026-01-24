/**
 * Routing-Controllers Authorization (BetterAuth)
 * Custom authorization checker and current user checker for routing-controllers
 * Uses BetterAuth session validation
 */

import { Action } from 'routing-controllers';
import type { Request } from 'express';
import { auth } from '@yacc/backend/infrastructure/auth/better-auth';
import { db } from '@yacc/backend/infrastructure/db/client';
import { users } from '@yacc/backend/infrastructure/db/schema';
import { eq } from 'drizzle-orm';
import type { AuthUser } from '@yacc/backend/types/auth.types';

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
    const user = await db.query.users.findFirst({
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
    const user = await db.query.users.findFirst({
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
