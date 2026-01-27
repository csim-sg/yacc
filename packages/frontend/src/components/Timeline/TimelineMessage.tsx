/**
 * Timeline Message Component
 *
 * Displays a single message in conversation timeline
 * Includes:
 * - Sender avatar, name, timestamp
 * - Message body with status indicator
 * - Attachments preview
 * - Message grouping (visual)
 *
 * Props:
 * - message: Message object
 * - showSender: Show avatar/name (false if grouped with previous message)
 * - isOwn: True if message sent by current user
 */

import type { FC } from 'react';

interface TimelineMessageProps {
  message: any; // TODO: Use Message type from @yacc/common
  showSender: boolean;
  isOwn: boolean;
  className?: string;
}

/**
 * Timeline Message Component
 */
export const TimelineMessage: FC<TimelineMessageProps> = ({
  message,
  showSender,
  isOwn,
  className = '',
}) => {
  return (
    <div
      className={`flex gap-3 py-2 ${isOwn ? 'flex-row-reverse' : ''} ${className}`}
      data-message-id={message.id}
      role="article"
      aria-label={`Message from ${message.senderName} at ${message.createdAt}`}
    >
      {/* Avatar */}
      {showSender && (
        <div className="flex-shrink-0 w-8 h-8 bg-base-300 rounded-full flex items-center justify-center text-xs font-semibold">
          {message.senderName?.charAt(0).toUpperCase() || '?'}
        </div>
      )}

      {/* Empty space for grouped messages (no avatar) */}
      {!showSender && <div className="w-8 flex-shrink-0" />}

      {/* Message content */}
      <div className={`flex-1 ${isOwn ? 'text-right' : ''}`}>
        {/* Sender info (only first message in group) */}
        {showSender && (
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-sm font-semibold ${isOwn ? 'text-right w-full' : ''}`}>
              {message.senderName}
            </span>
            <span className="text-xs text-base-content/50">
              {new Date(message.createdAt).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </div>
        )}

        {/* Message body */}
        <div
          className={`inline-block px-3 py-2 rounded-lg ${
            isOwn ? 'bg-primary text-primary-content' : 'bg-base-200 text-base-content'
          }`}
        >
          <p className="text-sm whitespace-pre-wrap break-words">{message.body}</p>
        </div>

        {/* Status indicator (only for own messages) */}
        {isOwn && message.status && (
          <div className="flex justify-end items-center gap-1 mt-1 text-xs text-base-content/60">
            {message.status === 'pending' && (
              <>
                <span className="loading loading-spinner loading-xs" />
                <span>Sending...</span>
              </>
            )}
            {message.status === 'sent' && (
              <>
                <span>✓</span>
                <span>Sent</span>
              </>
            )}
            {message.status === 'failed' && (
              <span className="text-error">Failed</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
