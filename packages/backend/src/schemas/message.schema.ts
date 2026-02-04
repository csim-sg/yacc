import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  jsonb,
  pgEnum,
  index,
} from 'drizzle-orm/pg-core';
import { conversations } from './conversation.schema';
import { users } from './user.schema';

export const messageStatusEnum = pgEnum('message_status', ['pending', 'sent', 'failed']);

export const messageDirectionEnum = pgEnum('message_direction', ['inbound', 'outbound']);

/**
 * Messages table - stores individual messages
 */
export const messages = pgTable(
  'messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    senderId: uuid('sender_id').references(() => users.id, { onDelete: 'set null' }),
    senderName: varchar('sender_name', { length: 255 }).notNull(),
    body: text('body').notNull(),
    status: messageStatusEnum('status').notNull().default('pending'),
    direction: messageDirectionEnum('direction').notNull(),
    externalMessageId: varchar('external_message_id', { length: 255 }),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    conversationIdIdx: index('messages_conversation_id_idx').on(table.conversationId),
    senderIdIdx: index('messages_sender_id_idx').on(table.senderId),
    statusIdx: index('messages_status_idx').on(table.status),
    directionIdx: index('messages_direction_idx').on(table.direction),
    createdAtIdx: index('messages_created_at_idx').on(table.createdAt),
  })
);

export type Message = typeof messages.$inferSelect;
export type MessageInsert = typeof messages.$inferInsert;
