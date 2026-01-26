# FE-004: API Integration Layer - Developer Handoff

**Date:** 2026-01-26  
**Status:** ✅ Ready for Development  
**Blocked By:** ❌ NONE (FE-003 merged 2026-01-26)  
**Target Hours:** 10-12 hours  
**Target Completion:** 2026-01-28 (Day 4 of Week 2)

---

## 🎯 Executive Summary

FE-004 implements a centralized, type-safe API client with automatic error handling and data fetching using TanStack Query and Zod validation. This is the critical integration layer connecting frontend UI components to backend APIs.

**Dependencies:**
- ✅ FE-001: Frontend Auth Integration (provides AuthContext) - MERGED
- ✅ FE-002: Login/Logout UI (provides base components) - MERGED
- ✅ FE-003: RBAC Navigation (provides role-based routing) - MERGED TODAY
- ⏳ BE-006: WebSocket Infrastructure (real-time updates) - Ready to start parallel

**Unblocks:**
- FE-005: Inbox Page Component (needs useConversations hook)
- QA-001: Integration Testing (needs API mocked responses)
- BE-006 Integration: WebSocket needs initial data from API client

---

## 📋 Task Details

### Branch Information

**Feature Branch:** `task/FE-004-api-integration`  
**Base Branch:** `dev`  
**Branch Created:** 2026-01-26  
**Remote Status:** Pushed and tracked (`-u origin`)  
**Commit with Documentation:** 415528a (planning docs updated)

### Scope

**What to Build:**
1. ✅ Centralized Axios HTTP client with interceptors
2. ✅ TanStack Query (React Query) setup with QueryClient
3. ✅ Zod schema validation for API responses
4. ✅ Custom React hooks for data fetching (useConversations, useMessages, useUser)
5. ✅ Error handling (401, 403, 5xx with retry)
6. ✅ Cache strategy with proper invalidation
7. ✅ Integration with existing AuthContext for token management
8. ✅ TypeScript type safety (zero `any` types)
9. ✅ E2E and unit tests (85%+ coverage)

**What NOT to Build:**
- ❌ WebSocket integration (BE-006 handles this)
- ❌ UI components (FE-005 uses these hooks)
- ❌ Inbox Page logic (FE-005 handles display)
- ❌ Admin panels or settings pages

---

## ✅ Acceptance Criteria (10 Groups)

All 10 acceptance criteria groups from week2-product-owner-review.md Section 4 (FE-004):

### 1. API Client Setup

**Requirement:** Base HTTP client with request/response interceptors

- [ ] Create `packages/frontend/src/api/client.ts`
  - Base URL from env: `VITE_API_URL` (default: `http://localhost:3000/api`)
  - Default timeout: 30 seconds
  - Content-Type: `application/json` (auto-added)
  - Default headers: `{ "Accept": "application/json" }`
  
- [ ] Correlation ID Injection (middleware pattern)
  - Auto-add `X-Correlation-ID` header to ALL requests
  - Use UUID v4 format or existing ID from session
  - Reference: AuthContext + Session storage
  
- [ ] Authorization Header (token injection)
  - Auto-add `Authorization: Bearer <token>` for authenticated requests
  - Get token from AuthContext (via hook or provider)
  - Handle missing token gracefully (401 on endpoint)
  
- [ ] Request interceptor (logging optional, not required)
  - Log request: method, URL, status code to console (MVP)
  - Include correlation ID in logs
  
- [ ] Response interceptor (error handling)
  - Handle non-2xx status codes
  - Extract error message from response body
  - Log errors with correlation ID

**Success Criteria:**
- ✅ Axios instance created and exported
- ✅ All requests include Correlation-ID header
- ✅ All requests include Authorization header (if authenticated)
- ✅ Timeout enforced (30s)
- ✅ Error responses handled consistently

---

### 2. TanStack Query Setup

**Requirement:** QueryClient configured with sensible defaults

- [ ] Create `packages/frontend/src/lib/query-client.ts`
  - `new QueryClient()` with options:
    - `staleTime: 30000` (30 seconds - data considered fresh)
    - `gcTime: 5 * 60 * 1000` (5 minutes - cache retention before garbage collection)
    - `retry: 3` (retry failed requests 3 times)
    - `retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000)` (exponential backoff)
    - `networkMode: 'always'` (attempt requests even with poor connectivity)
  
