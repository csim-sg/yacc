/**
 * Assignments Controller
 * Handles assignment endpoints
 */

import type { Request } from 'express';
import {
  JsonController,
  Post,
  Param,
  Body,
  Req,
  Authorized,
  CurrentUser,
  HttpCode,
  BadRequestError,
  NotFoundError,
  ForbiddenError,
} from 'routing-controllers';
import { logger } from '../infrastructure/logger';
import type { AuthUser } from '../types/auth.types';
import type { AssignConversationRequest } from '../types/assignments.types';
import { assignmentsService } from '../services/assignments.service';

interface AuthenticatedRequest extends Request {
  correlationId?: string;
}

/**
 * Assignments API endpoints
 * Only manager+ roles can assign conversations
 */
@JsonController('/api/conversations/:conversationId/assign')
@Authorized()
export class AssignmentsController {
  /**
   * POST /conversations/:conversationId/assign
   * Assign a conversation to a user (manager+ only)
   */
  @Post()
  @HttpCode(200)
  async assignConversation(
    @Req() req: AuthenticatedRequest,
    @Param('conversationId') conversationId: string,
    @Body() body: AssignConversationRequest,
    @CurrentUser() user: AuthUser
  ) {
    const correlationId = req.correlationId || 'unknown';

    try {
      // RBAC check: only manager+ can assign
      if (!['super_admin', 'admin', 'manager'].includes(user.role)) {
        logger.warn(
          {
            userId: user.id,
            userRole: user.role,
            conversationId,
            correlationId,
          },
          'Assignment attempt by unauthorized user'
        );
        throw new ForbiddenError('Only manager or higher can assign conversations');
      }

      // Validate request body
      if (!body.assignedUserId || typeof body.assignedUserId !== 'string') {
        throw new BadRequestError('assignedUserId is required and must be a string');
      }

      logger.info(
        {
          userId: user.id,
          conversationId,
          assignedUserId: body.assignedUserId,
          correlationId,
        },
        'Assigning conversation'
      );

      // Perform assignment
      const result = await assignmentsService.assignConversation(
        conversationId,
        body.assignedUserId,
        user.id
      );

      logger.info(
        {
          userId: user.id,
          conversationId,
          assignedUserId: body.assignedUserId,
          correlationId,
        },
        'Conversation assigned successfully'
      );

      return { data: result };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error(
        {
          userId: user.id,
          conversationId,
          error: message,
          correlationId,
        },
        'Failed to assign conversation'
      );

      if (message.includes('not found')) {
        throw new NotFoundError(message);
      }
      if (message.includes('access denied') || message.includes('unauthorized')) {
        throw new ForbiddenError(message);
      }
      throw new BadRequestError(message);
    }
  }
}
