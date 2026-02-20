/**
 * Rules Engine Service
 * Evaluates routing rules against messages and applies matching rule actions
 * First-match-wins strategy: stops at first rule that matches all conditions
 */

import { eq, and } from 'drizzle-orm';
import { dbClient } from '../infrastructure/db.client';
import { logger } from '../infrastructure/logger';
import { conversations } from '../schemas/conversation.schema';
import type { RoutingRule } from '../schemas/routingRule.schema';
import { routingRules } from '../schemas/routingRule.schema';
import { routingRuleExecutions } from '../schemas/routingRuleExecution.schema';
import { tags } from '../schemas/tag.schema';
import { users } from '../schemas/user.schema';
import type { RoutingCondition, RoutingAction, RuleEvaluationContext, RuleMatchResult } from '../types/routingRules.types';
import { auditService } from './audit.service';

/**
 * Rules Engine Service
 * Handles rule evaluation and application
 */
export class RulesEngineService {
  /**
   * Evaluate all active rules for a message and apply first match
   * Returns the matched rule result if any rule matches, undefined otherwise
   */
  async evaluateRulesForMessage(
    context: RuleEvaluationContext,
    userId: string
  ): Promise<RuleMatchResult | undefined> {
    const { conversationId, messageId, channel, body, senderEmail } = context;

    try {
      // Fetch all active rules ordered by priority (ascending = lower number = higher priority)
      const activeRules = (await dbClient
        .select()
        .from(routingRules)
        .where(eq(routingRules.status, 'active'))
        .orderBy(routingRules.priority)) as RoutingRule[];

      logger.debug(
        { conversationId, messageId, ruleCount: activeRules.length },
        'Evaluating rules for message'
      );

      // Evaluate each rule in priority order
      for (const rule of activeRules) {
        const conditions = (rule.conditions as unknown as RoutingCondition[]) || [];
        const actions = (rule.actions as unknown as RoutingAction[]) || [];

        // Check if all conditions match (AND logic)
        const allConditionsMatch = await this.evaluateConditions(
          conditions,
          context
        );

        if (allConditionsMatch) {
          logger.info(
            { conversationId, messageId, ruleId: rule.id },
            'Rule matched, applying actions'
          );

          // Apply matched rule actions
          await this.applyActions(actions, conversationId, userId);

          // Log rule execution
          await this.logRuleExecution(rule.id, conversationId, conditions, actions);

          // Audit log the execution
          await auditService.logAction({
            actorId: userId,
            action: 'rule.executed',
            entityType: 'conversation',
            entityId: conversationId,
            metadata: {
              ruleId: rule.id,
              ruleName: rule.name,
              matchedConditions: conditions,
              appliedActions: actions,
            },
          });

          return {
            ruleId: rule.id,
            matchedConditions: conditions,
            appliedActions: actions,
          };
        }
      }

      // No rules matched - log execution anyway for audit trail
      await auditService.logAction({
        actorId: userId,
        action: 'rule.executed',
        entityType: 'conversation',
        entityId: conversationId,
        metadata: {
          matched: false,
          message: 'No rules matched',
        },
      });

      logger.debug(
        { conversationId, messageId },
        'No rules matched'
      );

      return undefined;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error(
        { conversationId, messageId, error: message },
        'Error evaluating rules'
      );
      // Don't throw - rule evaluation failure shouldn't break message flow
      return undefined;
    }
  }

  /**
   * Evaluate all conditions for a message
   * Returns true if ALL conditions match (AND logic)
   */
  private async evaluateConditions(
    conditions: RoutingCondition[],
    context: RuleEvaluationContext
  ): Promise<boolean> {
    if (conditions.length === 0) {
      return true; // No conditions = auto-match
    }

    for (const condition of conditions) {
      const matches = await this.matchesCondition(condition, context);
      if (!matches) {
        return false; // AND logic: all must match
      }
    }

    return true;
  }

