/**
 * Assignment Entity
 * Represents a conversation assignment to a user
 * Tracks current and previous assignees for audit purposes
 *
 * @see PATCH /api/conversations/:id/assign - AssignRequest
 */
export type Assignment = {
  /** Unique identifier (UUID) */
  id: string;
  /** UUID of the conversation being assigned */
  conversationId: string;
  /** UUID of the user currently assigned to the conversation */
  assignedUserId: string | null;
  /** UUID of the user who made the assignment */
  assignedById: string;
  /** ISO8601 timestamp when assignment was created */
  createdAt: string;
  /** ISO8601 timestamp when assignment was removed (if reassigned) */
  unassignedAt?: string;
};
