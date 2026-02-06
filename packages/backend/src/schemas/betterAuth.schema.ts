import { pgTable, text, uuid, timestamp, varchar, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { users } from './user.schema';

/**
 * Session table - BetterAuth session management
 */
export const session = pgTable(
  'session',
  {
    id: text('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: timestamp('expires_at').notNull(),
    token: text('token').notNull().unique(),
    ipAddress: varchar('ip_address', { length: 45 }),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    userIdIdx: index('session_user_id_idx').on(table.userId),
    tokenIdx: index('session_token_idx').on(table.token),
    expiresAtIdx: index('session_expires_at_idx').on(table.expiresAt),
  })
);

/**
 * Verification table - BetterAuth email/phone verification
 */
export const verification = pgTable(
  'verification',
  {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(), // email or phone
    value: text('value').notNull(), // verification code/token
    expiresAt: timestamp('expires_at').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    identifierIdx: index('verification_identifier_idx').on(table.identifier),
    expiresAtIdx: index('verification_expires_at_idx').on(table.expiresAt),
  })
);

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
  (table) => ({
    userIdIdx: index('account_user_id_idx').on(table.userId),
    providerAccountIdx: uniqueIndex('account_provider_account_idx').on(
      table.providerId,
      table.accountId
    ),
  })
);

export type Session = typeof session.$inferSelect;
export type SessionInsert = typeof session.$inferInsert;

export type Verification = typeof verification.$inferSelect;
export type VerificationInsert = typeof verification.$inferInsert;

export type Account = typeof account.$inferSelect;
export type AccountInsert = typeof account.$inferInsert;
