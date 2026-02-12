/**
 * Selected Conversations Store
 * Zustand store for managing selected conversations for bulk actions
 */

import { create } from 'zustand';

interface SelectedConversationsStore {
  selectedIds: Set<string>;
  isSelectAll: boolean;

  // Actions
  toggleConversation: (id: string) => void;
  selectAll: (ids: string[]) => void;
  deselectAll: () => void;
  clearSelection: () => void;
  isSelected: (id: string) => boolean;
  getSelectedIds: () => string[];
}

export const useSelectedConversationsStore = create<SelectedConversationsStore>(
  (set, get) => ({
    selectedIds: new Set(),
    isSelectAll: false,

    toggleConversation: (id: string) => {
      set((state) => {
        const newSelectedIds = new Set(state.selectedIds);
        if (newSelectedIds.has(id)) {
          newSelectedIds.delete(id);
        } else {
          newSelectedIds.add(id);
        }
        return { selectedIds: newSelectedIds };
      });
    },

    selectAll: (ids: string[]) => {
      set({
        selectedIds: new Set(ids),
        isSelectAll: true,
      });
    },

    deselectAll: () => {
      set({
        selectedIds: new Set(),
        isSelectAll: false,
      });
    },

    clearSelection: () => {
      set({
        selectedIds: new Set(),
        isSelectAll: false,
      });
    },

    isSelected: (id: string) => {
      return get().selectedIds.has(id);
    },

    getSelectedIds: () => {
      return Array.from(get().selectedIds);
    },
  })
);
