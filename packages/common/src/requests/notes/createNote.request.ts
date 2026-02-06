import { IsOptional, IsString, IsUUID, IsBoolean } from 'class-validator';

/**
 * Create Note Request
 * Body parameters for creating a note on a conversation
 */
export class CreateNoteRequest {
  @IsString()
  body!: string;

  @IsOptional()
  @IsString()
  @IsUUID()
  replyToMessageId?: string;

  @IsOptional()
  @IsBoolean()
  isInternal?: boolean; // Default false - visible only to internal users
}
