/**
 * Navigation Component
 *
 * Role-based sidebar navigation for YACC application
 * Displays menu items based on user role
 * Handles responsive design (mobile drawer vs desktop sidebar)
 *
 * Features:
 * - Role-based visibility (4 roles)
 * - Active route highlighting
 * - Mobile/tablet/desktop responsive
 * - Accessible (WCAG 2.1 AA)
 * - Logout button
 */

import { useMemo, type ReactElement } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  getAccessibleNavItems,
  type NavigationItem,
  type RoleType,
} from '../lib/navigation';

interface NavigationProps {
  isOpen?: boolean;
  onClose?: () => void;
}

/**
 * Navigation Item Component
 * Single navigation menu item with active state highlighting
 */
function NavItem({
  item,
  isActive,
}: {
  item: NavigationItem;
  isActive: boolean;
}): ReactElement {
  return (
    <Link
      to={item.href}
      className={`
        flex items-center gap-3 px-4 py-3 rounded-lg transition-colors
        ${
          isActive
            ? 'bg-primary text-primary-content font-semibold'
            : 'text-base-content hover:bg-base-200'
        }
      `}
      aria-current={isActive ? 'page' : undefined}
    >
      {item.icon && <span className="text-lg">{item.icon}</span>}
      <span>{item.label}</span>
    </Link>
  );
}

/**
 * Navigation Component
 * Main navigation sidebar with role-based items
 */
export function Navigation({
  isOpen = true,
  onClose,
}: NavigationProps): ReactElement {
  const { user, isLoading, logout } = useAuth();
  const { pathname } = useLocation();

  // Get accessible items based on user role
  const accessibleItems = useMemo(() => {
    if (!user) return [];
    return getAccessibleNavItems(user.role as RoleType);
  }, [user]);

  // Show loading state while user is loading
  if (isLoading) {
    return (
      <nav
        className="w-64 bg-base-100 border-r border-base-300 p-4"
        aria-busy="true"
        aria-label="Navigation"
      >
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-10 bg-base-200 rounded-lg animate-pulse"
            />
          ))}
        </div>
      </nav>
    );
  }

  // If not authenticated, don't render
  if (!user) {
    return <></>;
  }

  return (
    <nav
      className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-base-100 border-r border-base-300
        transition-transform duration-200 ease-in-out
        lg:static lg:translate-x-0 lg:z-0
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
      `}
      aria-label="Main navigation"
    >
      <div className="flex flex-col h-screen p-4">
        {/* Close button for mobile */}
        <div className="lg:hidden mb-4 flex justify-end">
          <button
            onClick={onClose}
            className="btn btn-ghost btn-sm btn-circle"
            aria-label="Close navigation"
          >
            ✕
          </button>
        </div>

        {/* Logo/App name */}
        <div className="mb-8 flex items-center gap-2">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <span className="text-primary-content font-bold">Y</span>
          </div>
          <span className="font-bold text-lg">YACC</span>
        </div>

        {/* User info */}
        <div className="mb-6 pb-6 border-b border-base-300">
          <div className="text-sm">
            <p className="font-semibold text-base-content truncate">
              {user.name || 'User'}
            </p>
            <p className="text-xs text-base-content/60 truncate">{user.email}</p>
            <p className="text-xs text-base-content/50 mt-1">
              Role: {user.role}
            </p>
          </div>
        </div>

        {/* Navigation items */}
        <div className="flex-1 space-y-2 overflow-y-auto">
          {accessibleItems.length > 0 ? (
            accessibleItems.map((item) => (
              <NavItem
                key={item.id}
                item={item}
                isActive={pathname === item.href}
              />
            ))
          ) : (
            <div className="text-center text-base-content/50 text-sm py-8">
              No accessible items
            </div>
          )}
        </div>

        {/* Logout button */}
        <div className="pt-6 border-t border-base-300">
          <button
            onClick={() => {
              logout().catch((err) => {
                console.error('Logout failed:', err);
              });
            }}
            className="btn btn-outline btn-block gap-2"
            aria-label="Sign out from application"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-5 h-5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M8.25 9V5.25A2.25 2.25 0 0110.5 3h6a2.25 2.25 0 012.25 2.25v13.5A2.25 2.25 0 0116.5 21h-6a2.25 2.25 0 01-2.25-2.25V15m-3 0l3-3m0 0l3 3m-3-3v12"
              />
            </svg>
            Sign Out
          </button>
        </div>
      </div>
    </nav>
  );
}
