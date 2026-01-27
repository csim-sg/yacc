import { ISearchableRequest } from '../../types/searchable.request';

/**
 * List Notifications Request
 * Query parameters for listing user notifications
 */
export class ListNotificationsRequest extends ISearchableRequest {
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
