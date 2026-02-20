# ADR-011: File Naming Convention Standardization (UPDATED)

**Date**: January 27, 2026  
**Last Updated**: February 20, 2026 (Session 3 - Extended to allow kebabCase)  
**Status**: Approved; Enforcement Partially Implemented (CI gating pending PR #274)  
**Decision Maker**: Architect  
**Affected Areas**: All packages (backend, frontend, common)  
**Priority**: HIGH  

---

## Executive Summary

Standardize file naming conventions across the YACC monorepo with **camelCase and kebabCase both allowed**, while respecting **React conventions**:
- **Components (.tsx)**: PascalCase (e.g., `Header.tsx`, `LoginPage.tsx`)
- **Hooks (.ts)**: camelCase with `use` prefix (e.g., `useMessages.ts`)
- **Services/Utilities (.ts)**: Both camelCase and kebabCase allowed (e.g., `authService.ts` or `auth-service.ts`)
- **Schemas/Types (.ts)**: Both camelCase and kebabCase allowed (e.g., `loginRequest.schema.ts` or `login-request.schema.ts`)

This accommodates both naming styles observed in the codebase while enforcing consistency with modern JavaScript/TypeScript and React conventions, reducing cognitive load for developers.

**Key Change (Feb 2026):** Extended from camelCase-only to allow both camelCase and kebabCase per eslint rule update (PR #273).

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

**Standardized file naming with React conventions and dual-case flexibility:**

### Naming Convention Rules (Updated Feb 2026)

| Category | Convention | Example |
|----------|-----------|---------|
| **React Components (.tsx)** | `PascalCase` (convention) | `Header.tsx`, `LoginPage.tsx`, `ProtectedRoute.tsx` |
| **React Context (.tsx)** | `PascalCase` (convention) | `AuthContext.tsx` |
| **React Hooks (.ts)** | `camelCase` with `use` prefix (convention) | `useMessages.ts`, `useSocket.ts`, `useConversations.ts` |
| **Backend Services (.ts)** | `camelCase` OR `kebabCase` | `messageStatusTracker.ts` or `message-status-tracker.ts`, `authService.ts` or `auth-service.ts` |
| **Backend Controllers (.ts)** | `camelCase` OR `kebabCase` | `auth.controller.ts` or `auth-controller.ts` |
| **Backend Middleware (.ts)** | `camelCase` OR `kebabCase` | `correlationId.middleware.ts` or `correlation-id.middleware.ts` |
| **Schemas/Types (.ts)** | `camelCase` OR `kebabCase` | `passwordReset.schema.ts` or `password-reset.schema.ts` |
| **Config Files** | Exception | `vite.config.ts`, `eslint.config.js`, `turbo.json` |
| **Classes/Interfaces** | `PascalCase` | `class MessageStatusTracker {}`, `interface User {}` |
| **Constants** | `UPPER_SNAKE_CASE` | `const MAX_RETRIES = 3` |
| **Variables/Functions** | `camelCase` | `const userId = 123`, `function sendMessage() {}` |

### Key Principle

**File names should reflect the primary export's naming style:**

```typescript
// ✅ CORRECT
// File: messageStatusTracker.ts or message-status-tracker.ts (both allowed)
export class MessageStatusTracker { }

// File: AuthContext.tsx  (React Context = PascalCase convention)
export const AuthContext = createContext();

// File: useMessages.ts  (React Hook = camelCase with use prefix convention)
export const useMessages = () => { };

// File: Header.tsx  (React Component = PascalCase convention)
export function Header() {}

// ⚠️ NOTE: In React directories (components/, pages/, contexts/), the unicorn/filename-case rule is disabled.
// PascalCase is a documented convention, not an enforced lint rule. Both these are acceptable:
// File: AuthContext.tsx ✅ (PascalCase convention)
// File: authContext.tsx ✅ (Also passes linter for these directories)
```

---

## Rationale

### 1. **Pragmatic Flexibility (Updated Feb 2026)**
   - Both camelCase and kebabCase are widely used in the codebase
   - PascalCase is a convention for React components (not lint-enforced)
   - Backend services and utilities use both styles interchangeably
   - Linter rule now permits both to match actual project patterns
   - Enforcing single case would require massive refactoring for minimal benefit

### 2. **Alignment with JavaScript Conventions**
   - Modern JavaScript/TypeScript projects use either camelCase or kebabCase
   - Prevents confusion between file names and class/interface names
   - Both are acceptable in industry standard projects

### 3. **Consistency Within Layers**
   - Frontend: PascalCase for components (React convention), camelCase for utilities
   - Backend: Both camelCase and kebabCase allowed for services/middleware/types
   - Easier onboarding for new team members (flexible, not rigid)
   - Reduces code review friction (both styles accepted)

### 4. **File System Compatibility**
   - Some developers use case-insensitive file systems (macOS by default)
   - PascalCase + camelCase + kebabCase can work on case-insensitive systems
   - Both camelCase and kebabCase are more portable than PascalCase-heavy repos

### 5. **Modern Tooling Support**
   - Vite, TypeScript, Jest, Vitest support both camelCase and kebabCase
   - Import paths work with both naming styles
   - IDE autocomplete functions equally well with both

### 6. **ADR Precedent**
   - [ADR-005](./ADR-005-infrastructure-config-pattern.md) established "flat folder structure" principle
   - This naming convention standardization complements that decision
   - Both ADRs support "keep it simple" (KISS) philosophy

---

## Implementation Plan

### Phase 1: Setup ESLint Rule (Updated Feb 2026)
**Timeline**: Complete  
**Owner**: Architecture Team

Update `eslint.config.js` to allow both camelCase and kebabCase (PR #273):

```javascript
'unicorn/filename-case': [
  'error',
  {
    cases: {
      camelCase: true,   // ✅ ALLOWED
      kebabCase: true,   // ✅ ALLOWED (Feb 2026 update)
      pascalCase: false, // ❌ NOT ALLOWED (except React components)
    },
  },
],
```

**Effect**: New files can use either camelCase or kebabCase. PascalCase only for React components/contexts. This aligns with actual project patterns without requiring widespread refactoring.

**Status**: ✅ COMPLETED in PR #273

### Phase 2: Refactor Backend (PR-based) ✅ COMPLETED
**Timeline**: Sprint after Phase 1  
**Owner**: Backend Developer

**Files renamed** (11 files total):
- Core: `BaseConnector.ts` → `baseConnector.ts`, `MessageStatusTracker.ts` → `messageStatusTracker.ts`
- Decorators: `require-permission.decorator.ts` → `requirePermission.decorator.ts`, `require-role.decorator.ts` → `requireRole.decorator.ts`
- Middleware: `auth-betterauth.middleware.ts` → `authBetterauth.middleware.ts`, `correlation-id.middleware.ts` → `correlationId.middleware.ts`, `request-logging.middleware.ts` → `requestLogging.middleware.ts`, `routing-controllers-auth.ts` → `routingControllersAuth.ts`
- Services: `password-reset.service.ts` → `passwordReset.service.ts`, `password-validation.service.ts` → `passwordValidation.service.ts`
- Types: `password-reset.schema.ts` → `passwordReset.schema.ts`

**All import statements updated** across the codebase.

**Status**: ✅ All files correctly renamed and imports fixed

### Phase 3: Refactor Frontend (PR-based) ✅ COMPLETED
**Timeline**: 1-2 sprints after Phase 2  
**Owner**: Frontend Developer

**Files kept in PascalCase** (React Component Convention):
1. `src/App.tsx` ✅ (Root component, PascalCase per React convention)
2. `src/components/Header.tsx` ✅
3. `src/components/LoginForm.tsx` ✅
4. `src/components/Navigation.tsx` ✅
5. `src/components/ProtectedRoute.tsx` ✅
6. `src/contexts/AuthContext.tsx` ✅
7. `src/pages/InboxPage.tsx` ✅
8. `src/pages/ConversationPage.tsx` ✅
9. `src/pages/LoginPage.tsx` ✅
10. `src/pages/RegisterPage.tsx` ✅

**Files renamed to camelCase** (Utilities/Services):
1. `src/lib/api-client.ts` → `src/lib/apiClient.ts` ✅
2. `src/lib/query-client.ts` → `src/lib/queryClient.ts` ✅
3. `src/api/error-handler.ts` → `src/api/errorHandler.ts` ✅
4. `src/main.tsx` import updated to reference `App` (not `app`) ✅

**All import statements updated** and verified with ESLint.

**Status**: ✅ All files correctly named per React conventions

### Phase 4: Refactor Common Package ✅ COMPLETED
**Timeline**: Parallel with Phase 3  
**Owner**: Shared (Backend/Frontend coordination)

**Files renamed** (8 files from kebab-case to camelCase):
1. `constants/routing-rules.constant.ts` → `constants/routingRules.constant.ts` ✅
2. `requests/password-reset.request.ts` → `requests/passwordReset.request.ts` ✅
3. `responses/password-reset.response.ts` → `responses/passwordReset.response.ts` ✅
4. `schemas/password-reset.schema.ts` → `schemas/passwordReset.schema.ts` ✅
5. `schemas/routing-rule.schema.ts` → `schemas/routingRule.schema.ts` ✅
6. `types/password-reset.types.ts` → `types/passwordReset.types.ts` ✅
7. `types/routing-rule-api.ts` → `types/routingRuleApi.ts` ✅
8. `types/routing-rule.ts` → `types/routingRule.ts` ✅

**All export statements and imports updated** in `index.ts` and across backend/frontend.

**Status**: ✅ All 8 files correctly renamed to camelCase

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

**Updated Feb 2026 (PR #273):** Now allows both camelCase and kebabCase:

**Root ESLint Config** (`eslint.config.js`):
```javascript
// Global rule: camelCase OR kebabCase allowed
'unicorn/filename-case': [
  'error',
  {
    cases: {
      camelCase: true,   // ✅ ALLOWED
      kebabCase: true,   // ✅ ALLOWED (Feb 2026 update)
      pascalCase: false, // ❌ NOT ALLOWED
    },
    ignore: [
      // Config files (standard exceptions)
      'vite.config.ts',
      'vitest.config.ts',
      'playwright.config.ts',
      'drizzle.config.ts',
      'eslint.config.js',
      'turbo.json',
      // React root component
      'App.tsx',
    ],
  },
],
```

**React Components/Pages/Contexts Override** (disables enforcement for PascalCase in these directories):
```javascript
// Files matching these patterns disable unicorn/filename-case rule
// allowing PascalCase per React conventions
{
  files: [
    '**/components/**/*.{tsx,ts}',
    '**/pages/**/*.{tsx,ts}',
    '**/contexts/**/*.{tsx,ts}',
  ],
  rules: {
    'unicorn/filename-case': 'off',  // ✅ PascalCase is ALLOWED here (documented convention)
  },
},
```

**Interpretation:**
- `unicorn/filename-case` is **DISABLED** (turned `off`) for `**/{components,pages,contexts}/**/*.{ts,tsx}`
- This means PascalCase is **a documented convention** in these directories, not an enforced requirement
- Outside these directories: camelCase and kebabCase are both accepted equally
- Global rule (root config) requires either camelCase or kebabCase; PascalCase outside React dirs is flagged as violation

### CI/CD Integration

**Current Status (Feb 2026):**
- Legacy `.github/workflows/lint.yml` runs ESLint on `pull_request` events targeting `main` or `develop` branches only (NOT `dev`)
- Legacy `.github/workflows/tests.yml` runs tests on `pull_request` events targeting `main` or `develop` branches only (NOT `dev`)
- **Backend/Frontend/Common PRs targeting `dev`**: Currently have no automated lint/tests; run locally until PR #274 merges
- **Once PR #274 merges**: Backend CI workflow activates for PRs targeting `dev`, enforcing changed-files lint gate

**How It Works Once PR #274 Merges:**
- New Backend CI workflow activates for PRs targeting `dev`, `develop`, or `main`
- ESLint runs on **changed files only** in backend PRs (not full baseline)
- Files with camelCase or kebabCase names: ✅ PASS
- Files with PascalCase names (outside React dirs): ❌ FAIL with unicorn/filename-case violation
- React components in `/components/`, `/pages/`, `/contexts/`: ✅ PASS with PascalCase (override is active)

### What Is Enforced vs Convention (Feb 2026 Update)

**Strictly Enforced by ESLint:**
- ✅ **Global rule** (all files outside React dirs): camelCase OR kebabCase ALLOWED (both equally accepted)
- ❌ **Global rule** (all files outside React dirs): PascalCase BLOCKED (violates `unicorn/filename-case`)

**React Directories (components/, pages/, contexts/): Rule Disabled (Convention-Based)**
- The `unicorn/filename-case` rule is **turned OFF** (`'off'`) for files matching `**/components/**/*.{tsx,ts}`, `**/pages/**/*.{tsx,ts}`, `**/contexts/**/*.{tsx,ts}`
- Result: PascalCase is **NOT enforced** but is a **documented convention** for React components
- In practice: `AuthContext.tsx` (PascalCase) and `authContext.tsx` (camelCase) both pass linting in these directories

**Documented Conventions (Guidance, Not Enforced):**
- **React Hooks** (.ts): Prefer camelCase with `use` prefix (e.g., `useMessages.ts`), but other naming passes linter
- **React Components/Pages/Contexts** (.tsx): Prefer PascalCase (e.g., `Header.tsx`, `LoginPage.tsx`, `AuthContext.tsx`), but enforcement is disabled; both PascalCase and camelCase pass linter
- **Backend Services/Middleware/Types** (.ts): Either camelCase or kebabCase acceptable; no preference enforced by linter
- **Rationale**: Allow flexibility in React directories while maintaining the core principle of preventing PascalCase in backend code (where classes should not match file names)

### Code Review Checklist
- [ ] All new files use camelCase OR kebabCase (both acceptable per ESLint rule)
- [ ] React components use PascalCase (components/, pages/, contexts/) - **convention documented, not enforced**
- [ ] No PascalCase outside React directories (global rule enforces this)
- [ ] Imports updated if renamed files affected
- [ ] ESLint passes on changed files (no filename-case violations on new code)

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
| **Architect** | ✅ APPROVED | ADR approved, all phases executed with React conventions respected. Feb 2026: Extended to allow dual camelCase/kebabCase per PR #273 |
| **Backend Developer** | ✅ COMPLETED | Phase 2: 11 files renamed, all imports updated. Feb 2026: kebabCase now allowed |
| **Frontend Developer** | ✅ COMPLETED | Phase 3: 10 files kept as PascalCase, 3 utilities renamed to camelCase |
| **Common Package Lead** | ✅ COMPLETED | Phase 4: 8 files renamed from kebab-case to camelCase. Feb 2026: kebabCase now allowed |
| **QA Lead** | ✅ COMPLETED | Phase 5: ESLint verified, no filename violations |
| **ESLint Enforcement** | ✅ ACTIVE | Phase 1: unicorn/filename-case rule allows camelCase OR kebabCase (with React override disabling rule for PascalCase in components/pages/contexts, Feb 2026 update) |
| **CI/CD Integration** | ⏳ PENDING PR #274 | Once PR #274 merges, backend PRs will lint changed files only; global rule will enforce camelCase/kebabCase naming |
| **Product Owner** | ✅ NO IMPACT | Internal refactoring, no business changes |

---

## Implementation Complete ✅ (Updated Feb 2026)

All phases have been successfully executed with Feb 2026 update:

1. ✅ **Phase 1**: ESLint configuration updated with React component overrides AND dual-case allowance (camelCase OR kebabCase)
   - Global rule: `'unicorn/filename-case': { cases: { camelCase: true, kebabCase: true } }`
   - React override: `'unicorn/filename-case': 'off'` for `/components/`, `/pages/`, `/contexts/` directories
   - Implementation: PR #273 (ESLint config), ADR-011 updated to document dual-case convention

2. ✅ **Phase 2**: Backend files standardized (11 files renamed to camelCase, now kebabCase also allowed per PR #273)
3. ✅ **Phase 3**: Frontend files standardized (10 components kept as PascalCase, 3 utilities renamed)
4. ✅ **Phase 4**: Common package standardized (8 files renamed from kebab-case to camelCase, now kebabCase allowed again per PR #273)
5. ✅ **Phase 5**: ESLint verification passed (0 filename violations); CI gate implementation pending PR #274

**Key Enforcement Details** (Feb 2026):
- **Frontend React components**: PascalCase (convention documented, ESLint rule disabled for these directories)
- **Frontend utilities/hooks**: camelCase (convention, allowed by global rule)
- **Backend services/middleware/types**: camelCase OR kebabCase (both allowed equally by global rule)
- **Common package**: camelCase OR kebabCase (both allowed equally by global rule)
- **Global ESLint rule**: Enforces camelCase OR kebabCase; blocks PascalCase outside React directories

**CI/CD Status** (Feb 2026):
- ESLint configuration updated: PR #273 (merged when approved)
- Backend CI gate implementation: PR #274 (not yet merged; will enforce changed-files lint gate once merged)
- Once PR #274 merges: backend PRs will lint only changed files, enforcing global filename-case rule

**Feb 2026 Update Rationale**:
- Backend codebase uses both naming styles interchangeably
- Enforcing single case would require massive refactoring with minimal benefit
- Allowing both camelCase and kebabCase aligns with KISS principle (ADR-005)
- All tools and IDEs support both styles equally

**Status**: Implementation extended to support dual-case convention (PR #273); CI gate pending PR #274

---

## Related Documents

- [ADR-005: Infrastructure & Config Pattern](./ADR-005-infrastructure-config-pattern.md)
- [ESLint Config](../../eslint.config.js)
- [AGENTS.md](../../AGENTS.md) - Project setup & standards

---

**Document Version**: 1.1  
**Last Updated**: February 20, 2026 (Session 3 - Extended to dual-case convention)  
**Previous Version**: 1.0 (January 27, 2026 - camelCase only)
