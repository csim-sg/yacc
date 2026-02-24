/**
 * Notes Types
 * Backend-specific types for note operations
 *
 * For shared types, use:
 * - NoteResponse from '@yacc/common/responses/notes/note.response'
 * - CreateNoteRequest from '@yacc/common/requests/notes/createNote.request'
 */

/**
 * Create Note Request
 * @deprecated Use CreateNoteRequest from '@yacc/common/requests/notes/createNote.request'
 */
export interface CreateNoteRequest {
  body: string;
}

/**
 * Note Response DTO
 * @deprecated Use NoteResponse from '@yacc/common/responses/notes/note.response'
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
