/**
 * Message Domain Type
 */

import type { Attachment } from './attachment';
import type { ValueOf } from './utils';

export interface Message {
  id: string;
  conversationId: string;
  senderId?: string;
  senderName?: string;
  body: string;
  status: ValueOf<typeof MESSAGE_STATUSES>;
  direction: ValueOf<typeof MESSAGE_DIRECTIONS>;
  platformMessageId?: string;
  createdAt: string;
  updatedAt: string;
  attachments?: Attachment[];
}

import { MESSAGE_STATUSES, MESSAGE_DIRECTIONS } from '../constants/statuses';
