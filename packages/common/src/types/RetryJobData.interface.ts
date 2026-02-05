/**
 * Retry Job Data
 *
 * Represents data for a message retry job in the queue
 */

export interface RetryJobData {
  messageId: string;
  conversationId: string;
  platform: 'telegram' | 'irc';
  attemptNumber: number;
  payload: Record<string, unknown>;
}
