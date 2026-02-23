/**
 * Assignment Response
 * Response shape for conversation assignment endpoints
 *
 * @see PATCH /api/conversations/:id/assign
 */
export interface AssignmentResponse {
  /** Unique identifier for this assignment record */
  id: string;
  /** UUID of the conversation */
  conversationId: string;
  /** UUID of the previously assigned user (null if unassigned) */
  previouslyAssignedUserId: string | null;
  /** UUID of the newly assigned user */
  newlyAssignedUserId: string;
  /** Display name of the user who made the assignment */
  assignedByName?: string;
  /** Display name of the newly assigned user */
  assignedToName?: string;
  /** ISO8601 timestamp when assignment was made */
  assignedAt: string;
}
