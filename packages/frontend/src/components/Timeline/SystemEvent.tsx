/**
 * System Event Component
 * Displays system events in timeline: assignments, tags, status changes, notes
 */

import React from 'react';

export type SystemEventType = 'assignment' | 'tag' | 'status' | 'note' | 'mention';

interface SystemEventProps {
  type: SystemEventType;
  actor: {
    id: string;
    name: string;
  };
  description: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

/**
 * Get icon for event type
 */
function getEventIcon(type: SystemEventType) {
  switch (type) {
    case 'assignment':
      return (
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
          <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
          <path
            fillRule="evenodd"
            d="M4 5a2 2 0 012-2 1 1 0 000 2H3a1 1 0 00-1 1v10a1 1 0 001 1h14a1 1 0 001-1V6a1 1 0 00-1-1h-3a1 1 0 000-2 2 2 0 00-2-2H6a2 2 0 00-2 2zM9 9a1 1 0 100 2h2a1 1 0 100-2H9z"
            clipRule="evenodd"
          />
        </svg>
      );
    case 'tag':
      return (
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
          <path
            fillRule="evenodd"
            d="M17.778 8.222c-4.296-4.296-11.26-4.296-15.556 0A2 2 0 001.808 9.149m16.384-1.927a9 9 0 10-12.721 0m9.546-9.546a11 11 0 010 15.556m-9.546 0a11 11 0 015.003-10.684"
            clipRule="evenodd"
          />
        </svg>
      );
    case 'status':
      return (
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
          <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
          <path
            fillRule="evenodd"
            d="M4 5a2 2 0 012-2 1 1 0 000 2H3a1 1 0 00-1 1v10a1 1 0 001 1h14a1 1 0 001-1V6a1 1 0 00-1-1h-3a1 1 0 000-2 2 2 0 00-2-2H6a2 2 0 00-2 2zM9 9a1 1 0 100 2h2a1 1 0 100-2H9z"
            clipRule="evenodd"
          />
        </svg>
      );
    case 'note':
      return (
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
          <path d="M5.5 13a3.5 3.5 0 01-.369-6.98 4 4 0 117.753-1.3A4.5 4.5 0 1113.5 13H11V9.413l1.293 1.293a1 1 0 001.414-1.414l-3-3a1 1 0 00-1.414 0l-3 3a1 1 0 001.414 1.414L9 9.414V13H5.5z" />
        </svg>
      );
    case 'mention':
      return (
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
          <path
            fillRule="evenodd"
            d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
            clipRule="evenodd"
          />
        </svg>
      );
  }
}

/**
 * Get color class for event type
 */
function getEventColor(type: SystemEventType): string {
  switch (type) {
    case 'assignment':
      return 'text-info';
    case 'tag':
      return 'text-success';
    case 'status':
      return 'text-warning';
    case 'note':
      return 'text-secondary';
    case 'mention':
      return 'text-primary';
    default:
      return 'text-base-content/60';
  }
}

/**
 * SystemEvent Component
 * Renders system events in the timeline
 */
export const SystemEvent: React.FC<SystemEventProps> = ({
  type,
  actor,
  description,
  timestamp,
  metadata,
}) => {
  const colorClass = getEventColor(type);
  const timeDate = new Date(timestamp);
  const timeString = timeDate.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div
      className="flex items-start gap-3 py-3 px-4 bg-base-100 border border-base-200 rounded-lg my-2"
      role="article"
      aria-label={`System event: ${description}`}
    >
      {/* Icon */}
      <div className={`flex-shrink-0 mt-0.5 ${colorClass}`}>{getEventIcon(type)}</div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="text-sm">
          <span className="font-semibold">{actor.name}</span>
          <span className="text-base-content/60"> {description}</span>
        </div>

        {/* Metadata if available */}
        {metadata && (
          <div className="mt-1 text-xs text-base-content/50 space-y-0.5">
            {Object.entries(metadata).map(([key, value]) => (
              <div key={key}>
                <span className="font-medium">{key}:</span> {String(value)}
              </div>
            ))}
          </div>
        )}

        {/* Timestamp */}
        <time className="text-xs text-base-content/40 mt-1">{timeString}</time>
      </div>
    </div>
  );
};

SystemEvent.displayName = 'SystemEvent';

/**
 * Helper to create common system event descriptions
 */
export const createSystemEventDescription = (type: SystemEventType, data: any): string => {
  switch (type) {
    case 'assignment':
      return `assigned ${data.assigneeName} to this conversation`;
    case 'tag':
      return `added tag "${data.tagName}"`;
    case 'status':
      return `changed status from "${data.oldStatus}" to "${data.newStatus}"`;
    case 'note':
      return `added a note`;
    case 'mention':
      return `mentioned ${data.mentionedName}`;
    default:
      return 'performed an action';
  }
};
