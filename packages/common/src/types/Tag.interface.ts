/**
 * Tag Entity
 * User-created reusable tags for categorizing conversations
 *
 * @see POST /api/tags - CreateTagRequest
 * @see GET /api/tags - List tags
 * @see POST /api/conversations/:id/tags - AddTagToConversationRequest
 */
export interface Tag {
  /** Unique identifier (auto-increment integer) */
  id: number;
  /** Tag display name (1-255 chars) */
  name: string;
  /** Hex color code (e.g., #FF5733) */
  color: string;
  /** UUID of user who created the tag */
  createdById: string;
  /** ISO8601 timestamp when tag was created */
  createdAt: string;
}
