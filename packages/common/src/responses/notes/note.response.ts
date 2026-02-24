import type { Note } from '../../types/note.interface';

/**
 * Note Response
 * Response shape for note endpoints
 *
 * @see GET /api/conversations/:id/notes
 * @see POST /api/conversations/:id/notes
 */
export type NoteResponse = Note;
