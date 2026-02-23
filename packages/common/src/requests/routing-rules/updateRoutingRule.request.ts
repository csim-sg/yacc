import { IsOptional, IsString, IsInt, IsEnum, Min } from 'class-validator';

/**
 * Update Routing Rule Request
 * Body parameters for updating an existing routing rule
 *
 * @see PATCH /api/rules/:id
 * @see RBAC: admin+ (managers cannot modify rules)
 */
export class UpdateRoutingRuleRequest {
  /** Rule display name */
  @IsOptional()
  @IsString()
  name?: string;

  /** Rule description */
  @IsOptional()
  @IsString()
  description?: string;

  /** Rule status (active or disabled) */
  @IsOptional()
  @IsEnum(['active', 'disabled'])
  status?: 'active' | 'disabled';

  /** Priority order (lower = higher priority) */
  @IsOptional()
  @IsInt()
  @Min(1)
  priority?: number;

  /** JSON array of conditions (serialized) */
  @IsOptional()
  @IsString()
  conditions?: string;

  /** JSON array of actions (serialized) */
  @IsOptional()
  @IsString()
  actions?: string;
}
