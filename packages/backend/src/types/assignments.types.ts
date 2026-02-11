/**
 * Assignment Types
 * Type definitions for conversation assignment operations
 */

/**
 * Assign Conversation Request
 */
export interface AssignConversationRequest {
  assignedUserId: string; // User ID to assign the conversation to
}

/**
 * Assignment Response DTO
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