- [ ] Create provider component
  - `<QueryClientProvider client={queryClient}>`
  - Wrap in `src/App.tsx` or main layout
  
- [ ] Default error handling
  - Call `queryClient.resetQueries()` on 401 logout
  - Show error toast on 403 and 5xx
  
- [ ] Mutation defaults
  - `useQueryClient()` for invalidating related queries
  - Example: POST /messages → invalidate messages + conversations

**Success Criteria:**
- ✅ QueryClient exported and configured
- ✅ QueryClientProvider wrapping app
- ✅ Cache strategy set (staleTime + gcTime)
- ✅ Retry logic configured (exponential backoff)
- ✅ No warnings in console about QueryClient

---

### 3. Zod Schema Validation

**Requirement:** Runtime validation + TypeScript types from schemas

- [ ] Create `packages/frontend/src/api/schemas.ts`
  - Define Zod schemas for API responses:
    - `ConversationSchema` (with all fields)
    - `MessageSchema` (with all fields)
    - `UserSchema` (for current user)
    - `ConversationListResponseSchema` (paginated response)
    - `MessageListResponseSchema` (paginated response)
  
- [ ] Type inference from schemas
  - `export type Conversation = z.infer<typeof ConversationSchema>`
  - `export type Message = z.infer<typeof MessageSchema>`
  - Use in hook return types
  
- [ ] Response validation
  - Validate responses before returning from hooks
  - On validation error: log error + throw + trigger error boundary
  - Never return unvalidated data
  
- [ ] Error messages
  - Include field names in validation errors
  - Example: "Error validating Conversation: 'status' must be open|pending|resolved"

**Success Criteria:**
- ✅ Zod schemas defined for all API responses
- ✅ Types exported from schemas (no manual type definitions)
- ✅ Runtime validation in hooks (via `.parse()` or `.parseAsync()`)
- ✅ Validation errors logged and handled
- ✅ No `any` types in schemas

---

### 4. Custom Hooks (3 Required)

**Requirement:** Reusable React hooks for data fetching

#### Hook 1: `useConversations()`

**Location:** `packages/frontend/src/hooks/queries/conversations.ts`

```typescript
export function useConversations(filters?: ConversationFilters) {
  return useQuery({
    queryKey: ['conversations', filters],
    queryFn: async () => {
      const response = await apiClient.get('/conversations', { params: filters });
      return ConversationListResponseSchema.parse(response.data);
    },
    staleTime: 30000,
    gcTime: 5 * 60 * 1000,
    enabled: true, // always fetch
  });
}
```

**Parameters:**
- `filters?: ConversationFilters` (optional)
  - `channelId?: string`
  - `assignedUserId?: string`
  - `status?: ConversationStatus`
  - `page?: number` (default: 1)
  - `pageSize?: number` (default: 20)

**Returns:**
- `{ data: Conversation[] | undefined, error: ..., isLoading: boolean, ...useQuery helpers }`

**Usage:**
```typescript
const { data: conversations, isLoading, error } = useConversations({ 
  status: 'open',
  page: 1 
});
```

#### Hook 2: `useMessages()`

**Location:** `packages/frontend/src/hooks/queries/messages.ts`

```typescript
export function useMessages(conversationId: string, options?: UseMessagesOptions) {
  return useQuery({
    queryKey: ['messages', conversationId],
    queryFn: async () => {
      const response = await apiClient.get(`/conversations/${conversationId}/messages`, {
        params: { limit: options?.limit ?? 50 }
      });
      return MessageListResponseSchema.parse(response.data);
    },
    staleTime: 10000,
    gcTime: 5 * 60 * 1000,
    enabled: !!conversationId, // don't fetch until conversationId provided
  });
}
```

**Parameters:**
- `conversationId: string` (required)
- `options?: { limit?: number }` (optional)

**Returns:**
- `{ data: Message[] | undefined, error: ..., isLoading: boolean, ...useQuery helpers }`

**Usage:**
```typescript
const { data: messages, isLoading } = useMessages(conversationId);
```

#### Hook 3: `useUser()`

**Location:** `packages/frontend/src/hooks/queries/user.ts`

