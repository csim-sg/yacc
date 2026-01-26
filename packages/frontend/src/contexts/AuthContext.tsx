/**
 * Auth Context + Provider
 * 
 * React Context for managing authentication state across the application
 * Provides useAuth hook for easy access to auth state
 * 
 * Aligned with BetterAuth backend endpoints:
 * - POST /api/auth/sign-in/email (login)
 * - POST /api/auth/sign-out (logout)
 * - GET /api/auth/get-session (session)
 * - POST /api/auth/refresh-token (token refresh)
 * 
 * Uses custom api-client.ts for API calls
 */

import { createContext, useContext, useState, useEffect, ReactNode, type JSXElement } from 'react';
import { api } from '../lib/api-client';

/**
 * User type matching BetterAuth response
 */
interface User {
  id: string;
  email: string;
  name?: string;
  role: 'SUPER_ADMIN' | 'ADMIN' | 'MANAGER' | 'USER';
}

/**
 * Auth Context type definition
 */
interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  loadUser: () => Promise<void>;
  clearError: () => void;
}

/**
 * Auth Context
 */
const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Auth Provider Component
 * Wraps application to provide auth context to all children
 * Manages authentication state and provides helper functions
 */
export function AuthProvider({ children }: { children: ReactNode }): JSXElement {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Load user session on mount
   * Uses GET /api/auth/get-session endpoint
   */
  useEffect(() => {
    const loadSession = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const session = await api.get('/api/auth/get-session');
        if (session) {
          setUser(session);
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to load session';
        console.error('Auth: Failed to load session', { error: message });
        setError(message);
      } finally {
        setIsLoading(false);
      }
    };

    loadSession();
  }, []);

  /**
   * Login function
   * Uses POST /api/auth/sign-in/email endpoint
   */
  const login = async (email: string, password: string): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await api.post('/api/auth/sign-in/email', {
        body: { email, password },
      });

      setUser(response);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Login failed';
      console.error('Auth: Login failed', { error: message });
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Logout function
   * Uses POST /api/auth/sign-out endpoint
   */
  const logout = async (): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      await api.post('/api/auth/sign-out');
      setUser(null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Logout failed';
      console.error('Auth: Logout failed', { error: message });
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Load user function
   * Restores session by calling GET /api/auth/get-session
   * Called when app starts or user returns to app
   */
  const loadUser = async (): Promise<void> => {
    await loadSession();
  };

  /**
   * Clear error function
   * Removes error message from state
   */
  const clearError = (): void => {
    setError(null);
  };

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
    error,
    login,
    logout,
    loadUser,
    clearError,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * useAuth hook
 * 
 * Provides convenient access to auth context
 * Throws error if used outside of AuthProvider
 */
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
}
