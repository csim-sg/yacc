import { IsOptional, IsString, IsEnum, IsUUID, IsInt, Min, Max, IsBoolean } from 'class-validator';
import { ISearchableRequest } from '../../types/searchable.request';

/**
 * List Messages Request
 * Query parameters for listing messages in a conversation
 */
export class ListMessagesRequest extends ISearchableRequest {
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
