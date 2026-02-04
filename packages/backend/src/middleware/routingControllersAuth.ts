/**
 * Routing-Controllers Authorization (BetterAuth)
 * Custom authorization checker and current user checker for routing-controllers
 * Uses BetterAuth session validation
 */

import { Action } from 'routing-controllers';
import type { Request } from 'express';
import { dbClient } from '../infrastructure/db.client';
// TODO: Export schema from db.client
// import { users, session } from '../infrastructure/db.schema';
import { eq } from 'drizzle-orm';
import { config } from '../config/config';
import type { AuthUser } from '../types/auth.types';
// TODO: Implement BetterAuth client
// import { getAuthInstance } from '../infrastructure/better-auth.client';

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

// TODO: Initialize BetterAuth properly when infrastructure is ready
// const auth = getAuthInstance();
const auth = null as any;

/**
 * Authorization checker for routing-controllers
 * Validates BetterAuth session and checks user roles/permissions
 *
 * Used by routing-controllers @Authorized decorator
 * 
 * TODO: Implement proper BetterAuth integration when infrastructure is ready
 */
export async function authorizationChecker(
  action: Action,
  roles: string[]
): Promise<boolean> {
  try {
    // const request = action.request as AuthRequest;

    // // BetterAuth automatically extracts Bearer token from Authorization header
    // if (!auth) {
    //   return false;
    // }
    // const session = await auth.api.getSession({
    //   headers: request.headers,
    // });

    // if (!session) {
    //   return false;
    // }

    // // Fetch full user from database to get role and status
    // const userId = session.user.id as string;
    // const user = await dbClient.query.users.findFirst({
    //   where: eq(users.id, userId),
    // });

    // if (!user) {
    //   return false;
    // }

    // // Check user status - inactive or suspended users cannot login
    // if (user.status === 'inactive' || user.status === 'suspended') {
    //   return false;
    // }

    // // Attach user to request (for currentUserChecker)
    // request.user = {
    //   id: user.id,
    //   email: user.email,
    //   name: user.name,
    //   role: user.role,
    //   status: user.status,
    //   emailVerified: user.emailVerified,
    //   createdAt: user.createdAt,
    //   lastLoginAt: user.lastLoginAt,
    // } as AuthUser;

    // // Attach session to request
    // request.session = {
    //   id: session.session.id as string,
    //   userId: user.id,
    //   expiresAt: session.session.expiresAt as Date,
    // };

    // // If no specific roles required, just check if authenticated
    // if (!roles || roles.length === 0) {
    //   return true;
    // }

    // // Check if user has required role
    // return roles.includes(user.role);

    return false;
  } catch (error) {
    return false;
  }
}

/**
 * Current user checker for routing-controllers
 * Returns current authenticated user for use in controllers
 *
 * Used by routing-controllers @CurrentUser decorator
 * 
 * TODO: Implement proper BetterAuth integration when infrastructure is ready
 */
export async function currentUserChecker(
  action: Action
): Promise<AuthUser | undefined> {
  try {
    // const request = action.request as AuthRequest;

    // // BetterAuth automatically extracts Bearer token from Authorization header
    // if (!auth) {
    //   return undefined;
    // }
    // const session = await auth.api.getSession({
    //   headers: request.headers,
    // });

    // if (!session) {
    //   return undefined;
    // }

    // // Fetch full user from database to get role and status
    // const userId = session.user.id as string;
    // const user = await dbClient.query.users.findFirst({
    //   where: eq(users.id, userId),
    // });

    // if (!user || user.status === 'inactive' || user.status === 'suspended') {
    //   return undefined;
    // }

    // return {
    //   id: user.id,
    //   email: user.email,
    //   name: user.name,
    //   role: user.role,
    //   status: user.status,
    //   emailVerified: user.emailVerified,
    //   createdAt: user.createdAt,
    //   lastLoginAt: user.lastLoginAt,
    // } as AuthUser;

    return undefined;
  } catch (error) {
    return undefined;
  }
}
