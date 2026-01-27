import { IsString, IsInt } from 'class-validator';

/**
 * Send Message Request
 * Body parameters for sending a message
 */
export class SendMessageRequest {
  @IsString()
  body!: string;

  @IsOptional()
  @IsUUID()
  replyToMessageId?: string;

  @IsOptional()
  @IsString()
  attachments?: string; // JSON array or comma-separated URLs
}
