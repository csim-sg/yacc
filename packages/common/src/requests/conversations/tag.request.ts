import { IsInt } from 'class-validator';

/**
 * Tag Request
 * Body parameters for adding/managing tags on conversations
 */
export class TagRequest {
  @IsInt()
  tagId!: number;
}
