import { IsOptional, IsInt } from 'class-validator';

/**
 * Mark Notification As Read Request
 * Body parameters for marking notification as read
 */
export class MarkNotificationAsReadRequest {
  @IsOptional()
  @IsUUID()
  notificationId?: string;
}
