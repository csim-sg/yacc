# ADR-011: File Naming Convention Standardization

**Date**: January 27, 2026  
**Status**: PROPOSED  
**Decision Maker**: Architect  
**Affected Areas**: All packages (backend, frontend, common)  
**Priority**: HIGH  

---

## Executive Summary

Standardize all file naming conventions across the YACC monorepo to use **camelCase exclusively** for consistency, maintainability, and to align with modern JavaScript/TypeScript conventions. This ADR outlines the rationale, scope, implementation plan, and enforcement mechanism.

---

## Current State (Problem)

The codebase currently has **inconsistent file naming conventions**:

### Backend (`packages/backend/src/`)
- ✅ **camelCase**: Most files (30+)
  - Controllers: `auth.controller.ts`, `conversations.controller.ts`
  - Services: `auth.service.ts`, `conversation.service.ts`
  - Middleware: `auth-betterauth.middleware.ts`
  - Config: `db.ts`, `redis.ts`, `email.ts`

- ⚠️ **PascalCase**: 5 files (inconsistent)
  - `src/connectors/base/BaseConnector.ts`
  - `src/connectors/base/ConnectorFactory.ts`
  - `src/services/MessageStatusTracker.ts`
  - `src/websockets/WSConstants.ts`
  - `src/workers/messageRetryWorker.ts`

### Frontend (`packages/frontend/src/`)
- ✅ **camelCase**: Mostly correct (hooks, services, utilities)
  - Hooks: `useSocket.ts`, `useMessages.ts`, `useConversations.ts`
  - Services: `auth.service.ts`, `conversations.service.ts`
  - API: `api-client.ts`, `error-handler.ts`

- ⚠️ **PascalCase**: 17 files (components and contexts)
  - Components: `App.tsx`, `LoginForm.tsx`, `Header.tsx`, `Navigation.tsx`, `ProtectedRoute.tsx`
  - Contexts: `AuthContext.tsx`
  - Pages: `InboxPage.tsx`, `ConversationPage.tsx`, `LoginPage.tsx`, `RegisterPage.tsx`

**This inconsistency creates confusion and increases cognitive load for developers.**

### Common Package (`packages/common/src/`)
- Mostly follows kebab-case for schemas and snake_case in some cases

---

## Decision

**All files across the monorepo MUST use camelCase naming convention.**

### Naming Convention Rules

| Category | Convention | Example |
|----------|-----------|---------|
| **Files** | `camelCase` | `messageStatusTracker.ts`, `authContext.tsx` |
| **Directories** | `kebab-case` OR `camelCase` | `src/connectors`, `src/middleware` (keep as-is) |
| **Classes/Interfaces** | `PascalCase` | `class AuthService {}`, `interface User {}` |
| **Constants** | `UPPER_SNAKE_CASE` | `const MAX_RETRIES = 3` |
| **Variables/Functions** | `camelCase` | `const userId = 123`, `function sendMessage() {}` |

### Key Principle

**File names should reflect the primary export they contain:**

```typescript
// ✅ CORRECT
// File: messageStatusTracker.ts
export class MessageStatusTracker { }

// File: authContext.tsx
export const AuthContext = createContext();

// File: useMessages.ts
export const useMessages = () => { };

// ❌ INCORRECT
// File: MessageStatusTracker.ts  (PascalCase)
export class MessageStatusTracker { }
```

---

## Rationale

### 1. **Alignment with JavaScript Conventions**
   - Modern JavaScript/TypeScript projects (Next.js, React, Express) use camelCase
   - Prevents confusion between file names and class/interface names
   - Reduces the need for case conversions in tooling

### 2. **Consistency Across the Team**
   - Single, uniform rule reduces decision-making burden
   - Easier onboarding for new team members
   - Reduces code review friction

### 3. **File System Compatibility**
   - Some developers use case-insensitive file systems (macOS by default)
   - PascalCase + camelCase in same repo can cause subtle Git issues
   - camelCase is safer and more portable

### 4. **Modern Tooling Support**
   - Vite, TypeScript, Jest, Vitest all work better with consistent naming
   - Import paths are more predictable
   - IDE autocomplete functions better

### 5. **ADR Precedent**
   - [ADR-005](./ADR-005-infrastructure-config-pattern.md) established "flat folder structure" principle
   - This naming convention standardization complements and reinforces that decision

---

## Implementation Plan

### Phase 1: Setup ESLint Rule (Enforce Going Forward)
**Timeline**: This sprint  
**Owner**: Backend Lead

Update `eslint.config.js` to enforce camelCase only:

```javascript
'unicorn/filename-case': [
  'error',
  {
    cases: {
      camelCase: true,  // ✅ ALLOWED
      kebabCase: false, // ❌ NOT ALLOWED
      pascalCase: false, // ❌ NOT ALLOWED
    },
  },
],
```

**Effect**: New files MUST follow camelCase. Existing violations are flagged but not breaking.

### Phase 2: Refactor Backend (PR-based)
**Timeline**: Sprint after Phase 1  
**Owner**: Backend Developer

**Files to rename** (5 files):
1. `src/connectors/base/BaseConnector.ts` → `src/connectors/base/baseConnector.ts`
2. `src/connectors/base/ConnectorFactory.ts` → `src/connectors/base/connectorFactory.ts`
3. `src/services/MessageStatusTracker.ts` → `src/services/messageStatusTracker.ts`
4. `src/websockets/WSConstants.ts` → `src/websockets/wsConstants.ts`
5. `src/workers/messageRetryWorker.ts` → `src/workers/messageRetryWorker.ts` (already correct)

