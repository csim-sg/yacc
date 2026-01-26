# ✅ DEVELOPER READINESS CHECKLIST: FE-001

**Status:** 🛑 **BLOCKED** — Awaiting architect decisions + backend fixes  
**Task:** FE-001 Frontend Auth Integration  
**Developer:** [To be assigned]  
**Date:** 2026-01-26  

---

## 📋 BEFORE YOU START: Blocker Clearance List

### ⛔ BLOCKER #1: Backend Architecture Compliance
**Status:** 🔴 **NOT CLEARED**

**What's Wrong:**
- Backend uses `@Req() req: any` (violates your "No `any` types" constraint)
- 3 instances in `simple-auth.controller.ts` (lines 42, 103, 156)

**Who Fixes It:** Backend Developer  
**What They Must Do:**
- Change `@Req() req: any` → `@Req() req: AuthRequest`
- Define `AuthRequest` interface extending Express Request
- Re-run: `pnpm --filter @yacc/backend test` (71 tests must still pass)

**When It's Cleared:**
- [ ] Backend developer confirms fix
- [ ] All 71 tests passing
- [ ] No TypeScript errors

**Your Role:** WAIT for this to complete before starting

---

### ⛔ BLOCKER #2: Token Expiry Format Standardization
**Status:** 🔴 **NOT CLEARED**

**What's Wrong:**
- Backend generates token `exp` in milliseconds (non-standard)
- Frontend code expects seconds (JWT standard)
- Result: **Token never expires in frontend** (critical bug)

**Who Fixes It:** Architect + Backend Developer  
**Decision Required:** 
- [ ] **Option A (RECOMMENDED):** Use JWT standard (seconds)
  - Architect approves ADR-006
  - Backend changes `exp: Math.floor(Date.now() / 1000) + ...`
  - Frontend logic: `Date.now() >= exp * 1000`
- [ ] **Option B:** Keep milliseconds, document non-standard format
  - Not recommended (breaks JWT assumptions)

**When It's Cleared:**
- [ ] Architect approves approach (ADR-006)
- [ ] Backend implements change
- [ ] Token test added: `test('token expiry detection works correctly')`
- [ ] All tests passing

**Your Role:** WAIT for this to complete + document which format you use

---

### ⛔ BLOCKER #3: Token Refresh Strategy Decision
**Status:** 🔴 **NOT CLEARED**

**What's Wrong:**
- Handoff documents assume refresh endpoint exists
- Backend has NO `/api/auth/refresh` endpoint
- Your Subtask 4 implementation will be non-functional

**Who Decides:** Architect  
**Who Implements:** Backend Developer (if chosen)  
**Decision Required:**
- [ ] **Option A (RECOMMENDED):** Add POST `/api/simple-auth/refresh` endpoint
  - Takes 2-3 hours
  - Returns: `{ token: string }`
  - Validates existing session, returns new token
  - Handoff pattern will work as-is
- [ ] **Option B:** Remove refresh, redirect to login on 401
  - Takes 1 hour to update docs
  - Handoff pattern must be rewritten
  - Simpler but worse UX

**When It's Cleared:**
- [ ] Architect decision documented (ADR-006)
- [ ] If Option A: endpoint implemented + tested
- [ ] If Option B: handoff docs updated + developer briefed
- [ ] PR merged to dev

**Your Role:** WAIT for decision, then adjust your implementation approach

---

## 🔧 SETUP CHECKLIST (Can Do In Parallel With Blockers)

### Setup Step 1: Create Missing Folders
**Status:** ⚠️ Can do anytime, needed for Subtask 5-6

```bash
mkdir -p packages/frontend/src/contexts
mkdir -p packages/frontend/src/components
```

**Verify:**
```bash
ls -la packages/frontend/src/ | grep -E "(contexts|components)"
# Should show both folders exist
```

**When Complete:**
- [ ] Both folders exist and are empty

---

