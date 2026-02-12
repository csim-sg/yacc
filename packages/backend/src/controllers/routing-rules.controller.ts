/**
 * Routing Rules Controller
 * Handles routing rules CRUD endpoints: create, list, update, delete, query executions
 * Admin+ only access
 */

import type { Request } from 'express';
import type { AuthUser } from '../types/auth.types';
import type { CreateRoutingRuleRequest, UpdateRoutingRuleRequest } from '../types/routingRules.types';
import {
  JsonController,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Req,
  CurrentUser,
  HttpCode,
  BadRequestError,
  NotFoundError,
  ForbiddenError,
  QueryParams,
  Authorized,
} from 'routing-controllers';
import { routingRulesService } from '../services/routing-rules.service';
import { logger } from '../infrastructure/logger';

interface AuthenticatedRequest extends Request {
  correlationId?: string;
}

/**
 * Routing Rules API endpoints
 * Admin+ for create/update/delete
 * Manager+ for list and query executions
 */
@JsonController('/api/routing-rules')
@Authorized()
export class RoutingRulesController {
  /**
   * GET /routing-rules
   * List all routing rules (manager+ only)
   */
  @Get()
  @HttpCode(200)
  async listRules(
    @Req() req: AuthenticatedRequest,
    @CurrentUser() user: AuthUser
  ) {
    const correlationId = req.correlationId || 'unknown';

    try {
      // RBAC check: manager+ can list
      if (!['super_admin', 'admin', 'manager'].includes(user.role)) {
        logger.warn(
          {
            userId: user.id,
            userRole: user.role,
            correlationId,
          },
          'List routing rules attempt by unauthorized user'
        );
        throw new ForbiddenError('Only manager or higher can list routing rules');
      }

      logger.info(
        { userId: user.id, correlationId },
        'Listing routing rules'
      );

      const rules = await routingRulesService.listRules();

      logger.info(
        { userId: user.id, count: rules.length, correlationId },
        'Routing rules listed successfully'
      );

      return { data: rules };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error(
        { error: message, userId: user.id, correlationId },
        'Failed to list routing rules'
      );
      throw new BadRequestError(message);
    }
  }

  /**
   * POST /routing-rules
   * Create a new routing rule (admin+ only)
   */
  @Post()
  @HttpCode(201)
  async createRule(
    @Req() req: AuthenticatedRequest,
    @Body() body: CreateRoutingRuleRequest,
    @CurrentUser() user: AuthUser
  ) {
    const correlationId = req.correlationId || 'unknown';

    try {
      // RBAC check: only admin+ can create
      if (!['super_admin', 'admin'].includes(user.role)) {
        logger.warn(
          {
            userId: user.id,
            userRole: user.role,
            correlationId,
          },
          'Create routing rule attempt by unauthorized user'
        );
        throw new ForbiddenError('Only admin or higher can create routing rules');
      }

      logger.info(
        { userId: user.id, ruleName: body.name, correlationId },
        'Creating routing rule'
      );

      const rule = await routingRulesService.createRule(user.id, body);

      logger.info(
        { userId: user.id, ruleId: rule.id, correlationId },
        'Routing rule created successfully'
      );

      return { data: rule };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error(
        { error: message, userId: user.id, correlationId },
        'Failed to create routing rule'
      );
      throw new BadRequestError(message);
    }
  }

  /**
   * PATCH /routing-rules/:id
   * Update a routing rule (admin+ only)
   */
  @Patch('/:id')
  @HttpCode(200)
  async updateRule(
    @Req() req: AuthenticatedRequest,
    @Param('id') ruleId: string,
    @Body() body: UpdateRoutingRuleRequest,
    @CurrentUser() user: AuthUser
  ) {
    const correlationId = req.correlationId || 'unknown';

    try {
      // RBAC check: only admin+ can update
      if (!['super_admin', 'admin'].includes(user.role)) {
        logger.warn(
          {
            userId: user.id,
            userRole: user.role,
            ruleId,
            correlationId,
          },
          'Update routing rule attempt by unauthorized user'
        );
        throw new ForbiddenError('Only admin or higher can update routing rules');
      }

      logger.info(
        { userId: user.id, ruleId, correlationId },
        'Updating routing rule'
      );

      const rule = await routingRulesService.updateRule(user.id, ruleId, body);

      logger.info(
        { userId: user.id, ruleId, correlationId },
        'Routing rule updated successfully'
      );

      return { data: rule };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error(
        { error: message, userId: user.id, ruleId, correlationId },
        'Failed to update routing rule'
      );

      if (message.includes('not found')) {
        throw new NotFoundError(message);
      }
      throw new BadRequestError(message);
    }
  }

  /**
   * DELETE /routing-rules/:id
   * Delete a routing rule (admin+ only)
   */
  @Delete('/:id')
  @HttpCode(200)
  async deleteRule(
    @Req() req: AuthenticatedRequest,
    @Param('id') ruleId: string,
    @CurrentUser() user: AuthUser
  ) {
    const correlationId = req.correlationId || 'unknown';

    try {
      // RBAC check: only admin+ can delete
      if (!['super_admin', 'admin'].includes(user.role)) {
        logger.warn(
          {
            userId: user.id,
            userRole: user.role,
            ruleId,
            correlationId,
          },
          'Delete routing rule attempt by unauthorized user'
        );
        throw new ForbiddenError('Only admin or higher can delete routing rules');
      }

      logger.info(
        { userId: user.id, ruleId, correlationId },
        'Deleting routing rule'
      );

      const result = await routingRulesService.deleteRule(user.id, ruleId);

      logger.info(
        { userId: user.id, ruleId, correlationId },
        'Routing rule deleted successfully'
      );

      return { data: result };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error(
        { error: message, userId: user.id, ruleId, correlationId },
        'Failed to delete routing rule'
      );

      if (message.includes('not found')) {
        throw new NotFoundError(message);
      }
      throw new BadRequestError(message);
    }
  }

  /**
   * GET /routing-rules/:id/executions
   * Query rule execution logs (manager+ only)
   */
  @Get('/:id/executions')
  @HttpCode(200)
  async getRuleExecutions(
    @Req() req: AuthenticatedRequest,
    @Param('id') ruleId: string,
    @QueryParams() query: Record<string, unknown>,
    @CurrentUser() user: AuthUser
  ) {
    const correlationId = req.correlationId || 'unknown';

    try {
      // RBAC check: manager+ can query executions
      if (!['super_admin', 'admin', 'manager'].includes(user.role)) {
        logger.warn(
          {
            userId: user.id,
            userRole: user.role,
            ruleId,
            correlationId,
          },
          'Query rule executions attempt by unauthorized user'
        );
        throw new ForbiddenError('Only manager or higher can query rule executions');
      }

      // Parse pagination params
      const page = query.page ? Math.max(1, parseInt(query.page as string, 10)) : 1;
      const pageSize = query.pageSize ? Math.min(100, Math.max(1, parseInt(query.pageSize as string, 10))) : 50;

      logger.info(
        { userId: user.id, ruleId, page, pageSize, correlationId },
        'Fetching rule execution logs'
      );

      const result = await routingRulesService.getRuleExecutions(ruleId, page, pageSize);

      logger.info(
        { userId: user.id, ruleId, count: result.executions.length, correlationId },
        'Rule execution logs fetched successfully'
      );

      return {
        data: result.executions,
        page: result.page,
        pageSize: result.pageSize,
        total: result.total,
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error(
        { error: message, userId: user.id, ruleId, correlationId },
        'Failed to fetch rule execution logs'
      );
      throw new BadRequestError(message);
    }
  }
}
