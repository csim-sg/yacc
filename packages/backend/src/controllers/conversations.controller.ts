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
} from 'routing-controllers';
import { conversationService } from '../services/conversation.service.js';
import { auditService } from '../services/audit.service.js';
import { ListConversationsRequest } from '@yacc/common/requests/conversations/listConversations.request';
import { UpdateStatusRequest } from '@yacc/common/requests/conversations/updateStatus.request';
import { UpdatePriorityRequest } from '@yacc/common/requests/conversations/updatePriority.request';
import { AssignRequest } from '@yacc/common/requests/conversations/assign.request';
import { TagRequest } from '@yacc/common/requests/conversations/tag.request';
import type { AuthUser } from '../types/auth.types.js';

@JsonController('/api/conversations')
@Authorized()
export class ConversationsController {
  /**
   * GET /api/conversations
   * List conversations with filters and pagination
   */
  @Get('/')
  async listConversations(@Req() req: Request) {
    const query = req.query || {};
    const normalizedQuery: ListConversationsRequest = {
      page: query.page ? Number(query.page) : undefined,
      limit: query.limit ? Number(query.limit) : undefined,
      channel: typeof query.channel === 'string' ? query.channel : undefined,
      status: typeof query.status === 'string' ? query.status : undefined,
      priority: typeof query.priority === 'string' ? query.priority : undefined,
      assignedUserId: typeof query.assignedUserId === 'string' ? query.assignedUserId : undefined,
      search: typeof query.search === 'string' ? query.search : undefined,
      dateFrom: typeof query.dateFrom === 'string' ? query.dateFrom : undefined,
      dateTo: typeof query.dateTo === 'string' ? query.dateTo : undefined,
      unread: query.unread === 'true',
      sortBy: typeof query.sortBy === 'string' ? (query.sortBy as 'lastActivity' | 'created' | 'priority') : undefined,
      sortOrder: typeof query.sortOrder === 'string' ? (query.sortOrder as 'asc' | 'desc') : undefined,
    };
    const result = await conversationService.listConversations(normalizedQuery);

    return {
      data: result.data,
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
    };
  }

  /**
   * GET /api/conversations/:id
   * Get conversation by ID
   */
  @Get('/:id')
  async getConversation(@Param('id') id: string) {
    const conversation = await conversationService.getConversation(id);
    return {
      data: conversation,
    };
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
}
