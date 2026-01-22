import type { Platform } from './Platform.type';

export interface RetryJobData {
  messageId: string;
  conversationId: string;
  platform: Platform;
  attemptNumber: number;
  attemptAt: Date;
  lastError?: string;
}
