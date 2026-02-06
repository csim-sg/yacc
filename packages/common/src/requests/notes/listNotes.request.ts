import { IsOptional, IsUUID } from 'class-validator';
import { SearchableRequest } from '../../types/searchableRequest.type';

/**
 * List Notes Request
 * Query parameters for listing notes on a conversation
 */
export class ListNotesRequest extends SearchableRequest {
  @IsOptional()
  @IsUUID()
  conversationId?: string;
}
