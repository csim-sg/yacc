import { IsOptional, IsInt, Min, Max } from 'class-validator';
import { SearchableRequest } from '../../types/searchableRequest.type.js';

/**
 * List Notifications Request
 * Query parameters for listing user notifications
 */
export class ListNotificationsRequest extends SearchableRequest {
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
