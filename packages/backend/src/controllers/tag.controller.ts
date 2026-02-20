/**
 * Tag Controller
 * Handles tag CRUD and conversation tag management with routing-controllers
 * Implements endpoints per .docs/02-api-and-data-model.md
 */

import type { AddTagToConversationRequest } from '@yacc/common/requests/tags/addTagToConversation.request';
import type { CreateTagRequest } from '@yacc/common/requests/tags/createTag.request';
import type { Request } from 'express';
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
  NotFoundError,
  BadRequestError,
  ForbiddenError,
} from 'routing-controllers';
import { logger } from '../infrastructure/logger';
import { authorizationService } from '../services/authorization.service';
import { tagService } from '../services/tag.service';
import type { AuthUser } from '../types/auth.types';

interface AuthenticatedRequest extends Request {
  correlationId?: string;
}

@JsonController('/api')
export class TagController {
  /**
   * GET /api/tags
   * List all tags - Requires authentication (any role)
   */
  @Get('/tags')
  @Authorized()
  async listTags(@Req() req: AuthenticatedRequest) {
    const startTime = performance.now();
    const correlationId = req.correlationId || 'unknown';

    try {
      const result = await tagService.listTags();

      if (!result.success) {
        throw new Error(result.error || 'Failed to list tags');
      }

      const duration = performance.now() - startTime;
      logger.debug(
        {
          correlationId,
          tagCount: result.data?.length || 0,
          durationMs: Math.round(duration),
        },
        'GET /api/tags completed'
      );

      return {
        data: result.data,
      };
    } catch (error) {
      const duration = performance.now() - startTime;
      logger.error(
        {
          correlationId,
          error: error instanceof Error ? error.message : String(error),
          durationMs: Math.round(duration),
        },
        'GET /api/tags failed'
      );
      throw error;
    }
  }

  /**
   * POST /api/tags
   * Create a new tag - Requires authentication (any role)
   * GOV-021: All roles (admin, manager, user, super_admin) can create tags
   */
  @Post('/tags')
  @Authorized()
  @HttpCode(201)
  async createTag(
    @Body() body: CreateTagRequest,
    @CurrentUser() user: AuthUser,
    @Req() req: AuthenticatedRequest
  ) {
    const startTime = performance.now();
    const correlationId = req.correlationId || 'unknown';

    try {
      // Validate tag name
      if (!body.name || body.name.trim().length === 0) {
        throw new BadRequestError('Tag name is required');
      }

      if (body.name.length > 255) {
        throw new BadRequestError('Tag name must be 255 characters or less');
      }

      // Validate color if provided
      if (body.color) {
        const hexColorRegex = /^#[0-9A-F]{6}$/i;
        if (!hexColorRegex.test(body.color)) {
          throw new BadRequestError('Color must be a valid hex color code (e.g., #FF5A5F)');
        }
      }

      const result = await tagService.createTag({
        name: body.name.trim(),
        color: body.color,
        createdById: user.id,
      });

      if (!result.success) {
        throw new Error(result.error || 'Failed to create tag');
      }

      const duration = performance.now() - startTime;
      logger.debug(
        {
          correlationId,
          tagId: result.data?.id,
          tagName: body.name,
          durationMs: Math.round(duration),
        },
        'POST /api/tags completed'
      );

      return {
        data: result.data,
      };
    } catch (error) {
      const duration = performance.now() - startTime;
      logger.error(
        {
          correlationId,
          error: error instanceof Error ? error.message : String(error),
          durationMs: Math.round(duration),
        },
        'POST /api/tags failed'
      );
      throw error;
    }
  }

   /**
    * POST /api/conversations/:id/tags
    * Add tag to conversation
    * Allowed roles: admin, manager, user, super_admin (per GOV-021)
    * 
    * Resource-level authorization: User must have access to the conversation
    * GOV-021: All roles can tag conversations (with resource-level auth check)
    */
   @Post('/conversations/:id/tags')
   @Authorized()
   @HttpCode(201)
  async addTagToConversation(
    @Param('id') conversationId: string,
    @Body() body: AddTagToConversationRequest,
    @CurrentUser() user: AuthUser,
    @Req() req: AuthenticatedRequest
  ) {
    const startTime = performance.now();
    const correlationId = req.correlationId || 'unknown';

     try {
       // Validate tagId
       if (body.tagId === undefined || body.tagId === null) {
         throw new BadRequestError('Valid tagId is required');
       }

       const parsedTagId = Number(body.tagId);
       if (!Number.isInteger(parsedTagId) || parsedTagId <= 0) {
         throw new BadRequestError('Valid tagId is required');
       }

       // Resource-level authorization: Check if user has access to this conversation
       const canAccess = await authorizationService.canAccessConversation(user, conversationId);
       if (!canAccess) {
         throw new ForbiddenError('Not authorized to access this conversation');
       }

       const result = await tagService.addTagToConversation({
         conversationId,
         tagId: parsedTagId,
         userId: user.id,
       });

       if (!result.success) {
         if (result.statusCode === 404) {
           throw new NotFoundError(result.error || 'Conversation or tag not found');
         }
         throw new Error(result.error || 'Failed to add tag to conversation');
       }

      const duration = performance.now() - startTime;
      logger.debug(
        {
          correlationId,
          conversationId,
          tagId: body.tagId,
          durationMs: Math.round(duration),
        },
        'POST /api/conversations/:id/tags completed'
      );

      return {
        data: result.data,
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
        'POST /api/conversations/:id/tags failed'
      );
      throw error;
    }
  }

  /**
   * DELETE /api/conversations/:id/tags/:tagId
   * Remove tag from conversation
   * Allowed roles: admin, manager, user, super_admin (per GOV-021)
   * 
   * Resource-level authorization: User must have access to the conversation
   * GOV-021: All roles can untag conversations (with resource-level auth check)
   */
  @Delete('/conversations/:id/tags/:tagId')
  @Authorized()
  @HttpCode(200)
  async removeTagFromConversation(
    @Param('id') conversationId: string,
    @Param('tagId') tagId: string,
    @CurrentUser() user: AuthUser,
    @Req() req: AuthenticatedRequest
  ) {
    const startTime = performance.now();
    const correlationId = req.correlationId || 'unknown';

    try {
      const parsedTagId = parseInt(tagId, 10);
      if (!Number.isInteger(parsedTagId) || parsedTagId <= 0) {
        throw new BadRequestError('Valid tagId is required');
      }

      // Resource-level authorization: Check if user has access to this conversation
      const canAccess = await authorizationService.canAccessConversation(user, conversationId);
      if (!canAccess) {
        throw new ForbiddenError('Not authorized to access this conversation');
      }

      const result = await tagService.removeTagFromConversation({
        conversationId,
        tagId: parsedTagId,
        userId: user.id,
      });

      if (!result.success) {
        if (result.statusCode === 404) {
          throw new NotFoundError(result.error || 'Conversation or tag not found');
        }
        throw new Error(result.error || 'Failed to remove tag from conversation');
      }

      const duration = performance.now() - startTime;
      logger.debug(
        {
          correlationId,
          conversationId,
          tagId: parsedTagId,
          durationMs: Math.round(duration),
        },
        'DELETE /api/conversations/:id/tags/:tagId completed'
      );

      return {
        data: result.data,
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
        'DELETE /api/conversations/:id/tags/:tagId failed'
      );
      throw error;
    }
  }
}
