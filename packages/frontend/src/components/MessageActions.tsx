/**
 * Message Actions Component
 * Dropdown menu with edit/delete options for messages
 * Only shown for own messages or admin users
 */

import React, { useState, useRef, useEffect } from 'react';
import type { Message } from '../api/schemas';

interface MessageActionsProps {
  /** Message to perform actions on */
  message: Message;

  /** Whether current user is message owner */
  isOwn: boolean;

  /** Whether current user is admin */
  isAdmin?: boolean;

  /** Called when edit button clicked */
  onEdit?: (message: Message) => void;

  /** Called when delete button clicked */
  onDelete?: (messageId: string) => void;

  /** Additional CSS class */
  className?: string;
}

/**
 * MessageActions Component
 * Renders a dropdown menu with edit and delete options
 * Menu appears on hover or focus
 */
export const MessageActions: React.FC<MessageActionsProps> = ({
  message,
  isOwn,
  isAdmin = false,
  onEdit,
  onDelete,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Close menu on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        !buttonRef.current?.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Don't show menu if user can't edit/delete
  const canEdit = (isOwn || isAdmin) && onEdit;
  const canDelete = (isOwn || isAdmin) && onDelete;

  if (!canEdit && !canDelete) {
    return null;
  }

  return (
    <div className={`relative inline-block ${className}`}>
      <button
        ref={buttonRef}
        className="inline-flex items-center justify-center w-6 h-6 rounded hover:bg-base-200 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Message actions"
        aria-expanded={isOpen}
        type="button"
      >
        <svg
          className="w-4 h-4"
          fill="currentColor"
          viewBox="0 0 20 20"
          aria-hidden="true"
        >
          <path d="M10.5 1.5H9.5V3h1V1.5zM10.5 17h-1v1.5h1V17zM1.5 10.5V9.5H3v1H1.5zM17 10.5v-1h1.5v1H17zM4.22 4.22L3.51 3.51l1.06-1.06.71.71-1.06 1.06zm11.56 11.56l-.71.71 1.06 1.06.71-.71-1.06-1.06zM3.51 16.49l.71.71 1.06-1.06-.71-.71-1.06 1.06zm11.56-11.56l.71-.71-1.06-1.06-.71.71 1.06 1.06z" />
        </svg>
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <div
          ref={menuRef}
          className="absolute right-0 mt-2 w-48 bg-base-100 border border-base-300 rounded-lg shadow-lg z-20"
          role="menu"
          aria-orientation="vertical"
        >
          {/* Edit option */}
          {canEdit && (
            <button
              className="w-full text-left px-4 py-2 hover:bg-base-200 flex items-center gap-2 transition-colors first:rounded-t-lg"
              onClick={() => {
                onEdit?.(message);
                setIsOpen(false);
              }}
              role="menuitem"
              type="button"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                />
              </svg>
              <span className="text-sm">Edit</span>
            </button>
          )}

          {/* Delete option */}
          {canDelete && (
            <button
              className="w-full text-left px-4 py-2 hover:bg-error/10 text-error flex items-center gap-2 transition-colors last:rounded-b-lg"
              onClick={() => {
                onDelete?.(message.id);
                setIsOpen(false);
              }}
              role="menuitem"
              type="button"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
              <span className="text-sm">Delete</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};

MessageActions.displayName = 'MessageActions';
