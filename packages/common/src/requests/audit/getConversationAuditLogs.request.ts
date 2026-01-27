import { IsOptional, IsInt } from 'class-validator';
import { Type } from 'class-transformer';
import { ISearchableRequest } from '../types/searchableRequest.type';

/**
 * Get Conversation Audit Logs Request
 * Query parameters for fetching audit logs for a specific conversation
 */
export class GetConversationAuditLogsRequest extends ISearchableRequest {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  limit?: number;
}
