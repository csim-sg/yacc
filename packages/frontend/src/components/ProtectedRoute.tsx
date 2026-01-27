/**
 * Protected Route Component
 * 
 * Route protection wrapper that redirects unauthenticated users to login page
 * Supports role-based access control with role hierarchy
 * 
 * Aligned with custom api-client.ts and AuthContext
 * Uses React Router for navigation
 */

import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  meetsRoleRequirement,
  type RoleType,
} from '../lib/navigation';

/**
 * Protected Route Props
 */
interface ProtectedRouteProps {
  children: ReactNode;
  requiredRole?: RoleType;
  fallback?: ReactNode;
}

/**
 * Protected Route Component
 * 
 * Renders children if user is authenticated and has required role
 * Redirects to login if not authenticated
 * Redirects to inbox if insufficient permissions
 * 
 * Supports role hierarchy:
 * - SUPER_ADMIN: All access
 * - ADMIN: Admin+ access
 * - MANAGER: Manager+ access
 * - USER: User+ access (lowest)
 */
export function ProtectedRoute({
  children,
  requiredRole,
  fallback,
}: ProtectedRouteProps): ReactNode {
  const { user, isAuthenticated, isLoading } = useAuth();

  // Show loading state
  if (isLoading) {
    return (
      <>
        {fallback || (
          <div className="min-h-screen flex items-center justify-center bg-base-200">
            <div className="text-center">
              <span className="loading loading-spinner loading-lg text-primary"></span>
              <p className="mt-4 text-base-content/70">Loading...</p>
            </div>
          </div>
        )}
      </>
    );
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Check role if required
  if (requiredRole && user) {
    const userRole = user.role as RoleType;
    if (!meetsRoleRequirement(userRole, requiredRole)) {
      return <Navigate to="/inbox" replace />;
    }
  }

  // Render children
  return <>{children}</>;
}


