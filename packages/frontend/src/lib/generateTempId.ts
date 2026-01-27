/**
 * Generate Temporary ID
 * Creates unique temporary IDs for optimistic updates
 * Format: temp-{timestamp}-{random}
 */

/**
 * Generate a unique temporary ID for optimistic updates
 * Used to track optimistic messages until server confirms creation
 * Format: temp-{timestamp}-{random}
 */
export function generateTempId(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 11);
  return `temp-${timestamp}-${random}`;
}

/**
 * Check if an ID is a temporary ID
 */
export function isTempId(id: string): boolean {
  return id.startsWith('temp-');
}
