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

// Mock users for @mention suggestions
const MOCK_MENTION_USERS = [
  { id: '1', name: 'Alice Johnson' },
  { id: '2', name: 'Bob Smith' },
  { id: '3', name: 'Carol White' },
];

export function NotesSection({
  conversation,
}: NotesSectionProps) {
  const queryClient = useQueryClient();
  const { notes, addNote, isLoading } = useNotesStore();
  const [noteBody, setNoteBody] = useState('');
  const [mentions, setMentions] = useState<string[]>([]);
  const [showMentionSuggestions, setShowMentionSuggestions] = useState(false);
  const [mentionSearchTerm, setMentionSearchTerm] = useState('');

  // Add note mutation
  const addNoteMutation = useMutation({
    mutationFn: () => addNote(conversation.id, noteBody, mentions),
    onSuccess: () => {
      setNoteBody('');
      setMentions([]);
      void queryClient.invalidateQueries({
        queryKey: ['conversation', conversation.id],
      });
    },
  });

  // Handle text input and detect @mentions
  const handleNoteChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setNoteBody(text);

    // Detect @mention trigger
    const lastChar = text[text.length - 1];
    const lastWord = text.split(/\s+/).pop() || '';

    if (lastChar === '@') {
      setShowMentionSuggestions(true);
      setMentionSearchTerm('');
    } else if (lastWord.startsWith('@')) {
      setShowMentionSuggestions(true);
      setMentionSearchTerm(lastWord.substring(1).toLowerCase());
    } else {
      setShowMentionSuggestions(false);
    }
  };

  // Handle mention selection
  const handleSelectMention = (userId: string, userName: string) => {
    // Replace the partial @mention with the full one
    const parts = noteBody.split(/\s+/);
    const lastPart = parts[parts.length - 1];

    if (lastPart.startsWith('@')) {
      parts[parts.length - 1] = `@${userName}`;
    } else {
      parts.push(`@${userName}`);
    }

    const newText = parts.join(' ');
    setNoteBody(newText + ' ');
    setMentions([...mentions, userId]);
    setShowMentionSuggestions(false);
    setMentionSearchTerm('');
  };

  const filteredMentionUsers = MOCK_MENTION_USERS.filter((user) =>
    user.name.toLowerCase().includes(mentionSearchTerm)
  );

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
            placeholder="Add a note... (@mention a team member)"
            className="textarea textarea-sm textarea-bordered w-full resize-none h-20"
            disabled={addNoteMutation.isPending}
            data-testid="note-input"
          />

          {/* Mention suggestions */}
          {showMentionSuggestions && filteredMentionUsers.length > 0 && (
            <div
              className="absolute bottom-full left-0 right-0 mb-2 bg-base-100 border border-base-300 rounded-lg shadow-lg z-50 max-h-32 overflow-y-auto"
              data-testid="mention-suggestions"
            >
              {filteredMentionUsers.map((user) => (
                <button
                  key={user.id}
                  onClick={() => handleSelectMention(user.id, user.name)}
                  className="w-full text-left px-4 py-2 text-sm hover:bg-base-200 border-b border-base-300 last:border-b-0"
                  data-testid={`mention-suggestion-${user.id}`}
                >
                  @{user.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Mentioned users */}
        {mentions.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {mentions.map((userId) => {
              const user = MOCK_MENTION_USERS.find((u) => u.id === userId);
              return (
                <div
                  key={userId}
                  className="badge badge-primary badge-outline text-xs"
                  data-testid={`mentioned-user-${userId}`}
                >
                  @{user?.name}
                </div>
              );
            })}
          </div>
        )}

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
                <span className="font-semibold">{note.authorName}</span>
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
