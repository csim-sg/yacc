import type { Timestamp } from './Timestamp.interface';
import type { MessageStatus } from './MessageStatus.type';
import type { MessageDirection } from './MessageDirection.type';
import type { Attachment } from './Attachment.interface';

export interface Message extends Timestamp {
  id: string;
  conversationId: string;
  senderId?: string;
  senderName?: string;
  body: string;
  status: MessageStatus;
  direction: MessageDirection;
  platformMessageId?: string;
  attachments?: Attachment[];
}
