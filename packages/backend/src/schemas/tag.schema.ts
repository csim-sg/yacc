import { pgTable, serial, varchar, timestamp, uuid, uniqueIndex } from 'drizzle-orm/pg-core';
import { users } from './user.schema';

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
  (table) => [
    uniqueIndex('tags_name_created_by_idx').on(table.name, table.createdById),
  ]
);

export type Tag = typeof tags.$inferSelect;
export type TagInsert = typeof tags.$inferInsert;
