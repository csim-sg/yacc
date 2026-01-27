import { IsOptional, IsString } from 'class-validator';

/**
 * Create Tag Request
 * Body parameters for creating a new tag
 */
export class CreateTagRequest {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  color?: string; // Hex color code
}
