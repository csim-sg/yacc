import { IsEnum } from 'class-validator';

/**
 * Update Status Request
 * Body parameters for updating conversation status
 */
export class UpdateStatusRequest {
  @IsEnum(['open', 'pending', 'resolved'])
  status!: 'open' | 'pending' | 'resolved';
}
