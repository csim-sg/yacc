import { pgEnum } from 'drizzle-orm/pg-core';

/**
 * Message Status Enum - Defines message delivery state
 * pending: Message pending delivery
 * sent: Message sent successfully
 * failed: Message delivery failed
 */
export const messageStatusEnum = pgEnum('message_status', ['pending', 'sent', 'failed']);

export type MessageStatus = typeof messageStatusEnum.enumValues[number];
