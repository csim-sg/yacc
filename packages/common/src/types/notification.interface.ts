import type { Timestamp } from './Timestamp.interface';
import type { NotificationType } from './NotificationType.type';

export interface Notification extends Timestamp {
  id: string;
  userId: string;
  type: NotificationType;
  conversationId: string;
  actorId?: string;
  actorName?: string;
  body: string;
  isRead: boolean;
  readAt?: string;
  dismissedAt?: string;
}
