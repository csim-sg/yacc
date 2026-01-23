/**
 * Routing-Controllers Authorization
 * Custom authorization checker and current user checker for routing-controllers
 * Uses simple JWT token from simple-auth controller
 */

import { Action } from 'routing-controllers';
import { db } from '@yacc/backend/infrastructure/db/client';
import { users } from '@yacc/backend/infrastructure/db/schema';
import { eq } from 'drizzle-orm';

/**
 * Decode simple JWT token
 */
function decodeToken(token: string): any {
  try {
    const payload = JSON.parse(Buffer.from(token, 'base64url').toString());
    // Check expiration
    if (payload.exp < Date.now()) {
      return null;
    }
    return payload;
  } catch (error) {
    return null;
  }
}

/**
 * Authorization checker for routing-controllers
 * Validates Bearer token and checks user permissions
 */
export async function authorizationChecker(
  action: Action,
  roles: string[]
): Promise<boolean> {
  try {
    // Extract token from Authorization header
    const authHeader = action.request.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return false;
    }

    const token = authHeader.substring(7);
    const payload = decodeToken(token);

    if (!payload) {
      return false;
    }

    // Fetch full user from database
    const user = await db.query.users.findFirst({
      where: eq(users.id, payload.userId),
    });

    if (!user || user.status !== 'active') {
      return false;
    }

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
 * Returns the current authenticated user
 */
export async function currentUserChecker(action: Action): Promise<any> {
  try {
    // Extract token from Authorization header
    const authHeader = action.request.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.substring(7);
    const payload = decodeToken(token);

    if (!payload) {
      return null;
    }

    // Fetch full user from database
    const user = await db.query.users.findFirst({
      where: eq(users.id, payload.userId),
    });

    if (!user || user.status !== 'active') {
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
      emailVerified: user.emailVerified,
    };
  } catch (error) {
    return null;
  }
}
