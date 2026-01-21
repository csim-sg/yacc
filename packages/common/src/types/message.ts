/**
 * Message Domain Type
 */

export interface Message {
  id: string;
  conversationId: string;
  senderId?: string;
  senderName?: string;
  body: string;
  status: 'pending' | 'sent' | 'failed';
  direction: 'inbound' | 'outbound';
  platformMessageId?: string;
  createdAt: string;
  updatedAt: string;
  attachments?: Attachment[];
}

import type { Attachment } from './attachment';
