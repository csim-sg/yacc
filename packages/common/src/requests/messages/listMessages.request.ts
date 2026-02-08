import { IsOptional, IsUUID, IsInt, Min, Max } from 'class-validator';
import { SearchableRequest } from '../../types/searchableRequest.type.js';

/**
 * List Messages Request
 * Query parameters for listing messages in a conversation
 */
export class ListMessagesRequest extends SearchableRequest {
  @IsOptional()
  @IsUUID()
  conversationId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
