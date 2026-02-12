/**
 * Tags Controller
 * Handles tag CRUD endpoints: create, list, attach, detach
 */

import type { Request } from 'express';
import type { AuthUser } from '../types/auth.types';
import type { CreateTagRequest, AttachTagRequest } from '../types/tags.types';
import {
  JsonController,
  Get,
  Post,
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
import { tagsService } from '../services/tags.service';
import { logger } from '../infrastructure/logger';

interface AuthenticatedRequest extends Request {
  correlationId?: string;
}

/**
 * Tags API endpoints
 * All endpoints accessible to authenticated users
 */
@JsonController('/api/tags')
@Authorized()
export class TagsController {
  /**
   * GET /tags
   * List all tags created by the current user
   */
  @Get()
  @HttpCode(200)
  async listTags(
    @Req() req: AuthenticatedRequest,
    @CurrentUser() user: AuthUser
  ) {
    const correlationId = req.correlationId || 'unknown';

    try {
      logger.info(
        { userId: user.id, correlationId },
        'Listing tags'
      );

      const tagList = await tagsService.listTags(user.id);

      logger.info(
        { userId: user.id, count: tagList.length, correlationId },
        'Tags listed successfully'
      );

      return { data: tagList };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error(
        { error: message, userId: user.id, correlationId },
        'Failed to list tags'
      );
      throw new BadRequestError(message);
    }
  }

  /**
   * POST /tags
   * Create a new tag
   */
  @Post()
  @HttpCode(201)
  async createTag(
    @Req() req: AuthenticatedRequest,
    @Body() body: CreateTagRequest,
    @CurrentUser() user: AuthUser
  ) {
    const correlationId = req.correlationId || 'unknown';

    try {
      logger.info(
        { userId: user.id, tagName: body.name, correlationId },
        'Creating tag'
      );

      const tag = await tagsService.createTag(user.id, body);

      logger.info(
        { userId: user.id, tagId: tag.id, correlationId },
        'Tag created successfully'
      );

      return { data: tag };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error(
        { error: message, userId: user.id, correlationId },
        'Failed to create tag'
      );
      throw new BadRequestError(message);
    }
  }

  /**
   * POST /tags/:conversationId/tags
   * Attach a tag to a conversation
   */
  @Post('/conversations/:conversationId')
  @HttpCode(200)
  async attachTag(
    @Req() req: AuthenticatedRequest,
    @Param('conversationId') conversationId: string,
    @Body() body: AttachTagRequest,
    @CurrentUser() user: AuthUser
  ) {
    const correlationId = req.correlationId || 'unknown';

    try {
      logger.info(
        { userId: user.id, conversationId, tagId: body.tagId, correlationId },
        'Attaching tag to conversation'
      );

      const tags = await tagsService.attachTagToConversation(
        user.id,
        conversationId,
        body
      );

      logger.info(
        { userId: user.id, conversationId, correlationId },
        'Tag attached successfully'
      );

      return { data: { tags } };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error(
        { error: message, userId: user.id, conversationId, correlationId },
        'Failed to attach tag'
      );

      if (message.includes('not found')) {
        throw new NotFoundError(message);
      }
      throw new BadRequestError(message);
    }
  }

  /**
   * DELETE /tags/conversations/:conversationId/tags/:tagId
   * Detach a tag from a conversation
   */
  @Delete('/conversations/:conversationId/tags/:tagId')
  @HttpCode(200)
  async detachTag(
    @Req() req: AuthenticatedRequest,
    @Param('conversationId') conversationId: string,
    @Param('tagId') tagId: string,
    @CurrentUser() user: AuthUser
  ) {
    const correlationId = req.correlationId || 'unknown';
    const tagIdNum = parseInt(tagId, 10);

    try {
      logger.info(
        { userId: user.id, conversationId, tagId: tagIdNum, correlationId },
        'Detaching tag from conversation'
      );

      const tags = await tagsService.detachTagFromConversation(
        user.id,
        conversationId,
        tagIdNum
      );

      logger.info(
        { userId: user.id, conversationId, correlationId },
        'Tag detached successfully'
      );

      return { data: { tags } };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error(
        { error: message, userId: user.id, conversationId, correlationId },
        'Failed to detach tag'
      );

      if (message.includes('not found')) {
        throw new NotFoundError(message);
      }
      throw new BadRequestError(message);
    }
  }
}
