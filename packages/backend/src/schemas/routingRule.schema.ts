import { pgTable, uuid, varchar, text, timestamp, integer, jsonb, index } from 'drizzle-orm/pg-core';
import { users } from './user.schema';

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
  (table) => [
    index('routing_rules_status_idx').on(table.status),
    index('routing_rules_priority_idx').on(table.priority),
  ]
);

export type RoutingRule = typeof routingRules.$inferSelect;
export type RoutingRuleInsert = typeof routingRules.$inferInsert;
