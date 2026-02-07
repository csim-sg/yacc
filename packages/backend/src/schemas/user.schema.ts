import { boolean, pgTable, text, timestamp, uuid, varchar, index } from 'drizzle-orm/pg-core';
import { userRoleEnum, userStatusEnum } from './enums/index';

/**
 * Users table - stores user accounts and authentication
 */
export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
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
  },
  (table) => [
    index('users_email_idx').on(table.email),
    index('users_role_idx').on(table.role),
    index('users_status_idx').on(table.status),
  ]
);

export type User = typeof users.$inferSelect;
export type UserInsert = typeof users.$inferInsert;