import { IsUUID, IsOptional } from 'class-validator';

/**
 * Assign Conversation Request
 * Body parameters for assigning conversation to a user
 */
export class AssignRequest {
  @IsUUID()
  @IsOptional()
  assignedUserId!: string | null;
}
