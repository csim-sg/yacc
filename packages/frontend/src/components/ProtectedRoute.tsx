/**
 * Protected Route Component
 * 
 * Route protection wrapper that redirects unauthenticated users to login page
 * Supports optional role-based access control
 * 
 * Aligned with custom api-client.ts and AuthContext
 */

import { ReactNode } from 'react';
import { useAuth } from '../contexts/AuthContext';

/**
 * Protected Route Props
 */
interface ProtectedRouteProps {
  children: ReactNode;
  requiredRole?: 'SUPER_ADMIN' | 'ADMIN' | 'MANAGER' | 'USER';
  fallback?: ReactNode;
}

/**
 * Protected Route Component
 * 
 * Renders children if user is authenticated
 * Redirects to login page if not authenticated
 * Optionally checks role if requiredRole is provided
 * 
 * NOTE: Will use tanstack/react-router in FE-004 for navigation
 */
export function ProtectedRoute({
  children,
  requiredRole,
  fallback,
}: ProtectedRouteProps): ReactNode {
  const { user, isAuthenticated, isLoading } = useAuth();
  
  // Placeholder navigation - will replace with tanstack/react-router in FE-004
  const navigate = (to: string) => {
    console.log(`[ProtectedRoute] Navigating to ${to}`);
    if (typeof window !== 'undefined') {
      window.location.href = to;
    }
  };

  // Show loading state
  if (isLoading) {
    return <>{fallback || <div>Loading...</div>}</>;
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    navigate('/login');
    return null;
  }

  // Check role if required
  if (requiredRole && user?.role !== requiredRole) {
    navigate('/');
    return null;
  }

  // Render children
  return <>{children}</>;
}


