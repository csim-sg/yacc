/**
 * Routing Rules Service
 * Handles CRUD operations for routing rules
 * Admin+ only access
 */

import { eq, desc, sql } from 'drizzle-orm';
import { dbClient } from '../infrastructure/db.client';
import { logger } from '../infrastructure/logger';
import { routingRules } from '../schemas/routingRule.schema';
import { routingRuleExecutions } from '../schemas/routingRuleExecution.schema';
import { tags } from '../schemas/tag.schema';
import { users } from '../schemas/user.schema';
import type {
  CreateRoutingRuleRequest,
  UpdateRoutingRuleRequest,
  RoutingCondition,
  RoutingAction,
} from '../types/routingRules.types';
import { auditService } from './audit.service';

/**
 * Routing Rules Service
 */
export class RoutingRulesService {
  /**
   * Create a new routing rule
   * Validates all user/tag references in conditions and actions
   */
  async createRule(createdById: string, request: CreateRoutingRuleRequest) {
    const { name, description, status, priority, conditions, actions } = request;

    try {
      // Validate input
      if (!name || name.trim().length === 0) {
        throw new Error('Rule name is required');
      }

      if (name.trim().length > 255) {
        throw new Error('Rule name must be 255 characters or less');
      }

      if (priority < 0 || priority > 9999) {
        throw new Error('Priority must be between 0 and 9999');
      }

      // Validate conditions
      if (!Array.isArray(conditions) || conditions.length === 0) {
        throw new Error('At least one condition is required');
      }

      await this.validateConditions(conditions);

      // Validate actions
      if (!Array.isArray(actions) || actions.length === 0) {
        throw new Error('At least one action is required');
      }

      await this.validateActions(actions);

      // Create rule
       const result = await dbClient
         .insert(routingRules)
         .values({
           name: name.trim(),
           description: description?.trim() || undefined,
           status,
           priority,
           conditions: conditions as unknown,
           actions: actions as unknown,
           createdById,
         })
         .returning();

      const createdRule = result[0];

      // Audit log
      await auditService.logAction({
        actorId: createdById,
        action: 'rule.created',
        entityType: 'rule',
        entityId: createdRule.id,
        metadata: {
          ruleName: createdRule.name,
          status: createdRule.status,
          priority: createdRule.priority,
          conditions: conditions.length,
          actions: actions.length,
        },
      });

      logger.info(
        { ruleId: createdRule.id, userId: createdById, ruleName: createdRule.name },
        'Rule created successfully'
      );

      return createdRule;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error(
        { error: message, userId: createdById, ruleName: request.name },
        'Failed to create rule'
      );
      throw error;
    }
  }

  /**
   * List all active routing rules
   */
  async listRules() {
    try {
       const allRules = (await dbClient
         .select()
         .from(routingRules)
         .orderBy(routingRules.priority)) as Array<typeof routingRules.$inferSelect>;

      logger.info(
        { count: allRules.length },
        'Rules listed successfully'
      );

      return allRules;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error(
        { error: message },
        'Failed to list rules'
      );
      throw error;
    }
  }

  /**
   * Get a single rule by ID
   */
  async getRule(ruleId: string) {
    try {
      const rule = await dbClient
        .select()
        .from(routingRules)
        .where(eq(routingRules.id, ruleId))
        .limit(1);

      if (rule.length === 0) {
        throw new Error('Rule not found');
      }

      return rule[0];
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error(
        { error: message, ruleId },
        'Failed to fetch rule'
      );
      throw error;
    }
  }

  /**
   * Update a routing rule
   * Validates all user/tag references if conditions/actions are updated
   */
  async updateRule(userId: string, ruleId: string, request: UpdateRoutingRuleRequest) {
    try {
       // Verify rule exists (throws if not found)
       await this.getRule(ruleId);

       // Validate updates
      if (request.name !== undefined) {
        if (request.name.trim().length === 0) {
          throw new Error('Rule name is required');
        }
        if (request.name.trim().length > 255) {
          throw new Error('Rule name must be 255 characters or less');
        }
      }

      if (request.priority !== undefined) {
        if (request.priority < 0 || request.priority > 9999) {
          throw new Error('Priority must be between 0 and 9999');
        }
      }

      // Validate conditions if provided
      if (request.conditions !== undefined) {
        if (!Array.isArray(request.conditions) || request.conditions.length === 0) {
          throw new Error('At least one condition is required');
        }
        await this.validateConditions(request.conditions);
      }

      // Validate actions if provided
      if (request.actions !== undefined) {
        if (!Array.isArray(request.actions) || request.actions.length === 0) {
          throw new Error('At least one action is required');
        }
        await this.validateActions(request.actions);
      }

       // Build update payload
       const updatePayload: Record<string, unknown> = {
         updatedAt: new Date(),
       };

      if (request.name !== undefined) updatePayload.name = request.name.trim();
      if (request.description !== undefined) updatePayload.description = request.description?.trim();
      if (request.status !== undefined) updatePayload.status = request.status;
      if (request.priority !== undefined) updatePayload.priority = request.priority;
      if (request.conditions !== undefined) updatePayload.conditions = request.conditions;
      if (request.actions !== undefined) updatePayload.actions = request.actions;

      // Update rule
      const result = await dbClient
        .update(routingRules)
        .set(updatePayload)
        .where(eq(routingRules.id, ruleId))
        .returning();

      const updatedRule = result[0];

      // Audit log
      await auditService.logAction({
        actorId: userId,
        action: 'rule.updated',
        entityType: 'rule',
        entityId: ruleId,
        metadata: {
          ruleName: updatedRule.name,
          changes: {
            name: request.name !== undefined,
            status: request.status !== undefined,
            priority: request.priority !== undefined,
            conditions: request.conditions !== undefined,
            actions: request.actions !== undefined,
          },
        },
      });

      logger.info(
        { ruleId, userId },
        'Rule updated successfully'
      );

      return updatedRule;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error(
        { error: message, userId, ruleId },
        'Failed to update rule'
      );
      throw error;
    }
  }

