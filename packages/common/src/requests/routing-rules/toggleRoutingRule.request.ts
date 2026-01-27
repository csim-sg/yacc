import { IsOptional, IsBoolean } from 'class-validator';

/**
 * Enable/Disable Routing Rule Request
 * Body parameters for toggling a routing rule
 */
export class ToggleRoutingRuleRequest {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
