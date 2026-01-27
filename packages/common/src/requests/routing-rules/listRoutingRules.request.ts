import { IsOptional, IsInt, IsString, IsEnum } from 'class-validator';
import { ISearchableRequest } from '../../types/searchable.request';

/**
 * List Routing Rules Request
 * Query parameters for listing routing rules
 */
export class ListRoutingRulesRequest extends ISearchableRequest {
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
  @IsBoolean()
  includeDisabled?: boolean;
}
