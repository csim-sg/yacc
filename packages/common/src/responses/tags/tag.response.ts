import type { Tag } from '../../types/Tag.interface';

/**
 * Tag Response
 * Response shape for tag endpoints
 *
 * @see GET /api/tags
 * @see POST /api/tags
 */
export interface TagResponse extends Tag {
  /** Number of conversations using this tag (optional, for list views) */
  conversationCount?: number;
}
