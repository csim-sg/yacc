/**
 * Conversation Response
 * Response shape for conversation endpoints
 * Note: List endpoints use BaseListResponse<T> directly
 */
export interface ConversationResponse {
  success: boolean;
  message?: string;
  data?: unknown;
  totalCount?: number;
  totalPage?: number;
}
