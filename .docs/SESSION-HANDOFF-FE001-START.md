# SESSION HANDOFF: FE-001 Frontend Auth Integration Development

**Generated:** 2026-01-26  
**For:** New Development Session  
**Task:** FE-001 Frontend Auth Integration (10-12 hours)  
**Branch:** Start on `dev`, create feature branch `task/FE-001-auth-integration`  
**Status:** ✅ READY TO START (All prerequisites complete, no blockers)

---

## 🎯 EXECUTIVE SUMMARY

You are starting FE-001: Frontend Auth Integration - the first task of Week 2 development.

**What you're building:**
- Enhance React frontend authentication integration with BetterAuth backend
- Add JWT token management with automatic refresh on expiry
- Implement comprehensive API request/response interceptors (401/403/500 handlers)
- Create Auth Context + useAuth hook for React component access
- Create Protected Route wrapper for role-based access
- Write unit tests (80%+ code coverage minimum)

**Current state:**
- ✅ All Week 1 backend tasks complete and merged to dev
- ✅ Backend auth controllers ready (simple-auth, auth, users)
- ✅ Frontend auth infrastructure exists (auth.service.ts, api-client.ts, auth.store.ts)
- ✅ No blockers or external dependencies
- ✅ Database schema ready (users, sessions, messages tables)
- ✅ Architecture & requirements fully documented

**Your task:**
- Review backend controller (5 minutes)
- Implement 8 subtasks sequentially (10-12 hours)
- Write comprehensive unit tests (80%+ coverage)
- Create PR with clear documentation

**Success criteria:**
- All 8 subtasks implemented and tested
- 80%+ code coverage for new code
- No breaking changes to existing functionality
- Manual testing complete (login/logout/token refresh flows)
- PR created with documentation

---

## 📚 CRITICAL CONTEXT FOR YOU

### What Has Already Been Done (Week 1)

**Backend Authentication System (100% Complete):**
- ✅ BetterAuth setup with JWT tokens
- ✅ Login endpoint: `POST /simple-auth/login`
- ✅ Logout endpoint: `POST /simple-auth/logout`
- ✅ Session endpoint: `GET /simple-auth/session`
- ✅ Forgot password endpoint: `POST /auth/forgot-password`
- ✅ Reset password endpoint: `POST /auth/reset-password`
- ✅ User registration endpoint: `POST /auth/register` (if applicable)
- ✅ RBAC middleware with role validation
- ✅ 71/71 tests passing
- ✅ 85%+ code coverage maintained
- ✅ All code merged to dev branch

**Frontend Existing Infrastructure (Functional but Incomplete):**
- ✅ TanStack Query dependency installed
- ✅ Zustand state management installed
- ✅ Socket.io-client installed
- ✅ `auth.service.ts` (147 lines) - API calls to backend
- ✅ `auth.store.ts` (121 lines) - Zustand state store
- ✅ `api-client.ts` (138 lines) - API wrapper with token storage
- ✅ `LoginPage.tsx` - Login UI (basic implementation)
- ✅ Tailwind CSS configured
- ✅ TypeScript strict mode enabled

**What's Missing (Your Task):**
- ❌ Comprehensive request/response interceptors
- ❌ Automatic token refresh on 401 errors
- ❌ Auth Context + Provider pattern
- ❌ useAuth hook for React components
- ❌ Protected Route wrapper component
- ❌ Unit tests (80%+ coverage)
- ❌ Proper error handling (401/403/500)
- ❌ Session restoration on app load

---

### Architecture & Key Decisions

**Technology Stack (Week 2):**
- **Frontend Framework:** React 18 + TanStack Start (SPA)
- **State Management:** Zustand (auth.store.ts)
- **Data Fetching:** TanStack Query (will integrate in FE-004)
- **API Client:** Custom api-client.ts (to be enhanced)
- **Authentication:** BetterAuth backend + JWT tokens
- **Real-Time:** Socket.io (WebSocket client, configured in BE-006)
- **HTTP Client:** Fetch API with interceptors
- **Styling:** Tailwind CSS + DaisyUI (optional)

**Architect Decision on BetterAuth React SDK:**
- ❌ **DO NOT install** `better-auth/react` package
- ❌ **Reason:** Package installation blocked by network issues; custom implementation is sufficient
- ✅ **Instead:** Use existing auth.service.ts + api-client.ts + auth.store.ts as foundation
- ✅ **Enhance** existing code to add missing features (interceptors, token refresh, auth provider)

**Authentication Flow (Backend-to-Frontend):**

```
User logs in → POST /simple-auth/login with email+password
    ↓
Backend validates credentials via BetterAuth
    ↓
Backend responds with:
  - Set-Auth-Token header (JWT token)
  - User object in response body
    ↓
Frontend extracts token from Set-Auth-Token header
    ↓
Frontend stores token in localStorage (via api-client.ts)
    ↓
Frontend includes token in Authorization header for future requests
    ↓
Backend validates token on each request
    ↓
If token expired (401 response):
  - Frontend interceptor detects 401
  - Attempt refresh (if available) or redirect to login
  - Retry original request with new token
    ↓
User makes requests with valid token until logout or expiry
```

