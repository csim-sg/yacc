/**
 * Bulk Actions Controller
 *
 * Handles bulk operations on conversations:
 * - Bulk assign/reassign conversations to users
 * - Bulk tag (add tags to conversations)
 * - Bulk status update (change conversation status)
 *
 * Features:
 * - Best-effort approach (partial success is OK, failures are returned)
 * - Max 100 conversations per request
 * - Atomic per-conversation updates (each conversation processed independently)
 * - RBAC: manager+ only
 * - Audit logging: bulk_action_applied for each successful action
 */

import type { Request } from 'express';
import {
  JsonController,
  Post,
  Body,
  Req,
  Authorized,
  CurrentUser,
  HttpCode,
  BadRequestError,
  ForbiddenError,
  InternalServerError,
} from 'routing-controllers';
import { bulkActionsService } from '../services/bulkActions.service';
import { logger } from '../infrastructure/logger';
import type { AuthUser } from '../types/auth.types';
import type { BulkActionRequest, BulkActionResponse } from '../types/bulkActions.types';
import { isValidActionType, isValidStatus } from '../types/bulkActions.types';

interface AuthenticatedRequest extends Request {
  correlationId?: string;
}

/**
 * Bulk Actions API endpoints
 * Only manager+ roles can perform bulk operations
 */
@JsonController('/api/conversations')
@Authorized()
export class BulkActionsController {
  /**
   * POST /api/conversations/bulk
   * Bulk assign, tag, or update status for multiple conversations
   *
   * Request body:
   * {
   *   "conversationIds": ["c1", "c2", "c3"],
   *   "action": "assign" | "tag" | "status",
   *   "data": {
   *     "assigneeId": "u123" // for assign
   *     "tagId": 456          // for tag (number)
   *     "status": "resolved"  // for status (open|pending|resolved)
   *   }
   * }
   *
    * Response (envelope format):
    * {
    *   "data": {
    *     "successCount": 98,
    *     "failureCount": 2,
    *     "failures": [
    *       {"id": "c1", "reason": "Conversation not found"},
    *       {"id": "c2", "reason": "Assignment failed: ..."}
    *     ]
    *   }
    * }
   *
   * Status codes:
   * - 200: Bulk operation complete (success + failures returned)
   * - 400: Bad request (invalid input)
   * - 403: Forbidden (insufficient permissions)
   * - 500: Internal server error
   */
  @Post('/bulk')
  @HttpCode(200)
  async bulkActionConversations(
    @Req() req: AuthenticatedRequest,
    @Body() body: BulkActionRequest,
    @CurrentUser() user: AuthUser
  ): Promise<BulkActionResponse> {
    const correlationId = req.correlationId || 'unknown';

    try {
      // RBAC check: only manager+ can perform bulk actions
      const allowedRoles = ['super_admin', 'admin', 'manager'];
      if (!allowedRoles.includes(user.role)) {
        logger.warn(
          { correlationId, userId: user.id, userRole: user.role },
          'Bulk action denied: insufficient role'
        );
        throw new ForbiddenError('Only manager+ can perform bulk actions');
      }

      // Validate request body
      if (!body || typeof body !== 'object') {
        throw new BadRequestError('Request body is required');
      }

      const { conversationIds, action, data } = body;

      // Validate conversationIds
      if (!Array.isArray(conversationIds)) {
        throw new BadRequestError('conversationIds must be an array');
      }

      if (conversationIds.length === 0) {
        throw new BadRequestError('conversationIds array cannot be empty');
      }

      if (conversationIds.length > 100) {
        throw new BadRequestError('Maximum 100 conversations per request');
      }

      // Validate action type
      if (!isValidActionType(action)) {
        throw new BadRequestError('action must be one of: assign, tag, status');
      }

      // Validate data based on action
      if (!data || typeof data !== 'object') {
        throw new BadRequestError('data object is required');
      }

      logger.info(
        { correlationId, userId: user.id, action, count: conversationIds.length },
        'Bulk action requested'
      );

      // Execute bulk action
      let result: BulkActionResponse;

      switch (action) {
        case 'assign': {
          // assigneeId can be any string (including null if reassigning to unassigned)
          // But if provided, it should be non-empty
          const assigneeId = (data.assigneeId as unknown) || null;
          if (assigneeId !== null && typeof assigneeId !== 'string') {
            throw new BadRequestError('assigneeId must be a string or null');
          }
          result = await bulkActionsService.bulkAssign(
            conversationIds,
            user.id,
            assigneeId as string,
            correlationId
          );
          break;
        }

        case 'tag': {
          const tagId = data.tagId as unknown;
          if (typeof tagId !== 'number' || tagId < 1) {
            throw new BadRequestError('tagId must be a positive integer');
          }
          result = await bulkActionsService.bulkTag(
            conversationIds,
            tagId,
            user.id,
            correlationId
          );
          break;
        }

        case 'status': {
          const newStatus = data.status as unknown;
          if (!isValidStatus(newStatus)) {
            throw new BadRequestError('status must be one of: open, pending, resolved');
          }
          result = await bulkActionsService.bulkUpdateStatus(
            conversationIds,
            newStatus,
            user.id,
            correlationId
          );
          break;
        }

        default:
          throw new BadRequestError(`Unknown action: ${action}`);
      }

       logger.info(
         { correlationId, action, successCount: result.data.successCount, failureCount: result.data.failureCount },
         'Bulk action completed'
       );

       return result;
    } catch (error: unknown) {
      if (error instanceof BadRequestError || error instanceof ForbiddenError) {
        throw error;
      }

      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error(
        { correlationId, error: errorMsg, userId: user.id },
        'Bulk action failed'
      );

      // Return generic error to client, detailed error logged server-side
      throw new InternalServerError('Bulk action failed');
    }
  }
}
