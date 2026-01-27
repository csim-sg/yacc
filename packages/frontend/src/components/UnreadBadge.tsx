/**
 * Unread Badge Component
 * Displays unread message count for conversations
 *
 * Features:
 * - Shows count (e.g., "3")
 * - Red/warning color for unread
 * - Smooth animations on count changes
 * - Accessible (ARIA label)
 * - No layout shift when count changes
 * - Disappears when count is 0
 */

import React from 'react';

interface UnreadBadgeProps {
  /** Number of unread messages */
  count: number;
  /** Optional CSS class name for styling */
  className?: string;
}

/**
 * UnreadBadge Component
 * Shows unread message count with visual feedback
 *
 * @param count - Number of unread messages
 * @param className - Additional CSS classes
 *
 * @example
 * ```tsx
 * <UnreadBadge count={3} />
 * <UnreadBadge count={0} /> // Hidden
 * <UnreadBadge count={99} className="badge-lg" />
 * ```
 */
export const UnreadBadge: React.FC<UnreadBadgeProps> = ({ count, className = '' }) => {
  // Don't render if count is 0
  if (count === 0) {
    return null;
  }

  // Cap display at 99+ for very large counts
  const displayCount = count > 99 ? '99+' : count.toString();

  return (
    <span
      className={`badge badge-sm badge-error transition-all duration-200 ${className}`}
      role="status"
      aria-live="polite"
      aria-label={`${count} unread message${count === 1 ? '' : 's'}`}
    >
      {displayCount}
    </span>
  );
};

UnreadBadge.displayName = 'UnreadBadge';
