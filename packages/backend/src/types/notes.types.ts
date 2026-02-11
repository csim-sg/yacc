/**
 * Notes Types
 * Type definitions for note creation and note-related operations
 */

/**
 * Create Note Request
 */
export interface CreateNoteRequest {
  body: string;
}

/**
 * Note Response DTO
 */
export interface NoteResponse {
  id: string;
  conversationId: string;
  authorId: string;
  body: string;
  mentions?: string[]; // User IDs that were mentioned
  createdAt: string;
  updatedAt: string;
}

/**
 * @mention parsing result
 */
export interface MentionMatch {
  mention: string; // The username part (e.g., "john" from "@john")
  userId?: string; // The matched user ID, if found
}

/**
 * Note creation response with notifications
 */
export interface NoteCreationResult {
  note: NoteResponse;
  mentionedUserIds: string[]; // User IDs that were notified about mentions
}
