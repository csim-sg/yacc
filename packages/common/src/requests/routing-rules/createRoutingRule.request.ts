import { IsOptional, IsString, IsInt, IsEnum, IsBoolean } from 'class-validator';

/**
 * Create Routing Rule Request
 * Body parameters for creating a new routing rule
 */
export class CreateRoutingRuleRequest {
  @IsString()
  name!: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  priority?: number;

  @IsOptional()
  @IsString()
  conditions?: string; // JSON array of conditions

  @IsOptional()
  @IsString()
  actions?: string; // JSON array of actions
}
