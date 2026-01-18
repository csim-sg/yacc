import { Request, Response, NextFunction } from 'express';
import { extractToken, verifyToken, JWTPayload } from '../../infrastructure/auth/jwt.js';

// Extend Express Request to include user
declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload;
    }
  }
}

/**
 * Authentication middleware - verify JWT token
 */
export function authenticateRequest(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  try {
    const authHeader = req.headers.authorization;
    const token = extractToken(authHeader);

    if (!token) {
      res.status(401).json({ error: 'Missing or invalid authorization header' });
      return;
    }

    const payload = verifyToken(token);
    req.user = payload;
    next();
  } catch (error: any) {
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
