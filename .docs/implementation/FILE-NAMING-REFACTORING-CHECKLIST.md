# File Naming Refactoring Checklist

**Status**: READY TO EXECUTE  
**Start Date**: To be scheduled  
**Owner**: Backend Lead (Phase 2), Frontend Lead (Phase 3), QA Lead (Phase 5)  

---

## Phase 1: Setup & Enforcement (Week 1)

**Owner**: Architect  
**Duration**: 1 day  
**Status**: ⏳ PENDING

### Tasks

- [ ] Review ADR-011 approval from all leads
- [ ] Update `eslint.config.js` to enforce camelCase only
  ```javascript
  'unicorn/filename-case': [
    'error',
    {
      cases: {
        camelCase: true,
        kebabCase: false,
        pascalCase: false,
      },
      ignore: [
        'vite.config.ts',
        'vitest.config.ts',
        'playwright.config.ts',
        'drizzle.config.ts',
        'eslint.config.js',
      ],
    },
  ],
  ```
- [ ] Run `pnpm lint` to verify no errors
- [ ] Create PR for Phase 1
- [ ] Merge to `dev` branch
- [ ] Announce to team that new files must follow camelCase

### Verification
```bash
# Run this after changes
pnpm lint
# Should show 0 errors in new config (existing violations not yet broken)
```

---

## Phase 2: Backend Refactoring (Week 2)

**Owner**: Backend Developer  
**Duration**: 2-3 hours  
**Files to Rename**: 5 files  

### Backend Files to Refactor

#### 1. BaseConnector.ts → baseConnector.ts

**Location**: `packages/backend/src/connectors/base/BaseConnector.ts`

- [ ] Rename file using IDE refactoring (right-click → Rename Symbol)
- [ ] Verify imports auto-updated in:
  - [ ] `src/connectors/base/ConnectorFactory.ts` (or `connectorFactory.ts`)
  - [ ] Any test files importing BaseConnector
- [ ] Run `pnpm --filter @yacc/backend lint` to verify no errors

**Before**:
```typescript
// File: BaseConnector.ts
export class BaseConnector { }
```

**After**:
```typescript
// File: baseConnector.ts
export class BaseConnector { }
```

#### 2. ConnectorFactory.ts → connectorFactory.ts

**Location**: `packages/backend/src/connectors/base/ConnectorFactory.ts`

- [ ] Rename file using IDE refactoring
- [ ] Verify imports auto-updated in:
  - [ ] Any files importing ConnectorFactory
  - [ ] Test files
- [ ] Verify it no longer imports from `BaseConnector.ts` (should be `baseConnector.ts`)
- [ ] Run `pnpm --filter @yacc/backend lint`

#### 3. MessageStatusTracker.ts → messageStatusTracker.ts

**Location**: `packages/backend/src/services/MessageStatusTracker.ts`

- [ ] Rename file using IDE refactoring
- [ ] Verify imports updated in:
  - [ ] `src/index.ts` or any re-exports
  - [ ] Any services that import it
  - [ ] Test files
- [ ] Run `pnpm --filter @yacc/backend lint`

#### 4. WSConstants.ts → wsConstants.ts

**Location**: `packages/backend/src/websockets/WSConstants.ts`

- [ ] Rename file using IDE refactoring
- [ ] Verify imports updated in:
  - [ ] WebSocket gateway/handler files
  - [ ] Any constants consumers
- [ ] Run `pnpm --filter @yacc/backend lint`

#### 5. Verify messageRetryWorker.ts (Already correct)

**Location**: `packages/backend/src/workers/messageRetryWorker.ts`

- [ ] ✅ Already uses camelCase - No action needed
- [ ] Verify it's correctly exported and imported

### Backend PR Checklist

- [ ] All 5 file renames completed
- [ ] All imports updated (IDE should auto-update)
- [ ] Run full lint: `pnpm --filter @yacc/backend lint` - ✅ 0 errors
- [ ] Run tests: `pnpm --filter @yacc/backend test` - ✅ All pass
- [ ] Create PR with title: `refactor(backend): standardize file naming to camelCase`
- [ ] Link ADR-011 in PR description
- [ ] Request architect review
- [ ] Address any feedback
- [ ] Merge to `dev` branch
- [ ] Update this checklist: Mark Phase 2 as COMPLETE

---

## Phase 3: Frontend Refactoring (Week 3-4)

**Owner**: Frontend Developer  
**Duration**: 4-6 hours  
**Files to Rename**: 17 files  

### Frontend Files to Refactor

#### Components (5 files)

**Directory**: `packages/frontend/src/components/`

- [ ] **Header.tsx → header.tsx**
  - Rename using IDE refactoring
  - Verify imports updated in: `App.tsx`, tests
  - Update: `export function Header() { }`

