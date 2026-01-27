import { ISearchableRequest } from '../../types/searchable.request';

/**
 * List Notes Request
 * Query parameters for listing notes on a conversation
 */
export class ListNotesRequest extends ISearchableRequest {
  @IsOptional()
  @IsUUID()
  conversationId?: string;
}
