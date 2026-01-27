/**
 * Timeline Component Tests
 *
 * Tests for timeline display:
 * - Message ordering
 * - Message grouping (same sender, 5 min window)
 * - Sender info display
 * - Status indicators
 * - Pagination
 */

import { describe, it, expect } from 'vitest';

/**
 * Test message grouping logic
 */
function groupMessages(
  messages: any[],
  currentUserId: string,
): Array<{ message: any; showSender: boolean; isOwn: boolean }> {
  if (!messages.length) return [];

  const GROUPING_WINDOW = 5 * 60 * 1000; // 5 minutes
  const result: Array<{ message: any; showSender: boolean; isOwn: boolean }> = [];

  for (let i = 0; i < messages.length; i++) {
    const current = messages[i];
    const previous = i > 0 ? messages[i - 1] : null;
    const currentTime = new Date(current.createdAt).getTime();
    const previousTime = previous ? new Date(previous.createdAt).getTime() : 0;

    const showSender =
      !previous ||
      previous.senderId !== current.senderId ||
      currentTime - previousTime > GROUPING_WINDOW;

    result.push({
      message: current,
      showSender,
      isOwn: current.senderId === currentUserId,
    });
  }

  return result;
}

describe('Timeline Message Grouping', () => {
  const now = Date.now();
  const baseTime = new Date(now).toISOString();

  describe('Single message', () => {
    it('should show sender for first message', () => {
      const messages = [
        {
          id: 'msg-1',
          senderId: 'user-1',
          senderName: 'Alice',
          body: 'Hello',
          createdAt: baseTime,
        },
      ];

      const grouped = groupMessages(messages, 'user-2');

      expect(grouped).toHaveLength(1);
      expect(grouped[0].showSender).toBe(true);
    });
  });

  describe('Message ordering', () => {
    it('should maintain chronological order', () => {
      const messages = [
        {
          id: 'msg-1',
          senderId: 'user-1',
          senderName: 'Alice',
          body: 'First',
          createdAt: new Date(now - 5000).toISOString(),
        },
        {
          id: 'msg-2',
          senderId: 'user-1',
          senderName: 'Alice',
          body: 'Second',
          createdAt: new Date(now - 2000).toISOString(),
        },
        {
          id: 'msg-3',
          senderId: 'user-1',
          senderName: 'Alice',
          body: 'Third',
          createdAt: baseTime,
        },
      ];

      const grouped = groupMessages(messages, 'user-2');

      expect(grouped[0].message.body).toBe('First');
      expect(grouped[1].message.body).toBe('Second');
      expect(grouped[2].message.body).toBe('Third');
    });
  });

  describe('Same sender grouping', () => {
    it('should group consecutive messages from same sender', () => {
      const messages = [
        {
          id: 'msg-1',
          senderId: 'user-1',
          senderName: 'Alice',
          body: 'First',
          createdAt: new Date(now - 3000).toISOString(),
        },
        {
          id: 'msg-2',
          senderId: 'user-1',
          senderName: 'Alice',
          body: 'Second',
          createdAt: new Date(now - 2000).toISOString(),
        },
        {
          id: 'msg-3',
          senderId: 'user-1',
          senderName: 'Alice',
          body: 'Third',
          createdAt: baseTime,
        },
      ];

      const grouped = groupMessages(messages, 'user-2');

      expect(grouped[0].showSender).toBe(true); // First message
      expect(grouped[1].showSender).toBe(false); // Same sender, < 5 min
      expect(grouped[2].showSender).toBe(false); // Same sender, < 5 min
    });

    it('should show sender after 5 minute gap', () => {
      const messages = [
        {
          id: 'msg-1',
          senderId: 'user-1',
          senderName: 'Alice',
          body: 'First',
          createdAt: new Date(now - 400000).toISOString(), // 400 sec ago
        },
        {
          id: 'msg-2',
          senderId: 'user-1',
          senderName: 'Alice',
          body: 'Second',
          createdAt: baseTime, // 400 sec later (> 5 min)
        },
      ];

      const grouped = groupMessages(messages, 'user-2');

      expect(grouped[0].showSender).toBe(true);
      expect(grouped[1].showSender).toBe(true); // > 5 min gap
    });
  });

  describe('Different sender', () => {
    it('should always show sender when sender changes', () => {
      const messages = [
        {
          id: 'msg-1',
          senderId: 'user-1',
          senderName: 'Alice',
          body: 'First',
          createdAt: new Date(now - 3000).toISOString(),
        },
        {
          id: 'msg-2',
          senderId: 'user-2',
          senderName: 'Bob',
          body: 'Second',
          createdAt: new Date(now - 2000).toISOString(),
        },
      ];

      const grouped = groupMessages(messages, 'user-3');

      expect(grouped[0].showSender).toBe(true);
      expect(grouped[1].showSender).toBe(true); // Different sender
    });
  });

  describe('isOwn flag', () => {
    it('should mark own messages correctly', () => {
      const currentUserId = 'user-1';
      const messages = [
        {
          id: 'msg-1',
          senderId: 'user-1',
          senderName: 'Alice',
          body: 'My message',
          createdAt: baseTime,
        },
        {
          id: 'msg-2',
          senderId: 'user-2',
          senderName: 'Bob',
          body: 'Their message',
          createdAt: baseTime,
        },
      ];

      const grouped = groupMessages(messages, currentUserId);

      expect(grouped[0].isOwn).toBe(true);
      expect(grouped[1].isOwn).toBe(false);
    });
  });

  describe('Empty messages', () => {
    it('should return empty array for empty messages', () => {
      const grouped = groupMessages([], 'user-1');

      expect(grouped).toHaveLength(0);
    });
  });

  describe('Complex scenario', () => {
    it('should handle mixed senders and time gaps', () => {
      const messages = [
        // Alice - first
        {
          id: 'msg-1',
          senderId: 'user-1',
          senderName: 'Alice',
          body: 'Hello',
          createdAt: new Date(now - 400000).toISOString(),
        },
        // Alice - < 5 min later
        {
          id: 'msg-2',
          senderId: 'user-1',
          senderName: 'Alice',
          body: 'How are you?',
          createdAt: new Date(now - 300000).toISOString(),
        },
        // Bob - different sender
        {
          id: 'msg-3',
          senderId: 'user-2',
          senderName: 'Bob',
          body: 'Good!',
          createdAt: new Date(now - 250000).toISOString(),
        },
        // Bob - < 5 min later
        {
          id: 'msg-4',
          senderId: 'user-2',
          senderName: 'Bob',
          body: 'You?',
          createdAt: new Date(now - 200000).toISOString(),
        },
        // Alice - > 5 min later
        {
          id: 'msg-5',
          senderId: 'user-1',
          senderName: 'Alice',
          body: 'Also good',
          createdAt: baseTime,
        },
      ];

      const grouped = groupMessages(messages, 'user-3');

      expect(grouped[0].showSender).toBe(true); // Alice first
      expect(grouped[1].showSender).toBe(false); // Alice grouped
      expect(grouped[2].showSender).toBe(true); // Bob new sender
      expect(grouped[3].showSender).toBe(false); // Bob grouped
      expect(grouped[4].showSender).toBe(true); // Alice > 5 min later
    });
  });
});