**Update all import statements** in affected files.

**Create a single PR** with:
- Title: `refactor(backend): standardize file naming to camelCase`
- Include all 5 file renames + import updates
- Update this ADR status to APPROVED

### Phase 3: Refactor Frontend (PR-based)
**Timeline**: 1-2 sprints after Phase 2  
**Owner**: Frontend Developer

**Files to rename** (17 files):
1. `src/App.tsx` → `src/app.tsx`
2. `src/components/Header.tsx` → `src/components/header.tsx`
3. `src/components/LoginForm.tsx` → `src/components/loginForm.tsx`
4. `src/components/Navigation.tsx` → `src/components/navigation.tsx`
5. `src/components/ProtectedRoute.tsx` → `src/components/protectedRoute.tsx`
6. `src/contexts/AuthContext.tsx` → `src/contexts/authContext.tsx`
7. `src/pages/InboxPage.tsx` → `src/pages/inboxPage.tsx`
8. `src/pages/ConversationPage.tsx` → `src/pages/conversationPage.tsx`
9. `src/pages/LoginPage.tsx` → `src/pages/loginPage.tsx`
10. `src/pages/RegisterPage.tsx` → `src/pages/registerPage.tsx`

**Plus any new components added since this ADR.**

**Update:**
- All import statements
- Router configuration (if applicable)
- Component references in test files
- Storybook stories (if used)

**Create a single PR** with all 17 renames + updates.

### Phase 4: Refactor Common Package
**Timeline**: Parallel with Phase 3  
**Owner**: Shared (Backend/Frontend coordination)

Audit and standardize `packages/common/src/`:
- Review all schema, type, and interface file names
- Convert to camelCase where needed
- Update exports in `index.ts`

### Phase 5: Update Tests and Test Files
**Timeline**: Ongoing during Phases 2-4  
**Owner**: QA Lead

**All test files should use camelCase:**
- `src/tests/unit/services/authService.test.ts`
- `src/tests/integration/controllers/authController.test.ts`
- `tests/fe-001-login-ui.spec.ts` (already camelCase)

---

## Enforcement Mechanism

### ESLint Rule (Automated)
```javascript
// In eslint.config.js
'unicorn/filename-case': [
  'error',
  {
    cases: {
      camelCase: true,
    },
    ignore: [
      // Ignore specific patterns if needed (e.g., config files)
      'vite.config.ts',
      'vitest.config.ts',
      'playwright.config.ts',
      'drizzle.config.ts',
    ],
  },
],
```

### CI/CD Integration
- ESLint runs on all PRs (`pnpm lint`)
- PRs with filename violations are blocked
- Developers see clear error: `"File name should be in camelCase"`

### Code Review Checklist
- [ ] All new files use camelCase
- [ ] No PascalCase file names added
- [ ] Imports updated if renamed files affected

---

## Migration Impact & Risk Mitigation

### What This Affects
- **Git history**: File renames appear as deletions + additions (not ideal but acceptable)
- **Branches**: Feature branches merging after refactor may have conflicts
- **IDE configs**: May need rebuild/refresh of caches
- **Documentation**: Links in `.docs/` may reference old file paths

### Risk Mitigation
1. **Phase-based approach**: Refactor one package at a time
2. **Squash commits**: Each phase is a single commit for clarity
3. **Team communication**: Announce planned refactor dates
4. **Branch strategy**: Do refactor on `dev` branch, not on active feature branches
5. **Documentation update**: Update relevant `.docs/` files after each phase

### Backwards Compatibility
- None needed: This is internal refactoring only
- No API changes
- No dependency changes
- Frontend import paths change, but tests will catch issues

---

## Decision Criteria (Architecture Review)

✅ **Consistency**: Single, clear rule across entire codebase  
✅ **Maintainability**: Reduces cognitive load, easier to navigate  
✅ **Alignment**: Matches JavaScript/TypeScript best practices  
✅ **Tooling**: Supported by all linters and IDEs  
✅ **Team feedback**: Collected from developers (pending)  

---

## Approval Status

| Role | Status | Notes |
|------|--------|-------|
| **Architect** | ⏳ PENDING | Awaiting team review |
| **Backend Lead** | ⏳ PENDING | Confirm readiness to refactor 5 files |
| **Frontend Lead** | ⏳ PENDING | Confirm readiness to refactor 17 files |
| **QA Lead** | ⏳ PENDING | Confirm test file updates |
| **Product Owner** | ⏳ PENDING | Confirm no business impact |

---

## Next Steps

1. **Distribute this ADR** to backend, frontend, and QA leads
2. **Collect feedback** (1-2 days)
3. **Update based on feedback** (if any)
4. **Mark as APPROVED** by Architect
5. **Execute Phase 1** (Update ESLint rule)
6. **Execute Phase 2+** (Sequential refactoring)

---

## Related Documents

- [ADR-005: Infrastructure & Config Pattern](./ADR-005-infrastructure-config-pattern.md)
- [ESLint Config](../../eslint.config.js)
- [AGENTS.md](../../AGENTS.md) - Project setup & standards

---

**Document Version**: 1.0  
**Last Updated**: January 27, 2026
