/**
 * Notification Domain Type
 */

export interface Notification {
  id: string;
  userId: string;
  type: 'assignment' | 'mention';
  conversationId: string;
  actorId?: string;
  actorName?: string;
  isRead: boolean;
  createdAt: string;
}
