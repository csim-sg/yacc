/**
 * Message Send Error Interface
 *
 * Error details when a message fails to send
 */

export interface MessageSendError {
  messageId: string;
  message: string;
  error: string;
  code?: string;
  retryable: boolean;
}
