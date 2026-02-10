/**
 * Reply Composer Component
 * Text input for composing and sending replies to conversations
 *
 * Features:
 * - Text input with send button
 * - Loading/sending state
 * - Error handling and display
 * - Optimistic UI updates
 * - Character limit (5000 chars)
 * - Keyboard shortcut: Ctrl+Enter to send
 * - Input validation (prevent empty messages)
 */

import React, { useState, useCallback, useEffect } from 'react';

interface ReplyComposerProps {
  /** Called when user submits the reply */
  onSend: (body: string) => Promise<void>;

  /** Whether the send operation is in progress */
  isSending?: boolean;

  /** Error message if send failed */
  error?: string;

  /** Whether to show error alert */
  showError?: boolean;

  /** Callback when error is dismissed */
  onErrorDismiss?: () => void;

  /** Max character limit (default: 5000) */
  maxLength?: number;

  /** CSS class */
  className?: string;

  /** Placeholder text */
  placeholder?: string;
}

const DEFAULT_MAX_LENGTH = 5000;
const DEFAULT_PLACEHOLDER = 'Type your reply here...';

/**
 * ReplyComposer Component
 * Renders text input with send functionality
 */
export const ReplyComposer: React.FC<ReplyComposerProps> = ({
  onSend,
  isSending = false,
  error,
  showError = true,
  onErrorDismiss,
  maxLength = DEFAULT_MAX_LENGTH,
  className = '',
  placeholder = DEFAULT_PLACEHOLDER,
}) => {
  const [body, setBody] = useState('');
  const [isLocalSending, setIsLocalSending] = useState(false);

  const charCount = body.length;
  const isAtLimit = charCount >= maxLength;
  const isEmpty = !body.trim();
  const isDisabled = isEmpty || isSending || isLocalSending;

  // Handle keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Ctrl+Enter or Cmd+Enter to send
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleSend();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [body]);

  const handleSend = useCallback(async () => {
    if (isEmpty || isDisabled) {
      return;
    }

    const messageBody = body.trim();
    if (!messageBody) {
      return;
    }

    try {
      setIsLocalSending(true);
      await onSend(messageBody);
      setBody(''); // Clear input on success
    } catch (err) {
      // Error is handled by parent component via props
      console.error('[ReplyComposer] Failed to send message:', err);
    } finally {
      setIsLocalSending(false);
    }
  }, [body, isEmpty, isDisabled, onSend]);

  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      {/* Error alert */}
      {error && showError && (
        <div className="alert alert-error shadow-lg" role="alert">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="stroke-current shrink-0 h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <div className="flex-1">
            <h3 className="font-bold">Failed to send message</h3>
            <div className="text-sm">{error}</div>
          </div>
          {onErrorDismiss && (
            <button
              className="btn btn-sm btn-ghost"
              onClick={onErrorDismiss}
              aria-label="Dismiss error message"
              type="button"
            >
              Dismiss
            </button>
          )}
        </div>
      )}

      {/* Composer card */}
      <div className="card bg-base-100 border border-base-300">
        <div className="card-body p-0 gap-0">
          {/* Textarea */}
          <textarea
            className="w-full p-4 resize-none focus:outline-none focus:ring-0 min-h-24 max-h-48 bg-base-100 text-base"
            value={body}
            onChange={(e) => {
              const newValue = e.target.value.slice(0, maxLength);
              setBody(newValue);
            }}
            onKeyDown={(e) => {
              // Allow tab in textarea
              if (e.key === 'Tab') {
                e.preventDefault();
                const textarea = e.currentTarget;
                const start = textarea.selectionStart;
                const end = textarea.selectionEnd;
                const newValue = body.substring(0, start) + '\t' + body.substring(end);
                setBody(newValue);
                // Move cursor after inserted tab
                setTimeout(() => {
                  textarea.selectionStart = textarea.selectionEnd = start + 1;
                }, 0);
              }
            }}
            disabled={isSending || isLocalSending}
            placeholder={placeholder}
            aria-label="Message body"
            aria-describedby={isAtLimit ? 'char-limit-warning' : 'char-counter'}
            data-testid="reply-composer-textarea"
          />

          {/* Footer with character counter and send button */}
          <div className="flex items-center justify-between px-4 py-3 bg-base-200 border-t border-base-300 gap-3">
            {/* Character counter */}
            <div
              id={isAtLimit ? 'char-limit-warning' : 'char-counter'}
              className={`text-xs font-medium whitespace-nowrap ${
                isAtLimit
                  ? 'text-error font-bold'
                  : 'text-base-content/60'
              }`}
              aria-live="polite"
              aria-atomic="true"
            >
              {charCount.toLocaleString()} / {maxLength.toLocaleString()}
              {isAtLimit && <span className="ml-1">(limit reached)</span>}
            </div>

            {/* Send button */}
            <button
              className="btn btn-primary btn-sm gap-2"
              onClick={handleSend}
              disabled={isDisabled}
              aria-label="Send message"
              type="button"
              data-testid="reply-composer-send-button"
            >
              {isSending || isLocalSending ? (
                <>
                  <svg
                    className="w-4 h-4 animate-spin"
                    fill="none"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  <span>Sending...</span>
                </>
              ) : (
                <>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                    className="w-4 h-4"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M6 12L3.269 3.125A59.769 59.769 0 0121.94 12c0 .135-.007.27-.02.404.662-.32 1.283-.823 1.844-1.382l2.494-2.494c.09-.09.182-.179.273-.268-.663.72-1.423 1.331-2.262 1.787m0 0a48.972 48.972 0 016.02 6.022c-7.449 7.449-15.809 6.627-17.708-4.185m0 0a6.977 6.977 0 001.347-2.395m0 0a6.979 6.979 0 01.5-1.636M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <span>Send</span>
                </>
              )}
            </button>
          </div>

          {/* Hint text */}
          <div className="px-4 py-2 bg-base-100 text-xs text-base-content/50 border-t border-base-300">
            Press{' '}
            <kbd className="px-1.5 py-0.5 bg-base-200 rounded text-xs font-semibold">
              Ctrl+Enter
            </kbd>{' '}
            to send
          </div>
        </div>
      </div>
    </div>
  );
};

ReplyComposer.displayName = 'ReplyComposer';
