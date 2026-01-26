/**
 * Header Component
 *
 * Top navigation bar with:
 * - Application branding/logo
 * - Logout button with user info
 * - Responsive design
 * - Accessibility features
 */

import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';

/**
 * Header Component
 */
export function Header(): JSX.Element {
  const { user, logout, isLoading } = useAuth();
  const navigate = useNavigate();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  /**
   * Handle logout with optional confirmation
   */
  const handleLogout = async (): Promise<void> => {
    // Show confirmation modal
    setShowLogoutConfirm(true);
  };

  /**
   * Confirm logout
   */
  const confirmLogout = async (): Promise<void> => {
    setIsLoggingOut(true);
    try {
      await logout();
      setShowLogoutConfirm(false);
      // Redirect handled by AuthContext, but navigate just in case
      navigate('/login');
    } catch (error: unknown) {
      console.error('Logout failed:', error instanceof Error ? error.message : String(error));
      setIsLoggingOut(false);
    }
  };

  /**
   * Cancel logout
   */
  const cancelLogout = (): void => {
    setShowLogoutConfirm(false);
  };

  return (
    <>
      {/* Header */}
      <header className="bg-base-100 shadow-sm border-b border-base-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
                <span className="text-primary-content font-bold text-lg">Y</span>
              </div>
              <span className="text-xl font-bold text-base-content hidden sm:inline">YACC</span>
            </div>

            {/* User Section */}
            <div className="flex items-center gap-4">
              {/* User Info */}
              {user && (
                <div className="hidden sm:flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-sm font-medium text-base-content">{user.name || user.email}</p>
                    <p className="text-xs text-base-content/60">{user.role.replace(/_/g, ' ')}</p>
                  </div>
                  {/* Avatar */}
                  <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                    <span className="text-primary-content text-sm font-bold">
                      {(user.name || user.email)[0].toUpperCase()}
                    </span>
                  </div>
                </div>
              )}

              {/* Logout Button */}
              <button
                onClick={handleLogout}
                disabled={isLoading || isLoggingOut}
                className="btn btn-sm btn-ghost"
                aria-label="Logout"
                title="Sign out"
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
                    d="M8.603 3.799A4.49 4.49 0 0112 2.25c2.498 0 4.741 1.571 5.603 3.799m0 0A5.989 5.989 0 0116.5 12a5.989 5.989 0 01-.9 3.201m0 0A4.49 4.49 0 0112 21.75c-2.498 0-4.741-1.571-5.603-3.799m0 0A5.989 5.989 0 015.5 12c0-1.156.3-2.25.9-3.201m0 0A4.49 4.49 0 0112 2.25c2.498 0 4.741 1.571 5.603 3.799"
                  />
                </svg>
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <dialog className="modal modal-open">
          <form method="dialog" className="modal-box">
            <h3 className="font-bold text-lg">Sign Out</h3>
            <p className="py-4 text-base-content/70">
              Are you sure you want to sign out? You'll need to sign in again to access your account.
            </p>

            <div className="modal-action">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={cancelLogout}
                disabled={isLoggingOut}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-error"
                onClick={confirmLogout}
                disabled={isLoggingOut}
              >
                {isLoggingOut ? (
                  <>
                    <span className="loading loading-spinner loading-sm"></span>
                    Signing out...
                  </>
                ) : (
                  'Sign Out'
                )}
              </button>
            </div>
          </form>

          {/* Modal Backdrop */}
          <form method="dialog" className="modal-backdrop" onClick={cancelLogout}>
            <button type="button" disabled={isLoggingOut} />
          </form>
        </dialog>
      )}
    </>
  );
}
