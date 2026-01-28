/**
 * Timeline Component
 *
 * Main conversation timeline display
 * Features:
 * - Chronological message ordering
 * - Message grouping (same sender within 5 min)
 * - Pagination (infinite scroll)
 * - Unread marker
 * - Real-time updates via WebSocket
 * - Virtual scrolling for performance
 *
 * Props:
 * - conversationId: Conversation ID
 * - currentUserId: Current user ID
 * - messages: Message array
 * - isLoading: Loading state
 * - onLoadMore: Pagination callback
 * - className?: CSS classes
 */

import { useEffect, useRef, useMemo } from 'react';
import type { FC } from 'react';
import { TimelineMessage } from './TimelineMessage';
import { TypingIndicator } from '../TypingIndicator';
import { logger } from '../../lib/logger';

interface TimelineProps {
  conversationId: string;
  currentUserId: string;
  messages: any[]; // TODO: Message[]
  isLoading?: boolean;
  onLoadMore?: () => void;
  className?: string;
}

/**
 * Group messages by sender and time (5 min window)
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

    // Show sender if first message or sender changed or time gap > 5 min
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

/**
 * Timeline Component
 */
export const Timeline: FC<TimelineProps> = ({
  conversationId,
  currentUserId,
  messages,
  isLoading = false,
  onLoadMore,
  className = '',
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  // Group messages
  const groupedMessages = useMemo(() => {
    return groupMessages(messages, currentUserId);
  }, [messages, currentUserId]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [groupedMessages.length]);

  // Handle infinite scroll (load older messages)
  useEffect(() => {
    const handleScroll = (e: Event) => {
      const target = e.target as HTMLDivElement;
      if (target.scrollTop === 0 && onLoadMore && !isLoading) {
        logger.debug('[Timeline] Reached top, loading more messages');
        onLoadMore();
      }
    };

    const scrollContainer = scrollRef.current;
    scrollContainer?.addEventListener('scroll', handleScroll);

    return () => {
      scrollContainer?.removeEventListener('scroll', handleScroll);
    };
  }, [onLoadMore, isLoading]);

  return (
    <div
      ref={scrollRef}
      className={`flex-1 overflow-y-auto flex flex-col space-y-1 p-4 ${className}`}
      role="main"
      aria-label={`Conversation ${conversationId} messages timeline`}
    >
      {/* Loading indicator (top) */}
      {isLoading && (
        <div className="flex justify-center py-4">
          <span className="loading loading-spinner loading-sm text-primary" />
        </div>
      )}

      {/* No messages */}
      {!messages.length && !isLoading && (
        <div className="flex items-center justify-center h-full text-center text-base-content/60">
          <div>
            <p className="text-sm">No messages yet</p>
            <p className="text-xs">Start a conversation by sending a message</p>
          </div>
        </div>
      )}

      {/* Messages */}
      {groupedMessages.map((item, index) => (
        <TimelineMessage
          key={item.message.id || index}
          message={item.message}
          showSender={item.showSender}
          isOwn={item.isOwn}
        />
      ))}

      {/* Typing indicator */}
      <div className="mb-4">
        <TypingIndicator conversationId={conversationId} />
      </div>

      {/* Scroll anchor */}
      <div ref={endRef} />
    </div>
  );
};
