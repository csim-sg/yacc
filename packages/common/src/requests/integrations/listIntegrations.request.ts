import { IsOptional, IsInt, Min, Max } from 'class-validator';
import { SearchableRequest } from '../../types/searchableRequest.type';

/**
 * List Integrations Request
 * Query parameters for listing all integrations
 */
export class ListIntegrationsRequest extends SearchableRequest {
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
