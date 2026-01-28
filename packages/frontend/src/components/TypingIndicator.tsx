/**
 * Typing Indicator Component
 *
 * Displays which users are currently typing in a conversation
 * Formats: "Alice is typing..." | "Alice and Bob are typing..." | "Alice, Bob and 2 others are typing..."
 *
 * Features:
 * - Dynamic text based on typing user count
 * - Animated loading dots
 * - No layout shift (fixed height)
 * - Accessible (ARIA labels)
 * - Styled with Tailwind/DaisyUI
 */

import { useMemo } from 'react';
import { useTypingUsers } from '../stores/websocket.store';

interface TypingIndicatorProps {
  conversationId: string;
  className?: string;
}

/**
 * Format typing users display
 * Shows up to 3 users explicitly, then adds count for others
 */
function formatTypingUsers(users: Array<{ userId: string; userName: string }>): string {
  if (users.length === 0) {
    return '';
  }

  if (users.length === 1) {
    return `${users[0].userName} is typing...`;
  }

  if (users.length === 2) {
    return `${users[0].userName} and ${users[1].userName} are typing...`;
  }

  // 3+ users
  const shown = users.slice(0, 2);
  const remaining = users.length - 2;
  const names = shown.map((u) => u.userName).join(', ');

  if (remaining === 1) {
    return `${names} and ${remaining} other is typing...`;
  }

  return `${names} and ${remaining} others are typing...`;
}

/**
 * Typing Indicator Component
 */
export function TypingIndicator({ conversationId, className }: TypingIndicatorProps) {
  const typingUsers = useTypingUsers(conversationId);

  const typingText = useMemo(() => {
    return formatTypingUsers(typingUsers);
  }, [typingUsers]);

  if (!typingText) {
    return null;
  }

  return (
    <div
      className={`flex items-center gap-2 text-sm text-base-content/70 h-6 ${className || ''}`}
      role="status"
      aria-live="polite"
      aria-label="Users typing indicator"
    >
      <span>{typingText}</span>
      <span
        className="flex gap-1"
        aria-hidden="true"
      >
        <span className="w-1 h-1 bg-current rounded-full animate-bounce" />
        <span className="w-1 h-1 bg-current rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
        <span className="w-1 h-1 bg-current rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
      </span>
    </div>
  );
}
