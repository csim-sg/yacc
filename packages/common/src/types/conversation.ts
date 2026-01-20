/**
 * Conversation Types
 */

import type { ConversationStatus, MessageStatus, MessageDirection, ChannelType, Timestamp } from './domain';
import type { User } from './user';

export interface Message extends Timestamp {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  status: MessageStatus;
  direction: MessageDirection;
  attachments?: Attachment[];
  metadata?: Record<string, unknown>;
}

export interface Attachment {
  id: string;
  url: string;
  name: string;
  type: string;
  size: number;
  storageKey?: string;
}

export interface Conversation extends Timestamp {
  id: string;
  channel: ChannelType;
  externalThreadId: string;
  status: ConversationStatus;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  assignedUserId?: string;
  assignedUser?: User;
  messages: Message[];
  tags?: Tag[];
  notes?: Note[];
  lastMessageAt?: Date;
}

export interface Tag {
  id: string;
  name: string;
  color: string;
  createdById: string;
}

export interface Note {
  id: string;
  conversationId: string;
  authorId: string;
  body: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ConversationFilter {
  channel?: ChannelType;
  status?: ConversationStatus;
  assignedUserId?: string;
  tags?: string[];
  priority?: string;
  searchText?: string;
  dateFrom?: Date;
  dateTo?: Date;
}
