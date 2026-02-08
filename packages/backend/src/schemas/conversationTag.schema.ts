import { pgTable, uuid, integer, uniqueIndex } from 'drizzle-orm/pg-core';
import { conversations } from './conversation.schema';
import { tags } from './tag.schema';

/**
 * ConversationTags junction table - M:M relationship between conversations and tags
 */
export const conversationTags = pgTable(
  'conversation_tags',
  {
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    tagId: integer('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
  },
  (table) => [
    uniqueIndex('conversation_tags_pkey').on(table.conversationId, table.tagId),
  ]
);

export type ConversationTag = typeof conversationTags.$inferSelect;
export type ConversationTagInsert = typeof conversationTags.$inferInsert;
