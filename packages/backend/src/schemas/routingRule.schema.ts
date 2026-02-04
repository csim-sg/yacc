import { pgTable, uuid, varchar, text, timestamp, integer, jsonb, serial, index } from 'drizzle-orm/pg-core';
import { users } from './user.schema';
import { conversations } from './conversation.schema';

/**
 * RoutingRules table - stores automated routing rules
 */
export const routingRules = pgTable(
  'routing_rules',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    status: varchar('status', { length: 50 }).notNull().default('active'), // 'active', 'disabled'
    priority: integer('priority').notNull().default(999), // Lower number = higher priority
    conditions: jsonb('conditions').notNull(), // JSON array of conditions
    actions: jsonb('actions').notNull(), // JSON array of actions
    createdById: uuid('created_by_id')
      .notNull()
      .references(() => users.id, { onDelete: 'set null' }),
    lastRunAt: timestamp('last_run_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    statusIdx: index('routing_rules_status_idx').on(table.status),
    priorityIdx: index('routing_rules_priority_idx').on(table.priority),
  })
);

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
  (table) => ({
    ruleIdIdx: index('routing_rule_executions_rule_id_idx').on(table.ruleId),
    conversationIdIdx: index('routing_rule_executions_conversation_id_idx').on(table.conversationId),
  })
);

export type RoutingRule = typeof routingRules.$inferSelect;
export type RoutingRuleInsert = typeof routingRules.$inferInsert;

export type RoutingRuleExecution = typeof routingRuleExecutions.$inferSelect;
export type RoutingRuleExecutionInsert = typeof routingRuleExecutions.$inferInsert;
