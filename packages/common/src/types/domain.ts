/**
 * Core Domain Types
 */

export type Role = 'super_admin' | 'admin' | 'manager' | 'user';

export type ConversationStatus = 'open' | 'pending' | 'resolved';

export type MessageStatus = 'pending' | 'sent' | 'failed';

export type MessageDirection = 'inbound' | 'outbound';

export type ChannelType = 'telegram' | 'irc' | 'whatsapp' | 'twitter';

export interface Timestamp {
  createdAt: Date;
  updatedAt: Date;
}