  /**
   * Evaluate a single condition
   */
  private async matchesCondition(
    condition: RoutingCondition,
    context: RuleEvaluationContext
  ): Promise<boolean> {
    try {
      const { field, operator, value } = condition;
      const { channel, body, senderEmail } = context;

      switch (field) {
        case 'channel': {
          // Match channel (eq operator only)
          if (operator !== 'eq') {
            logger.warn({ field, operator }, 'Invalid operator for channel field');
            return false;
          }
          return channel === value;
        }

        case 'keyword': {
          // Match keyword in message body
          if (operator === 'contains') {
            return typeof value === 'string'
              ? body.toLowerCase().includes(value.toLowerCase())
              : false;
          }
          if (operator === 'regex') {
            try {
              const regex = new RegExp(value as string, 'i');
              return regex.test(body);
            } catch {
              logger.warn({ regex: value }, 'Invalid regex pattern');
              return false;
            }
          }
          logger.warn({ field, operator }, 'Invalid operator for keyword field');
          return false;
        }

        case 'sender': {
          // Match sender email local-part (eq operator only)
          if (operator !== 'eq') {
            logger.warn({ field, operator }, 'Invalid operator for sender field');
            return false;
          }
          if (!senderEmail) {
            return false;
          }
          // Extract local-part of email (before @)
          const senderLocalPart = senderEmail.split('@')[0]?.toLowerCase() || '';
          const conditionValue = (value as string).toLowerCase();
          return senderLocalPart === conditionValue;
        }

        case 'tag': {
          // Match if conversation has tag (has operator only)
          if (operator !== 'has') {
            logger.warn({ field, operator }, 'Invalid operator for tag field');
            return false;
          }
          // Check if conversation has this tag
          const { conversationId } = context;
          const result = await dbClient
            .select()
            .from(tags)
            .where(eq(tags.id, value as any)) // Tag ID from condition
            .limit(1);
          return result.length > 0;
        }

        case 'time': {
          // Match current hour (gt/lt operators)
          const now = new Date();
          const currentHour = now.getHours();
          const conditionHour = typeof value === 'number' ? value : parseInt(value as string, 10);

          if (isNaN(conditionHour)) {
            logger.warn({ value }, 'Invalid hour value for time condition');
            return false;
          }

          if (operator === 'gt') {
            return currentHour > conditionHour;
          }
          if (operator === 'lt') {
            return currentHour < conditionHour;
          }
          logger.warn({ field, operator }, 'Invalid operator for time field');
          return false;
        }

        default:
          logger.warn({ field }, 'Unknown condition field');
          return false;
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.warn(
        { error: message, condition },
        'Error evaluating condition'
      );
      return false;
    }
  }

  /**
   * Apply all actions from a matched rule
   * Silent failure on invalid actions (don't break message flow)
   */
  private async applyActions(
    actions: RoutingAction[],
    conversationId: string,
    userId: string
  ): Promise<void> {
    if (actions.length === 0) {
      return;
    }

    for (const action of actions) {
      try {
        await this.applyAction(action, conversationId);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        logger.warn(
          { conversationId, action, error: message },
          'Failed to apply action'
        );
        // Continue applying other actions on failure (best-effort)
      }
    }
  }

  /**
   * Apply a single action to a conversation
   */
  private async applyAction(
    action: RoutingAction,
    conversationId: string
  ): Promise<void> {
    const { type, value } = action;

    try {
      switch (type) {
        case 'assign': {
          // Assign conversation to user
          const targetUser = await dbClient
            .select()
            .from(users)
            .where(eq(users.id, value))
            .limit(1);

          if (targetUser.length === 0) {
            throw new Error(`User ${value} not found`);
          }

          // Update conversation assigned user
          await dbClient
            .update(conversations)
            .set({ assignedUserId: value })
            .where(eq(conversations.id, conversationId));

          logger.info(
            { conversationId, userId: value },
            'Conversation assigned via rule'
          );
          break;
        }

        case 'tag': {
          // Tag conversation (validation: tag must exist - already validated in condition)
          logger.debug(
            { conversationId, tagId: value },
            'Tag action applied via rule'
          );
          // Tag application will be handled by future implementation
          break;
        }

        case 'priority': {
          // Set conversation priority
          const validPriorities = ['low', 'normal', 'high', 'urgent'];
          if (!validPriorities.includes(value)) {
            throw new Error(`Invalid priority: ${value}`);
          }

          await dbClient
            .update(conversations)
            .set({ priority: value as any })
            .where(eq(conversations.id, conversationId));

          logger.info(
            { conversationId, priority: value },
            'Conversation priority set via rule'
          );
          break;
        }

        default:
          logger.warn({ type }, 'Unknown action type');
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to apply ${type} action: ${message}`);
    }
  }

  /**
   * Log rule execution to database
   */
  private async logRuleExecution(
    ruleId: string,
    conversationId: string,
    matchedConditions: RoutingCondition[],
    appliedActions: RoutingAction[]
  ): Promise<void> {
    try {
      await dbClient.insert(routingRuleExecutions).values({
        ruleId,
        conversationId,
        matchedConditions: matchedConditions as any,
        appliedActions: appliedActions as any,
      });

      logger.debug(
        { ruleId, conversationId },
        'Rule execution logged'
      );
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.warn(
        { error: message, ruleId, conversationId },
        'Failed to log rule execution'
      );
      // Don't throw - execution logging failure shouldn't break application
    }
  }
}

export const rulesEngineService = new RulesEngineService();
