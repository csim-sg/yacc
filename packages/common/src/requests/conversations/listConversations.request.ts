import { IsOptional, IsInt, IsString, IsUUID, IsEnum, Min, Max } from 'class-validator';
import { SearchableRequest } from '../../types/searchableRequest.type.js';

/**
 * List Conversations Request
 * Query parameters for listing conversations with filters and pagination
 */
export class ListConversationsRequest extends SearchableRequest {
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsString()
  channel?: string;

  @IsOptional()
  @IsEnum(['open', 'pending', 'resolved'])
  status?: 'open' | 'pending' | 'resolved';

  @IsOptional()
  @IsEnum(['low', 'normal', 'high', 'urgent'])
  priority?: 'low' | 'normal' | 'high' | 'urgent';

  @IsOptional()
  @IsUUID()
  assignedUserId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  tagId?: number;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  dateFrom?: string;

  @IsOptional()
  @IsString()
  dateTo?: string;

  @IsOptional()
  unread?: boolean;

  @IsOptional()
  @IsEnum(['lastActivity', 'created', 'priority'])
  sortBy?: 'lastActivity' | 'created' | 'priority';

  @IsOptional()
  @IsEnum(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc';
}
