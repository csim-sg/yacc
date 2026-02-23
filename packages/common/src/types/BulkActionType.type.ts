/**
 * Bulk Action Type
 * Supported bulk operation types for conversations
 *
 * Note: These values match the backend implementation.
 * The schema uses 'changeStatus'/'changePriority' for validation but the API uses 'status'.
 */
export type BulkActionType = 'assign' | 'tag' | 'status';
