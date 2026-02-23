import { IsArray, IsEnum, IsUUID, IsOptional, IsString, IsNumber, ArrayMinSize, ArrayMaxSize, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import type { BulkActionType } from '../../types/BulkActionType.type';

/**
 * Bulk Action Data
 * Action-specific parameters for bulk operations
 */
class BulkActionData {
  @IsOptional()
  @IsUUID()
  assignedUserId?: string;

  @IsOptional()
  @IsUUID()
  assigneeId?: string;

  @IsOptional()
  @IsNumber()
  tagId?: number;

  @IsOptional()
  @IsString()
  status?: 'open' | 'pending' | 'resolved';

  @IsOptional()
  @IsString()
  priority?: 'low' | 'normal' | 'high' | 'urgent';
}

/**
 * Bulk Action Request
 * Body parameters for performing bulk operations on conversations
 *
 * Features:
 * - Best-effort: partial success is OK
 * - Max 100 conversations per request
 * - RBAC: manager+ only
 *
 * @see POST /api/conversations/bulk
 */
export class BulkActionRequest {
  /** Array of conversation UUIDs (1-100) */
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsUUID('4', { each: true })
  conversationIds!: string[];

  /** Type of bulk action to perform */
  @IsEnum(['assign', 'tag', 'status'])
  action!: BulkActionType;

  /** Action-specific parameters */
  @ValidateNested()
  @Type(() => BulkActionData)
  data!: BulkActionData;
}
