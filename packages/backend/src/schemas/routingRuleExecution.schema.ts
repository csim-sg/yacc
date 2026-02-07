import { pgTable, uuid, serial, timestamp, jsonb, index } from 'drizzle-orm/pg-core';
import { routingRules } from './routingRule.schema';
import { conversations } from './conversation.schema';

/**
 * RoutingRuleExecutions table - audit trail of rule executions
 */
export const routingRuleExecutions = pgTable(
  'routing_rule_executions',
  {
    id: serial('id').primaryKey(),
    ruleId: uuid('rule_id')
      .notNull()
      .references(() => routingRules.id, { onDelete: 'cascade' }),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    matchedConditions: jsonb('matched_conditions'),
    appliedActions: jsonb('applied_actions'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    index('routing_rule_executions_rule_id_idx').on(table.ruleId),
    index('routing_rule_executions_conversation_id_idx').on(table.conversationId),
  ]
);

export type RoutingRuleExecution = typeof routingRuleExecutions.$inferSelect;
export type RoutingRuleExecutionInsert = typeof routingRuleExecutions.$inferInsert;