**Role-Based Access Control (RBAC):**
- 4 Roles: Super Admin, Admin, Manager, User
- 18 Permissions across features
- Backend validates via `@RequirePermission()` decorator
- Frontend restricts UI/navigation based on user role
- You'll implement role-based navigation in FE-003 (not this task)

---

## 🚀 WHAT YOU NEED TO DO

### The 8 Subtasks of FE-001 (Sequential Implementation)

**Subtask 1: Review Backend Controller** (5-10 min)
- **What:** Understand backend auth endpoints and response format
- **Files to review:**
  - `packages/backend/src/controllers/simple-auth.controller.ts`
  - `packages/backend/src/controllers/auth.controller.ts`
- **Verify:**
  - Login endpoint: POST /simple-auth/login (accepts email, password)
  - Logout endpoint: POST /simple-auth/logout
  - Session endpoint: GET /simple-auth/session
  - Response format: { user: {...}, token?: string } with Set-Auth-Token header
  - Error responses: 401 for invalid credentials, 400 for validation errors
- **Document findings:** Note any important details in comments

---

**Subtask 2: Enhance JWT Token Storage** (1-2 hours)
- **Current Status:** Partial implementation in api-client.ts
- **What to do:**
  1. Review existing `getToken()`, `setToken()`, `clearToken()` functions
  2. Add token expiry checking:
     - Calculate token expiry from JWT decode
     - Check if token expired before making requests
     - Return null if expired (trigger refresh/logout)
  3. Add session storage option (currently only localStorage)
     - Allow configurable storage (localStorage vs sessionStorage)
     - Default to localStorage for persistent auth
  4. Add automatic token cleanup:
     - Clear token on page unload if needed
     - Clear token on logout (already done)
  5. Add helper function: `isTokenExpired()` to check expiry status

- **Implementation pattern:**
  ```typescript
  // In api-client.ts
  
  function decodeToken(token: string): { exp?: number } {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload;
    } catch {
      return {};
    }
  }
  
  function isTokenExpired(token: string | null): boolean {
    if (!token) return true;
    const { exp } = decodeToken(token);
    if (!exp) return false; // If no exp, assume valid
    return Date.now() >= exp * 1000;
  }
  
  function getToken(): string | null {
    const token = localStorage.getItem('auth_token');
    if (isTokenExpired(token)) {
      clearToken();
      return null;
    }
    return token;
  }
  ```

- **Test coverage:** 80%+ (test token expiry detection, storage, retrieval)

---

**Subtask 3: Implement Request/Response Interceptors** (2-3 hours)
- **Current Status:** No comprehensive interceptors
- **What to do:**
  1. Create wrapper around fetch API (or use axios equivalent)
  2. Implement request interceptor:
     - Add Authorization header: `Authorization: Bearer ${token}`
     - Add custom headers (X-Correlation-ID, Content-Type)
     - Log request (with correlation ID)
  3. Implement response interceptor:
     - Handle success (200-299): return response
     - Handle 401 (Unauthorized):
       - Attempt token refresh (if available)
       - Retry original request with new token
       - On failure: logout + redirect to login
     - Handle 403 (Forbidden):
       - Show user notification: "You don't have permission"
       - Log action for audit
     - Handle 500 (Server Error):
       - Show generic error message
       - Log full error for debugging
     - Handle network errors:
       - Retry logic (exponential backoff)
       - Show user-friendly error message
  4. Add request timeout (30 seconds default)
  5. Add retry logic for transient errors (5xx, network timeouts)

- **Implementation pattern:**
  ```typescript
  // In lib/api-client.ts or new lib/auth-interceptors.ts
  
  interface FetchOptions extends RequestInit {
    timeout?: number;
    retries?: number;
  }
  
  async function fetchWithInterceptors(
    url: string,
    options: FetchOptions = {}
  ): Promise<Response> {
    const {
      timeout = 30000,
      retries = 3,
      ...fetchOptions
    } = options;
    
    // Request interceptor
    const token = getToken();
    const headers = {
      'Content-Type': 'application/json',
      'X-Correlation-ID': generateCorrelationId(),
      ...fetchOptions.headers,
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        
        const response = await fetch(url, {
          ...fetchOptions,
          headers,
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);
        
        // Response interceptor
        if (response.ok) {
          return response;
        }
        
        if (response.status === 401) {
          // Token expired - refresh or logout
          const refreshed = await attemptTokenRefresh();
          if (refreshed) {
            // Retry with new token
            return fetchWithInterceptors(url, { ...options, retries: 0 });
          } else {
            // Logout
            await logout();
            window.location.href = '/login';
            throw new Error('Unauthorized');
          }
        }
        
        if (response.status === 403) {
          throw new Error('Permission denied');
        }
        
        if (response.status >= 500 && attempt < retries) {
          // Retry on server error
          await delay(Math.pow(2, attempt) * 1000);
          continue;
        }
        
        return response;
      } catch (error) {
        lastError = error as Error;
        if (attempt < retries) {
          await delay(Math.pow(2, attempt) * 1000);
          continue;
        }
      }
    }
    
    throw lastError || new Error('Request failed');
  }
  ```

