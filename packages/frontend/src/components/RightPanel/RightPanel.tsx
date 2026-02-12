/**
 * Right Panel Component
 * Displays conversation metadata, tags, notes, and assignments
 * Shown alongside the conversation view in a responsive sidebar
 */

import { useEffect } from 'react';
import { useNotesStore } from '../../stores/notes.store';
import { useTagsStore } from '../../stores/tags.store';
import type { ConversationDetail } from '../../services/conversations.service';
import { AssignmentSection } from './AssignmentSection';
import { TagsSection } from './TagsSection';
import { NotesSection } from './NotesSection';

interface RightPanelProps {
  conversation: ConversationDetail;
  onAssignmentChange?: () => void;
  onTagsChange?: () => void;
}

export function RightPanel({
  conversation,
  onAssignmentChange,
  onTagsChange,
}: RightPanelProps) {
  const { fetchNotes } = useNotesStore();
  const { fetchTags } = useTagsStore();

  // Load tags and notes when conversation changes
  useEffect(() => {
    void fetchTags();
    void fetchNotes(conversation.id);
  }, [conversation.id, fetchNotes, fetchTags]);

  return (
    <div
      className="w-80 bg-base-100 border-l border-base-300 flex flex-col overflow-hidden"
      data-testid="right-panel"
    >
      {/* Header */}
      <div className="px-4 py-4 border-b border-base-300">
        <h3 className="text-lg font-semibold">Details</h3>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Assignment Section */}
        <AssignmentSection
          conversation={conversation}
          onChange={onAssignmentChange}
        />

        {/* Tags Section */}
        <TagsSection
          conversation={conversation}
          onChange={onTagsChange}
        />

        {/* Notes Section */}
        <NotesSection conversation={conversation} />
      </div>
    </div>
  );
}
