/**
 * Assignment Types
 * Backend-specific types for conversation assignment operations
 *
 * For shared types, use:
 * - Assignment from '@yacc/common/types/Assignment.type'
 * - AssignmentResponse from '@yacc/common/responses/conversations/assignment.response'
 * - AssignRequest from '@yacc/common/requests/conversations/assign.request'
 */

/**
 * Assign Conversation Request
 * @deprecated Use AssignRequest from '@yacc/common/requests/conversations/assign.request'
 */
export interface AssignConversationRequest {
  assignedUserId: string; // User ID to assign the conversation to
}

/**
 * Assignment Response DTO
 * @deprecated Use AssignmentResponse from '@yacc/common/responses/conversations/assignment.response'
 */
export interface AssignmentResponse {
  id: string;
  conversationId: string;
  previouslyAssignedUserId: string | null;
  newlyAssignedUserId: string;
  assignedAt: string;
}

/**
 * Assignment audit metadata
 */
export interface AssignmentAuditMetadata {
  oldAssignedUserId: string | null;
  newAssignedUserId: string;
  conversationId: string;
}
