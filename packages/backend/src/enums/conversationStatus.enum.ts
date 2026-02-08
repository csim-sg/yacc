import { pgEnum } from 'drizzle-orm/pg-core';

/**
 * Conversation Status Enum - Defines conversation state
 * open: Active conversation, awaiting reply or action
 * pending: Agent replied, awaiting customer response
 * resolved: Conversation closed
 */
export const conversationStatusEnum = pgEnum('conversation_status', [
  'open',
  'pending',
  'resolved',
]);

export type ConversationStatus = typeof conversationStatusEnum.enumValues[number];
