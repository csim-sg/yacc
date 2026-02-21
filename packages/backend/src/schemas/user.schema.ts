import { boolean, pgTable, text, timestamp, varchar, index } from 'drizzle-orm/pg-core';
import { userRoleEnum } from '../enums/userRole.enum';
import { userStatusEnum } from '../enums/userStatus.enum';

/**
 * Users table - stores user accounts and authentication
 * 
 * Note: ID is TEXT (not UUID) because BetterAuth generates text-based user IDs.
 * BetterAuth Drizzle adapter expects this format.
 * 
 * Soft delete: deletedAt column used for soft deletes (user not removed from DB)
 */
export const users = pgTable(
  'users',
  {
    id: text('id').primaryKey(),
    email: varchar('email', { length: 255 }).notNull().unique(),
    name: varchar('name', { length: 255 }).notNull(),
    passwordHash: text('password_hash').notNull(),
    role: userRoleEnum('role').notNull().default('user'),
    status: userStatusEnum('status').notNull().default('active'),
    emailVerified: boolean('email_verified').notNull().default(false),
    image: text('image'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
    lastLoginAt: timestamp('last_login_at'),
    deletedAt: timestamp('deleted_at'),
  },
  (table) => [
    index('users_email_idx').on(table.email),
    index('users_role_idx').on(table.role),
    index('users_status_idx').on(table.status),
    index('users_deleted_at_idx').on(table.deletedAt),
  ]
);

export type User = typeof users.$inferSelect;
export type UserInsert = typeof users.$inferInsert;