```typescript
export function useUser() {
  const { user: authUser } = useAuthStore();
  
  return useQuery({
    queryKey: ['user', authUser?.id],
    queryFn: async () => {
      const response = await apiClient.get('/auth/me');
      return UserSchema.parse(response.data);
    },
    staleTime: 60000, // 1 minute
    gcTime: 10 * 60 * 1000, // 10 minutes
    enabled: !!authUser?.id, // only fetch if authenticated
  });
}
```

**Parameters:** None (uses AuthContext)

**Returns:**
- `{ data: User | undefined, error: ..., isLoading: boolean, ...useQuery helpers }`

**Usage:**
```typescript
const { data: user } = useUser();
```

**Success Criteria:**
- ✅ All 3 hooks implemented and exported
- ✅ Proper TypeScript generics (useQuery<T>)
- ✅ Proper error handling (TanStack Query built-in)
- ✅ Loading states accessible
- ✅ Refetch triggers (e.g., `refetch()` method)

---

### 5. Error Handling

**Requirement:** Handle HTTP errors consistently

#### 401 Unauthorized (Invalid/Expired Token)

**Behavior:**
1. Catch 401 response in interceptor
2. Clear AuthContext (call `logout()`)
3. Redirect to `/login`
4. Show toast: "Session expired. Please log in again."

**Implementation:**
```typescript
// In response interceptor
if (error.response?.status === 401) {
  const { logout } = useAuthStore.getState();
  logout();
  window.location.href = '/login'; // Force redirect
  throw error;
}
```

#### 403 Forbidden (Permission Denied)

