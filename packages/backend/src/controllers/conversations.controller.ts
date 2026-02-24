/**
 * Conversations Controller
 * Handles conversation CRUD and updates with routing-controllers
 */

import type { AssignRequest } from '@yacc/common/requests/conversations/assign.request';
import type { ListConversationsRequest } from '@yacc/common/requests/conversations/listConversations.request';
import type { UpdatePriorityRequest } from '@yacc/common/requests/conversations/updatePriority.request';
import type { UpdateStatusRequest } from '@yacc/common/requests/conversations/updateStatus.request';
import { BaseListResponse } from '@yacc/common/responses/base-list.response';
import type { Request } from 'express';
import {
  JsonController,
  Get,
  Patch,
  Param,
  Body,
  Req,
  Authorized,
  CurrentUser,
  HttpCode,
  BadRequestError,
} from 'routing-controllers';
import { logger } from '../infrastructure/logger';
import { auditService } from '../services/audit.service';
import { conversationService } from '../services/conversation.service';
import type { AuthUser } from '../types/auth.types';

interface AuthenticatedRequest extends Request {
  correlationId?: string;
}

const VALID_CHANNELS = ['telegram', 'irc'] as const;
const VALID_STATUSES = ['open', 'pending', 'resolved'] as const;
const VALID_PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const;
const VALID_SORT_BY = ['lastActivity', 'created', 'priority'] as const;
const VALID_SORT_ORDER = ['asc', 'desc'] as const;

function parsePositiveInt(value: unknown, _name: string): number | undefined {
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
    priority: priority as 'low' | 'normal' | 'high' | 'urgent' | undefined,
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

      // Create a query adapter for BaseListResponse
      const queryAdapter = {
        getLimit: () => normalizedQuery.limit || 20,
        getPage: () => (normalizedQuery.page || 1) - 1, // Convert to 0-indexed
      };

      return new BaseListResponse(result.data, result.total, queryAdapter);
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

   // Tag management endpoints moved to TagController
   // This provides a unified tag API with proper response formatting
   // See packages/backend/src/controllers/tag.controller.ts

   // Message endpoints moved to MessageController
   // See packages/backend/src/controllers/message.controller.ts
}