- [ ] **LoginForm.tsx → loginForm.tsx**
  - Rename using IDE refactoring
  - Verify imports updated in: pages, tests
  - Update: `export function LoginForm() { }`

- [ ] **Navigation.tsx → navigation.tsx**
  - Rename using IDE refactoring
  - Verify imports updated in: `app.tsx`, layouts
  - Update: `export function Navigation() { }`

- [ ] **ProtectedRoute.tsx → protectedRoute.tsx**
  - Rename using IDE refactoring
  - Verify imports updated in: routing files, tests
  - Update: `export function ProtectedRoute() { }`

#### Contexts (1 file)

**Directory**: `packages/frontend/src/contexts/`

- [ ] **AuthContext.tsx → authContext.tsx**
  - Rename using IDE refactoring
  - Verify imports updated in: App, ProtectedRoute, tests
  - Update: `export const AuthContext = createContext(...)`

#### Pages (4 files)

**Directory**: `packages/frontend/src/pages/`

- [ ] **InboxPage.tsx → inboxPage.tsx**
  - Rename using IDE refactoring
  - Verify imports in: router configuration
  - Update: `export function InboxPage() { }`

- [ ] **ConversationPage.tsx → conversationPage.tsx**
  - Rename using IDE refactoring
  - Verify imports in: router configuration
  - Update: `export function ConversationPage() { }`

- [ ] **LoginPage.tsx → loginPage.tsx**
  - Rename using IDE refactoring
  - Verify imports in: router configuration
  - Update: `export function LoginPage() { }`

- [ ] **RegisterPage.tsx → registerPage.tsx**
  - Rename using IDE refactoring
  - Verify imports in: router configuration
  - Update: `export function RegisterPage() { }`

#### Root Component (1 file)

**Directory**: `packages/frontend/src/`

- [ ] **App.tsx → app.tsx**
  - Rename using IDE refactoring
  - Verify imports in: `main.tsx`
  - Update: `export function App() { }`

#### Update Main Entry (1 file)

**Directory**: `packages/frontend/src/`

- [ ] **main.tsx** (already correct, just verify import)
  ```typescript
  // Before: import App from './App'
  // After: import { App } from './app'
  ```

### Frontend Router/Config Updates

**If router is configured elsewhere:**

- [ ] Update router configuration file (e.g., `routing.ts` or inside `app.tsx`)
  ```typescript
  // Before
  import InboxPage from './pages/InboxPage';
  
  // After
  import { InboxPage } from './pages/inboxPage';
  ```

### Frontend Test Files

**Update all test file imports:**

- [ ] `tests/**/*.spec.ts` - Update import paths
  ```bash
  # Find all imports of renamed components
  grep -r "import.*from.*'.*\(Header\|LoginForm\|Navigation\|InboxPage\)'" tests/
  
  # Update them
  # Example: import { Header } from '../src/components/header';
  ```

- [ ] Run tests: `pnpm --filter @yacc/frontend test` - Verify all pass

### Frontend PR Checklist

- [ ] All 17 file renames completed
- [ ] All imports updated (use IDE refactoring)
- [ ] Router configuration updated
- [ ] Test file imports updated
- [ ] Run lint: `pnpm --filter @yacc/frontend lint` - ✅ 0 errors
- [ ] Run tests: `pnpm --filter @yacc/frontend test` - ✅ All pass
- [ ] Run build: `pnpm --filter @yacc/frontend build` - ✅ Succeeds
- [ ] Create PR with title: `refactor(frontend): standardize file naming to camelCase`
- [ ] Link ADR-011 in PR description
- [ ] Request architect review
- [ ] Address any feedback
- [ ] Merge to `dev` branch
- [ ] Update this checklist: Mark Phase 3 as COMPLETE

---

## Phase 4: Common Package Refactoring (Week 4)

**Owner**: Shared (Backend/Frontend coordination)  
**Duration**: 2-3 hours  
**Scope**: TBD based on audit  

### Audit Common Package First

Run this to see current state:

```bash
find packages/common/src -name "*.ts" -o -name "*.tsx" | sort
```

### Categories to Review

- [ ] **Constants**: Verify all `constants/*.ts` files use camelCase
- [ ] **Schemas**: Verify all `schemas/*.ts` files use camelCase
- [ ] **Types**: Verify all `types/*.ts` files use camelCase
- [ ] **Requests**: Verify all `requests/*.ts` files use camelCase
- [ ] **Responses**: Verify all `responses/*.ts` files use camelCase

### Refactoring Steps

For each file that needs renaming:

1. [ ] Rename using IDE refactoring
2. [ ] Update all imports in:
   - [ ] `packages/common/src/index.ts` (if exported)
   - [ ] `packages/backend/**/*.ts` (if imported)
   - [ ] `packages/frontend/**/*.ts` (if imported)
