import { IsOptional, IsString, IsInt, Min } from 'class-validator';
import type { RoutingRuleStatus } from '../../types/RoutingRuleStatus.type';

/**
 * Create Routing Rule Request
 * Body parameters for creating a new routing rule
 *
 * @see POST /api/rules
 * @see RBAC: admin+ (managers cannot create rules)
 */
export class CreateRoutingRuleRequest {
  /** Rule display name (required) */
  @IsString()
  name!: string;

  /** Rule description */
  @IsOptional()
  @IsString()
  description?: string;

  /** Rule status (active or disabled, defaults to active) */
  @IsOptional()
  status?: RoutingRuleStatus;

  /** Priority order (lower = higher priority, evaluated first) */
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
