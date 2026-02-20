/**
 * App Component
 * Main application entry point with routing
 *
 * Features:
 * - BetterAuth integration (FE-001)
 * - Login/Logout UI (FE-002)
 * - Role-based navigation (FE-003)
 * - Route protection with role checking
 * - TanStack Query for data fetching (FE-004)
 */

import { useState, type ReactElement } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Navigation } from './components/Navigation';
import { Header } from './components/Header';
import { ReconnectingIndicator } from './components/ReconnectingIndicator';
import { AuditLogsPage } from './pages/AuditLogsPage';
import { ConversationPage } from './pages/ConversationPage';
import { InboxPage } from './pages/InboxPage';
import { IrcProfilesPage } from './pages/IrcProfilesPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/registerPage';
import { RoutingRulesPage } from './pages/RoutingRulesPage';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { queryClient } from './lib/queryClient';

/**
 * Public Route wrapper
 * Redirects authenticated users to inbox
 */
function PublicRoute({ children }: { children: ReactElement }): ReactElement {
  const { isAuthenticated, isLoading } = useAuth();

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
    return <Navigate to="/inbox" replace />;
  }

  return children;
}

/**
 * Main Layout Component
 * Wraps protected routes with navigation and header
 */
function MainLayout({ children }: { children: ReactElement }): ReactElement {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen bg-base-100">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar Navigation */}
      <Navigation isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <Header onMenuClick={() => setSidebarOpen(!sidebarOpen)} />

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}

/**
 * App Routes Component
 * Separated from App to have access to AuthProvider context
 */
function AppRoutes(): ReactElement {
  const { isLoading } = useAuth();

  // Global loading state
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

  return (
    <>
      <ReconnectingIndicator />
      <Routes>
      {/* Public routes (no layout) */}
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

      {/* Protected routes (with layout) */}
      <Route
        path="/inbox"
        element={
          <ProtectedRoute>
            <MainLayout>
              <InboxPage />
            </MainLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/conversations/:id"
        element={
          <ProtectedRoute>
            <MainLayout>
              <ConversationPage />
            </MainLayout>
          </ProtectedRoute>
        }
      />

      {/* Admin routes */}
      <Route
        path="/users"
        element={
          <ProtectedRoute requiredRole="SUPER_ADMIN">
            <MainLayout>
              <div className="p-8">Admin: Users (Coming soon)</div>
            </MainLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/integrations"
        element={
          <ProtectedRoute requiredRole="SUPER_ADMIN">
            <MainLayout>
              <div className="p-8">Admin: Integrations (Coming soon)</div>
            </MainLayout>
          </ProtectedRoute>
        }
      />
       <Route
         path="/routing-rules"
         element={
           <ProtectedRoute requiredRole="ADMIN">
             <MainLayout>
               <RoutingRulesPage />
             </MainLayout>
           </ProtectedRoute>
         }
       />
        <Route
          path="/audit-logs"
          element={
            <ProtectedRoute requiredRole="MANAGER">
              <MainLayout>
                <AuditLogsPage />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/integrations/irc-profiles"
          element={
            <ProtectedRoute requiredRole="ADMIN">
              <MainLayout>
                <IrcProfilesPage />
              </MainLayout>
            </ProtectedRoute>
          }
        />
       <Route
         path="/settings"
         element={
           <ProtectedRoute requiredRole="ADMIN">
             <MainLayout>
               <div className="p-8">Settings (Coming soon)</div>
            </MainLayout>
          </ProtectedRoute>
        }
      />

      {/* Catch all - redirect to inbox for auth, login for public */}
      <Route path="*" element={<Navigate to="/inbox" replace />} />
    </Routes>
    </>
  );
}

/**
 * App Component
 * Root component with providers wrapping (Auth + React Query)
 *
 * Provider Order (important):
 * 1. QueryClientProvider (outer) - Provides React Query context
 * 2. AuthProvider - Provides authentication context
 * 3. BrowserRouter - Provides routing context
 * 4. AppRoutes - Application routes
 */
function App(): ReactElement {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