- **Test coverage:** 80%+ (test all interceptor scenarios)

---

**Subtask 4: Implement Token Refresh on 401** (1-2 hours)
- **Current Status:** No automatic refresh
- **What to do:**
  1. Check if backend provides refresh endpoint:
     - Review simple-auth.controller.ts for refresh logic
     - If no refresh endpoint, use login credentials (store encrypted) or redirect to login
  2. Create `attemptTokenRefresh()` function:
     - Call refresh endpoint (or use login with stored credentials)
     - Extract new token from response
     - Store new token (via `setToken()`)
     - Return true if successful, false otherwise
  3. Integrate into response interceptor (Subtask 3):
     - On 401 response: call `attemptTokenRefresh()`
     - If successful: retry original request
     - If failed: logout + redirect to login
  4. Handle edge cases:
     - Prevent multiple simultaneous refresh attempts
     - Queue requests during refresh
     - Handle refresh failure gracefully

- **Implementation pattern:**
  ```typescript
  let isRefreshing = false;
  let refreshPromise: Promise<boolean> | null = null;
  let pendingRequests: Array<() => void> = [];
  
  async function attemptTokenRefresh(): Promise<boolean> {
    if (isRefreshing && refreshPromise) {
      return refreshPromise;
    }
    
    isRefreshing = true;
    
    refreshPromise = (async () => {
      try {
        const response = await fetch('/auth/refresh', { method: 'POST' });
        if (response.ok) {
          const { token } = await response.json();
          setToken(token);
          
          // Process queued requests
          pendingRequests.forEach(cb => cb());
          pendingRequests = [];
          
          return true;
        }
        return false;
      } catch {
        return false;
      } finally {
        isRefreshing = false;
        refreshPromise = null;
      }
    })();
    
    return refreshPromise;
  }
  
  function queueRequest(callback: () => void): void {
    if (isRefreshing) {
      pendingRequests.push(callback);
    } else {
      callback();
    }
  }
  ```

- **Test coverage:** 80%+ (test refresh success/failure, token update, retry logic)

---

**Subtask 5: Create Auth Context + Provider** (2-3 hours)
- **Current Status:** No React context
- **What to do:**
  1. Create new file: `packages/frontend/src/contexts/AuthContext.tsx`
  2. Define AuthContext with:
     - `user`: Current user object (id, email, role, name)
     - `isAuthenticated`: Boolean flag
     - `isLoading`: Boolean for loading state
     - `error`: Error message (if any)
     - `login()`: Function to login
     - `logout()`: Function to logout
     - `loadUser()`: Function to restore session on app load
     - `clearError()`: Function to clear error
  3. Create AuthProvider component:
     - Wrap app and provide context values
     - Initialize auth state on mount (load existing session)
     - Handle token expiry detection
     - Update user role in real-time
  4. Create useAuth hook:
     - Return context values
     - Throw error if used outside provider
  5. Ensure TypeScript types are strict (no `any`)

- **Implementation pattern:**
  ```typescript
  // contexts/AuthContext.tsx
  
  import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
  import * as authService from '../services/auth.service';
  
  interface User {
    id: string;
    email: string;
    name?: string;
    role: 'SUPER_ADMIN' | 'ADMIN' | 'MANAGER' | 'USER';
  }
  
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
  
  const AuthContext = createContext<AuthContextType | undefined>(undefined);
  
  export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    
    useEffect(() => {
      // Load user on app mount
      loadUser();
    }, []);
    
    async function loadUser() {
      setIsLoading(true);
      try {
        const response = await authService.getSession();
        if (response) {
          setUser(response);
        }
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setIsLoading(false);
      }
    }
    
    async function login(email: string, password: string) {
      setIsLoading(true);
      setError(null);
      try {
        const response = await authService.login({ email, password });
        setUser(response.user);
      } catch (err) {
        const message = (err as Error).message;
        setError(message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    }
    
    async function logout() {
      setIsLoading(true);
      try {
        await authService.logout();
        setUser(null);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setIsLoading(false);
      }
    }
    
    function clearError() {
      setError(null);
    }
    
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
  
  export function useAuth(): AuthContextType {
    const context = useContext(AuthContext);
    if (!context) {
      throw new Error('useAuth must be used within AuthProvider');
    }
    return context;
  }
  ```

- **Test coverage:** 80%+ (test provider mounting, user loading, login/logout, error handling)

---

**Subtask 6: Create Protected Route Wrapper** (1-2 hours)
- **Current Status:** No route protection
- **What to do:**
  1. Create new file: `packages/frontend/src/components/ProtectedRoute.tsx`
  2. Component accepts:
     - `children`: React component(s) to render if authenticated
     - `requiredRole?`: Optional role to check (optional for FE-001)
     - `fallback?`: Optional loading component
  3. Component logic:
     - Check `useAuth()` context
     - If loading: show fallback or loading spinner
     - If not authenticated: redirect to login page
     - If authenticated (and role matches if specified): render children
  4. Use with React Router or TanStack Router