### Setup Step 2: Fix api-client.ts `any` Type
**Status:** ⚠️ Can do anytime, quick fix

**File:** `packages/frontend/src/lib/api-client.ts` line 6

**Current Code:**
```typescript
const API_BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL || 'http://localhost:3000/api';
```

**Required Fix:**
```typescript
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';
```

**Why:** Violates "No `any` types" constraint. Vite provides native types for `import.meta.env`.

**Verify:**
```bash
cd packages/frontend
pnpm lint
# No errors related to import.meta
```

**When Complete:**
- [ ] api-client.ts line 6 updated (no `as any`)
- [ ] `pnpm --filter @yacc/frontend lint` passes

---

### Setup Step 3: Verify Development Environment
**Status:** ℹ️ Check this is done

**Prerequisites:**
```bash
# Check Node version
node --version  # Should be v18+

# Check pnpm version
pnpm --version  # Should be v9+

# Check docker
docker --version  # Needed for local PostgreSQL/Redis

# Check backend is running (in separate terminal)
pnpm --filter @yacc/backend dev
# Should see: "Listening on port 3000"
```

**When Complete:**
- [ ] Node v18+ installed
- [ ] pnpm v9+ installed
- [ ] Docker installed
- [ ] Backend server running on port 3000
- [ ] Frontend can start on port 5173

---

## ✅ ARCHITECTURE CONSTRAINTS REMINDER

**Read This Section Carefully — These Are Non-Negotiable:**

### Rule 1: No `any` Types
❌ **FORBIDDEN:**
```typescript
const handler = (req: any) => { ... }
const data: any = response.body
```

✅ **REQUIRED:**
```typescript
interface AuthRequest extends Request {
  auth?: { user: User; session: Session };
}
const handler = (req: AuthRequest) => { ... }
const data: LoginResponse = response.body
```

### Rule 2: Flat Folder Structure
❌ **FORBIDDEN:**
```
src/auth/
  ├── services/
  ├── interceptors/
  └── context/
```

✅ **REQUIRED:**
```
src/
  ├── services/        (all services flat here)
  ├── lib/             (all lib files flat here)
  ├── contexts/        (all contexts flat here)
  ├── components/      (all components flat here)
  └── stores/          (all stores flat here)
```

### Rule 3: One Definition Per File
❌ **FORBIDDEN:**
```typescript
// src/services/auth.service.ts
export const login = () => { ... }
export const logout = () => { ... }
export const refresh = () => { ... }  // 3 functions in 1 file ❌
```

✅ **REQUIRED:**
```typescript
// src/services/auth-login.service.ts
export const login = () => { ... }

// src/services/auth-logout.service.ts
export const logout = () => { ... }

// src/services/auth-refresh.service.ts
export const refresh = () => { ... }
```

### Rule 4: No Barrel Exports
❌ **FORBIDDEN:**
```typescript
// src/services/index.ts
export * from './auth.service'
export * from './user.service'
```

✅ **REQUIRED:**
```typescript
// Direct imports from files
import { login } from '../services/auth.service'
import { getUser } from '../services/user.service'
```

---

## 📋 THE 8 SUBTASKS (Waiting For Blockers)

### Once All Blockers Cleared, You'll Implement (In Order):

