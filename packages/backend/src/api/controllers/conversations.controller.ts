/**
 * Conversations Controller
 * Handles conversation CRUD and updates with routing-controllers
 */

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
import { IsOptional, IsEnum, IsInt, IsString, IsUUID, Min, Max } from 'class-validator';
import { conversationService } from '@yacc/backend/domain/services/conversation.service';
import { auditService } from '@yacc/backend/domain/services/audit.service';

// DTOs
class ListConversationsQuery {
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsString()
  channel?: string;

  @IsOptional()
  @IsEnum(['open', 'pending', 'resolved'])
  status?: 'open' | 'pending' | 'resolved';

  @IsOptional()
  @IsEnum(['low', 'medium', 'high', 'urgent'])
  priority?: 'low' | 'medium' | 'high' | 'urgent';

  @IsOptional()
  @IsUUID()
  assignedUserId?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  dateFrom?: string;

  @IsOptional()
  @IsString()
  dateTo?: string;

  @IsOptional()
  unread?: boolean;

  @IsOptional()
  @IsEnum(['lastActivity', 'created', 'priority'])
  sortBy?: 'lastActivity' | 'created' | 'priority';

  @IsOptional()
  @IsEnum(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc';
}

class UpdateStatusBody {
  @IsEnum(['open', 'pending', 'resolved'])
  status!: 'open' | 'pending' | 'resolved';
}

class UpdatePriorityBody {
  @IsEnum(['low', 'medium', 'high', 'urgent'])
  priority!: 'low' | 'medium' | 'high' | 'urgent';
}

class AssignBody {
  @IsUUID()
  @IsOptional()
  assignedUserId!: string | null;
}

class TagBody {
  @IsInt()
  tagId!: number;
}

@JsonController('/api/conversations')
@Authorized()
export class ConversationsController {
  /**
   * GET /api/conversations
   * List conversations with filters and pagination
   */
  @Get('/')
  async listConversations(@Req() req: any) {
    const query = req?.query || {};
    const normalizedQuery: ListConversationsQuery = {
      page: query.page ? Number(query.page) : undefined,
      limit: query.limit ? Number(query.limit) : undefined,
      channel: query.channel,
      status: query.status,
      priority: query.priority,
      assignedUserId: query.assignedUserId ? String(query.assignedUserId) : undefined,
      search: query.search,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
      unread: query.unread === 'true',
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
    };
    const result = await conversationService.listConversations(normalizedQuery);
    const totalCount = result.pagination.total;
    const totalPage = result.pagination.pages;

    return {
      data: result.conversations,
      totalCount,
      page: result.pagination.page,
      totalPage,
    };
  }

  /**
   * GET /api/conversations/:id
   * Get conversation by ID with messages
   */
  @Get('/:id')
  async getConversation(@Param('id') id: string) {
    const conversation = await conversationService.getConversation(id);
    return {
      success: true,
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
    @Body() body: UpdateStatusBody,
    @CurrentUser() user: any
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
      success: true,
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
    @Body() body: UpdatePriorityBody,
    @CurrentUser() user: any
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
      success: true,
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
    @Body() body: AssignBody,
    @CurrentUser() user: any
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
      success: true,
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
    @Body() body: TagBody,
    @CurrentUser() user: any
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
      success: true,
      message: 'Tag added successfully',
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
    @CurrentUser() user: any
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
      success: true,
      message: 'Tag removed successfully',
    };
  }
}
