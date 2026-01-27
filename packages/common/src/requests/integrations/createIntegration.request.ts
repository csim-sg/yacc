import { IsOptional, IsString, IsEnum } from 'class-validator';

/**
 * Create Integration Request
 * Body parameters for creating a new platform integration
 */
export class CreateIntegrationRequest {
  @IsString()
  @IsEnum(['telegram', 'irc'])
  platform!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  credentials?: string; // JSON object with API keys/tokens
}
