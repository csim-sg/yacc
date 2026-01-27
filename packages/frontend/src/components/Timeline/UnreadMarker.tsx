/**
 * Unread Marker Component
 * Visual divider showing where unread messages start in timeline
 */

import React from 'react';

interface UnreadMarkerProps {
  /** Number of unread messages */
  unreadCount?: number;

  /** CSS class */
  className?: string;
}

/**
 * UnreadMarker Component
 * Shows divider line with unread count between read and unread messages
 */
export const UnreadMarker: React.FC<UnreadMarkerProps> = ({ unreadCount = 0, className = '' }) => {
  return (
    <div
      className={`flex items-center gap-3 my-4 ${className}`}
      role="region"
      aria-label={`${unreadCount} unread message${unreadCount === 1 ? '' : 's'}`}
    >
      {/* Left line */}
      <div className="flex-1 h-0.5 bg-gradient-to-r from-transparent to-primary/30" />

      {/* Badge */}
      <div className="px-3 py-1 bg-primary text-primary-content text-xs font-semibold rounded-full flex-shrink-0">
        {unreadCount} new
      </div>

      {/* Right line */}
      <div className="flex-1 h-0.5 bg-gradient-to-l from-transparent to-primary/30" />
    </div>
  );
};

UnreadMarker.displayName = 'UnreadMarker';
