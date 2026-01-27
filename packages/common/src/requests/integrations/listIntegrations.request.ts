import { IsOptional, IsInt } from 'class-validator';

/**
 * List Integrations Request
 * Query parameters for listing all integrations
 */
export class ListIntegrationsRequest extends ISearchableRequest {
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
