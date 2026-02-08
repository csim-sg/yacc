import { IListResponse } from '../../types/listResponse.type.js';

/**
 * Conversation Response
 * Response shape for conversation endpoints
 */
export interface ConversationResponse extends IListResponse<any> {
  success: boolean;
  message?: string;
  totalCount?: number;
  totalPage?: number;
}