- **Implementation pattern:**
  ```typescript
  // components/ProtectedRoute.tsx
  
  import { ReactNode } from 'react';
  import { useAuth } from '../contexts/AuthContext';
  import { useNavigate } from '@tanstack/react-router';
  
  interface ProtectedRouteProps {
    children: ReactNode;
    requiredRole?: string;
    fallback?: ReactNode;
  }
  
  export function ProtectedRoute({
    children,
    requiredRole,
    fallback,
  }: ProtectedRouteProps) {
    const { isAuthenticated, isLoading, user } = useAuth();
    const navigate = useNavigate();
    
    if (isLoading) {
      return fallback || <div>Loading...</div>;
    }
    
    if (!isAuthenticated) {
      navigate({ to: '/login', replace: true });
      return null;
    }
    
    if (requiredRole && user?.role !== requiredRole) {
      navigate({ to: '/', replace: true });
      return null;
    }
    
    return <>{children}</>;
  }
  ```

- **Test coverage:** 80%+ (test authentication check, redirect logic, role validation)

---

**Subtask 7: Write Unit Tests** (2-3 hours)
- **Current Status:** No tests for new code
- **What to do:**
  1. Create test files:
     - `packages/frontend/src/services/__tests__/auth.service.test.ts`
     - `packages/frontend/src/stores/__tests__/auth.store.test.ts`
     - `packages/frontend/src/lib/__tests__/api-client.test.ts`
     - `packages/frontend/src/contexts/__tests__/AuthContext.test.ts`
     - `packages/frontend/src/components/__tests__/ProtectedRoute.test.ts`
  2. Test scenarios (per file):
     - **auth.service.test.ts:**
       - login() success/failure
       - logout() success/failure
       - getSession() with valid/invalid token
       - forgotPassword() success/failure
       - resetPassword() success/failure
     - **auth.store.test.ts:**
       - Initial state
       - login action (success/failure)
       - logout action
       - setUser action
       - clearError action
     - **api-client.test.ts:**
       - Token storage (get/set/clear)
       - Token expiry detection
       - Request interceptor (adds Authorization header)
       - Response interceptor (handles 401/403/500)
       - Token refresh on 401
     - **AuthContext.test.ts:**
       - Provider mounting
       - User loading on mount
       - login action
       - logout action
       - useAuth hook (inside/outside provider)
       - Error handling
     - **ProtectedRoute.test.ts:**
       - Renders children if authenticated
       - Redirects to login if not authenticated
       - Shows loading state
       - Validates required role (if specified)
  3. Mock external dependencies:
     - Mock fetch API for auth service tests
     - Mock localStorage for token storage tests
     - Mock React Router for navigation tests
  4. Target coverage: 80%+ minimum

- **Test tools:**
  - Framework: Vitest (already used in backend, consistent)
  - Testing Library: @testing-library/react
  - Mock library: vitest.mock()

- **Example test:**
  ```typescript
  // packages/frontend/src/services/__tests__/auth.service.test.ts
  
  import { describe, it, expect, vi, beforeEach } from 'vitest';
  import * as authService from '../auth.service';
  
  describe('authService', () => {
    beforeEach(() => {
      // Clear mocks before each test
      vi.clearAllMocks();
    });
    
    describe('login', () => {
      it('should return user on successful login', async () => {
        const mockUser = {
          id: '1',
          email: 'test@example.com',
          role: 'USER',
        };
        
        vi.spyOn(global, 'fetch').mockResolvedValueOnce(
          new Response(JSON.stringify({ user: mockUser }), {
            status: 200,
            headers: { 'set-auth-token': 'fake-jwt-token' },
          })
        );
        
        const result = await authService.login({
          email: 'test@example.com',
          password: 'password123',
        });
        
        expect(result).toEqual(mockUser);
      });
      
      it('should throw error on failed login', async () => {
        vi.spyOn(global, 'fetch').mockResolvedValueOnce(
          new Response(JSON.stringify({ error: 'Invalid credentials' }), {
            status: 401,
          })
        );
        
        await expect(
          authService.login({
            email: 'test@example.com',
            password: 'wrong-password',
          })
        ).rejects.toThrow('Invalid credentials');
      });
    });
  });
  ```

---

