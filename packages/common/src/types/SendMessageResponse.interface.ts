import type { MessageSendError } from './MessageSendError.interface';

export interface SendMessageResponse {
  success: boolean;
  messageId?: string;
  platformMessageId?: string;
  error?: MessageSendError;
  metadata?: Record<string, unknown>;
}
