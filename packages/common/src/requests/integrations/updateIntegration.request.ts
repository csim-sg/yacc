import { IsOptional, IsString, IsBoolean } from 'class-validator';

/**
 * Update Integration Request
 * Body parameters for updating an integration
 */
export class UpdateIntegrationRequest {
  @IsOptional()
  @IsString()
  credentials?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
