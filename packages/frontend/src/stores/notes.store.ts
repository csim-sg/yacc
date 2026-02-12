/**
 * Notes Store
 * Zustand store for managing notes for the current conversation
 */

import { create } from 'zustand';
import { notesService, type Note } from '../services/notes.service';

interface NotesStore {
  notes: Note[];
  isLoading: boolean;
  error: string | null;
  currentConversationId: string | null;

  // Actions
  fetchNotes: (conversationId: string) => Promise<void>;
  addNote: (conversationId: string, body: string, mentions?: string[]) => Promise<Note>;
  setCurrentConversation: (conversationId: string | null) => void;
  clearError: () => void;
}

export const useNotesStore = create<NotesStore>((set) => ({
  notes: [],
  isLoading: false,
  error: null,
  currentConversationId: null,

  fetchNotes: async (conversationId: string) => {
    set({ isLoading: true, error: null, currentConversationId: conversationId });
    try {
      const response = await notesService.list(conversationId);
      set({ notes: response.data, isLoading: false });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch notes';
      set({ error: errorMessage, isLoading: false });
      console.error('Failed to fetch notes:', error);
    }
  },

  addNote: async (conversationId: string, body: string, mentions?: string[]) => {
    set({ error: null });
    try {
      const response = await notesService.create(conversationId, {
        body,
        mentions,
      });
      const newNote = response.data;
      set((state) => ({
        notes: [...state.notes, newNote],
      }));
      return newNote;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create note';
      set({ error: errorMessage });
      console.error('Failed to create note:', error);
      throw error;
    }
  },

  setCurrentConversation: (conversationId: string | null) => {
    set({
      currentConversationId: conversationId,
      notes: conversationId ? [] : [],
      error: null,
    });
  },

  clearError: () => set({ error: null }),
}));
