/**
 * Conversations Controller
 * Handles conversation CRUD and updates with routing-controllers
 */

import type { Request } from 'express';
import {
  JsonController,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Req,
  Authorized,
  CurrentUser,
  HttpCode,
  BadRequestError,
  NotFoundError,
} from 'routing-controllers';
import { conversationService } from '../services/conversation.service.js';
import { auditService } from '../services/audit.service.js';
import { logger } from '../infrastructure/logger.js';
import { ListConversationsRequest } from '@yacc/common/requests/conversations/listConversations.request';
import { UpdateStatusRequest } from '@yacc/common/requests/conversations/updateStatus.request';
import { UpdatePriorityRequest } from '@yacc/common/requests/conversations/updatePriority.request';
import { AssignRequest } from '@yacc/common/requests/conversations/assign.request';
import { TagRequest } from '@yacc/common/requests/conversations/tag.request';
import type { AuthUser } from '../types/auth.types.js';

interface AuthenticatedRequest extends Request {
  correlationId?: string;
}

@JsonController('/api/conversations')
@Authorized()
export class ConversationsController {
  /**
   * GET /api/conversations
   * List conversations with filters and pagination
   */
  @Get('/')
  async listConversations(@Req() req: AuthenticatedRequest) {
    const startTime = performance.now();
    const correlationId = req.correlationId || 'unknown';

    try {
      const query = req.query || {};
      const normalizedQuery: ListConversationsRequest = {
        page: query.page ? Number(query.page) : undefined,
        limit: query.limit ? Number(query.limit) : undefined,
        channel: typeof query.channel === 'string' ? query.channel : undefined,
        status: (typeof query.status === 'string' ? query.status : undefined) as 'open' | 'pending' | 'resolved' | undefined,
        priority: (typeof query.priority === 'string' ? query.priority : undefined) as 'low' | 'medium' | 'high' | 'urgent' | undefined,
        assignedUserId: typeof query.assignedUserId === 'string' ? query.assignedUserId : undefined,
        search: typeof query.search === 'string' ? query.search : undefined,
        dateFrom: typeof query.dateFrom === 'string' ? query.dateFrom : undefined,
        dateTo: typeof query.dateTo === 'string' ? query.dateTo : undefined,
        unread: query.unread === 'true',
        sortBy: typeof query.sortBy === 'string' ? (query.sortBy as 'lastActivity' | 'created' | 'priority') : undefined,
        sortOrder: typeof query.sortOrder === 'string' ? (query.sortOrder as 'asc' | 'desc') : undefined,
      };
      const result = await conversationService.listConversations(normalizedQuery);

      const duration = performance.now() - startTime;
      logger.debug(
        {
          correlationId,
          filters: normalizedQuery,
          resultCount: result.data.length,
          total: result.total,
          durationMs: Math.round(duration),
        },
        'GET /api/conversations completed'
      );

      return {
        data: result.data,
        page: result.page,
        pageSize: result.pageSize,
        total: result.total,
      };
    } catch (error) {
      const duration = performance.now() - startTime;
      logger.error(
        {
          correlationId,
          error: error instanceof Error ? error.message : String(error),
          durationMs: Math.round(duration),
        },
        'GET /api/conversations failed'
      );
      throw error;
    }
  }