| # | Subtask | Time | Status |
|---|---------|------|--------|
| 1 | Review backend controller | 5 min | 🟡 WAITING |
| 2 | Enhance token storage | 1-2 h | 🟡 WAITING (blocked by BLOCKER #2) |
| 3 | Add interceptors | 2-3 h | 🟡 WAITING |
| 4 | Token refresh on 401 | 1-2 h | 🟡 WAITING (blocked by BLOCKER #3) |
| 5 | Auth Context + useAuth | 2-3 h | 🟡 WAITING |
| 6 | Protected Route wrapper | 1-2 h | 🟡 WAITING |
| 7 | Unit tests (80%+ coverage) | 2-3 h | 🟡 WAITING |
| 8 | Manual testing + PR | 1-2 h | 🟡 WAITING |

**Total Time:** 10-12 hours  
**Can Start When:** All 3 blockers cleared + setup complete

---

## 🎯 ACCEPTANCE CRITERIA (Your Definition of Done)

**12 Items You Must Complete (From Product Owner):**

- [ ] **AC1:** JWT token automatically extracted from `Set-Auth-Token` header on login
- [ ] **AC2:** Token stored in localStorage with automatic expiry detection
- [ ] **AC3:** Request interceptor adds `Authorization: Bearer ${token}` header to all requests
- [ ] **AC4a:** Response interceptor handles 401 (Unauthorized) with retry or redirect
- [ ] **AC4b:** Response interceptor handles 403 (Forbidden) with permission message
- [ ] **AC4c:** Response interceptor handles 500+ (Server Error) with error message
- [ ] **AC5:** Token refresh endpoint called automatically on 401 (or redirect to login per ADR-006)
- [ ] **AC6:** Auth Context provides `useAuth()` hook with user, isAuthenticated, isLoading, error
- [ ] **AC7:** Protected Route wrapper redirects to login if not authenticated
- [ ] **AC8:** Unit tests cover all auth flows (80%+ code coverage minimum)
- [ ] **AC9:** Manual testing completed (login, logout, token refresh, errors)
- [ ] **AC10-12:** No breaking changes, strict TypeScript passes, PR has clear docs

**You're Done When:** All 12 items are checked ✅

---

## 🧪 TESTING CHECKLIST (You Must Have This Passing)

**Before Creating PR, Run:**

```bash
# Terminal 1: Start backend
pnpm --filter @yacc/backend dev

# Terminal 2: Start frontend
pnpm --filter @yacc/frontend dev

# Terminal 3: Run tests
pnpm --filter @yacc/frontend test                 # All pass?
pnpm --filter @yacc/frontend test --coverage      # 80%+?
pnpm --filter @yacc/frontend lint                 # No errors?

# Manual testing (in browser at http://localhost:5173)
# 1. Go to login page
# 2. Enter test credentials
# 3. See success message + redirected to dashboard
# 4. See Authorization header sent in requests (DevTools)
# 5. Click logout
# 6. See token cleared + redirected to login
```

**Before PR:**
- [ ] All unit tests passing (25+ tests expected)
- [ ] Code coverage 80%+
- [ ] No TypeScript errors (`pnpm lint` passes)
- [ ] Manual login/logout flow works
- [ ] Token stored in localStorage
- [ ] Authorization header sent in requests
- [ ] Zero breaking changes to existing code

---

## 📤 PR REQUIREMENTS

**When You're Done, Create PR With:**

**Title:** `feat(FE-001): Implement Frontend Auth Integration`

**Body Template:**
```markdown
## Summary
Implements comprehensive frontend authentication integration with BetterAuth backend, including:
- JWT token management with automatic refresh on 401
- Request/response interceptors (401/403/500 handlers)
- Auth Context + useAuth hook for React components
- Protected Route wrapper for role-based access
- Comprehensive unit tests (80%+ coverage)

## Changes
- Enhanced `api-client.ts` with interceptors and token refresh
- Created `contexts/AuthContext.tsx` with AuthProvider and useAuth hook
- Created `components/ProtectedRoute.tsx` for route protection
- Added 25+ unit tests with 80%+ code coverage

## Testing
- ✅ All tests passing (71 backend + 25 frontend = 96 total)
- ✅ Code coverage: 82% (exceeds 80% target)
- ✅ Manual E2E testing complete:
  - Login flow verified
  - Logout flow verified  
  - Token refresh on 401 verified
  - Error handling verified (401, 403, 500)

## Architecture
- ✅ No `any` types (strict TypeScript)
- ✅ Flat folder structure maintained
- ✅ One definition per file enforced
- ✅ All constraints met (see AGENTS.md)

## Related
- Closes #35
- Depends on: BE-003 (complete), BE-027 (complete)

## Blockers Addressed
- [x] BLOCKER #1: Backend `any` types fixed (ADR-xxx)
- [x] BLOCKER #2: Token expiry format standardized (ADR-006)
- [x] BLOCKER #3: Refresh strategy implemented (ADR-006)
```

**Required Before Merging:**
- [ ] All tests passing
- [ ] 80%+ code coverage
- [ ] No TypeScript errors
- [ ] No `any` types
- [ ] Architect approval (code review)
- [ ] References to blockers/ADRs included

---

## 🚨 BLOCKER STATUS DASHBOARD

**Check This Before Starting — If Any Red, STOP and Wait:**

| Blocker | Status | Owner | ETA | Action |
|---------|--------|-------|-----|--------|
| Backend `any` types (BLOCKER #1) | 🔴 NOT CLEARED | Backend Dev | Today | Monitor |
| Token expiry format (BLOCKER #2) | 🔴 NOT CLEARED | Architect | Today | Monitor |
| Refresh strategy (BLOCKER #3) | 🔴 NOT CLEARED | Architect | Today | Monitor |
| Missing folders (Setup #1) | 🟡 READY | You | Now | Do it |
| api-client.ts `any` (Setup #2) | 🟡 READY | You | Now | Do it |
| Dev environment (Setup #3) | 🟡 READY | You | Now | Verify |

**Decision Point:**
- [ ] **IF any blocker is 🔴 RED:** Do setup tasks, then wait for blockers to clear
- [ ] **IF all blockers are 🟢 GREEN:** Start Subtask 1 immediately

---

## 📞 GET HELP

**Stuck or Questions?**

1. **Architecture question?** → Contact Architect (review AGENTS.md first)
2. **Backend unclear?** → Review `packages/backend/src/controllers/simple-auth.controller.ts`
3. **Type error?** → Check `.docs/AGENTS.md` - Architecture Constraints section
4. **Test help?** → Review `.docs/SESSION-HANDOFF-FE001-START.md` - Subtask 7 examples
5. **Blocker status?** → Check this checklist section "Blocker Status Dashboard"

**Escalation Path:**
1. Check docs (`.docs/SESSION-HANDOFF-FE001-START.md` has detailed answers)
2. Review code examples in handoff
3. Ask Product Owner or Architect

---

## 🎓 LAST MINUTE TIPS

1. **Start simple:** Get Subtask 1-2 working first before moving to complex interceptors
2. **Test as you go:** Don't implement all 8 tasks then test at end
3. **Mock externals:** In tests, mock fetch API and localStorage (don't use real ones)
4. **TypeScript first:** Let the types guide your implementation
5. **Read existing code:** auth.service.ts and api-client.ts have good patterns to follow

---

## 🟢 READY TO START?

**Checklist Before You Begin:**

- [ ] All 3 blockers are cleared (status = 🟢 GREEN)
- [ ] Setup tasks completed:
  - [ ] Folders created (contexts/, components/)
  - [ ] api-client.ts `any` type fixed
  - [ ] Development environment verified
- [ ] You've read:
  - [ ] QUICK-START-FE001.md (5 min)
  - [ ] SESSION-HANDOFF-FE001-START.md (30 min)
  - [ ] Architecture constraints above (5 min)
- [ ] Backend is running: `pnpm --filter @yacc/backend dev` ✅
- [ ] You understand the 8 subtasks and timeline (10-12 hours)
- [ ] You know where to get help (see section above)

**Status:** ❌ **NOT READY YET** (3 blockers pending)

**When Blocked Gets To 🟢 GREEN:**
1. Check all items above are ✅ done
2. Create branch: `git checkout -b task/FE-001-auth-integration`
3. Start Subtask 1: Review backend controller

---

**Last Updated:** 2026-01-26  
**Status:** BLOCKED - Awaiting blocker clearance  
**Next Review:** When blockers cleared (target: same day)

**You got this! 🚀 Just waiting for architecture decisions to be made.**