  /**
   * Delete a routing rule
   */
  async deleteRule(userId: string, ruleId: string) {
    try {
      // Verify rule exists
      const existing = await this.getRule(ruleId);

      // Delete rule (cascade will handle routing_rule_executions)
      await dbClient
        .delete(routingRules)
        .where(eq(routingRules.id, ruleId));

      // Audit log
      await auditService.logAction({
        actorId: userId,
        action: 'rule.deleted',
        entityType: 'rule',
        entityId: ruleId,
        metadata: {
          ruleName: existing.name,
        },
      });

      logger.info(
        { ruleId, userId },
        'Rule deleted successfully'
      );

      return { success: true };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error(
        { error: message, userId, ruleId },
        'Failed to delete rule'
      );
      throw error;
    }
  }

  /**
   * Get rule execution logs with pagination
   */
  async getRuleExecutions(ruleId: string, page: number = 1, pageSize: number = 50) {
    try {
      const limit = Math.min(100, Math.max(1, pageSize));
      const offset = Math.max(0, (page - 1) * limit);

      // Get total count
      const countResult = await dbClient
        .select({ count: sql<number>`cast(count(*) as integer)` })
        .from(routingRuleExecutions)
        .where(eq(routingRuleExecutions.ruleId, ruleId));

      const total = Number(countResult[0]?.count || 0);

      // Fetch paginated executions
      const executions = await dbClient
        .select()
        .from(routingRuleExecutions)
        .where(eq(routingRuleExecutions.ruleId, ruleId))
        .orderBy(desc(routingRuleExecutions.createdAt))
        .limit(limit)
        .offset(offset);

      logger.debug(
        { ruleId, count: executions.length, total, page, limit },
        'Fetched rule executions'
      );

      return { executions, total, page, pageSize: limit };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error(
        { error: message, ruleId },
        'Failed to fetch rule executions'
      );
      throw error;
    }
  }

  /**
   * Validate all conditions in a rule
   * Checks that referenced users/tags exist
   */
  private async validateConditions(conditions: RoutingCondition[]): Promise<void> {
    for (const condition of conditions) {
      const { field, operator, value } = condition;

      // Validate field
      if (!['channel', 'keyword', 'sender', 'tag', 'time'].includes(field)) {
        throw new Error(`Invalid condition field: ${field}`);
      }

      // Validate operator for field
      const validOperators: Record<string, string[]> = {
        channel: ['eq'],
        keyword: ['contains', 'regex'],
        sender: ['eq'],
        tag: ['has'],
        time: ['gt', 'lt'],
      };

      if (!validOperators[field]?.includes(operator)) {
        throw new Error(`Invalid operator ${operator} for field ${field}`);
      }

      // Validate regex if regex operator
      if (operator === 'regex') {
        try {
          new RegExp(value as string);
        } catch {
          throw new Error(`Invalid regex pattern: ${value}`);
        }
      }

       // Validate tag exists if tag field
       if (field === 'tag') {
         const tagResult = await dbClient
           .select()
           .from(tags)
           .where(eq(tags.id, typeof value === 'number' ? value : parseInt(String(value), 10)))
           .limit(1);

        if (tagResult.length === 0) {
          throw new Error(`Tag ${value} not found`);
        }
      }
    }
  }

  /**
   * Validate all actions in a rule
   * Checks that referenced users exist and priorities are valid
   */
  private async validateActions(actions: RoutingAction[]): Promise<void> {
    const validPriorities = ['low', 'normal', 'high', 'urgent'];

    for (const action of actions) {
      const { type, value } = action;

      // Validate action type
      if (!['assign', 'tag', 'priority'].includes(type)) {
        throw new Error(`Invalid action type: ${type}`);
      }

      // Validate user exists for assign action
      if (type === 'assign') {
        const userResult = await dbClient
          .select()
          .from(users)
          .where(eq(users.id, value))
          .limit(1);

        if (userResult.length === 0) {
          throw new Error(`User ${value} not found`);
        }
      }

      // Validate priority for priority action
      if (type === 'priority') {
        if (!validPriorities.includes(value)) {
          throw new Error(`Invalid priority: ${value}. Must be one of: ${validPriorities.join(', ')}`);
        }
      }

       // Validate tag exists for tag action
       if (type === 'tag') {
         const tagResult = await dbClient
           .select()
           .from(tags)
           .where(eq(tags.id, typeof value === 'number' ? value : parseInt(String(value), 10)))
           .limit(1);

        if (tagResult.length === 0) {
          throw new Error(`Tag ${value} not found`);
        }
      }
    }
  }
}

export const routingRulesService = new RoutingRulesService();
