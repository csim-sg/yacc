import { pgTable, text, timestamp, varchar, index } from 'drizzle-orm/pg-core';
import { users } from './user.schema';

/**
 * Session table - BetterAuth session management
 */
export const session = pgTable(
  'session',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: timestamp('expires_at').notNull(),
    token: text('token').notNull().unique(),
    ipAddress: varchar('ip_address', { length: 45 }),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('session_user_id_idx').on(table.userId),
    index('session_token_idx').on(table.token),
    index('session_expires_at_idx').on(table.expiresAt),
  ]
);

export type Session = typeof session.$inferSelect;
export type SessionInsert = typeof session.$inferInsert;
