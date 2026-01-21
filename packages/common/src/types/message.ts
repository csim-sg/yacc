/**
 * Message Domain Type
 */

import type { Attachment } from './attachment';

export interface Message {
  id: string;
  conversationId: string;
  senderId?: string;
  senderName?: string;
  body: string;
  status: keyof typeof MESSAGE_STATUSES;
  direction: keyof typeof MESSAGE_DIRECTIONS;
  platformMessageId?: string;
  createdAt: string;
  updatedAt: string;
  attachments?: Attachment[];
}

import { MESSAGE_STATUSES, MESSAGE_DIRECTIONS } from '../constants/statuses';
