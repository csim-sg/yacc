import { pgTable, text, timestamp, index } from 'drizzle-orm/pg-core';

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
  (table) => [
    index('verification_identifier_idx').on(table.identifier),
    index('verification_expires_at_idx').on(table.expiresAt),
  ]
);

export type Verification = typeof verification.$inferSelect;
export type VerificationInsert = typeof verification.$inferInsert;
