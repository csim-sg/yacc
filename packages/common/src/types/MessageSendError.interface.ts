export interface MessageSendError {
  message: string;
  messageId?: string;
  code?: string;
  retryable?: boolean;
  details?: Record<string, unknown>;
}
