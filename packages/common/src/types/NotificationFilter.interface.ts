import type { NotificationType } from './NotificationType.type';

export interface NotificationFilter {
  unread?: boolean;
  type?: NotificationType;
}
