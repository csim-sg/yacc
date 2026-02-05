import { pgTable, uuid, text, timestamp, jsonb, index } from 'drizzle-orm/pg-core';
import { conversations } from './conversation.schema';
import { users } from './user.schema';

/**
 * Notes table - internal notes on conversations (not sent to customers)
 */
export const notes = pgTable(
  'notes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    authorId: uuid('author_id')
      .notNull()
      .references(() => users.id, { onDelete: 'set null' }),
    body: text('body').notNull(),
    mentions: jsonb('mentions'), // Array of user IDs mentioned in note
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    conversationIdIdx: index('notes_conversation_id_idx').on(table.conversationId),
    authorIdIdx: index('notes_author_id_idx').on(table.authorId),
  })
);

export type Note = typeof notes.$inferSelect;
export type NoteInsert = typeof notes.$inferInsert;
