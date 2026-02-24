import { IsOptional, IsUUID, IsString, IsNumber } from 'class-validator';

/**
 * Bulk Action Data
 * Action-specific parameters for bulk operations
 *
 * @see BulkActionRequest
 * @see POST /api/conversations/bulk
 */
export class BulkActionData {
  /** UUID of user to assign conversations to (use null to unassign) */
  @IsOptional()
  @IsUUID()
  assigneeId?: string;

  /** ID of tag to add to conversations */
  @IsOptional()
  @IsNumber()
  tagId?: number;

  /** Status to set for conversations */
  @IsOptional()
  @IsString()
  status?: 'open' | 'pending' | 'resolved';

  /** Priority to set for conversations */
  @IsOptional()
  @IsString()
  priority?: 'low' | 'normal' | 'high' | 'urgent';
}