**Subtask 8: Manual Testing & PR Creation** (1-2 hours)
- **What to do:**
  1. Manual end-to-end testing:
     - Start backend (if needed): `pnpm --filter @yacc/backend dev`
     - Start frontend: `pnpm --filter @yacc/frontend dev`
     - Test login flow:
       - Go to login page
       - Enter credentials
       - Verify token stored in localStorage
       - Verify user displayed in UI
       - Verify Authorization header sent in requests
     - Test logout flow:
       - Click logout
       - Verify token cleared
       - Verify redirect to login
     - Test token refresh (if implemented):
       - Manually set expired token in localStorage
       - Make API request
       - Verify 401 handler triggers
       - Verify token refresh or redirect to login
     - Test error scenarios:
       - Invalid credentials → error message shown
       - Network timeout → error message shown
       - 403 error → permission denied message shown
  2. Verify all tests pass:
     - `pnpm --filter @yacc/frontend test` (all tests pass)
     - `pnpm --filter @yacc/frontend test --coverage` (80%+ coverage)
  3. Create PR:
     - Branch name: `task/FE-001-auth-integration`
     - Commit message: Clear, descriptive, references issue #35
     - PR title: "feat(FE-001): Implement Frontend Auth Integration"
     - PR body: Document changes, test coverage, manual testing results
     - Add ADR reference if architectural decisions made
     - Request review from architect

- **PR template:**
  ```markdown
  # feat(FE-001): Implement Frontend Auth Integration
  
  ## Summary
  Implements comprehensive frontend authentication integration with BetterAuth backend, including:
  - JWT token management with automatic refresh on expiry
  - Request/response interceptors (401/403/500 handlers)
  - Auth Context + useAuth hook for React components
  - Protected Route wrapper for role-based access
  - Comprehensive unit tests (80%+ coverage)
  
  ## Changes
  - Enhanced `api-client.ts` with interceptors and token refresh logic
  - Created `contexts/AuthContext.tsx` with AuthProvider and useAuth hook
  - Created `components/ProtectedRoute.tsx` for route protection
  - Added comprehensive unit tests (5 test files, 80%+ coverage)
  - Enhanced token storage with expiry detection
  
  ## Testing
  - ✅ All 71 backend tests passing
  - ✅ 25 new frontend tests added (80%+ coverage)
  - ✅ Manual end-to-end testing complete:
    - Login flow verified
    - Logout flow verified
    - Token refresh on expiry verified
    - Error handling verified
  
  ## Type Safety
  - ✅ No `any` types used
  - ✅ Strict TypeScript compilation passes
  - ✅ Full type inference for API responses
  
  ## Breaking Changes
  - None (backward compatible)
  
  ## Related
  - Closes #35
  - Related to BE-027, BE-003, BE-005
  
  ## Checklist
  - [x] Code follows architectural constraints (no `any` types, flat structure)
  - [x] All tests passing (80%+ coverage)
  - [x] No breaking changes
  - [x] Manual testing complete
  - [x] Documentation updated (if needed)
  ```

---

## 📁 FILE LOCATIONS & STRUCTURE

### Files to Review (Read-Only)

```
packages/backend/src/
├── controllers/
│   ├── simple-auth.controller.ts      ← Review: login/logout/session endpoints
│   ├── auth.controller.ts             ← Review: forgot password, reset password
│   └── users.controller.ts            ← Reference: User model, RBAC checks
├── services/
│   └── authorization.service.ts       ← Reference: RBAC permission matrix
└── config/
    └── db.ts                          ← Reference: Database schema (users, sessions)
```

### Files to Enhance (Your Work)

```
packages/frontend/src/
├── services/
│   ├── auth.service.ts               ← Enhance: Add refresh logic, error handling
│   └── __tests__/
│       └── auth.service.test.ts       ← Create: Unit tests (80%+ coverage)
├── stores/
│   ├── auth.store.ts                 ← Review/Enhance: Zustand store
│   └── __tests__/
│       └── auth.store.test.ts        ← Create: Unit tests
├── lib/
│   ├── api-client.ts                 ← Enhance: Add interceptors, token refresh
│   ├── auth-interceptors.ts          ← Create: Comprehensive interceptor logic
│   └── __tests__/
│       ├── api-client.test.ts        ← Create: Unit tests
│       └── auth-interceptors.test.ts ← Create: Unit tests
├── contexts/
│   ├── AuthContext.tsx               ← Create: Auth provider + useAuth hook
│   └── __tests__/
│       └── AuthContext.test.ts       ← Create: Unit tests
├── components/
│   ├── ProtectedRoute.tsx            ← Create: Route protection wrapper
│   └── __tests__/
│       └── ProtectedRoute.test.ts    ← Create: Unit tests
├── pages/
│   └── LoginPage.tsx                 ← Reference: Already exists, minor updates
└── main.tsx                          ← Wrap app with AuthProvider
```

### Documentation Files (Reference)

```
.docs/
├── plans/
│   ├── week2-product-owner-review.md    ← FE-001 requirements (Section 1)
│   ├── week2-architect-review.md        ← Auth patterns (Section 1.1)
│   └── week2-action-plan.md             ← Timeline (Day 1-2)
├── SESSION-WEEK2-KICKOFF.md             ← State assessment
└── 02-api-and-data-model.md             ← Backend API spec (Section 2)
```

---

## 🔧 DEVELOPMENT SETUP

### Prerequisites

```bash
# Verify versions
node --version              # v18 or higher
pnpm --version             # v9+
docker --version           # For local services
```

### Initial Setup (If First Time)

