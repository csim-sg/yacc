import { z } from 'zod';

/**
 * Query parameters for GET /conversations/:id/messages
 */
export interface GetMessagesQuery {
  page?: number;
  limit?: number;
  direction?: 'inbound' | 'outbound';
}

/**
 * Request body for POST /conversations/:id/messages
 */
export const SendMessageRequestSchema = z.object({
  body: z
    .string()
    .min(1, 'Message body is required')
    .max(10000, 'Message body exceeds maximum length (10000 characters)'),
  attachmentIds: z.array(z.string().uuid()).optional(),
});

export type SendMessageRequestBody = z.infer<typeof SendMessageRequestSchema>;

/**
 * Message response DTO
 */
export interface MessageResponseDTO {
  id: string;
  conversationId: string;
  senderId: string | null;
  senderName: string;
  body: string;
  status: 'pending' | 'sent' | 'failed';
  direction: 'inbound' | 'outbound';
  externalMessageId?: string;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Error details stored in message metadata
 */
export interface ErrorDetails {
  code: string;
  message: string;
  timestamp: string;
  retryCount?: number;
}

/**
 * Connector dispatch request
 */
export interface ConnectorDispatchRequest {
  messageId: string;
  conversationId: string;
  body: string;
  externalThreadId?: string;
}

/**
 * Connector dispatch response
 */
export interface ConnectorDispatchResponse {
  success: boolean;
  externalMessageId?: string;
  error?: string;
}
