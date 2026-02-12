/**
 * Assignment Section
 * Allows assigning/unassigning conversations to users
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { assignmentsService } from '../../services/assignments.service';
import type { ConversationDetail } from '../../services/conversations.service';

interface AssignmentSectionProps {
  conversation: ConversationDetail;
  onChange?: () => void;
}

/**
 * User list - deferred to Phase 3
 * TODO: Implement GET /api/users endpoint to fetch real users
 * Phase 1 MVP: Assignment works but user dropdown is empty
 * Will be populated once user API is available in Phase 3
 */

export function AssignmentSection({
  conversation,
  onChange,
}: AssignmentSectionProps) {
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);

  // TODO: Replace with real users API call (GET /api/users)
  // For Phase 1 MVP, users list is empty - assignment still functions via ID input
  const users: Array<{ id: string; name: string; email: string }> = [];

  // Assign mutation
  const assignMutation = useMutation({
    mutationFn: (userId: string | null) =>
      assignmentsService.assign(conversation.id, userId),
    onSuccess: () => {
      // Invalidate conversation queries to refetch
      void queryClient.invalidateQueries({
        queryKey: ['conversation', conversation.id],
      });
      setIsOpen(false);
      onChange?.();
    },
    onError: (error) => {
      console.error('Failed to assign conversation:', error);
    },
  });

  const currentAssignee = users.find(
    (u) => u.id === conversation.assignedUserId
  );

  return (
    <div
      className="px-4 py-4 border-b border-base-300"
      data-testid="assignment-section"
    >
      <div className="flex items-center justify-between mb-2">
        <label className="text-sm font-semibold text-base-content/80">
          Assigned to
        </label>
      </div>

      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full btn btn-sm btn-outline"
          disabled={assignMutation.isPending}
          data-testid="assignment-button"
        >
          {currentAssignee ? (
            <>
              <span className="text-xs">{currentAssignee.name}</span>
            </>
          ) : (
            <span className="text-xs opacity-50">Unassigned</span>
          )}
        </button>

        {isOpen && (
          <div
            className="absolute top-full left-0 right-0 mt-2 bg-base-100 border border-base-300 rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto"
            data-testid="assignment-dropdown"
          >
            {/* Unassign option */}
            <button
              onClick={() => assignMutation.mutate(null)}
              className="w-full text-left px-4 py-2 text-sm hover:bg-base-200 border-b border-base-300"
              disabled={assignMutation.isPending}
              data-testid="unassign-option"
            >
              Unassigned
            </button>

            {/* User options */}
            {users.map((user) => (
              <button
                key={user.id}
                onClick={() => assignMutation.mutate(user.id)}
                className={`w-full text-left px-4 py-2 text-sm hover:bg-base-200 ${
                  user.id === conversation.assignedUserId
                    ? 'bg-primary/10 text-primary'
                    : ''
                }`}
                disabled={assignMutation.isPending}
                data-testid={`user-option-${user.id}`}
              >
                <div className="font-medium">{user.name}</div>
                <div className="text-xs opacity-70">{user.email}</div>
              </button>
            ))}
          </div>
        )}
      </div>

      {assignMutation.isPending && (
        <div className="mt-2 flex items-center gap-2">
          <div className="loading loading-spinner loading-xs"></div>
          <span className="text-xs text-base-content/60">Updating...</span>
        </div>
      )}

      {assignMutation.isError && (
        <div className="mt-2 alert alert-error alert-sm">
          <span className="text-xs">Failed to update assignment</span>
        </div>
      )}
    </div>
  );
}
