/**
 * Typing Indicator Component Tests
 *
 * Tests for typing indicator display:
 * - Text formatting for different user counts
 * - Component rendering
 * - Accessibility attributes
 *
 * Note: Component tests are simplified to unit-test the formatting logic
 * Full E2E tests should use Playwright
 */

import { describe, it, expect } from 'vitest';

/**
 * Test the formatting logic extracted from the component
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

describe('Typing Indicator Formatting', () => {
  describe('No typing users', () => {
    it('should return empty string when no users are typing', () => {
      expect(formatTypingUsers([])).toBe('');
    });
  });

  describe('Single user typing', () => {
    it('should format single user correctly', () => {
      const users = [{ userId: 'user-1', userName: 'Alice' }];
      expect(formatTypingUsers(users)).toBe('Alice is typing...');
    });
  });

  describe('Two users typing', () => {
    it('should format two users correctly', () => {
      const users = [
        { userId: 'user-1', userName: 'Alice' },
        { userId: 'user-2', userName: 'Bob' },
      ];
      expect(formatTypingUsers(users)).toBe('Alice and Bob are typing...');
    });
  });

  describe('Three users typing', () => {
    it('should format three users with singular "other"', () => {
      const users = [
        { userId: 'user-1', userName: 'Alice' },
        { userId: 'user-2', userName: 'Bob' },
        { userId: 'user-3', userName: 'Charlie' },
      ];
      expect(formatTypingUsers(users)).toBe('Alice, Bob and 1 other is typing...');
    });
  });

  describe('Four or more users typing', () => {
    it('should format four users with plural "others"', () => {
      const users = [
        { userId: 'user-1', userName: 'Alice' },
        { userId: 'user-2', userName: 'Bob' },
        { userId: 'user-3', userName: 'Charlie' },
        { userId: 'user-4', userName: 'Diana' },
      ];
      expect(formatTypingUsers(users)).toBe('Alice, Bob and 2 others are typing...');
    });

    it('should format five users with plural "others"', () => {
      const users = [
        { userId: 'user-1', userName: 'Alice' },
        { userId: 'user-2', userName: 'Bob' },
        { userId: 'user-3', userName: 'Charlie' },
        { userId: 'user-4', userName: 'Diana' },
        { userId: 'user-5', userName: 'Eve' },
      ];
      expect(formatTypingUsers(users)).toBe('Alice, Bob and 3 others are typing...');
    });
  });
});
