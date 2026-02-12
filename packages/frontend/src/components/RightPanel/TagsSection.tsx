/**
 * Tags Section
 * Displays and manages conversation tags
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { ConversationDetail } from '../../services/conversations.service';
import { tagsService } from '../../services/tags.service';
import { useTagsStore } from '../../stores/tags.store';

interface TagsSectionProps {
  conversation: ConversationDetail;
  onChange?: () => void;
}

const TAG_COLORS = [
  '#FF6B6B', // Red
  '#4ECDC4', // Teal
  '#45B7D1', // Blue
  '#FFA07A', // Light Salmon
  '#98D8C8', // Mint
  '#F7DC6F', // Yellow
  '#BB8FCE', // Purple
];

export function TagsSection({
  conversation,
  onChange,
}: TagsSectionProps) {
  const queryClient = useQueryClient();
  const { tags, createTag } = useTagsStore();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [selectedColor, setSelectedColor] = useState(TAG_COLORS[0]);

  // Add tag mutation
  const addTagMutation = useMutation({
    mutationFn: (tagId: string) =>
      tagsService.addToConversation(conversation.id, { tagId }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['conversation', conversation.id],
      });
      onChange?.();
    },
  });

  // Remove tag mutation
  const removeTagMutation = useMutation({
    mutationFn: (tagId: string) =>
      tagsService.removeFromConversation(conversation.id, tagId),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['conversation', conversation.id],
      });
      onChange?.();
    },
  });

  // Create tag mutation
  const createTagMutation = useMutation({
    mutationFn: () => createTag(newTagName, selectedColor),
    onSuccess: (newTag) => {
      setNewTagName('');
      setShowCreateForm(false);
      // Automatically add the new tag to conversation
      void addTagMutation.mutate(newTag.id);
    },
  });

  const conversationTags = conversation.tags || [];
  const availableTags = tags.filter(
    (tag) => !conversationTags.some((ct) => ct.id === tag.id)
  );

  return (
    <div
      className="px-4 py-4 border-b border-base-300"
      data-testid="tags-section"
    >
      <div className="flex items-center justify-between mb-3">
        <label className="text-sm font-semibold text-base-content/80">
          Tags
        </label>
      </div>

      {/* Current tags */}
      <div className="flex flex-wrap gap-2 mb-3">
        {conversationTags.map((tag) => (
          <div
            key={tag.id}
            className="flex items-center gap-1 px-2 py-1 rounded-full text-white text-xs font-medium"
            style={{ backgroundColor: tag.color }}
            data-testid={`tag-badge-${tag.id}`}
          >
            <span>{tag.name}</span>
            <button
              onClick={() => removeTagMutation.mutate(tag.id)}
              className="ml-1 hover:opacity-80 cursor-pointer"
              disabled={removeTagMutation.isPending}
              aria-label={`Remove ${tag.name} tag`}
              data-testid={`remove-tag-${tag.id}`}
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      {/* Add tag dropdown */}
      {availableTags.length > 0 && !showCreateForm && (
        <div className="dropdown dropdown-top w-full">
          <button className="btn btn-sm btn-outline w-full" data-testid="add-tag-button">
            + Add Tag
          </button>
          <ul className="dropdown-content z-50 menu p-2 shadow bg-base-100 rounded-box w-52 border border-base-300">
            {availableTags.map((tag) => (
              <li key={tag.id}>
                <button
                  onClick={() => addTagMutation.mutate(tag.id)}
                  disabled={addTagMutation.isPending}
                  className="flex items-center gap-2"
                  data-testid={`add-tag-option-${tag.id}`}
                >
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: tag.color }}
                  />
                  <span>{tag.name}</span>
                </button>
              </li>
            ))}
            <li>
              <button
                onClick={() => setShowCreateForm(true)}
                className="text-primary"
                data-testid="create-new-tag-button"
              >
                + Create New Tag
              </button>
            </li>
          </ul>
        </div>
      )}

      {/* Create new tag form */}
      {showCreateForm && (
        <div className="space-y-3" data-testid="create-tag-form">
          <input
            type="text"
            placeholder="Tag name"
            value={newTagName}
            onChange={(e) => setNewTagName(e.target.value)}
            className="input input-sm input-bordered w-full"
            data-testid="tag-name-input"
          />
          <div className="flex gap-2 flex-wrap">
            {TAG_COLORS.map((color) => (
              <button
                key={color}
                onClick={() => setSelectedColor(color)}
                className={`w-6 h-6 rounded-full border-2 ${
                  selectedColor === color ? 'border-base-content' : 'border-transparent'
                }`}
                style={{ backgroundColor: color }}
                data-testid={`color-option-${color}`}
              />
            ))}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => createTagMutation.mutate()}
              disabled={!newTagName.trim() || createTagMutation.isPending}
              className="btn btn-sm btn-primary flex-1"
              data-testid="save-tag-button"
            >
              {createTagMutation.isPending ? 'Creating...' : 'Create'}
            </button>
            <button
              onClick={() => setShowCreateForm(false)}
              className="btn btn-sm btn-ghost flex-1"
              data-testid="cancel-tag-button"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {addTagMutation.isPending && (
        <div className="mt-2 text-xs text-base-content/60">Adding tag...</div>
      )}

      {removeTagMutation.isPending && (
        <div className="mt-2 text-xs text-base-content/60">Removing tag...</div>
      )}
    </div>
  );
}
