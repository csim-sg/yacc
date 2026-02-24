import { IsOptional, IsString, IsInt, Min } from 'class-validator';
import type { RoutingRuleStatus } from '../../types/RoutingRuleStatus.type';

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
  status?: RoutingRuleStatus;

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
