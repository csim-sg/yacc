/**
 * BetterAuth Middleware
 * Authentication and authorization using BetterAuth
 */

import { Request, Response, NextFunction } from 'express';
import { auth } from '../../infrastructure/auth/better-auth.js';
import { db } from '../../infrastructure/db/client.js';
import { users } from '../../infrastructure/db/schema.js';
import { eq } from 'drizzle-orm';

// User type for BetterAuth
export interface AuthUser {
  id: string;
  email: string;
  role: string;
  name: string;
  emailVerified: boolean;
}

export interface AuthSession {
  id: string;
  userId: string;
  expiresAt: Date;
}

/**
 * Authentication middleware using BetterAuth
 */
export async function authenticateRequest(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // BetterAuth automatically extracts Bearer token from Authorization header
    const session = await auth.api.getSession({
      headers: req.headers as any,
    });

    if (!session) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Fetch full user from database
    const userId = session.user.id as string;
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user || user.status !== 'active') {
      res.status(401).json({ error: 'User not found or inactive' });
      return;
    }

    // Attach user to request (casting to bypass type conflict with old middleware)
    (req as any).user = {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
      emailVerified: user.emailVerified,
    };
    (req as any).session = {
      id: session.session.id,
      userId: user.id,
      expiresAt: session.session.expiresAt,
    };

    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/**
 * Authorization middleware - check user role
 */
export function authorizeRole(...allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }

    next();
  };
}

/**
 * Role hierarchy (higher role includes lower roles' permissions)
 */
const ROLE_HIERARCHY: Record<string, number> = {
  super_admin: 4,
  admin: 3,
  manager: 2,
  user: 1,
};

/**
 * Authorization middleware - check if user has minimum role
 */
export function requireRole(minimumRole: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const userRoleLevel = ROLE_HIERARCHY[req.user.role] || 0;
    const requiredRoleLevel = ROLE_HIERARCHY[minimumRole] || 0;

    if (userRoleLevel < requiredRoleLevel) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }

    next();
  };
}

/**
 * Permission matrix for role-based access control
 */
export const PERMISSIONS: Record<string, string[]> = {
  super_admin: [
    'create_user',
    'edit_user',
    'delete_user',
    'manage_roles',
    'view_audit_logs',
    'export_audit_logs',
    'manage_integrations',
    'manage_routing_rules',
    'reply_to_conversation',
    'assign_conversation',
    'tag_conversation',
    'create_note',
    'view_raw_payload',
  ],
  admin: [
    'view_audit_logs',
    'export_audit_logs',
    'manage_routing_rules',
    'reply_to_conversation',
    'assign_conversation',
    'tag_conversation',
    'create_note',
    'view_raw_payload',
  ],
  manager: [
    'reply_to_conversation',
    'assign_conversation',
    'tag_conversation',
    'create_note',
    'view_audit_logs',
    'view_raw_payload',
  ],
  user: [
    'reply_to_conversation',
    'tag_conversation',
    'create_note',
  ],
};

/**
 * Permission check middleware
 */
export function checkPermission(permission: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const userPermissions = PERMISSIONS[req.user.role] || [];
    if (!userPermissions.includes(permission)) {
      res.status(403).json({ error: `Missing permission: ${permission}` });
      return;
    }

    next();
  };
}
