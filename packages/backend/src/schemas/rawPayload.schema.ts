import { pgTable, serial, uuid, varchar, timestamp, jsonb, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { messages } from './message.schema';

/**
 * RawPayloads table - stores raw payloads from external platforms (7-day retention)
 */
export const rawPayloads = pgTable(
  'raw_payloads',
  {
    id: serial('id').primaryKey(),
    messageId: uuid('message_id')
      .notNull()
      .references(() => messages.id, { onDelete: 'cascade' }),
    platform: varchar('platform', { length: 50 }).notNull(), // 'telegram', 'irc', etc.
    payload: jsonb('payload').notNull(),
    storageKey: varchar('storage_key', { length: 500 }), // S3/R2 object key for large payloads
    expiresAt: timestamp('expires_at')
      .notNull()
      .default(sql`NOW() + INTERVAL '7 days'`),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    messageIdIdx: index('raw_payloads_message_id_idx').on(table.messageId),
    expiresAtIdx: index('raw_payloads_expires_at_idx').on(table.expiresAt),
  })
);

export type RawPayload = typeof rawPayloads.$inferSelect;
export type RawPayloadInsert = typeof rawPayloads.$inferInsert;
