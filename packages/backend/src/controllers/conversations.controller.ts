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

const VALID_CHANNELS = ['telegram', 'irc'] as const;
const VALID_STATUSES = ['open', 'pending', 'resolved'] as const;
const VALID_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;
const VALID_SORT_BY = ['lastActivity', 'created', 'priority'] as const;
const VALID_SORT_ORDER = ['asc', 'desc'] as const;

function parsePositiveInt(value: unknown, name: string): number | undefined {
  if (value === undefined || value === '') return undefined;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) return undefined;
  return n;
}

function validateListConversationsQuery(query: Record<string, unknown>): ListConversationsRequest {
  if (query.page !== undefined && query.page !== '') {
    const page = parsePositiveInt(query.page, 'page');
    if (page === undefined) {
      throw new BadRequestError('Invalid query: page must be a positive integer');
    }
  }
  if (query.limit !== undefined && query.limit !== '') {
    const limit = parsePositiveInt(query.limit, 'limit');
    if (limit === undefined || limit > 100) {
      throw new BadRequestError('Invalid query: limit must be an integer between 1 and 100');
    }
  }
  if (query.tagId !== undefined && query.tagId !== '') {
    const tagId = parsePositiveInt(query.tagId, 'tagId');
    if (tagId === undefined) {
      throw new BadRequestError('Invalid query: tagId must be a positive integer');
    }
  }
  const channel = typeof query.channel === 'string' ? query.channel : undefined;
  if (channel !== undefined && !VALID_CHANNELS.includes(channel as (typeof VALID_CHANNELS)[number])) {
    throw new BadRequestError(`Invalid query: channel must be one of ${VALID_CHANNELS.join(', ')}`);
  }
  const status = typeof query.status === 'string' ? query.status : undefined;
  if (status !== undefined && !VALID_STATUSES.includes(status as (typeof VALID_STATUSES)[number])) {
    throw new BadRequestError(`Invalid query: status must be one of ${VALID_STATUSES.join(', ')}`);
  }
  const priority = typeof query.priority === 'string' ? query.priority : undefined;
  if (priority !== undefined && !VALID_PRIORITIES.includes(priority as (typeof VALID_PRIORITIES)[number])) {
    throw new BadRequestError(`Invalid query: priority must be one of ${VALID_PRIORITIES.join(', ')}`);
  }
  const sortBy = typeof query.sortBy === 'string' ? query.sortBy : undefined;
  if (sortBy !== undefined && !VALID_SORT_BY.includes(sortBy as (typeof VALID_SORT_BY)[number])) {
    throw new BadRequestError(`Invalid query: sortBy must be one of ${VALID_SORT_BY.join(', ')}`);
  }
  const sortOrder = typeof query.sortOrder === 'string' ? query.sortOrder : undefined;
  if (sortOrder !== undefined && !VALID_SORT_ORDER.includes(sortOrder as (typeof VALID_SORT_ORDER)[number])) {
    throw new BadRequestError(`Invalid query: sortOrder must be one of ${VALID_SORT_ORDER.join(', ')}`);
  }

  const page = parsePositiveInt(query.page, 'page');
  const limitRaw = parsePositiveInt(query.limit, 'limit');
  const limit = limitRaw !== undefined && limitRaw <= 100 ? limitRaw : undefined;
  const tagId = parsePositiveInt(query.tagId, 'tagId');

  return {
    page,
    limit,
    channel,
    status: status as 'open' | 'pending' | 'resolved' | undefined,
    priority: priority as 'low' | 'medium' | 'high' | 'urgent' | undefined,
    assignedUserId: typeof query.assignedUserId === 'string' ? query.assignedUserId : undefined,
    tagId,
    search: typeof query.search === 'string' ? query.search : undefined,
    dateFrom: typeof query.dateFrom === 'string' ? query.dateFrom : undefined,
    dateTo: typeof query.dateTo === 'string' ? query.dateTo : undefined,
    unread: query.unread === 'true',
    sortBy: sortBy as 'lastActivity' | 'created' | 'priority' | undefined,
    sortOrder: sortOrder as 'asc' | 'desc' | undefined,
  };
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
      const query = (req.query || {}) as Record<string, unknown>;
      const normalizedQuery = validateListConversationsQuery(query);
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
  async getConversation(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    const startTime = performance.now();
    const correlationId = req.correlationId || 'unknown';

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
    @Req() req: AuthenticatedRequest
  ) {
    const startTime = performance.now();
    const correlationId = req.correlationId || 'unknown';

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
      @Req() req: AuthenticatedRequest
    ) {
      const startTime = performance.now();
      const correlationId = req.correlationId || 'unknown';

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
