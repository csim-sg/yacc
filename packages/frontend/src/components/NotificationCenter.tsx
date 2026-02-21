/**
 * Notification Center Component
 * Displays notifications in a dropdown panel
 * Shows unread count badge on bell icon
 */

import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
   useNotifications,
   useNotificationsStore,
 } from '../stores/notifications.store';
import { logger } from '../lib/logger';

interface NotificationCenterProps {
  /** Optional CSS class */
  className?: string;
}

/**
 * Single notification item in the center
 */
const NotificationItem: React.FC<{
   notification: any;
   onMarkAsRead: (id: string) => void;
   onDismiss: (id: string) => void;
   onClickThrough?: () => void;
 }> = ({ notification, onMarkAsRead, onDismiss, onClickThrough }) => {
  const getIcon = () => {
    switch (notification.type) {
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
      case 'mention':
        return (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
            <path d="M2 5a2 2 0 012-2h12a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2V5z" />
            <path
              d="M6.5 7a.75.75 0 100-1.5.75.75 0 000 1.5z"
              fill="white"
              fillOpacity="0.2"
            />
          </svg>
        );
      default:
        return (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
            <path d="M5 4a2 2 0 012-2h6a2 2 0 012 2v14l-5-2.5L5 18V4z" />
          </svg>
        );
    }
  };

   return (
     <div
       className={`px-4 py-3 border-b border-base-200 hover:bg-base-100 transition-colors cursor-pointer ${
         !notification.isRead ? 'bg-primary/5' : ''
       }`}
       onClick={() => {
         if (!notification.isRead) {
           onMarkAsRead(notification.id);
         }
         if (onClickThrough) {
           onClickThrough();
         }
       }}
     >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className="text-primary flex-shrink-0 mt-0.5">{getIcon()}</div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-sm">{notification.title}</h4>
          <p className="text-xs text-base-content/60 mt-0.5 line-clamp-2">
            {notification.message}
          </p>
          <time className="text-xs text-base-content/40 mt-1">
            {new Date(notification.createdAt).toLocaleTimeString()}
          </time>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {!notification.isRead && (
            <button
              className="p-1 hover:bg-base-200 rounded transition-colors"
              onClick={() => onMarkAsRead(notification.id)}
              title="Mark as read"
              type="button"
              aria-label="Mark notification as read"
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
            </button>
          )}

          <button
            className="p-1 hover:bg-base-200 rounded transition-colors"
            onClick={() => onDismiss(notification.id)}
            title="Dismiss"
            type="button"
            aria-label="Dismiss notification"
          >
            <svg
              className="w-4 h-4"
              fill="currentColor"
              viewBox="0 0 20 20"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

/**
 * NotificationCenter Component
 * Dropdown bell icon with notification list
 * P0: Filter to assignment-only notifications
 */
export const NotificationCenter: React.FC<NotificationCenterProps> = ({ className = '' }) => {
   const [isOpen, setIsOpen] = useState(false);
   const menuRef = useRef<HTMLDivElement>(null);
   const buttonRef = useRef<HTMLButtonElement>(null);
   const navigate = useNavigate();

   const allNotifications = useNotifications();
   // P0: Filter to assignment notifications only
   const notifications = allNotifications.filter((n) => n.type === 'assignment');
   const unreadCount = notifications.filter((n) => !n.isRead).length;
   const { removeNotification, markAsRead, markAllAsRead } = useNotificationsStore();

  // Close on outside click
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

  return (
    <div className={`relative inline-block ${className}`}>
      {/* Bell icon button */}
      <button
        ref={buttonRef}
        className="relative inline-flex items-center justify-center w-9 h-9 rounded-lg hover:bg-base-200 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
        aria-label={`Notifications ${unreadCount > 0 ? `(${unreadCount} unread)` : ''}`}
        aria-expanded={isOpen}
        type="button"
      >
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>

        {/* Unread badge */}
        {unreadCount > 0 && (
          <span
            className="absolute top-1 right-1 flex items-center justify-center w-5 h-5 bg-error text-error-content text-xs font-bold rounded-full"
            aria-label={`${unreadCount} unread notifications`}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notification panel */}
      {isOpen && (
        <div
          ref={menuRef}
          className="absolute right-0 mt-2 w-80 bg-base-100 border border-base-300 rounded-lg shadow-xl z-50 max-h-96 overflow-y-auto"
          role="region"
          aria-label="Notifications"
        >
          {/* Header */}
          <div className="sticky top-0 px-4 py-3 bg-base-100 border-b border-base-200 flex items-center justify-between">
            <h3 className="font-semibold">Notifications</h3>
            {unreadCount > 0 && (
              <button
                className="text-xs text-primary hover:underline"
                onClick={() => markAllAsRead()}
                type="button"
              >
                Mark all as read
              </button>
            )}
          </div>

          {/* Notification list */}
          {notifications.length === 0 ? (
            <div className="px-4 py-8 text-center text-base-content/60">
              <p className="text-sm">No notifications yet</p>
            </div>
          ) : (
             <div role="list">
               {notifications.map((notification) => (
                 <div key={notification.id} role="listitem">
                   <NotificationItem
                     notification={notification}
                     onMarkAsRead={() => {
                       markAsRead(notification.id);
                       logger.debug('Marked notification as read', { id: notification.id });
                     }}
                     onDismiss={() => {
                       removeNotification(notification.id);
                       logger.debug('Dismissed notification', { id: notification.id });
                     }}
                     onClickThrough={() => {
                       // P0: Click notification marks as read and navigates to conversation
                       if (notification.conversationId) {
                         setIsOpen(false);
                         navigate(`/conversations/${notification.conversationId}`);
                       }
                     }}
                   />
                 </div>
               ))}
             </div>
          )}

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="sticky bottom-0 px-4 py-2 bg-base-100 border-t border-base-200">
              <button
                className="w-full text-sm text-primary hover:underline py-1"
                onClick={() => {
                  useNotificationsStore.getState().clearAll();
                  setIsOpen(false);
                  logger.debug('Cleared all notifications');
                }}
                type="button"
              >
                Clear all
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

NotificationCenter.displayName = 'NotificationCenter';
