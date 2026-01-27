/**
 * Message Status Indicator Component
 * Displays message delivery status: pending, sent, or failed
 * Shows retry button for failed messages with error tooltip
 */

import React, { useState } from 'react';
import type { Message } from '../api/schemas';

type MessageStatus = 'pending' | 'sent' | 'failed';

interface MessageStatusProps {
  message: Message;
  onRetry?: (messageId: string) => void;
  isLoading?: boolean;
}

/**
 * MessageStatus component
 * Renders visual indicator of message delivery status
 * - Pending: animated spinner
 * - Sent: checkmark icon
 * - Failed: error icon with retry button
 */
export const MessageStatus: React.FC<MessageStatusProps> = ({
  message,
  onRetry,
  isLoading = false,
}) => {
  const [showErrorTooltip, setShowErrorTooltip] = useState(false);

  const status = message.status;
  const isPending = status === 'pending';
  const isSent = status === 'sent';
  const isFailed = status === 'failed';

  // Pending state - animated spinner
  if (isPending || isLoading) {
    return (
      <div
        className="inline-flex items-center gap-1"
        aria-label="Message sending"
        role="status"
      >
        <div className="w-4 h-4 rounded-full border-2 border-transparent border-t-blue-500 border-r-blue-500 animate-spin" />
        <span className="text-xs text-gray-500">Sending...</span>
      </div>
    );
  }

  // Sent state - checkmark
  if (isSent) {
    return (
      <div
        className="inline-flex items-center gap-1 text-green-600"
        aria-label="Message sent successfully"
        role="status"
      >
        <svg
          className="w-4 h-4"
          fill="currentColor"
          viewBox="0 0 20 20"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
            clipRule="evenodd"
          />
        </svg>
        <span className="text-xs">Sent</span>
      </div>
    );
  }

  // Failed state - error icon with tooltip and retry button
  if (isFailed) {
    return (
      <div className="inline-flex items-center gap-2">
        <div className="relative inline-flex items-center">
          <button
            className="inline-flex items-center gap-1 text-red-600 hover:bg-red-50 rounded px-2 py-1 transition-colors"
            aria-label={`Message failed to send. ${message.body || 'Error details'}`}
            onMouseEnter={() => setShowErrorTooltip(true)}
            onMouseLeave={() => setShowErrorTooltip(false)}
            onClick={() => setShowErrorTooltip(!showErrorTooltip)}
            type="button"
          >
            <svg
              className="w-4 h-4"
              fill="currentColor"
              viewBox="0 0 20 20"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clipRule="evenodd"
              />
            </svg>
            <span className="text-xs">Failed</span>
          </button>

          {/* Error tooltip */}
          {showErrorTooltip && (
            <div
              className="absolute left-0 mt-0 mb-2 bottom-full w-max bg-red-900 text-white text-xs px-2 py-1 rounded shadow-lg z-10"
              role="tooltip"
            >
              Failed to send. Click retry or contact support.
              <div className="absolute top-full left-2 w-0 h-0 border-l-2 border-r-2 border-t-2 border-l-transparent border-r-transparent border-t-red-900" />
            </div>
          )}
        </div>

        {/* Retry button */}
        {onRetry && (
          <button
            className="text-xs px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={() => onRetry(message.id)}
            disabled={isLoading}
            aria-label="Retry sending message"
            type="button"
          >
            {isLoading ? 'Retrying...' : 'Retry'}
          </button>
        )}
      </div>
    );
  }

  // Unknown status - show nothing
  return null;
};

MessageStatus.displayName = 'MessageStatus';
