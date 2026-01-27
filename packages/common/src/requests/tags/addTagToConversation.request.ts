import { IsInt } from 'class-validator';

/**
 * Add Tag to Conversation Request
 * Body parameters for adding a tag to a conversation
 */
export class AddTagToConversationRequest {
  @IsInt()
  tagId!: number;
}
