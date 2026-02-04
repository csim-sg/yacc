import { IsOptional, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { SearchableRequest } from '../../types/searchableRequest.type';

/**
 * Get Conversation Audit Logs Request
 * Query parameters for fetching audit logs for a specific conversation
 */
export class GetConversationAuditLogsRequest extends SearchableRequest {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
