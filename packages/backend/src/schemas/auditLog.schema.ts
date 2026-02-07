import { pgTable, uuid, varchar, timestamp, jsonb, index } from 'drizzle-orm/pg-core';
import { users } from './user.schema';

/**
 * AuditLogs table - comprehensive audit trail of all actions
 */
export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    actorId: uuid('actor_id').references(() => users.id, { onDelete: 'set null' }),
    action: varchar('action', { length: 255 }).notNull(), // e.g., 'assignment', 'tag', 'note', 'status_change'
    entityType: varchar('entity_type', { length: 50 }).notNull(), // e.g., 'conversation', 'message', 'user'
    entityId: uuid('entity_id').notNull(),
    metadata: jsonb('metadata'), // Additional context (old value, new value, etc.)
    ipAddress: varchar('ip_address', { length: 45 }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    index('audit_logs_actor_id_idx').on(table.actorId),
    index('audit_logs_action_idx').on(table.action),
    index('audit_logs_entity_type_idx').on(table.entityType),
    index('audit_logs_created_at_idx').on(table.createdAt),
  ]
);

export type AuditLog = typeof auditLogs.$inferSelect;
export type AuditLogInsert = typeof auditLogs.$inferInsert;
