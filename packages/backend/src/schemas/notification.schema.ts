import { pgTable, uuid, varchar, text, timestamp, boolean, jsonb, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { conversations } from './conversation.schema';
import { users } from './user.schema';

/**
 * Notifications table - in-app notifications for users
 */
export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id')
       .notNull()
       .references(() => users.id, { onDelete: 'cascade' }),
    type: varchar('type', { length: 50 }).notNull(), // 'assignment', 'mention', etc.
    conversationId: uuid('conversation_id').references(() => conversations.id, {
       onDelete: 'set null',
     }),
    actorId: text('actor_id').references(() => users.id, { onDelete: 'set null' }),
    message: text('message').notNull(),
    isRead: boolean('is_read').notNull().default(false),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
   (table) => [
     index('notifications_user_id_idx').on(table.userId),
     index('notifications_is_read_idx').on(table.isRead),
     index('notifications_created_at_idx').on(table.createdAt),
     uniqueIndex('notifications_dedup_idx').on(
       table.userId,
       table.conversationId,
       table.type
     ),
   ]
);

export type Notification = typeof notifications.$inferSelect;
export type NotificationInsert = typeof notifications.$inferInsert;