**Behavior:**
1. Catch 403 in component (via useQuery error state)
2. Show toast: "You don't have permission to perform this action"
3. Keep user on page (don't logout)
4. Optionally: Show "Go Back" button

**Implementation:**
```typescript
const { data, error } = useConversations();

useEffect(() => {
  if (error?.response?.status === 403) {
    toast.error('Permission denied');
  }
}, [error]);
```

#### 5xx Server Errors (Retry)

**Behavior:**
1. TanStack Query auto-retries (3 attempts, exponential backoff)
2. If all retries fail: Show toast with "Retry" button
3. On retry: Call `refetch()` from useQuery

**Implementation:**
```typescript
const { data, error, refetch } = useConversations();

useEffect(() => {
  if (error?.response?.status >= 500) {
    toast.error('Server error. Retrying...', {
      action: {
        label: 'Retry',
        onClick: () => refetch(),
      },
    });
  }
}, [error, refetch]);
```

#### Network Errors (No Connectivity)

**Behavior:**
1. TanStack Query auto-retries on network error
2. If still no network after retries: Show toast "No internet connection"
3. Optionally: Show offline badge in header

**Success Criteria:**
- ✅ 401 logs user out + redirects
- ✅ 403 shows permission denied toast
- ✅ 5xx shows error + retry button
- ✅ Network errors handled gracefully
- ✅ No unhandled promise rejections

---

### 6. TypeScript Support

**Requirement:** Type-safe API client with zero `any` types

- [ ] No `any` types in client code
  - Use proper TypeScript generics
  - Example: `useQuery<Conversation[]>(...)`
  - Example: `apiClient.get<User>('/auth/me')`
  
- [ ] Proper request/response typing
  - Request DTO types in `types/api.ts`
  - Response types inferred from Zod schemas
  
- [ ] Type-safe query keys
  - Use `const queries = { conversations: () => ['conversations'] }`
  - Prevents typos in key strings
  
- [ ] Type-safe error handling
  - `error: Error | null` (not `any`)
  - Custom error type: `interface ApiError { message: string; code: string }`

**Success Criteria:**
- ✅ Zero `any` types (verify with `eslint`)
- ✅ TypeScript strict mode compilation passes
- ✅ Type inference works (hover reveals types)
- ✅ No type casting needed in components

---

### 7. Testing (Unit + E2E)

**Requirement:** Comprehensive test coverage (85%+ minimum)

#### Unit Tests (40-50% of effort)

**Location:** `packages/frontend/tests/api/`

Tests to write:
- [ ] `client.test.ts` (API client setup)
  - Test: Base URL configuration
  - Test: Correlation ID injection
  - Test: Authorization header injection
  - Test: Timeout enforcement
  - Test: Error response handling (4xx, 5xx)
  
- [ ] `schemas.test.ts` (Zod validation)
  - Test: Valid conversation response parses
  - Test: Invalid response throws validation error
  - Test: Type inference works (compile-time check)
  
- [ ] `conversations.test.ts` (useConversations hook)
  - Test: Query key generated correctly
  - Test: Successful response parsed
  - Test: Error response triggers error state
  - Test: Cache invalidation works
  - Test: Refetch works
  
- [ ] `messages.test.ts` (useMessages hook)
  - Similar to conversations
  
- [ ] `user.test.ts` (useUser hook)
  - Similar to conversations
  - Test: Disabled when not authenticated (enabled: !!authUser)

#### E2E Tests (40-50% of effort)

**Location:** `packages/frontend/tests/fe-004-api-integration.spec.ts`

Tests to write:
- [ ] API Client E2E
  - Test: Login + API call includes bearer token
  - Test: 401 response logs user out
  - Test: 403 response shows toast
  - Test: 5xx response retries then shows error
  
- [ ] useConversations E2E
  - Test: Page loads and fetches conversations (mock API)
  - Test: Conversation list displayed
  - Test: Filter changes trigger refetch
  - Test: Error state shows error message
  - Test: Retry button works
  
- [ ] useMessages E2E
  - Similar to useConversations
  
- [ ] useUser E2E
  - Test: User profile loaded on mount
  - Test: User data displayed in header
  
- [ ] Error Handling E2E
  - Test: Mock 401, verify logout
  - Test: Mock 403, verify toast
  - Test: Mock 500, verify retry

**Mock API Setup:**
- Use `msw` (Mock Service Worker) or `nock` for mocking HTTP requests
- Reference BE-001 or BE-002 test setup for patterns

**Success Criteria:**
- ✅ 85%+ code coverage (client.ts, schemas.ts, hooks/)
- ✅ All critical paths tested (success + error flows)
- ✅ E2E tests run in CI (Playwright)
- ✅ Unit tests run in CI (Vitest)
- ✅ No warnings from TanStack Query devtools

---

### 8. Integration Points

**Requirement:** Seamless integration with existing components

#### AuthContext Integration

- [ ] API client has access to tokens
  - Via `useAuthStore()` hook in interceptor
  - Or: Pass token from AuthContext to QueryClientProvider
  
- [ ] 401 triggers logout
  - Call `authStore.logout()` in error interceptor
  - AuthContext clears session
  
- [ ] Token refresh on 401
  - (Optional for MVP) Call `/auth/refresh-token` before retrying

#### Navigation Integration (FE-003)

- [ ] Navigation can use `useConversations()` for dynamic data
  - Example: Show conversation count in nav
  - Example: Show unread badge
  - (Optional) Can be added in FE-005

#### InboxPage Integration (FE-005)

- [ ] `<InboxPage>` uses `useConversations()` hook
  - Remove mock data
  - Replace with real API data
  - Keep same UI structure
  
- [ ] `<ConversationPage>` uses `useMessages()` hook
  - Remove mock data
  - Replace with real API data

#### WebSocket Integration (BE-006)

- [ ] API client fetches initial data on page load
  - `useConversations()` for inbox
  - `useMessages()` for conversation
  
- [ ] WebSocket updates invalidate cache
  - When BE-006 ready: `queryClient.invalidateQueries(['conversations'])`
  - Triggers refetch via TanStack Query

**Success Criteria:**
- ✅ API client works with AuthContext
- ✅ Components use hooks (no direct axios calls)
- ✅ Error handling integrated with toasts
- ✅ Ready for BE-006 WebSocket cache invalidation

---

### 9. Performance

**Requirement:** Optimized caching and minimal re-renders

- [ ] Cache strategy configured
  - `staleTime: 30000` (conversations fresh for 30s)
  - `staleTime: 10000` (messages fresh for 10s)
  - `gcTime: 5 * 60 * 1000` (cache kept for 5 min)
  
- [ ] Mutations invalidate appropriately
  - POST /messages → invalidate ['messages', conversationId]
  - PATCH /status → invalidate ['conversations']
  
- [ ] Prevent unnecessary refetches
  - Use `enabled` to control when queries run
  - Example: `enabled: !!conversationId` (don't fetch until ID provided)
  
- [ ] Monitor re-renders (DevTools)
  - Use React DevTools Profiler
  - Verify useConversations re-renders only on data change
  - Not re-rendering on unrelated state changes

**Success Criteria:**
- ✅ Cache working (verified via React DevTools)
- ✅ No unnecessary refetches
- ✅ No N+1 query problems
- ✅ Memory usage reasonable (no unbounded cache)

---

### 10. Documentation

**Requirement:** Clear usage examples and patterns

- [ ] Create `packages/frontend/src/api/README.md`
  - Hook usage examples (useConversations, useMessages, useUser)
  - Error handling patterns
  - Cache invalidation examples
  - Zod schema usage
  
- [ ] JSDoc comments in code
  - All exports documented
  - Parameter descriptions
  - Return type descriptions
  - Error conditions documented
  
- [ ] Update `.docs/02-api-and-data-model.md`
  - Add FE-004 section (API client patterns)
  - Add Zod schema examples
  - Add Hook usage patterns

**Success Criteria:**
- ✅ API README created with examples
- ✅ JSDoc on all public exports
- ✅ .docs updated with FE-004 section
- ✅ Example code compiles and runs

---

## 📚 Resources & References

### Architecture Documents

**Read First:**
- [week2-quick-reference.md](./week2-quick-reference.md) (5 min overview)
- [week2-product-owner-review.md](./week2-product-owner-review.md) Section 4 (FE-004 requirements)
- [week2-architect-review.md](./week2-architect-review.md) Section 1.2 (TanStack Query + Zod patterns)

**For Integration:**
- [API & Data Model](../.docs/02-api-and-data-model.md) (API endpoints + schemas)
- [AGENTS.md](./AGENTS.md) (Code constraints + architecture rules)

### Code Examples (from Architect Review)

**TanStack Query Pattern (Approved):**
```typescript
export function useConversations(filters?: ConversationFilters) {
  return useQuery({
    queryKey: ['conversations', filters],
    queryFn: () => apiClient.get('/conversations', { params: filters }),
    staleTime: 30000,           // 30 seconds
    gcTime: 5 * 60 * 1000,      // 5 minutes
  });
}
```

**Zod Pattern (Approved):**
```typescript
export const ConversationSchema = z.object({
  id: z.string().uuid(),
  channel: z.enum(['telegram', 'irc']),
  status: z.enum(['open', 'pending', 'resolved']),
  assignedUserId: z.string().uuid().nullable(),
  createdAt: z.date(),
});

export type Conversation = z.infer<typeof ConversationSchema>;
```

**Error Handling Pattern (Approved):**
```typescript
// In response interceptor
if (error.response?.status === 401) {
  const { logout } = useAuthStore.getState();
  logout();
  window.location.href = '/login';
}
```

### API Endpoints (from 02-api-and-data-model.md)

**Critical Endpoints for FE-004:**

| Method | Endpoint | Purpose | Response |
|--------|----------|---------|----------|
| GET | `/api/conversations` | Fetch inbox (paginated) | `{ data: Conversation[], pagination: {...} }` |
| GET | `/api/conversations/:id` | Fetch single conversation | `Conversation` |
| GET | `/api/conversations/:id/messages` | Fetch conversation messages | `{ data: Message[], pagination: {...} }` |
| POST | `/api/messages` | Send message | `Message` |
| PATCH | `/api/conversations/:id/status` | Update conversation status | `Conversation` |
| GET | `/api/auth/me` | Get current user | `User` |

**For Error Testing:**
| Method | Endpoint | Purpose | Response |
|--------|----------|---------|----------|
| POST | `/api/auth/refresh-token` (invalid) | Trigger 401 | 401 Unauthorized |
| PATCH | `/api/conversations/:id/assign` (no permission) | Trigger 403 | 403 Forbidden |
| GET | `/api/conversations/error` | Trigger 500 | 500 Server Error |

### Frontend Project Structure

**Current:**
```
packages/frontend/src/
├── api/                       (NEW - FE-004)
│   ├── client.ts              - Axios instance + interceptors
│   ├── endpoints.ts           - Endpoint definitions
│   ├── schemas.ts             - Zod response schemas
│   └── README.md              - API client documentation
├── hooks/                     (NEW - FE-004)
│   ├── queries/
│   │   ├── conversations.ts   - useConversations hook
│   │   ├── messages.ts        - useMessages hook
│   │   └── user.ts            - useUser hook
│   └── mutations/             (for FE-005+)
├── lib/
│   ├── query-client.ts        - QueryClient setup (NEW)
│   └── navigation.ts          - (existing)
├── stores/
│   └── auth.store.ts          - AuthContext (FE-001)
├── components/
│   └── Navigation.tsx         - (FE-003, uses roles)
├── pages/
│   ├── LoginPage.tsx          - (FE-002)
│   ├── InboxPage.tsx          - (FE-005, needs useConversations)
│   └── ConversationPage.tsx   - (existing, needs useMessages)
└── types/
    └── api.ts                 - API types + interfaces
```

### Dependencies (Already Installed)

- ✅ `@tanstack/react-query` - Data fetching + caching
- ✅ `axios` - HTTP client
- ✅ `zod` - Schema validation
- ✅ `zustand` - State management (AuthContext)
- ✅ `@better-auth/react` - Auth client

**If Missing:** `pnpm --filter @yacc/frontend add @tanstack/react-query zod`

### Testing Setup

**Test Files:**
- Jest → Vitest (FE already uses Vitest from BE-004)
- Playwright for E2E tests
- MSW (Mock Service Worker) for API mocking

**Reference Test Files:**
- `.../backend/src/__tests__/...` (Vitest patterns)
- `.../frontend/tests/fe-003-rbac-nav.spec.ts` (Playwright patterns)

---

## 🔍 Pre-Development Checklist

Before starting implementation:

- [ ] Read FE-004 scope (this document, first 3 sections)
- [ ] Read Acceptance Criteria (section 2 above)
- [ ] Review code examples in week2-architect-review.md
- [ ] Verify environment variables set:
  - `VITE_API_URL=http://localhost:3000/api` (or your backend URL)
- [ ] Verify dependencies installed:
  - `npm list @tanstack/react-query axios zod`
- [ ] Create branch (already done: task/FE-004-api-integration)
- [ ] Pull latest dev (already done)
- [ ] Verify no TypeScript errors in existing code:
  - `npm run type-check` (should pass)
- [ ] Understand project structure:
  - Look at FE-001 (auth store), FE-002 (UI components), FE-003 (navigation)
- [ ] Understand TanStack Query patterns:
  - Read 10 min intro: https://tanstack.com/query/latest
- [ ] Understand Zod patterns:
  - Read 5 min intro: https://zod.dev/

---

## 🎯 Development Approach (Recommended)

**Phase 1: Setup (1-2 hours)**
1. Create folder structure (api/, hooks/, lib/)
2. Set up QueryClient in lib/query-client.ts
3. Create API client in api/client.ts (basic structure, no interceptors yet)
4. Verify imports work, no TS errors

**Phase 2: Schemas & Validation (1-2 hours)**
1. Create all Zod schemas in api/schemas.ts
2. Extract types from schemas
3. Create api/endpoints.ts (hardcoded URLs)
4. Test: Verify schemas with sample data

**Phase 3: Hooks (3-4 hours)**
1. Implement useConversations hook
2. Implement useMessages hook
3. Implement useUser hook
4. Test each hook in isolation

**Phase 4: Error Handling & Interceptors (1-2 hours)**
1. Add request interceptor (correlation ID + auth headers)
2. Add response interceptor (error handling)
3. Test error scenarios (401, 403, 5xx)

**Phase 5: Testing (2-3 hours)**
1. Write unit tests for client.ts
2. Write tests for schemas
3. Write tests for hooks
4. Write E2E tests with mock API

**Phase 6: Integration (1-2 hours)**
1. Wrap app with QueryClientProvider
2. Verify AuthContext integration
3. Test with real backend (if running)
4. Handle edge cases (loading states, errors)

**Phase 7: Documentation (1 hour)**
1. Write JSDoc comments
2. Create api/README.md
3. Update .docs/02-api-and-data-model.md

---

## ✅ Definition of Done (7 Criteria)

For FE-004 to be DONE, all must be true:

1. ✅ **Functionality:** All 10 acceptance criteria groups met
   - [ ] API client setup complete
   - [ ] TanStack Query configured
   - [ ] Zod schemas defined
   - [ ] 3 hooks implemented (conversations, messages, user)
   - [ ] Error handling for 401/403/5xx
   - [ ] TypeScript types complete (zero `any`)
   - [ ] Testing suite complete (85%+ coverage)
   - [ ] Integration verified (with AuthContext)
   - [ ] Performance optimized (cache strategy)
   - [ ] Documentation complete

2. ✅ **Testing:** 85%+ code coverage minimum
   - [ ] Unit tests pass (Vitest)
   - [ ] E2E tests pass (Playwright)
   - [ ] No test warnings or errors
   - [ ] Coverage report generated (85%+)

3. ✅ **Code Quality:**
   - [ ] TypeScript strict mode: `npm run type-check` passes
   - [ ] Linting: `npm run lint` passes
   - [ ] No `any` types
   - [ ] No console warnings/errors
   - [ ] Code follows project standards (AGENTS.md)

4. ✅ **Documentation:**
   - [ ] api/README.md created with examples
   - [ ] JSDoc comments on all exports
   - [ ] .docs/02-api-and-data-model.md updated
   - [ ] Commit message clear + descriptive

5. ✅ **Git Workflow:**
   - [ ] Branch: task/FE-004-api-integration (already created)
   - [ ] All changes in feature branch (no direct dev commits)
   - [ ] Commits are logical + well-messaged
   - [ ] Ready for squash merge to dev

6. ✅ **Deployment Readiness:**
   - [ ] No environment-specific hacks
   - [ ] Uses VITE_API_URL from .env
   - [ ] Works with backend in dev + test + prod
   - [ ] No hardcoded tokens/secrets

7. ✅ **Architect Review:**
   - [ ] Passes architecture compliance check (see AGENTS.md)
   - [ ] Aligns with week2-architect-review.md patterns
   - [ ] No ADR violations
   - [ ] Ready for code review (Copilot or human)

---

## 📞 Support & Questions

### If You Get Stuck:

1. **Architecture Question?** 
   - Check week2-architect-review.md Section 1.2 (TanStack Query + Zod)
   - Check code examples (TanStack Query Pattern, Zod Pattern above)

2. **API Endpoint Question?**
   - Check .docs/02-api-and-data-model.md (Section 4: Endpoints)
   - Check backend implementation (if available)

3. **Testing Question?**
   - Check FE-001/FE-002/FE-003 test examples
   - Reference week2-product-owner-review.md Section 7 (testing strategy)

4. **Type Safety Question?**
   - Check AGENTS.md (Code Architecture Constraints)
   - No `any` types allowed - use proper generics
   - Example: `useQuery<Conversation[]>(...)`

5. **Integration Question?**
   - Check FE-003 for AuthContext usage pattern
   - Check section "Integration Points" above

### Escalate To Architect If:

- [ ] Architectural change needed (not in week2 docs)
- [ ] Significant scope change or blocker discovered
- [ ] Technical debt or workaround needed
- [ ] Multiple design options and need guidance

---

## 📊 Success Metrics

By end of FE-004 (target: 2026-01-28):

| Metric | Target | Verify |
|--------|--------|--------|
| Feature Complete | 100% (10 AC groups) | Checklist above |
| Code Coverage | 85%+ | `npm run test:coverage` |
| TypeScript | 0 errors | `npm run type-check` |
| Linting | 0 errors | `npm run lint` |
| Tests | 100% passing | `npm run test` |
| E2E Tests | 100% passing | `npm run test:e2e` |
| Time Spent | 10-12 hours | Track daily |
| Git Hygiene | Clean commits | 1 squash merge to dev |

---

## 🚀 Next Steps (After FE-004)

1. **Merge FE-004 to dev**
   - Create PR (squash merge recommended)
   - Request architect review
   - Merge when approved

2. **Unblock BE-006 + FE-005**
   - FE-004 API client ready for WebSocket integration
   - FE-004 hooks ready for InboxPage display component
   - Be-006 can start WebSocket infrastructure

3. **Week 2 Timeline Continues**
   - Day 3-4: FE-004 complete ✅
   - Day 4-5: FE-005 (Inbox Display) + BE-006 (WebSocket)
   - Day 5-6: BE-007 (Message Routing)
   - Day 6-8: QA-001 + QA-002

---

**Handoff Complete:** 2026-01-26  
**Developer Assigned:** [TBD]  
**Start Date:** 2026-01-27 (Day 3 of Week 2)  
**Target Completion:** 2026-01-28 (Day 4 of Week 2)  
**Estimated Hours:** 10-12  
**Architect Approval:** Required before merge
