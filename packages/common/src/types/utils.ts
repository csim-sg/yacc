/**
 * Type Utilities
 * Helper types for working with constants
 */

/**
 * Extracts the value types from a const object
 * Example: ValueOf<typeof CONVERSATION_STATUSES> = 'open' | 'pending' | 'resolved'
 */
export type ValueOf<T> = T[keyof T];
