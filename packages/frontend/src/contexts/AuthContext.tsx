/**
 * Auth Context + Provider (MIG-034; ADR-025)
 *
 * The single auth state system of the application: login/logout/registration,
 * session restore, and the ADR-025 forced-password-change state of the
 * bootstrap/recovery identity.
 *
 * All endpoint calls ride `services/auth.service.ts` against the Spring
 * auth contract; tokens are persisted by the single API client
 * (`lib/apiClient`). A failed session restore clears local auth state and
 * the routes force re-login (no POC identity continuity).
 *
 * Role normalization seam: the wire contract is lowercase
 * (`super_admin|admin|manager|user`); the UI keeps uppercase
 * (SUPER_ADMIN/ADMIN/MANAGER/USER) — every RBAC check reads the
 * normalized value via useAuth() and ProtectedRoute.
 */

import { createContext, useContext, useEffect, useState, type ReactElement, type ReactNode } from 'react';
import { clearTokens, getToken } from '../lib/apiClient';
import { authService } from '../services/auth.service';
import type { AuthUser } from '../types/auth.types';

/** Normalize a lowercase wire role to the UI role label. */
export function normalizeRole(role: string): 'SUPER_ADMIN' | 'ADMIN' | 'MANAGER' | 'USER' {
  const normalized = role.toUpperCase();
  if (normalized === 'SUPER_ADMIN' || normalized === 'ADMIN' || normalized === 'MANAGER' || normalized === 'USER') {
    return normalized;
  }
  // Default to USER if unknown role
  return 'USER';
}

/** UI-facing user shape (uppercase role). */
export interface User {
  id: string;
  email: string;
  name: string;
  role: 'SUPER_ADMIN' | 'ADMIN' | 'MANAGER' | 'USER';
  status: string;
  emailVerified: boolean;
  createdAt?: string;
}

/** Map the canonical wire user onto the UI shape. */
function toUiUser(user: AuthUser): User {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: normalizeRole(user.role),
    status: user.status,
    emailVerified: user.emailVerified,
    createdAt: user.createdAt,
  };
}

/**
 * Auth Context type definition
 */
interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  mustChangePassword: boolean;
  /** Returns the ADR-025 forced-password-change state of the session. */
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  loadUser: () => Promise<void>;
  refreshSession: () => Promise<void>;
  clearError: () => void;
  markPasswordChanged: () => void;
}

/**
 * Auth Context
 */
const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Auth Provider Component
 */
export function AuthProvider({ children }: { children: ReactNode }): ReactElement {
  const [user, setUser] = useState<User | null>(null);
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Login: POST /api/auth/sign-in/email. Stores the token pair and the
   * forced-password-change state.
   */
  const login = async (email: string, password: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    try {
      const session = await authService.signIn({ email, password });
      setUser(toUiUser(session.user));
      setMustChangePassword(session.mustChangePassword);
      return session.mustChangePassword;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Login failed';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Logout: POST /api/auth/sign-out, then clear all local auth state
   * (always cleared by the service, even on API failure).
   */
  const logout = async (): Promise<void> => {
    setIsLoading(true);
    setError(null);
    try {
      await authService.signOut();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Logout failed';
      setError(message);
      throw err;
    } finally {
      setUser(null);
      setMustChangePassword(false);
      setIsLoading(false);
    }
  };

  /**
   * Register: POST /api/auth/sign-up/email (creates `user` only — no
   * self-elevation). No auto-login; the flow hands over to the login page.
   */
  const register = async (email: string, password: string, name: string): Promise<void> => {
    setIsLoading(true);
    setError(null);
    try {
      await authService.signUp({ email, password, name });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Registration failed';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Load the session user. A missing/invalid token clears local auth
   * state (forced re-login at cutover is inherent).
   */
  const loadUser = async (): Promise<void> => {
    if (!getToken()) {
      setUser(null);
      setMustChangePassword(false);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const session = await authService.getSession();
      if (session) {
        setUser(toUiUser(session.user));
        setMustChangePassword(session.mustChangePassword);
      } else {
        clearTokens();
        setUser(null);
        setMustChangePassword(false);
      }
    } catch {
      clearTokens();
      setUser(null);
      setMustChangePassword(false);
    } finally {
      setIsLoading(false);
    }
  };

  /** Clear the forced-password-change state after a successful change. */
  const markPasswordChanged = (): void => {
    setMustChangePassword(false);
  };

  /** Restore the session on mount (GET /api/auth/get-session). */
  useEffect(() => {
    void loadUser();
  }, []);

  const clearError = (): void => {
    setError(null);
  };

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
    error,
    mustChangePassword,
    login,
    logout,
    register,
    loadUser,
    refreshSession: loadUser,
    clearError,
    markPasswordChanged,
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
 * Provides convenient access to auth context.
 */
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
}
