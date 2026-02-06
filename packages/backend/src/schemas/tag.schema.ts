import { pgTable, serial, varchar, timestamp, uuid, index, uniqueIndex, integer } from 'drizzle-orm/pg-core';
import { users } from './user.schema';
import { conversations } from './conversation.schema';

/**
 * Tags table - user-created tags for organizing conversations
 */
export const tags = pgTable(
  'tags',
  {
    id: serial('id').primaryKey(),
    name: varchar('name', { length: 255 }).notNull(),
    color: varchar('color', { length: 7 }).notNull().default('#808080'),
    createdById: uuid('created_by_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    nameCreatedByIdx: uniqueIndex('tags_name_created_by_idx').on(table.name, table.createdById),
  })
);

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
  (table) => ({
    pkey: uniqueIndex('conversation_tags_pkey').on(table.conversationId, table.tagId),
  })
);

export type Tag = typeof tags.$inferSelect;
export type TagInsert = typeof tags.$inferInsert;

export type ConversationTag = typeof conversationTags.$inferSelect;
export type ConversationTagInsert = typeof conversationTags.$inferInsert;
