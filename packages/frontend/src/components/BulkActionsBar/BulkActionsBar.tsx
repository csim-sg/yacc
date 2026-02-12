/**
 * Bulk Actions Bar
 * Displays action buttons when conversations are selected
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { bulkActionsService } from '../../services/bulkActions.service';
import { useSelectedConversationsStore } from '../../stores/selectedConversations.store';
import { useTagsStore } from '../../stores/tags.store';

interface BulkActionsBarProps {
  onActionsComplete?: () => void;
}

export function BulkActionsBar({ onActionsComplete }: BulkActionsBarProps) {
  const queryClient = useQueryClient();
  const { selectedIds, getSelectedIds, deselectAll } = useSelectedConversationsStore();
  const { tags } = useTagsStore();

  const selectedCount = selectedIds.size;
  const conversationIds = getSelectedIds();

  /**
   * User list - deferred to Phase 3
   * TODO: Implement GET /api/users endpoint
   * Phase 1 MVP: Users dropdown empty; bulk assign still works via direct ID
   */
  const users: Array<{ id: string; name: string }> = [];

  // Bulk assign mutation
  const bulkAssignMutation = useMutation({
    mutationFn: (assignedUserId: string) =>
      bulkActionsService.bulkAssign(conversationIds, assignedUserId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['conversations'] });
      deselectAll();
      onActionsComplete?.();
    },
  });

  // Bulk tag mutation
  const bulkTagMutation = useMutation({
    mutationFn: (tagId: number) =>
      bulkActionsService.bulkTag(conversationIds, tagId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['conversations'] });
      deselectAll();
      onActionsComplete?.();
    },
  });

  // Bulk status mutation
  const bulkStatusMutation = useMutation({
    mutationFn: (status: 'open' | 'pending' | 'resolved') =>
      bulkActionsService.bulkUpdateStatus(conversationIds, status),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['conversations'] });
      deselectAll();
      onActionsComplete?.();
    },
  });

  if (selectedCount === 0) {
    return null;
  }

  const isPending =
    bulkAssignMutation.isPending ||
    bulkTagMutation.isPending ||
    bulkStatusMutation.isPending;

  return (
    <div
      className="sticky bottom-0 left-0 right-0 bg-primary text-primary-content px-4 py-3 shadow-lg border-t border-primary-dark"
      data-testid="bulk-actions-bar"
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 flex-wrap">
        {/* Selection info */}
        <div className="flex items-center gap-3">
          <span className="badge badge-lg badge-secondary">
            {selectedCount} selected
          </span>
          <span className="text-sm opacity-90">
            {selectedCount === 1 ? '1 conversation' : `${selectedCount} conversations`}
          </span>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Assign dropdown */}
          <div className="dropdown dropdown-top">
            <button
              className="btn btn-sm btn-secondary"
              disabled={isPending}
              data-testid="assign-button"
            >
              Assign
            </button>
            <ul className="dropdown-content z-50 menu p-2 shadow bg-base-100 text-base-content rounded-box w-52 border border-base-300">
              {/* Note: Unassign not available in Phase 2 MVP - backend requires assignedUserId */}
              {users.length === 0 && (
                <li>
                  <div className="text-xs text-base-content/50" data-testid="no-users-message">
                    User list coming in Phase 3
                  </div>
                </li>
              )}
              {users.map((user) => (
                <li key={user.id}>
                  <button
                    onClick={() => bulkAssignMutation.mutate(user.id)}
                    disabled={isPending}
                    data-testid={`assign-user-${user.id}`}
                  >
                    {user.name}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Tag dropdown */}
          {tags.length > 0 && (
            <div className="dropdown dropdown-top">
              <button
                className="btn btn-sm btn-secondary"
                disabled={isPending}
                data-testid="tag-button"
              >
                Tag
              </button>
              <ul className="dropdown-content z-50 menu p-2 shadow bg-base-100 text-base-content rounded-box w-52 border border-base-300 max-h-48 overflow-y-auto">
                {tags.map((tag) => (
                  <li key={tag.id}>
                    <button
                      onClick={() => bulkTagMutation.mutate(tag.id)}
                      disabled={isPending}
                      className="flex items-center gap-2"
                      data-testid={`tag-option-${tag.id}`}
                    >
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: tag.color }}
                      />
                      <span>{tag.name}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Status dropdown */}
          <div className="dropdown dropdown-top">
            <button
              className="btn btn-sm btn-secondary"
              disabled={isPending}
              data-testid="status-button"
            >
              Status
            </button>
            <ul className="dropdown-content z-50 menu p-2 shadow bg-base-100 text-base-content rounded-box w-40 border border-base-300">
              <li>
                <button
                  onClick={() => bulkStatusMutation.mutate('open')}
                  disabled={isPending}
                  data-testid="status-open"
                >
                  Open
                </button>
              </li>
              <li>
                <button
                  onClick={() => bulkStatusMutation.mutate('pending')}
                  disabled={isPending}
                  data-testid="status-pending"
                >
                  Pending
                </button>
              </li>
              <li>
                <button
                  onClick={() => bulkStatusMutation.mutate('resolved')}
                  disabled={isPending}
                  data-testid="status-resolved"
                >
                  Resolved
                </button>
              </li>
            </ul>
          </div>

          {/* Clear selection */}
          <button
            onClick={() => deselectAll()}
            className="btn btn-sm btn-ghost"
            disabled={isPending}
            data-testid="clear-selection-button"
          >
            Clear
          </button>
        </div>

        {/* Loading indicator */}
        {isPending && (
          <div className="flex items-center gap-2">
            <div className="loading loading-spinner loading-sm"></div>
            <span className="text-sm">Updating...</span>
          </div>
        )}
      </div>

      {/* Error message */}
      {(bulkAssignMutation.isError ||
        bulkTagMutation.isError ||
        bulkStatusMutation.isError) && (
        <div className="mt-2 alert alert-error alert-sm">
          <span className="text-sm">
            {bulkAssignMutation.error instanceof Error
              ? bulkAssignMutation.error.message
              : bulkTagMutation.error instanceof Error
                ? bulkTagMutation.error.message
                : bulkStatusMutation.error instanceof Error
                  ? bulkStatusMutation.error.message
                  : 'Operation failed'}
          </span>
        </div>
      )}
    </div>
  );
}