3. [ ] Run lint: `pnpm lint`
4. [ ] Run tests: `pnpm test`

### Common PR Checklist

- [ ] All identified files renamed
- [ ] All imports updated across monorepo
- [ ] Run lint: `pnpm lint` - ✅ 0 errors
- [ ] Run tests: `pnpm test` - ✅ All pass
- [ ] Create PR with title: `refactor(common): standardize file naming to camelCase`
- [ ] Link ADR-011 in PR description
- [ ] Merge to `dev` branch
- [ ] Update this checklist: Mark Phase 4 as COMPLETE

---

## Phase 5: Test Files Standardization (Ongoing)

**Owner**: QA Lead  
**Duration**: 1-2 hours  
**Scope**: All test files across packages  

### Backend Test Files

**Directory**: `packages/backend/tests/`

- [ ] Audit all `.test.ts` files
- [ ] Rename any that don't follow camelCase
  - Example: `AuthService.test.ts` → `authService.test.ts`
- [ ] Update test configuration if needed
- [ ] Run: `pnpm --filter @yacc/backend test`

### Frontend Test Files

**Directory**: `packages/frontend/tests/`

- [ ] Audit all `.spec.ts` files
- [ ] Rename any that don't follow camelCase
- [ ] Update playwright config if needed
- [ ] Run: `pnpm --filter @yacc/frontend test`

### Test PR Checklist

- [ ] All test files renamed to camelCase
- [ ] Test configuration updated
- [ ] All tests pass
- [ ] Create PR with title: `refactor(tests): standardize test file naming to camelCase`
- [ ] Merge to `dev` branch
- [ ] Update this checklist: Mark Phase 5 as COMPLETE

---

## Post-Refactoring Tasks

### Documentation Update

- [ ] Update any `.docs/` files that reference renamed files
- [ ] Update architecture diagrams (Mermaid) if they reference file names
- [ ] Update README files with new file paths

### Governance Log

- [ ] Create entry in `GOV-011-file-naming-standardization.md`
  ```markdown
  ## Phase 2: Backend Refactoring - COMPLETED
  - Date: [Date]
  - Files renamed: 5
  - Imports updated: X
  - Tests passed: ✅
  
  ## Phase 3: Frontend Refactoring - COMPLETED
  - Date: [Date]
  - Files renamed: 17
  - Imports updated: X
  - Tests passed: ✅
  
  ## Phase 4: Common Package - COMPLETED
  - Date: [Date]
  - Files renamed: X
  - Imports updated: X
  - Tests passed: ✅
  
  ## Phase 5: Test Files - COMPLETED
  - Date: [Date]
  - Files renamed: X
  - All tests pass: ✅
  ```

### Team Communication

- [ ] Announce completion to team
- [ ] Update project board status
- [ ] Mark ADR-011 as COMPLETED
- [ ] Archive this checklist

---

## Rollback Plan

If critical issues occur:

1. **Immediate**: Revert PR
   ```bash
   git revert <commit-hash>
   pnpm install
   pnpm test
   ```

2. **Communication**: Notify team of issue

3. **Root Cause**: Analyze what went wrong

4. **Retry**: Fix issue and try again in new PR

5. **Escalate**: If repeated issues, discuss with architect

---

## Verification Commands

Run these after each phase:

```bash
# Lint all packages
pnpm lint

# Test backend
pnpm --filter @yacc/backend test

# Test frontend
pnpm --filter @yacc/frontend test

# Build frontend
pnpm --filter @yacc/frontend build

# Full monorepo test
pnpm test

# Check for any remaining PascalCase files
find packages -name "*[A-Z]*.ts" -o -name "*[A-Z]*.tsx" | grep -v node_modules | grep -v dist
```

---

## Timeline

| Phase | Owner | Week | Duration | Status |
|-------|-------|------|----------|--------|
| **Phase 1** | Architect | Feb 3 | 1 day | ⏳ Pending |
| **Phase 2** | Backend Dev | Feb 3-7 | 2-3 hrs | ⏳ Pending |
| **Phase 3** | Frontend Dev | Feb 10-17 | 4-6 hrs | ⏳ Pending |
| **Phase 4** | Backend/Frontend | Feb 17-24 | 2-3 hrs | ⏳ Pending |
| **Phase 5** | QA Lead | Ongoing | 1-2 hrs | ⏳ Pending |

---

## Sign-Off

After all phases complete:

- [ ] Architect: ADR-011 marked COMPLETED
- [ ] All leads: Confirm no outstanding issues
- [ ] Team: All tests passing, no regressions
- [ ] Documentation: Updated and verified

---

**Created**: January 27, 2026  
**Maintained By**: Architect  
**Last Updated**: January 27, 2026
