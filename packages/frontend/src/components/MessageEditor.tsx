/**
 * Message Editor Component
 * Inline editor for modifying message content
 * Shows save/cancel buttons and character counter
 */

import React, { useState, useEffect } from 'react';
import type { Message } from '../api/schemas';

interface MessageEditorProps {
  /** Message being edited */
  message: Message;

  /** Called when user clicks save */
  onSave: (messageId: string, newBody: string) => void;

  /** Called when user clicks cancel */
  onCancel: () => void;

  /** Whether save is in progress */
  isSaving?: boolean;

  /** Error message if save failed */
  error?: string;

  /** Max character limit (default: 4000) */
  maxLength?: number;

  /** CSS class */
  className?: string;
}

const DEFAULT_MAX_LENGTH = 4000;

/**
 * MessageEditor Component
 * Renders inline editor with save/cancel and character counter
 */
export const MessageEditor: React.FC<MessageEditorProps> = ({
  message,
  onSave,
  onCancel,
  isSaving = false,
  error,
  maxLength = DEFAULT_MAX_LENGTH,
  className = '',
}) => {
  const [editedBody, setEditedBody] = useState(message.body);

  const charCount = editedBody.length;
  const isAtLimit = charCount >= maxLength;
  const isChanged = editedBody !== message.body;

  // Handle keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.ctrlKey && e.key === 'Enter') {
        handleSave();
      }
      if (e.key === 'Escape') {
        onCancel();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [editedBody, onCancel]);

  const handleSave = () => {
    if (!isChanged || !editedBody.trim()) {
      onCancel();
      return;
    }
    onSave(message.id, editedBody);
  };

  return (
    <div className={`rounded-lg border-2 border-primary bg-base-100 overflow-hidden ${className}`}>
      {/* Editor textarea */}
      <textarea
        className="w-full p-3 resize-none focus:outline-none focus:ring-0 max-h-32"
        value={editedBody}
        onChange={(e) => {
          setEditedBody(e.target.value.slice(0, maxLength));
        }}
        disabled={isSaving}
        aria-label="Edit message body"
        aria-describedby={error ? 'edit-error' : 'edit-counter'}
        rows={3}
      />

      {/* Error message */}
      {error && (
        <div
          id="edit-error"
          className="px-3 py-2 bg-error/10 text-error text-sm border-t border-error/20"
          role="alert"
        >
          {error}
        </div>
      )}

      {/* Footer with counter and buttons */}
      <div className="flex items-center justify-between px-3 py-2 bg-base-200 border-t border-base-300">
        {/* Character counter */}
        <div
          id="edit-counter"
          className={`text-xs font-medium ${
            isAtLimit ? 'text-error' : 'text-base-content/60'
          }`}
          aria-live="polite"
        >
          {charCount.toLocaleString()} / {maxLength.toLocaleString()}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          {/* Cancel button */}
          <button
            className="px-3 py-1 text-sm rounded hover:bg-base-300 transition-colors disabled:opacity-50"
            onClick={onCancel}
            disabled={isSaving}
            aria-label="Cancel editing"
            type="button"
          >
            Cancel
          </button>

          {/* Save button */}
          <button
            className="px-3 py-1 text-sm bg-primary text-primary-content rounded hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-1"
            onClick={handleSave}
            disabled={!isChanged || !editedBody.trim() || isSaving}
            aria-label="Save edited message"
            type="button"
          >
            {isSaving ? (
              <>
                <svg
                  className="w-3 h-3 animate-spin"
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
                <span>Saving...</span>
              </>
            ) : (
              'Save (Ctrl+Enter)'
            )}
          </button>
        </div>
      </div>

      {/* Helpful hint */}
      <div className="px-3 py-2 bg-base-100 text-xs text-base-content/50 border-t border-base-300">
        Press <kbd className="px-1.5 py-0.5 bg-base-200 rounded text-xs font-semibold">
          Ctrl+Enter
        </kbd>{' '}
        to save or <kbd className="px-1.5 py-0.5 bg-base-200 rounded text-xs font-semibold">
          Esc
        </kbd>{' '}
        to cancel
      </div>
    </div>
  );
};

MessageEditor.displayName = 'MessageEditor';
