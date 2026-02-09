import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  index,
  integer,
  boolean,
} from 'drizzle-orm/pg-core';
import { messages } from './message.schema';
import { conversations } from './conversation.schema';

/**
 * Dead Letter Queue table - stores messages that failed after 3 retry attempts
 *
 * Purpose: Persistent storage for failed messages requiring ops investigation and manual intervention
 * Retention: 7 days (auto-cleanup via scheduled job)
 * Access: Manager+ roles only
 */
export const deadLetterQueue = pgTable(
  'dead_letter_queue',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    messageId: uuid('message_id')
      .notNull()
      .references(() => messages.id, { onDelete: 'cascade' }),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    
    // Original message payload for re-sending
    payload: jsonb('payload').notNull(),
    
    // Failure tracking
    failureReason: text('failure_reason').notNull(), // 'max_retries_exceeded', 'validation_error', 'platform_error', 'network_error', 'unknown'
    totalAttempts: integer('total_attempts').notNull().default(3),
    lastError: text('last_error').notNull(),
    
    // Timestamps
    movedAt: timestamp('moved_at').notNull().defaultNow(),
    expiresAt: timestamp('expires_at').notNull(), // Set to NOW() + 7 days
    
    // Re-queue tracking (if manually retried from DLQ)
    retryAttempt: boolean('retry_attempt').default(false),
    retriedAt: timestamp('retried_at'),
    retriedBy: uuid('retried_by'), // User who retried
    
    // Metadata
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('dlq_message_id_idx').on(table.messageId),
    index('dlq_conversation_id_idx').on(table.conversationId),
    index('dlq_moved_at_idx').on(table.movedAt),
    index('dlq_expires_at_idx').on(table.expiresAt), // For cleanup queries
    index('dlq_failure_reason_idx').on(table.failureReason),
    index('dlq_retry_attempt_idx').on(table.retryAttempt),
  ]
);

export type DeadLetterQueueEntry = typeof deadLetterQueue.$inferSelect;
export type DeadLetterQueueInsert = typeof deadLetterQueue.$inferInsert;
