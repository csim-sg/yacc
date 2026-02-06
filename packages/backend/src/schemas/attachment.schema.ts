import { pgTable, uuid, varchar, text, timestamp, integer, index } from 'drizzle-orm/pg-core';
import { messages } from './message.schema';

/**
 * Attachments table - stores attachment metadata
 */
export const attachments = pgTable(
  'attachments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    messageId: uuid('message_id')
      .notNull()
      .references(() => messages.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 500 }).notNull(),
    mimeType: varchar('mime_type', { length: 100 }).notNull(),
    size: integer('size').notNull(),
    storageKey: varchar('storage_key', { length: 500 }).notNull(), // S3/R2 object key
    url: text('url').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    messageIdIdx: index('attachments_message_id_idx').on(table.messageId),
  })
);

export type Attachment = typeof attachments.$inferSelect;
export type AttachmentInsert = typeof attachments.$inferInsert;