```bash
# Install dependencies (if not already done)
pnpm install

# Start local services (PostgreSQL, Redis)
docker-compose up -d

# Verify database is ready
# (Check logs: docker-compose logs postgres)
```

### Start Development Servers

```bash
# Terminal 1: Backend API
cd /home/chrissim/Projects/Antpolis/yacc-client
pnpm --filter @yacc/backend dev

# Terminal 2: Frontend SPA
cd /home/chrissim/Projects/Antpolis/yacc-client
pnpm --filter @yacc/frontend dev

# Backend runs on: http://localhost:3000
# Frontend runs on: http://localhost:5173
```

### Git Workflow

```bash
# 1. Ensure you're on dev branch and up to date
git checkout dev
git pull origin dev

# 2. Create feature branch
git checkout -b task/FE-001-auth-integration

# 3. Make changes to frontend code

# 4. Run tests
pnpm --filter @yacc/frontend test          # Run all tests
pnpm --filter @yacc/frontend test:ui       # Interactive test runner
pnpm --filter @yacc/frontend test --coverage  # Coverage report

# 5. Commit changes
git add packages/frontend/src
git commit -m "feat(FE-001): Implement Frontend Auth Integration

- Enhanced api-client.ts with comprehensive interceptors
- Added token refresh logic on 401 responses
- Created AuthContext with useAuth hook
- Created ProtectedRoute wrapper component
- Added comprehensive unit tests (80%+ coverage)

Closes #35"

# 6. Push to remote
git push origin task/FE-001-auth-integration

# 7. Create PR on GitHub
# Go to: https://github.com/csim-sg/yacc
# Create pull request from task/FE-001-auth-integration → dev
```

---

## 📊 ACCEPTANCE CRITERIA (From Product Owner)

**FE-001 Acceptance Criteria:**

- [ ] **AC1:** JWT token automatically extracted from `Set-Auth-Token` header on login
- [ ] **AC2:** Token stored securely in localStorage with automatic refresh on 401 response
- [ ] **AC3:** Request interceptor adds `Authorization: Bearer ${token}` header to all API requests
- [ ] **AC4:** Response interceptor handles:
  - [ ] 401 (Unauthorized): Attempt refresh or redirect to login
  - [ ] 403 (Forbidden): Show "Permission denied" message
  - [ ] 500+ (Server Error): Show error message with retry option
- [ ] **AC5:** Token refresh endpoint called automatically on 401 (if available)
- [ ] **AC6:** Auth Context provides `useAuth()` hook with user, isAuthenticated, isLoading, error
- [ ] **AC7:** Protected Route wrapper redirects to login if not authenticated
- [ ] **AC8:** Unit tests cover all auth flows (80%+ code coverage minimum)
- [ ] **AC9:** Manual testing completed: login, logout, token refresh, error scenarios
- [ ] **AC10:** No breaking changes to existing functionality
- [ ] **AC11:** TypeScript strict mode passes (no `any` types)
- [ ] **AC12:** PR created with clear documentation and references

---

## ⚠️ CRITICAL CONSTRAINTS (Must Follow)

### Architecture (Non-Negotiable)

1. **No `any` Types**
   - Use strict TypeScript
   - Properly type all function parameters and return values
   - Extend Express types correctly for middleware

2. **Flat Folder Structure**
   - ❌ NO nested `src/auth/services/` or `src/api/interceptors/`
   - ✅ YES: Flat structure:
     - `services/` - auth.service.ts
     - `stores/` - auth.store.ts
     - `lib/` - api-client.ts, auth-interceptors.ts
     - `contexts/` - AuthContext.tsx
     - `components/` - ProtectedRoute.tsx

3. **One Definition Per File**
   - One class/interface/service per file
   - No barrel exports (no `index.ts`)
   - Direct file imports

4. **No `any` Casting**
   - Don't use `req as any` for Express middleware
   - Use proper TypeScript interfaces

### Testing

1. **Code Coverage**
   - Minimum 80% coverage for new code
   - Use Vitest (consistent with backend)
   - Mock external dependencies (fetch, localStorage, react-router)

