import { Component, input } from '@angular/core';

/**
 * UnreadBadge (React `UnreadBadge.tsx` port — W6).
 *
 * Shows a conversation's unread message count with visual feedback:
 * hidden at 0, capped at `99+`, live-region announced. The count comes
 * from the conversation's `unreadCount` on the canonical conversations
 * list state — no separate badge store (single canonical state).
 */
@Component({
  selector: 'app-unread-badge',
  templateUrl: './unread-badge.html',
})
export class UnreadBadge {
  /** Number of unread messages. */
  readonly count = input.required<number>();

  /** Additional CSS classes. */
  readonly className = input('');
}
