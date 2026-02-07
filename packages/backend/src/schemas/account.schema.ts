import { pgTable, text, uuid, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { users } from './user.schema';

/**
 * Account table - BetterAuth OAuth provider accounts
 */
export const account = pgTable(
  'account',
  {
    id: text('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    expiresAt: timestamp('expires_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('account_user_id_idx').on(table.userId),
    uniqueIndex('account_provider_account_idx').on(
      table.providerId,
      table.accountId
    ),
  ]
);

export type Account = typeof account.$inferSelect;
export type AccountInsert = typeof account.$inferInsert;
