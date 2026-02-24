/**
 * Notes Controller
 * Handles note CRUD endpoints: create, list
 */

import type { Request } from 'express';
import {
  JsonController,
  Get,
  Post,
  Param,
  Body,
  Req,
  Authorized,
  CurrentUser,
  HttpCode,
  BadRequestError,
  NotFoundError,
  QueryParam,
} from 'routing-controllers';
import { BaseListResponse } from '@yacc/common/responses/base-list.response';
import { logger } from '../infrastructure/logger';
import { notesService } from '../services/notes.service';
import type { AuthUser } from '../types/auth.types';
import type { CreateNoteRequest } from '../types/notes.types';

interface AuthenticatedRequest extends Request {
  correlationId?: string;
}

/**
 * Notes API endpoints
 * All endpoints accessible to authenticated users
 */
@JsonController('/api/conversations/:conversationId/notes')
@Authorized()
export class NotesController {
  /**
   * GET /conversations/:conversationId/notes
   * List all notes for a conversation with pagination
   */
  @Get()
  @HttpCode(200)
  async listNotes(
    @Req() req: AuthenticatedRequest,
    @Param('conversationId') conversationId: string,
    @QueryParam('page') page: string = '1',
    @QueryParam('pageSize') pageSize: string = '50',
    @CurrentUser() user: AuthUser
  ) {
    const correlationId = req.correlationId || 'unknown';

    try {
      // Parse pagination params
      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(pageSize, 10) || 50));

      logger.info(
        { userId: user.id, conversationId, page: pageNum, limit, correlationId },
        'Listing notes for conversation'
      );

      const result = await notesService.listNotes(conversationId, pageNum, limit);

      logger.info(
        {
          userId: user.id,
          conversationId,
          count: result.data.length,
          total: result.total,
          correlationId,
        },
        'Notes listed successfully'
      );

      // Create a query adapter for BaseListResponse
      const queryAdapter = {
        getLimit: () => limit,
        getPage: () => pageNum - 1, // Convert to 0-indexed
      };

      return new BaseListResponse(result.data, result.total, queryAdapter);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error(
        { error: message, userId: user.id, conversationId, correlationId },
        'Failed to list notes'
      );

      if (message.includes('not found')) {
        throw new NotFoundError(message);
      }
      throw new BadRequestError(message);
    }
  }

  /**
   * POST /conversations/:conversationId/notes
   * Create a new note with mention parsing
   */
  @Post()
  @HttpCode(201)
  async createNote(
    @Req() req: AuthenticatedRequest,
    @Param('conversationId') conversationId: string,
    @Body() body: CreateNoteRequest,
    @CurrentUser() user: AuthUser
  ) {
    const correlationId = req.correlationId || 'unknown';

    try {
      logger.info(
        {
          userId: user.id,
          conversationId,
          bodyLength: body.body?.length || 0,
          correlationId,
        },
        'Creating note'
      );

      const result = await notesService.createNote(user.id, conversationId, body);

      logger.info(
        {
          userId: user.id,
          conversationId,
          noteId: result.note.id,
          mentionCount: result.mentionedUserIds.length,
          correlationId,
        },
        'Note created successfully'
      );

      return { data: result.note };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error(
        { error: message, userId: user.id, conversationId, correlationId },
        'Failed to create note'
      );

      if (message.includes('not found')) {
        throw new NotFoundError(message);
      }
      throw new BadRequestError(message);
    }
  }
}
