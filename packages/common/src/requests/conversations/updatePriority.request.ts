import { IsEnum } from 'class-validator';

/**
 * Update Priority Request
 * Body parameters for updating conversation priority
 */
export class UpdatePriorityRequest {
  @IsEnum(['low', 'medium', 'high', 'urgent'])
  priority!: 'low' | 'medium' | 'high' | 'urgent';
}
