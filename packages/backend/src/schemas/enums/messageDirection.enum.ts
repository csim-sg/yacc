import { pgEnum } from 'drizzle-orm/pg-core';

/**
 * Message Direction Enum - Defines message flow direction
 * inbound: Message received from external platform
 * outbound: Message sent from system to external platform
 */
export const messageDirectionEnum = pgEnum('message_direction', ['inbound', 'outbound']);

export type MessageDirection = typeof messageDirectionEnum.enumValues[number];
