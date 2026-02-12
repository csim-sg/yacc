/**
 * Notes Section
 * Displays and manages conversation notes with @mention support
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { ConversationDetail } from '../../services/conversations.service';
import { useNotesStore } from '../../stores/notes.store';

interface NotesSectionProps {
  conversation: ConversationDetail;
}

/**
 * @mention users - deferred to Phase 3
 * TODO: Implement GET /api/users endpoint to fetch real users for @mention suggestions
 * Phase 1 MVP: Backend parses @mentions from note body (regex: @(\w+))
 * Suggestions will be available once users API is implemented
 */

export function NotesSection({
  conversation,
}: NotesSectionProps) {
  const queryClient = useQueryClient();
  const { notes, addNote, isLoading } = useNotesStore();
  const [noteBody, setNoteBody] = useState('');

  /**
   * Backend handles @mention parsing
   * Users can type @username in notes; backend regex extracts mentions: @(\w+)
   * No client-side mention suggestions in Phase 1 MVP
   * Phase 3: Add user list API and auto-complete suggestions
   */

  // Add note mutation
  const addNoteMutation = useMutation({
    mutationFn: () => addNote(conversation.id, noteBody),
    onSuccess: () => {
      setNoteBody('');
      void queryClient.invalidateQueries({
        queryKey: ['conversation', conversation.id],
      });
    },
  });

  const handleNoteChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNoteBody(e.target.value);
  };

  const conversationNotes = notes.filter(
    (note) => note.conversationId === conversation.id
  );

  return (
    <div
      className="px-4 py-4 flex flex-col flex-1"
      data-testid="notes-section"
    >
      <div className="flex items-center justify-between mb-3">
        <label className="text-sm font-semibold text-base-content/80">
          Notes
        </label>
        <span className="badge badge-sm">{conversationNotes.length}</span>
      </div>

       {/* Add note form */}
       <div className="mb-4 space-y-2" data-testid="add-note-form">
         <div className="relative">
           <textarea
             value={noteBody}
             onChange={handleNoteChange}
             placeholder="Add a note... (use @username to mention team members)"
             className="textarea textarea-sm textarea-bordered w-full resize-none h-20"
             disabled={addNoteMutation.isPending}
             data-testid="note-input"
           />
         </div>

         <button
           onClick={() => addNoteMutation.mutate()}
           disabled={!noteBody.trim() || addNoteMutation.isPending}
           className="btn btn-sm btn-primary w-full"
           data-testid="save-note-button"
         >
           {addNoteMutation.isPending ? 'Saving...' : 'Add Note'}
         </button>
       </div>

      {/* Notes list */}
      <div className="flex-1 overflow-y-auto space-y-3">
        {isLoading ? (
          <div className="flex justify-center py-4">
            <div className="loading loading-spinner loading-sm"></div>
          </div>
        ) : conversationNotes.length === 0 ? (
          <div
            className="text-center text-sm text-base-content/50 py-4"
            data-testid="no-notes-message"
          >
            No notes yet
          </div>
        ) : (
          conversationNotes.map((note) => (
             <div
               key={note.id}
               className="bg-base-200/50 rounded-lg p-3 text-xs space-y-1"
               data-testid={`note-item-${note.id}`}
             >
               <div className="flex items-center justify-between">
                 <span className="font-semibold">{note.authorId}</span>
                 <span className="text-base-content/50">
                   {new Date(note.createdAt).toLocaleDateString('en-US', {
                     month: 'short',
                     day: 'numeric',
                     hour: '2-digit',
                     minute: '2-digit',
                   })}
                 </span>
               </div>
               <p className="text-base-content/80 whitespace-pre-wrap">{note.body}</p>

               {/* Render mentions */}
               {note.mentions && note.mentions.length > 0 && (
                 <div className="flex flex-wrap gap-1 pt-1">
                   {note.mentions.map((mention) => (
                     <span
                       key={mention}
                       className="badge badge-sm badge-primary/20 text-primary text-xs"
                       data-testid={`note-mention-${mention}`}
                     >
                       @{mention}
                     </span>
                   ))}
                 </div>
               )}
             </div>
          ))
        )}
      </div>
    </div>
  );
}