2. **Test Types**
   - Unit tests for services, stores, context, components
   - Integration tests for API client interceptors
   - No E2E tests for auth (that's FE-002)

### Code Quality

1. **Linting & Type Checking**
   - `pnpm --filter @yacc/frontend lint` - Must pass
   - `pnpm --filter @yacc/frontend test` - All tests pass
   - No TypeScript errors (tsc --noEmit)

2. **Performance**
   - No unnecessary re-renders
   - Minimize context updates
   - Efficient token storage/retrieval

### Git & PR

1. **Commit Messages**
   - Clear, descriptive commit messages
   - Reference issue number (#35)
   - Explain WHY, not just WHAT

2. **PR Requirements**
   - Clear PR title and description
   - Reference related issues/PRs
   - Include test coverage info
   - Document any architectural decisions

---

## 🚨 COMMON PITFALLS (Watch Out)

### 1. **Token Storage Issues**
- ❌ Store token in URL query params (security risk)
- ❌ Store token in global variable (lost on refresh)
- ✅ Store token in localStorage (persists across sessions)
- ✅ Store token in React context (available to components)

### 2. **Infinite Loop on 401**
- ❌ Retry request infinitely on 401 (causes infinite loop)
- ✅ Limit retry attempts (max 1 retry on 401)
- ✅ Logout on refresh failure (prevent infinite loop)

### 3. **Race Conditions on Token Refresh**
- ❌ Multiple simultaneous refresh requests (causes chaos)
- ✅ Queue requests during refresh (process after token updated)
- ✅ Use flag to prevent concurrent refresh (isRefreshing flag)

### 4. **CORS Issues with Credentials**
- ❌ Don't set `credentials: 'include'` for cross-origin requests (blocked by backend)
- ✅ Include token in Authorization header (explicit, not cookie-based)
- ✅ Backend responds with appropriate CORS headers

### 5. **Context Provider Mounting**
- ❌ Don't mount AuthProvider inside page components (causes state loss on navigation)
- ✅ Mount AuthProvider at root level (in main.tsx or App.tsx)
- ✅ Use context in child components (LoginPage, Dashboard, etc.)

### 6. **Test Mocking**
- ❌ Use real fetch API in tests (causes network calls)
- ✅ Mock fetch with vi.spyOn() (control responses)
- ✅ Mock localStorage (test token storage)
- ✅ Mock useNavigate hook (test redirects)

---

## 🆘 TROUBLESHOOTING

### Issue: Tests failing with "useAuth must be used within AuthProvider"
**Solution:** Wrap component with `<AuthProvider>` in test setup or use React Testing Library `renderWithAuth()` helper

### Issue: Token not being sent in API requests
**Solution:** Check:
1. Token stored in localStorage (getToken() returns value)
2. Request interceptor adds Authorization header
3. Backend accepts Authorization header (check CORS)

### Issue: Infinite redirect loop (login → logout → login)
**Solution:** Check:
1. Token expiry detection (isTokenExpired())
2. Token refresh retry limit (max 1 retry)
3. Logout called on refresh failure

### Issue: "Cannot read property 'user' of undefined" in ProtectedRoute
**Solution:** Ensure AuthProvider wraps entire app (check main.tsx)

### Issue: Tests taking too long to run
**Solution:**
1. Mock API calls (don't make real requests)
2. Use `vi.useFakeTimers()` for timeout tests
3. Run tests in parallel (Vitest default)

---

## ✅ COMPLETION CHECKLIST

Use this checklist to track progress:

### Implementation (Subtasks 1-7)
- [ ] Subtask 1: Backend controller reviewed
- [ ] Subtask 2: JWT token storage enhanced with expiry detection
- [ ] Subtask 3: Request/response interceptors implemented (401/403/500)
- [ ] Subtask 4: Token refresh on 401 working
- [ ] Subtask 5: Auth Context + Provider created
- [ ] Subtask 6: Protected Route wrapper created
- [ ] Subtask 7: Unit tests written (80%+ coverage)

### Testing & Validation
- [ ] All unit tests passing (25+ tests)
- [ ] Code coverage 80%+ for new code
- [ ] TypeScript strict mode passes
- [ ] ESLint passes
- [ ] Manual testing complete:
  - [ ] Login flow works
  - [ ] Logout flow works
  - [ ] Token refresh works
  - [ ] Error handling works (401, 403, 500)

### Code Quality
- [ ] No `any` types used
- [ ] Flat folder structure maintained
- [ ] One definition per file
- [ ] No barrel exports (no index.ts)
- [ ] Direct file imports
- [ ] Clear, descriptive comments where needed

### Git & PR
- [ ] Feature branch created: `task/FE-001-auth-integration`
- [ ] Changes committed with clear messages
- [ ] Pushed to remote
- [ ] PR created with title: "feat(FE-001): Implement Frontend Auth Integration"
- [ ] PR description includes:
  - [ ] Summary of changes
  - [ ] Test coverage info
  - [ ] Manual testing results
  - [ ] References to #35 and related tasks

### Documentation
- [ ] Session summary updated (.docs/SESSION-*.md)
- [ ] Architecture decisions documented (ADR if needed)
- [ ] Code comments added for complex logic

---

## 📞 ESCALATION CONTACTS

**If you get stuck:**
1. Check `.docs/SESSION-WEEK2-KICKOFF.md` for context
2. Review `.docs/plans/week2-quick-reference.md` for quick answers
3. Check `.docs/02-api-and-data-model.md` for API specs
4. Review backend controller files to verify endpoint behavior
5. Escalate architectural questions to Architect (create ADR)

**Common Escalations:**
- **API contract unclear:** Review backend controller + tests
- **TypeScript types failing:** Check type definitions in services
- **Test mocking issues:** Review Vitest documentation or existing backend tests
- **Architecture questions:** Document as ADR and request architect review

---

## 🎓 REFERENCE IMPLEMENTATIONS

### Example: Token Storage with Expiry

```typescript
// lib/api-client.ts - Token Storage Example

function decodeToken(token: string): Record<string, unknown> {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload;
  } catch {
    return {};
  }
}

export function isTokenExpired(token: string | null): boolean {
  if (!token) return true;
  
  const { exp } = decodeToken(token);
  if (!exp || typeof exp !== 'number') return false;
  
  // Compare with current time (token exp is in seconds, Date.now() is in ms)
  return Date.now() >= (exp * 1000);
}

export function getToken(): string | null {
  const token = localStorage.getItem('auth_token');
  
  if (isTokenExpired(token)) {
    clearToken();
    return null;
  }
  
  return token;
}

export function setToken(token: string): void {
  localStorage.setItem('auth_token', token);
}

export function clearToken(): void {
  localStorage.removeItem('auth_token');
}
```

### Example: Auth Context with Provider

```typescript
// contexts/AuthContext.tsx - Full Example

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from 'react';
import * as authService from '../services/auth.service';

interface User {
  id: string;
  email: string;
  name?: string;
  role: 'SUPER_ADMIN' | 'ADMIN' | 'MANAGER' | 'USER';
}

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

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({
  children,
}: {
  children: ReactNode;
}): JSX.Element {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadUser();
  }, []);

  async function loadUser(): Promise<void> {
    setIsLoading(true);
    try {
      const response = await authService.getSession();
      if (response) {
        setUser(response);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  }

  async function login(email: string, password: string): Promise<void> {
    setIsLoading(true);
    setError(null);
    try {
      const response = await authService.login({ email, password });
      setUser(response);
    } catch (err) {
      const message = (err as Error).message;
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }

  async function logout(): Promise<void> {
    setIsLoading(true);
    try {
      await authService.logout();
      setUser(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  }

  function clearError(): void {
    setError(null);
  }

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
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
```

### Example: Protected Route Component

```typescript
// components/ProtectedRoute.tsx - Full Example

import { ReactNode } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from '@tanstack/react-router';

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRole?: string;
  fallback?: ReactNode;
}

export function ProtectedRoute({
  children,
  requiredRole,
  fallback,
}: ProtectedRouteProps): JSX.Element | null {
  const { isAuthenticated, isLoading, user } = useAuth();
  const navigate = useNavigate();

  if (isLoading) {
    return <>{fallback || <div>Loading...</div>}</>;
  }

  if (!isAuthenticated) {
    navigate({ to: '/login', replace: true });
    return null;
  }

  if (requiredRole && user?.role !== requiredRole) {
    navigate({ to: '/', replace: true });
    return null;
  }

  return <>{children}</>;
}
```

---

## 🎬 NEXT STEPS AFTER FE-001

Once FE-001 is complete:

1. **FE-002: Login/Logout UI Components** (10-12 hours)
   - Build on top of Auth Context from FE-001
   - Create form validation, error messages, loading states
   - Enhance LoginPage with UX improvements
   - Create ForgotPasswordPage and ResetPasswordPage

2. **FE-003: RBAC-Based Navigation** (8-10 hours)
   - Use user.role from useAuth()
   - Implement role-based menu items
   - Implement role-based route access
   - Use ProtectedRoute with requiredRole parameter

3. **FE-004: API Integration Layer** (10-12 hours)
   - Integrate TanStack Query with all API endpoints
   - Create typed query hooks (useConversations, useMessages, etc.)
   - Handle caching, loading states, error states

4. **Be-006: WebSocket Infrastructure** (12-14 hours, parallel with FE-002/FE-003)
   - Set up Socket.io server on backend
   - Create WebSocket event handlers
   - Publish events on message creation, status change, etc.

5. **Integration Testing** (8 hours)
   - E2E tests with Playwright
   - Test full auth → message routing → real-time updates flow

---

## 📝 SUMMARY FOR HANDOFF

**You are ready to start FE-001. Here's what you need to do:**

1. **Review** backend controller (5 min) to understand auth endpoints
2. **Create** feature branch: `task/FE-001-auth-integration`
3. **Implement** 8 subtasks sequentially (10-12 hours):
   - Token storage with expiry
   - Request/response interceptors
   - Token refresh on 401
   - Auth Context + useAuth hook
   - Protected Route wrapper
   - Comprehensive unit tests (80%+ coverage)
4. **Test** manually: login, logout, token refresh, errors
5. **Create PR** with clear documentation
6. **Submit** for architect review

**Current Status:** ✅ All prerequisites complete, no blockers
**Architecture Compliance:** ✅ Verified constraints and patterns
**Support:** Reference docs at `.docs/SESSION-WEEK2-KICKOFF.md`, `.docs/plans/week2-*`

**Time Estimate:** 10-12 hours
**Difficulty:** Medium (integrating multiple systems)
**Risk Level:** Low (backend ready, auth patterns clear)

---

**Good luck! You've got this. 🚀**

*Last Updated: 2026-01-26*  
*Session Status: Ready to Start*  
*Task: FE-001 Frontend Auth Integration*  
*Issue: #35*
