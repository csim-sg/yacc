/**
 * App Component
 * Main application entry point with routing
 */

import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/auth.store';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { InboxPage } from './pages/InboxPage';
import { ConversationPage } from './pages/ConversationPage';

// Protected Route wrapper
function ProtectedRoute({
  children,
  roles,
}: {
  children: React.ReactNode;
  roles?: Array<'super_admin' | 'admin' | 'manager' | 'user'>;
}) {
  const { isAuthenticated, isLoading, user } = useAuthStore();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-base-200">
        <div className="text-center">
          <span className="loading loading-spinner loading-lg text-primary"></span>
          <p className="mt-4 text-base-content/70">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (roles && roles.length > 0) {
    const userRole = user?.role;
    if (!userRole || !roles.includes(userRole)) {
      return <Navigate to="/" replace />;
    }
  }

  return <>{children}</>;
}

// Public Route wrapper (redirect to inbox if already logged in)
function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-base-200">
        <div className="text-center">
          <span className="loading loading-spinner loading-lg text-primary"></span>
          <p className="mt-4 text-base-content/70">Loading...</p>
        </div>
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

function App() {
  const { loadUser } = useAuthStore();

  // Load user on app mount
  useEffect(() => {
    loadUser();
  }, [loadUser]);

  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route
          path="/login"
          element={
            <PublicRoute>
              <LoginPage />
            </PublicRoute>
          }
        />
        <Route
          path="/register"
          element={
            <PublicRoute>
              <RegisterPage />
            </PublicRoute>
          }
        />

        {/* Protected routes */}
        <Route
          path="/"
          element={
            <ProtectedRoute roles={['super_admin', 'admin', 'manager', 'user']}>
              <InboxPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/conversations/:id"
          element={
            <ProtectedRoute roles={['super_admin', 'admin', 'manager', 'user']}>
              <ConversationPage />
            </ProtectedRoute>
          }
        />

        {/* Catch all - redirect to inbox */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
