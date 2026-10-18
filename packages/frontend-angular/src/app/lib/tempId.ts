/**
 * Temporary ID generation for optimistic updates (React
 * `lib/generateTempId.ts` port, verbatim — T2 §3.1 optimistic row).
 *
 * Used to track optimistic messages until the server confirms creation.
 * Format: `temp-{timestamp}-{random}`.
 */

/** Generate a unique temporary ID for optimistic updates. */
export function generateTempId(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 11);
  return `temp-${timestamp}-${random}`;
}

/** Check whether an ID is a temporary (not yet server-confirmed) ID. */
export function isTempId(id: string): boolean {
  return id.startsWith('temp-');
}