  /**
   * GET /api/conversations/:id
   * Get conversation by ID
   */
  @Get('/:id')
<<<<<<< HEAD
  async getConversation(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    const startTime = performance.now();
    const correlationId = req.correlationId || 'unknown';
=======
  async getConversation(@Param('id') id: string, @Req() req: Request) {
    const startTime = performance.now();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const correlationId = (req as any).correlationId || 'unknown';
>>>>>>> origin/dev

    try {
      const conversation = await conversationService.getConversation(id);

      const duration = performance.now() - startTime;
      logger.debug(
        {
          correlationId,
          conversationId: id,
          durationMs: Math.round(duration),
        },
        'GET /api/conversations/:id completed'
      );

      return {
        data: conversation,
      };
    } catch (error) {
      const duration = performance.now() - startTime;
      logger.error(
        {
          correlationId,
          conversationId: id,
          error: error instanceof Error ? error.message : String(error),
          durationMs: Math.round(duration),
        },
        'GET /api/conversations/:id failed'
      );
      throw error;
    }
  }

  /**
   * PATCH /api/conversations/:id/status
   * Update conversation status
   */
  @Patch('/:id/status')
  @Authorized(['admin', 'manager', 'super_admin'])
  @HttpCode(200)
  async updateStatus(
    @Param('id') id: string,
    @Body() body: UpdateStatusRequest,
    @CurrentUser() user: AuthUser
  ) {
    const result = await conversationService.updateStatus(id, body.status);

    // Log audit
    await auditService.logAction({
      actorId: user.id,
      action: 'conversation_status_change',
      entityType: 'conversation',
      entityId: id,
      metadata: { oldStatus: result.oldStatus, newStatus: body.status },
    });

    return {
      data: result.conversation,
    };
  }

  /**
   * PATCH /api/conversations/:id/priority
   * Update conversation priority
   */
  @Patch('/:id/priority')
  @Authorized(['manager', 'admin', 'super_admin'])
  @HttpCode(200)
  async updatePriority(
    @Param('id') id: string,
    @Body() body: UpdatePriorityRequest,
    @CurrentUser() user: AuthUser
  ) {
    const result = await conversationService.updatePriority(id, body.priority);

    // Log audit
    await auditService.logAction({
      actorId: user.id,
      action: 'conversation_priority_change',
      entityType: 'conversation',
      entityId: id,
      metadata: { oldPriority: result.oldPriority, newPriority: body.priority },
    });

    return {
      data: result.conversation,
    };
  }

  /**
   * PATCH /api/conversations/:id/assign
   * Assign conversation to user
   */
  @Patch('/:id/assign')
  @Authorized(['admin', 'super_admin'])
  @HttpCode(200)
  async assignConversation(
    @Param('id') id: string,
    @Body() body: AssignRequest,
    @CurrentUser() user: AuthUser
  ) {
    const result = await conversationService.assignConversation(id, body.assignedUserId);

    // Log audit
    await auditService.logAction({
      actorId: user.id,
      action: 'conversation_assigned',
      entityType: 'conversation',
      entityId: id,
      metadata: {
        oldAssignedUserId: result.oldAssignedUserId,
        newAssignedUserId: body.assignedUserId,
      },
    });

    return {
      data: result.conversation,
    };
  }

  /**
   * POST /api/conversations/:id/tags
   * Add tag to conversation
   */
  @Post('/:id/tags')
  @Authorized(['admin', 'super_admin'])
  @HttpCode(201)
  async addTag(
    @Param('id') id: string,
    @Body() body: TagRequest,
    @CurrentUser() user: AuthUser
  ) {
    await conversationService.addTag(id, body.tagId);

    // Log audit
    await auditService.logAction({
      actorId: user.id,
      action: 'conversation_tagged',
      entityType: 'conversation',
      entityId: id,
      metadata: { tagId: body.tagId },
    });

    return {
      data: { success: true, message: 'Tag added successfully' },
    };
  }

  /**
   * DELETE /api/conversations/:id/tags/:tagId
   * Remove tag from conversation
   */
  @Delete('/:id/tags/:tagId')
  @Authorized(['admin', 'super_admin'])
  @HttpCode(200)
  async removeTag(
    @Param('id') id: string,
    @Param('tagId') tagId: number,
    @CurrentUser() user: AuthUser
  ) {
    await conversationService.removeTag(id, tagId);

    // Log audit
    await auditService.logAction({
      actorId: user.id,
      action: 'conversation_tag_removed',
      entityType: 'conversation',
      entityId: id,
      metadata: { tagId },
    });

    return {
      data: { success: true, message: 'Tag removed successfully' },
    };
  }

  /**
   * GET /api/conversations/:id/messages
   * Get messages for a conversation with pagination
   */
  @Get('/:id/messages')
  async getMessages(
    @Param('id') conversationId: string,
<<<<<<< HEAD
    @Req() req: AuthenticatedRequest
  ) {
    const startTime = performance.now();
    const correlationId = req.correlationId || 'unknown';
=======
    @Req() req: Request
  ) {
    const startTime = performance.now();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const correlationId = (req as any).correlationId || 'unknown';
>>>>>>> origin/dev

    try {
      const query = req.query || {};
      const page = query.page ? Number(query.page) : 1;
      const limit = query.limit ? Number(query.limit) : 50;
      const offset = (page - 1) * limit;

      const result = await conversationService.listConversationMessages(conversationId, offset, limit);

      const duration = performance.now() - startTime;
      logger.debug(
        {
          correlationId,
          conversationId,
          page,
          limit,
          messageCount: result.messages.length,
          total: result.total,
          durationMs: Math.round(duration),
        },
        'GET /api/conversations/:id/messages completed'
      );

      return {
        data: result.messages,
        page,
        pageSize: limit,
        total: result.total,
      };
    } catch (error) {
      const duration = performance.now() - startTime;
      logger.error(
        {
          correlationId,
          conversationId,
          error: error instanceof Error ? error.message : String(error),
          durationMs: Math.round(duration),
        },
        'GET /api/conversations/:id/messages failed'
      );
      throw error;
    }
  }

   /**
    * POST /api/conversations/:id/messages
    * Send a new message to a conversation
    */
    @Post('/:id/messages')
    @HttpCode(201)
    async sendMessage(
      @Param('id') conversationId: string,
      @Body() body: { body: string },
      @CurrentUser() user: AuthUser,
<<<<<<< HEAD
      @Req() req: AuthenticatedRequest
    ) {
      const startTime = performance.now();
      const correlationId = req.correlationId || 'unknown';
=======
      @Req() req: Request
    ) {
      const startTime = performance.now();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const correlationId = (req as any).correlationId || 'unknown';
>>>>>>> origin/dev

      try {
        // Validate message body
        if (!body.body || body.body.trim().length === 0) {
          throw new BadRequestError('Message body cannot be empty');
        }

        // Verify conversation exists
        try {
          await conversationService.getConversation(conversationId);
        } catch {
          throw new NotFoundError('Conversation not found');
        }

        const result = await conversationService.createMessage({
          conversationId,
          senderName: user.email,
          body: body.body,
          direction: 'outbound',
          status: 'pending',
        });

        // Log audit
        await auditService.logAction({
          actorId: user.id,
          action: 'message_sent',
          entityType: 'conversation',
          entityId: conversationId,
          metadata: { messageId: result.message.id },
        });

        const duration = performance.now() - startTime;
        logger.debug(
          {
            correlationId,
            conversationId,
            messageId: result.message.id,
            userId: user.id,
            durationMs: Math.round(duration),
          },
          'POST /api/conversations/:id/messages completed'
        );

        return {
          data: result.message,
        };
      } catch (error) {
        const duration = performance.now() - startTime;
        logger.error(
          {
            correlationId,
            conversationId,
            userId: user.id,
            error: error instanceof Error ? error.message : String(error),
            durationMs: Math.round(duration),
          },
          'POST /api/conversations/:id/messages failed'
        );
        throw error;
      }
    }
}
