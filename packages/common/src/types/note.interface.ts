import type { Timestamp } from './Timestamp.interface';

/**
 * Note Entity
 * Internal notes on conversations (not sent to customers)
 * Supports @mention notifications
 *
 * @see POST /api/conversations/:id/notes - CreateNoteRequest
 * @see GET /api/conversations/:id/notes - List notes
 */
export interface Note extends Timestamp {
  /** Unique identifier (UUID) */
  id: string;
  /** UUID of the conversation this note belongs to */
  conversationId: string;
  /** UUID of the user who authored the note */
  authorId: string;
  /** Display name of the author (for UI display) */
  authorName: string;
  /** Note body content (max 5000 chars) */
  body: string;
  /** Array of user UUIDs that were @mentioned */
  mentions?: string[];
}
