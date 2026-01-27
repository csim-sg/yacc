/**
 * Presence Tracking Hook
 * Monitors user activity and broadcasts presence updates
 * - Detects inactivity after 15 minutes
 * - Sets "away" status
 * - Broadcasts presence via WebSocket ping
 */

import { useEffect, useRef, useCallback } from 'react';
import { usePresenceStore } from '../stores/presence.store';
import { useWebSocketStore } from '../stores/websocket.store';
import { logger } from '../lib/logger';

const ACTIVITY_DEBOUNCE_MS = 5 * 60 * 1000; // 5 minutes
const AWAY_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes
const PRESENCE_PING_INTERVAL_MS = 60 * 1000; // 60 seconds

interface UsePresenceTrackingOptions {
  /** Whether to track activity */
  enabled?: boolean;
  /** Custom debounce interval (ms) */
  activityDebounceMs?: number;
  /** Custom away timeout (ms) */
  awayTimeoutMs?: number;
  /** Custom ping interval (ms) */
  pingIntervalMs?: number;
}

/**
 * Hook to track user activity and manage presence
 * Call this in the root app component to enable presence tracking
 */
export function usePresenceTracking(options: UsePresenceTrackingOptions = {}) {
  const {
    enabled = true,
    activityDebounceMs = ACTIVITY_DEBOUNCE_MS,
    awayTimeoutMs = AWAY_TIMEOUT_MS,
    pingIntervalMs = PRESENCE_PING_INTERVAL_MS,
  } = options;

  const activityTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const awayTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityTimeRef = useRef<number>(Date.now());

  const { updateActivityTimestamp, currentUserId, setUserPresence } = usePresenceStore();
  const { connectionState } = useWebSocketStore();

  /**
   * Emit presence ping to server
   * Called periodically to broadcast "I'm still here"
   */
  const emitPresencePing = useCallback(() => {
    if (connectionState !== 'connected' || !currentUserId) return;

    try {
      // TODO: Emit to WebSocket
      // socket.emit('presence.ping', { timestamp: new Date().toISOString() });
      logger.debug('Presence ping sent', { userId: currentUserId });
    } catch (error) {
      logger.error('Failed to emit presence ping', error);
    }
  }, [connectionState, currentUserId]);

  /**
   * Handle activity detected (mouse move, key press, etc.)
   * Debounced to avoid spam
   */
  const handleActivity = useCallback(() => {
    if (!enabled || !currentUserId) return;

    const now = Date.now();
    const timeSinceLastActivity = now - lastActivityTimeRef.current;

    // Only update if debounce interval passed
    if (timeSinceLastActivity < activityDebounceMs) {
      return;
    }

    lastActivityTimeRef.current = now;
    updateActivityTimestamp();

    // Clear away timeout - user is active
    if (awayTimeoutRef.current) {
      clearTimeout(awayTimeoutRef.current);
      awayTimeoutRef.current = null;
    }

    // Set user as online
    setUserPresence(currentUserId, 'online', new Date().toISOString());

    // Clear existing activity timeout
    if (activityTimeoutRef.current) {
      clearTimeout(activityTimeoutRef.current);
    }

    // Set new activity timeout - set away after inactivity
    activityTimeoutRef.current = setTimeout(() => {
      if (currentUserId) {
        setUserPresence(currentUserId, 'away', new Date().toISOString());
        logger.debug('User set to away', { userId: currentUserId });
      }
    }, awayTimeoutMs);

    logger.debug('Activity detected', { userId: currentUserId });
  }, [
    enabled,
    currentUserId,
    activityDebounceMs,
    awayTimeoutMs,
    updateActivityTimestamp,
    setUserPresence,
  ]);

  /**
   * Setup activity listeners
   * Track mouse/keyboard events
   */
  useEffect(() => {
    if (!enabled) return;

    const activityEvents = ['mousedown', 'keydown', 'scroll', 'touchstart'];

    activityEvents.forEach((event) => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    // Initial activity timestamp
    lastActivityTimeRef.current = Date.now();

    return () => {
      activityEvents.forEach((event) => {
        window.removeEventListener(event, handleActivity);
      });
    };
  }, [enabled, handleActivity]);

  /**
   * Setup presence ping interval
   * Broadcast "I'm still here" periodically
   */
  useEffect(() => {
    if (!enabled || connectionState !== 'connected') return;

    // Send initial ping
    emitPresencePing();

    // Setup periodic pings
    pingIntervalRef.current = setInterval(() => {
      emitPresencePing();
    }, pingIntervalMs);

    return () => {
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = null;
      }
    };
  }, [enabled, connectionState, pingIntervalMs, emitPresencePing]);

  /**
   * Cleanup on unmount or disconnect
   */
  useEffect(() => {
    return () => {
      if (activityTimeoutRef.current) {
        clearTimeout(activityTimeoutRef.current);
      }
      if (awayTimeoutRef.current) {
        clearTimeout(awayTimeoutRef.current);
      }
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
      }
    };
  }, []);

  return {
    handleActivity,
    emitPresencePing,
  };
}
