/**
 * Message Controller
 * Handles message retrieval and sending
 */

import type { Request, Response } from 'express';
import {
  JsonController,
  Get,
  Post,
  Param,
  Body,
  QueryParams,
  Req,
  Res,
  Authorized,
  HttpCode,
  BadRequestError,
  NotFoundError,
  ForbiddenError,
} from 'routing-controllers';
import { messageService } from '../services/message.service.js';
import { logger } from '../infrastructure/logger.js';
import type { AuthUser } from '../types/auth.types.js';
import type { GetMessagesQuery, SendMessageRequestBody } from '../types/message.types.js';
import { SendMessageRequestSchema } from '../types/message.types.js';

interface AuthenticatedRequest extends Request {
  correlationId?: string;
  user?: AuthUser;
}

function parsePositiveInt(value: unknown, name: string): number | undefined {
  if (value === undefined || value === '') return undefined;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) return undefined;
  return n;
}

function validateGetMessagesQuery(query: Record<string, unknown>): GetMessagesQuery {
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

  const direction = typeof query.direction === 'string' ? query.direction : undefined;
  if (direction !== undefined && !['inbound', 'outbound'].includes(direction)) {
    throw new BadRequestError('Invalid query: direction must be "inbound" or "outbound"');
  }

  return {
    page: query.page ? parsePositiveInt(query.page, 'page') : undefined,
    limit: query.limit ? parsePositiveInt(query.limit, 'limit') : undefined,
    direction: direction as 'inbound' | 'outbound' | undefined,
  };
}

@JsonController('/conversations/:conversationId/messages')
@Authorized()
export class MessageController {
  /**
   * GET /conversations/:conversationId/messages
   * Fetch messages for a conversation with pagination
   */
  @Get()
  async getMessages(
    @Param('conversationId') conversationId: string,
    @QueryParams() queryParams: Record<string, unknown>,
    @Req() req: AuthenticatedRequest,
    @Res() res: Response
  ): Promise<void> {
    const correlationId = req.correlationId || 'unknown';

    try {
      // Validate query parameters
      const query = validateGetMessagesQuery(queryParams);

      // Verify conversation exists
      const conversationExists = await messageService.conversationExists(conversationId);
      if (!conversationExists) {
        logger.warn(
          {
            conversationId,
            correlationId,
            userId: req.user?.id,
          },
          'Conversation not found'
        );
        res.status(404).json({ error: 'Conversation not found' });
        return;
      }

      // Fetch messages
      const { messages, total } = await messageService.getConversationMessages(conversationId, query);

      logger.debug(
        {
          conversationId,
          count: messages.length,
          total,
          correlationId,
        },
        'Messages fetched successfully'
      );

      res.status(200).json({
        messages,
        total,
        page: query.page || 1,
        limit: query.limit || 50,
      });
    } catch (error) {
      if (error instanceof BadRequestError) {
        res.status(400).json({ error: error.message });
        return;
      }

      logger.error(
        {
          conversationId,
          correlationId,
          userId: req.user?.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        'Failed to fetch messages'
      );

      res.status(500).json({ error: 'Failed to fetch messages' });
    }
  }

  /**
   * POST /conversations/:conversationId/messages
   * Send a message to a conversation
   * Role: user, manager only
   */
  @Post()
  @Authorized()
  @HttpCode(201)
  async sendMessage(
    @Param('conversationId') conversationId: string,
    @Body() payload: SendMessageRequestBody,
    @Req() req: AuthenticatedRequest,
    @Res() res: Response
  ): Promise<void> {
    const correlationId = req.correlationId || 'unknown';
    const userId = req.user?.id;
    const userRole = req.user?.role;

    try {
      // Validate user is authenticated
      if (!userId) {
        logger.warn(
          {
            conversationId,
            correlationId,
          },
          'Unauthenticated message send attempt'
        );
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      // Validate role (user and manager can send, admin and super_admin cannot)
      const allowedRoles = ['user', 'manager'];
      if (!allowedRoles.includes(userRole || '')) {
        logger.warn(
          {
            conversationId,
            correlationId,
            userId,
            userRole,
          },
          'Unauthorized message send attempt'
        );
        res.status(403).json({ error: 'Only users and managers can send messages' });
        return;
      }

      // Validate request body using Zod
      const validationResult = SendMessageRequestSchema.safeParse(payload);
      if (!validationResult.success) {
        const errorDetails = validationResult.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        }));

        logger.warn(
          {
            conversationId,
            correlationId,
            userId,
            errors: errorDetails,
          },
          'Invalid message payload'
        );
        res.status(400).json({
          error: 'Invalid request body',
          details: errorDetails,
        });
        return;
      }

      // Verify conversation exists
      const conversationExists = await messageService.conversationExists(conversationId);
      if (!conversationExists) {
        logger.warn(
          {
            conversationId,
            correlationId,
            userId,
          },
          'Conversation not found'
        );
        res.status(404).json({ error: 'Conversation not found' });
        return;
      }

      // Get user's display name
      const userName = await messageService.getUserName(userId);

      // Send message
      const message = await messageService.sendMessage(conversationId, userId, userName, validationResult.data);

      logger.info(
        {
          messageId: message.id,
          conversationId,
          correlationId,
          userId,
          status: message.status,
        },
        'Message sent successfully'
      );

      res.status(201).json(message);
    } catch (error) {
      if (error instanceof BadRequestError) {
        res.status(400).json({ error: error.message });
        return;
      }

      logger.error(
        {
          conversationId,
          correlationId,
          userId,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        'Failed to send message'
      );

       res.status(500).json({ error: 'Failed to send message' });
     }
   }

   /**
    * GET /conversations/:conversationId/messages/:messageId/status
    * Get the status of a specific message
    */
   @Get('/:messageId/status')
   async getMessageStatus(
     @Param('conversationId') conversationId: string,
     @Param('messageId') messageId: string,
     @Req() req: AuthenticatedRequest,
     @Res() res: Response
   ): Promise<void> {
     const correlationId = req.correlationId || 'unknown';

     try {
       // Verify conversation exists
       const conversationExists = await messageService.conversationExists(conversationId);
       if (!conversationExists) {
         logger.warn(
           {
             conversationId,
             messageId,
             correlationId,
           },
           'Conversation not found'
         );
         res.status(404).json({ error: 'Conversation not found' });
         return;
       }

       // Get message
       const message = await messageService.getMessage(messageId);
       if (!message) {
         logger.warn(
           {
             conversationId,
             messageId,
             correlationId,
           },
           'Message not found'
         );
         res.status(404).json({ error: 'Message not found' });
         return;
       }

       // Verify message belongs to conversation
       if (message.conversationId !== conversationId) {
         logger.warn(
           {
             conversationId,
             messageId,
             actualConversationId: message.conversationId,
             correlationId,
           },
           'Message does not belong to conversation'
         );
         res.status(404).json({ error: 'Message not found' });
         return;
       }

       logger.debug(
         {
           conversationId,
           messageId,
           status: message.status,
           correlationId,
         },
         'Message status retrieved'
       );

       res.status(200).json({
         messageId: message.id,
         status: message.status,
         createdAt: message.createdAt,
         updatedAt: message.updatedAt,
       });
     } catch (error) {
       logger.error(
         {
           conversationId,
           messageId,
           correlationId,
           error: error instanceof Error ? error.message : 'Unknown error',
         },
         'Failed to get message status'
       );

       res.status(500).json({ error: 'Failed to get message status' });
     }
   }
}
