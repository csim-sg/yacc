import { IsEnum } from 'class-validator';

/**
 * Update Priority Request
 * Body parameters for updating conversation priority
 */
export class UpdatePriorityRequest {
  @IsEnum(['low', 'normal', 'high', 'urgent'])
  priority!: 'low' | 'normal' | 'high' | 'urgent';
}
