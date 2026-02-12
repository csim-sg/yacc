/**
 * Tags Store
 * Zustand store for managing tags across the application
 */

import { create } from 'zustand';
import { tagsService, type Tag } from '../services/tags.service';

interface TagsStore {
  tags: Tag[];
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchTags: () => Promise<void>;
  createTag: (name: string, color: string) => Promise<Tag>;
  addTagToConversation: (conversationId: string, tagId: string) => Promise<void>;
  removeTagFromConversation: (conversationId: string, tagId: string) => Promise<void>;
  clearError: () => void;
}

export const useTagsStore = create<TagsStore>((set, get) => ({
  tags: [],
  isLoading: false,
  error: null,

  fetchTags: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await tagsService.list();
      set({ tags: response.data, isLoading: false });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch tags';
      set({ error: errorMessage, isLoading: false });
      console.error('Failed to fetch tags:', error);
    }
  },

  createTag: async (name: string, color: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await tagsService.create({ name, color });
      const newTag = response.data;
      set((state) => ({
        tags: [...state.tags, newTag],
        isLoading: false,
      }));
      return newTag;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create tag';
      set({ error: errorMessage, isLoading: false });
      console.error('Failed to create tag:', error);
      throw error;
    }
  },

  addTagToConversation: async (conversationId: string, tagId: string) => {
    set({ error: null });
    try {
      await tagsService.addToConversation(conversationId, { tagId });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to add tag';
      set({ error: errorMessage });
      console.error('Failed to add tag to conversation:', error);
      throw error;
    }
  },

  removeTagFromConversation: async (conversationId: string, tagId: string) => {
    set({ error: null });
    try {
      await tagsService.removeFromConversation(conversationId, tagId);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to remove tag';
      set({ error: errorMessage });
      console.error('Failed to remove tag from conversation:', error);
      throw error;
    }
  },

  clearError: () => set({ error: null }),
}));
