import { eq } from 'drizzle-orm';
import { dbClient } from '../infrastructure/db.client';
import { logger } from '../infrastructure/logger';
import { conversations } from '../schemas/conversation.schema';
import type { AuthUser } from '../types/auth.types';

/**
 * Authorization Service
 * 
 * Handles resource-level authorization checks (beyond role/permission decorators).
 * Decorators handle role and permission checks at the endpoint level.
 * This service handles resource ownership checks (e.g., User can only access their assigned conversations).
 * 
 * @see .docs/plans/week1-architect-review.md (Section 4: Resource-Level Authorization)
 */
export class AuthorizationService {
  /**
   * Check if user can access conversation
   * 
   * For User role: Must be assigned to the conversation
   * For other roles (admin+): Always allowed (role-level check is sufficient)
   * 
   * @param user - Authenticated user object
   * @param conversationId - ID of the conversation to check access for
   * @returns true if user can access, false otherwise
   * 
   * @example
   * ```typescript
   * const canAccess = await authService.canAccessConversation(user, conversationId);
   * if (!canAccess) {
   *   throw new ForbiddenError('Not assigned to this conversation');
   * }
   * ```
   */
  async canAccessConversation(
    user: AuthUser,
    conversationId: string
  ): Promise<boolean> {
    // Super Admin, Admin, Manager can access all conversations
    // Decorators ensure these roles already have permission to access conversations
    if (['super_admin', 'admin', 'manager'].includes(user.role)) {
      return true;
    }

    // User role: Must be assigned to the conversation
    if (user.role === 'user') {
      try {
        const conversation = await dbClient.query.conversations.findFirst({
          where: eq(conversations.id, conversationId),
          columns: { assignedUserId: true },
        });

        if (!conversation) {
          return false; // Conversation doesn't exist
        }

        return conversation.assignedUserId === user.id;
      } catch (error) {
        logger.error(
          { error: error instanceof Error ? error.message : String(error), conversationId, userId: user.id },
          'Authorization check failed for conversation access'
        );
        return false; // Deny on error (fail-closed security)
      }
    }

    // Unknown role or new role - deny by default (fail-closed security)
    return false;
  }

  /**
   * Check if user can send message to conversation
   * 
   * Same logic as canAccessConversation for MVP.
   * Could be extended in future for more granular control.
   * 
   * @param user - Authenticated user object
   * @param conversationId - ID of conversation to send message to
   * @returns true if user can send message, false otherwise
   */
  async canSendMessage(
    user: AuthUser,
    conversationId: string
  ): Promise<boolean> {
    return this.canAccessConversation(user, conversationId);
  }

  /**
   * Check if user can assign conversation to another user
   * 
   * Only admin+ roles can assign conversations.
   * This is checked by @RequirePermission decorator, but included here for completeness.
   * 
   * @param user - Authenticated user object
   * @returns true if user can assign conversations, false otherwise
   */
  canAssignConversation(user: AuthUser): boolean {
    return ['super_admin', 'admin', 'manager'].includes(user.role);
  }

  /**
   * Check if user can manage users (create, update, delete)
   * 
   * Only super_admin can manage users.
   * This is checked by @RequireRole decorator, but included here for completeness.
   * 
   * @param user - Authenticated user object
   * @returns true if user can manage users, false otherwise
   */
  canManageUsers(user: AuthUser): boolean {
    return user.role === 'super_admin';
  }

  /**
   * Check if user can view audit logs
   * 
   * Only admin+ can view audit logs.
   * This is checked by @RequireRole decorator, but included here for completeness.
   * 
   * @param user - Authenticated user object
   * @returns true if user can view audit logs, false otherwise
   */
  canViewAuditLogs(user: AuthUser): boolean {
    return ['super_admin', 'admin', 'manager'].includes(user.role);
  }
}

/**
 * Singleton export for use in services and controllers
 */
export const authorizationService = new AuthorizationService();
