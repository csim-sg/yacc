/**
 * Presence Indicator Component
 * Shows user's online/offline/away status with visual dot
 * Displays last active time in tooltip
 */

import React from 'react';
import { useUserPresence } from '../stores/presence.store';
import type { PresenceStatus } from '../stores/presence.store';

interface PresenceIndicatorProps {
  /** User ID to display presence for */
  userId: string;

  /** User name for tooltip (optional) */
  userName?: string;

  /** Size of indicator dot */
  size?: 'sm' | 'md' | 'lg';

  /** Whether to show as inline or standalone */
  inline?: boolean;

  /** Additional CSS class */
  className?: string;
}

/**
 * Get color classes for presence status
 */
function getStatusColor(status: PresenceStatus | undefined): string {
  switch (status) {
    case 'online':
      return 'bg-success'; // Green
    case 'away':
      return 'bg-warning'; // Yellow
    case 'offline':
      return 'bg-neutral'; // Gray
    default:
      return 'bg-base-300'; // Default gray for unknown
  }
}

/**
 * Get size classes for dot
 */
function getSizeClasses(size: 'sm' | 'md' | 'lg'): { dot: string; pulse: string } {
  switch (size) {
    case 'sm':
      return { dot: 'w-2 h-2', pulse: 'w-3 h-3' };
    case 'lg':
      return { dot: 'w-4 h-4', pulse: 'w-5 h-5' };
    case 'md':
    default:
      return { dot: 'w-3 h-3', pulse: 'w-4 h-4' };
  }
}

/**
 * Format last active time for display
 */
function formatLastActive(lastActiveAt?: string): string {
  if (!lastActiveAt) return 'Never active';

  const lastActive = new Date(lastActiveAt);
  const now = new Date();
  const diffMs = now.getTime() - lastActive.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

/**
 * PresenceIndicator Component
 * Small visual indicator showing user's presence status
 */
export const PresenceIndicator: React.FC<PresenceIndicatorProps> = ({
  userId,
  userName = 'User',
  size = 'md',
  inline = true,
  className = '',
}) => {
  const presence = useUserPresence(userId);
  const status = presence?.status || 'unknown';
  const lastActiveAt = presence?.lastActiveAt;

  const statusColor = getStatusColor(status);
  const { dot } = getSizeClasses(size);

  const statusLabel =
    status === 'online' ? 'online' : status === 'away' ? 'away' : 'offline';
  const lastActiveText = formatLastActive(lastActiveAt);

  const tooltip = `${userName} is ${statusLabel}. Last seen ${lastActiveText}`;

  return (
    <div className={inline ? 'inline-flex items-center' : className}>
      {/* Presence dot container */}
      <div
        className={`relative ${dot} rounded-full ${className}`}
        title={tooltip}
        aria-label={tooltip}
        role="status"
      >
        {/* Main dot */}
        <div className={`absolute inset-0 ${statusColor} rounded-full`} />

        {/* Pulse animation for online status */}
        {status === 'online' && (
          <div className={`absolute -inset-1 ${statusColor} rounded-full opacity-30 animate-pulse`} />
        )}
      </div>

      {/* Optional tooltip - shown on hover */}
      <div
        className="ml-2 px-2 py-1 bg-base-900 text-xs text-base-100 rounded opacity-0 pointer-events-none transition-opacity absolute mt-8 whitespace-nowrap"
        role="tooltip"
      >
        {tooltip}
      </div>
    </div>
  );
};

PresenceIndicator.displayName = 'PresenceIndicator';

/**
 * Presence Badge - shows inline with name
 * Commonly used in user lists
 */
interface PresenceBadgeProps {
  userId: string;
  userName: string;
  showLabel?: boolean;
}

export const PresenceBadge: React.FC<PresenceBadgeProps> = ({
  userId,
  userName,
  showLabel = false,
}) => {
  const presence = useUserPresence(userId);
  const status = presence?.status || 'unknown';

  const statusColor =
    status === 'online' ? 'bg-success' : status === 'away' ? 'bg-warning' : 'bg-neutral';

  return (
    <div className="inline-flex items-center gap-2">
      <div className={`w-2 h-2 rounded-full ${statusColor}`} aria-hidden="true" />
      <span>{userName}</span>
      {showLabel && <span className="text-xs text-base-content/60">({status})</span>}
    </div>
  );
};

PresenceBadge.displayName = 'PresenceBadge';
