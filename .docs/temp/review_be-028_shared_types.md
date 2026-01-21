# Architectural Review: BE-028 - Shared Types Package

**Reviewer:** Solution Architect
**Date:** January 21, 2026
**Commit:** `2af0a57` - WIP: BE-028 - Start shared types package
**GitHub Issue:** [#109 - Create shared types package](https://github.com/csim-sg/yacc/issues/109)

---

## Executive Summary

The shared types package implementation demonstrates a **solid foundation** with clear separation of concerns between types, schemas, constants, and utilities. However, **critical TypeScript compilation errors** must be resolved before this can proceed. The package structure follows monorepo best practices, but contains duplicate definitions and missing imports that block successful compilation.

**Overall Status:** ⚠️ **REQUIRES FIXES** - Cannot be approved until TypeScript errors are resolved.

---

## 1. Package Structure Assessment

### ✅ **Strengths**

1. **Clear Separation of Concerns**
   ```
   src/
   ├── types/          # Domain entities, API types, auth types
   ├── schemas/        # Zod validation schemas
   ├── constants/      # Enums, error codes
   ├── utils/          # Formatters, validators
   └── index.ts        # Main export
   ```

2. **Type Safety with Runtime Validation**
   - Uses Zod for runtime validation
   - Derives types from schemas where appropriate

3. **Comprehensive Coverage**
   - 23 TypeScript files
   - 33 exported interfaces
   - 33 Zod schemas

4. **Utility Functions**
   - Date formatting
   - Text truncation
   - File size formatting
   - Email/UUID/URL validation
   - Password strength checking

### ⚠️ **Architectural Concerns**

1. **Package Name Inconsistency**
   - Current: `@yacc/common` (in package.json)
   - Specified: `@omni-inbox/common` (in BE-028 issue)
   - **Recommendation:** Use `@yacc/common` to match the project name

2. **Module Exports Configuration**
   ```json
   "exports": {
     "./types": "./dist/types/index.js",
     "./schemas": "./dist/schemas/index.js",
     "./constants": "./dist/constants/index.js",
     "./utils": "./dist/utils/index.js"
   }
   ```
   **Concern:** This configuration doesn't match the actual file structure. The main entry point should be `./index.js`.

   **Recommendation:** Use this instead:
   ```json
   "exports": {
     ".": "./dist/index.js",
     "./types": "./dist/types/index.js",
     "./schemas": "./dist/schemas/index.js",
     "./constants": "./dist/constants/index.js",
     "./utils": "./dist/utils/index.js"
   }
   ```

---

## 2. Critical TypeScript Errors

### 🔴 **ERROR 1: Duplicate Interface Definitions**

**File:** `src/types/entities.ts`
**Lines:** 36-185 and 156-276

The following interfaces are defined **twice** in the same file:
- `Conversation` (lines 36-48 and 157-169)
- `Message` (lines 51-63 and 172-184)
- `Attachment` (lines 66-76 and 187-197)
- `Tag` (lines 79-85 and 200-206)
- `Note` (lines 88-95 and 209-216)
- `Notification` (lines 98-107 and 219-228)
- `RoutingRule` (lines 110-120 and 231-241)
- `RuleCondition` (lines 122-126 and 243-247)
- `RuleAction` (lines 128-131 and 249-252)
- `AuditLog` (lines 134-145 and 255-266)
- `RawPayload` (lines 148-154 and 269-275)

**Impact:** Code duplication, maintenance nightmare, potential inconsistencies.

**Fix:** Remove lines 156-275 (the duplicate section).

---

### 🔴 **ERROR 2: Duplicate Type Exports Between Files**

| Export | File 1 | File 2 | Status |
|--------|--------|--------|--------|
| `Role` | `constants/roles.ts:46` | `types/auth.ts:6` | Duplicate |
| `NOTIFICATION_TYPES` | `constants/statuses.ts:34-38` | `types/entities.ts:10-14` | Duplicate |
| `ROUTING_RULE_STATUSES` | `constants/statuses.ts:40-43` | `types/entities.ts:16-19` | Duplicate |

**Impact:** When both files are re-exported from `index.ts`, TypeScript throws:
```
error TS2308: Module './types/auth' has already exported a member named 'Role'.
error TS2308: Module './types/entities' has already exported a member named 'NOTIFICATION_TYPES'.
error TS2308: Module './types/entities' has already exported a member named 'ROUTING_RULE_STATUSES'.
```

**Architectural Principle:** **Constants should be the single source of truth.** Types should derive from constants, not duplicate them.

**Fix:**
1. Remove duplicate constants from `types/entities.ts` (lines 10-19)
2. Remove `Role` type from `types/auth.ts`
3. Import these types from constants where needed:

   ```typescript
   // In types/entities.ts
   import type { Role } from '../constants/roles';
   import type { NotificationType, RoutingRuleStatus } from '../constants/statuses';

   // In types/auth.ts
   import type { Role } from '../constants/roles';
   ```

---

### 🔴 **ERROR 3: Missing Imports in entities.ts**

**File:** `src/types/entities.ts`
**Missing Types:**
- `Role` (used on lines 29)
- `Channel` (used on lines 38, 159)
- `ConversationStatus` (used on lines 40, 161)
- `Priority` (used on lines 41, 162)
- `MessageStatus` (used on lines 57, 178)
- `MessageDirection` (used on lines 58, 179)

**Current Import:**
```typescript
import {
  USER_STATUSES,
} from '../constants';
```

**Fix:**
```typescript
import type {
  Role,
} from '../constants/roles';

import type {
  Channel,
  ConversationStatus,
  MessageStatus,
  MessageDirection,
  NotificationType,
  RoutingRuleStatus,
  Priority,
} from '../constants/statuses';

import {
  USER_STATUSES,
} from '../constants';
```

---

### 🔴 **ERROR 4: Non-Existent Module Import**

**File:** `src/types/user.ts`
**Line:** 5

```typescript
import type { Role, Timestamp } from './domain';
```

**Problem:** `src/types/domain.ts` only contains a comment (not a module):
```typescript
/**
 * Core Domain Types
 * (Consolidated into entities.ts - keeping for reference only)
 */
```

**Error:** `error TS2306: File '/path/to/domain.ts' is not a module.`

**Fix Options:**

**Option A:** Remove the unused `user.ts` file (recommended - not required by BE-028)

**Option B:** Define `Timestamp` type inline:
```typescript
export type Timestamp = {
  createdAt: string;
  updatedAt: string;
};
```

**Option C:** Move `Timestamp` to `types/entities.ts` and import from there.

---

### 🔴 **ERROR 5: Connector Types Export Conflicts**

**File:** `src/types/connector.types.ts`
**Lines:** 327-346

**Problem:** Types are defined as `export interface` and then re-exported as `export type`, causing conflicts:
```typescript
// Lines 196-241: Classes defined
export class ConnectionError extends Error { ... }
export class MessageSendError extends Error { ... }

// Lines 342-345: Re-exported
export {
  ConnectionError,
  MessageSendError,
  // ...
};
```

**Error:**
```
error TS2484: Export declaration conflicts with exported declaration of 'ConnectionError'.
error TS2484: Export declaration conflicts with exported declaration of 'MessageSendError'.
```

**Fix:** Remove the redundant type-only exports (lines 327-346) since all types are already exported inline.

---

### 🟡 **ERROR 6: Unused Imports**

**File:** `src/schemas/api.ts`
**Line:** 2

```typescript
import {
  ROLES,
  USER_STATUSES,
  CONVERSATION_STATUSES,
  PRIORITY_LEVELS,
  MESSAGE_STATUSES,
  MESSAGE_DIRECTIONS,
} from '../constants';  // ← Never used
```

**Fix:** Remove the unused import.

---

### 🟡 **ISSUE 7: Empty/Placeholder Files**

**Files:**
- `src/types/domain.ts` - Contains only a comment
- `src/types/conversation.ts` - Contains only a comment

**Problem:** These files suggest incomplete refactoring and add confusion.

**Recommendation:** Remove these files or properly implement them. Since the comment says "Consolidated into entities.ts", they should be removed.

---

## 3. BE-028 Requirements Compliance

### ✅ **Implemented Requirements**

| Requirement | Status | Notes |
|-------------|--------|-------|
| Package structure created | ✅ | Correct structure |
| package.json configured | ✅ | Has zod dependency |
| tsconfig.json configured | ✅ | Proper TypeScript settings |
| Domain entity types | ✅ | User, Conversation, Message, etc. defined |
| API request/response types | ✅ | All required types defined |
| Auth types (JWTPayload, AuthSession) | ✅ | Defined |
| Enums & constants | ✅ | Roles, statuses, channels, errors defined |
| Zod validation schemas | ✅ | Entity and API schemas created |
| Main export file | ✅ | Re-exports all modules |
| Utility functions | ✅ | Formatters and validators |

### ⚠️ **Partially Implemented Requirements**

| Requirement | Status | Issue |
|-------------|--------|-------|
| Package builds successfully | ❌ | TypeScript errors prevent build |
| TypeScript types generated | ❌ | Build fails |
| Type imports work in backend/frontend | ❌ | Cannot import due to compilation errors |

### ❌ **Missing Requirements**

| Requirement | Status | Notes |
|-------------|--------|-------|
| Monorepo integration | ❌ | Not verified (pnpm-workspace.yaml, turbo.json) |
| README.md documentation | ❌ | No README in packages/common/ |
| Unit tests for Zod schemas | ❌ | No tests directory or test files |

---

## 4. Architectural Recommendations

### 4.1 Single Source of Truth Principle

**Current Issue:** Duplicate definitions of constants/types across files.

**Recommendation:** Establish a clear ownership model:
- **Constants** (`constants/*.ts`) → Own the enum values and string constants
- **Types** (`types/*.ts`) → Own the interfaces, import types from constants
- **Schemas** (`schemas/*.ts`) → Import types/constants for validation

**Example:**
```typescript
// constants/roles.ts - Source of truth
export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  MANAGER: 'manager',
  USER: 'user',
} as const;

export type Role = keyof typeof ROLES;

// types/entities.ts - Imports from constants
import type { Role } from '../constants/roles';

export interface User {
  id: string;
  role: Role;  // Uses type from constants
  // ...
}
```

---

### 4.2 Schema-First vs Type-First Approach

**Current Implementation:** Mixed approach - some schemas infer types, some don't.

**Recommendation:** Adopt **type-first** approach for domain entities, **schema-first** for API inputs.

**Rationale:**
- Domain entities are consumed by both frontend and backend (types needed first)
- API inputs are validated at runtime (schemas needed first)

**Example:**
```typescript
// Type-first: Domain entity
export interface User {
  id: string;
  email: string;
  role: Role;
}

// Schema-first: API input
export const CreateUserSchema = z.object({
  email: z.string().email(),
  role: z.nativeEnum(ROLES),
});

export type CreateUserRequest = z.infer<typeof CreateUserSchema>;
```

---

### 4.3 Export Strategy

**Current Issue:** Main index.ts re-exports everything, causing conflicts.

**Recommendation:** Use selective exports to avoid conflicts.

**Option A: Explicit Exports**
```typescript
// src/index.ts
export * from './types/entities';
export * from './types/api';

// Constants - use selective exports to avoid duplicates
export { ROLES, ROLE_PERMISSIONS } from './constants/roles';
export {
  CHANNELS,
  CONVERSATION_STATUSES,
  PRIORITY_LEVELS,
  // ... (exclude duplicates)
} from './constants/statuses';
export { ERROR_CODE, ERROR_MESSAGE } from './constants/errors';
```

**Option B: Namespace Exports**
```typescript
// src/index.ts
export * as Entities from './types/entities';
export * as Api from './types/api';
export * as Constants from './constants';
export * as Schemas from './schemas';

// Usage in consumer:
import { Entities, Constants } from '@yacc/common';
const user: Entities.User = { ... };
```

**Recommendation:** Use Option A (explicit exports) for backward compatibility.

---

### 4.4 Date Handling Strategy

**Current Issue:** Mixed use of `Date` and `string` for timestamps.

**Examples:**
```typescript
// types/entities.ts - Uses string
export interface User {
  createdAt: string;  // ISO-8601
  updatedAt: string;  // ISO-8601
}

// schemas/user.schema.ts - Uses Date
export const UserSchema = z.object({
  createdAt: z.date(),
  updatedAt: z.date(),
});
```

**Recommendation:** **Standardize on ISO-8601 strings for API boundaries.**

**Rationale:**
- JSON serialization: `Date` objects become strings in JSON
- Database: Postgres uses timestamp strings
- Frontend: Easier to work with ISO strings

**Implementation:**
```typescript
// Domain entities (types/entities.ts) - Use strings for API boundaries
export interface User {
  createdAt: string;  // ISO-8601
  updatedAt: string;
}

// Schemas (schemas/entities.ts) - Use z.string().datetime()
export const UserSchema = z.object({
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
```

---

### 4.5 UUID Validation

**Current Implementation:** Uses `z.string().uuid()` for IDs.

**Recommendation:** Keep this approach but add utility function.

**Add to `src/utils/validation.ts`:**
```typescript
export function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}
```

**Already implemented:** ✅ This utility exists in `src/utils/validation.ts` - good!

---

## 5. Required Actions (Priority Order)

### 🔴 **P0 - Blocker (Must Fix Before Approval)**

1. **Remove duplicate interfaces in entities.ts** (lines 156-275)
2. **Remove duplicate constants from types/entities.ts** (lines 10-19)
3. **Remove Role type from types/auth.ts** (line 6)
4. **Add missing imports to types/entities.ts** (import Role, Channel, ConversationStatus, etc.)
5. **Fix types/user.ts import** - either remove file or inline Timestamp type
6. **Remove redundant exports from connector.types.ts** (lines 327-346)
7. **Remove empty/placeholder files** (types/domain.ts, types/conversation.ts)

### 🟡 **P1 - High Priority (Should Fix)**

8. **Remove unused imports from schemas/api.ts** (line 2)
9. **Fix package.json exports** - Add main entry point
10. **Standardize date handling** - Use ISO-8601 strings consistently

### 🟢 **P2 - Low Priority (Nice to Have)**

11. **Create README.md** in packages/common/
12. **Add unit tests** for Zod schemas
13. **Verify monorepo integration** (pnpm-workspace.yaml, turbo.json)

---

## 6. Approval Decision

### Current Status: **❌ NOT APPROVED**

**Blockers:**
- TypeScript compilation errors must be resolved
- Duplicate definitions must be removed
- Package must build successfully

### Path to Approval:

1. **Developer** fixes all P0 issues (estimated 1-2 hours)
2. **Developer** runs `npm run type-check` - all errors resolved
3. **Developer** runs `npm run build` - successful build
4. **Developer** commits changes with message: "fix(common): Resolve TypeScript compilation errors and remove duplicates"
5. **Architect** re-reviews and approves if all issues resolved

---

## 7. Implementation Examples

### Example Fix: entities.ts

**Before:**
```typescript
/**
 * Domain Entity Types
 */
import {
  USER_STATUSES,
} from '../constants';

export const NOTIFICATION_TYPES = {  // ← Duplicate
  ASSIGNMENT: 'assignment',
  // ...
} as const;

export const ROUTING_RULE_STATUSES = {  // ← Duplicate
  ACTIVE: 'active',
  // ...
} as const;

export interface User {
  id: string;
  role: Role;  // ← Not imported
  // ...
}

// ... duplicate interfaces below (lines 156-275)
```

**After:**
```typescript
/**
 * Domain Entity Types
 * Core data models for the application
 */
import type {
  Role,
} from '../constants/roles';

import type {
  Channel,
  ConversationStatus,
  Priority,
  MessageStatus,
  MessageDirection,
  NotificationType,
  RoutingRuleStatus,
} from '../constants/statuses';

import {
  USER_STATUSES,
} from '../constants';

export interface User {
  id: string;
  email: string;
  role: Role;
  status: UserStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Conversation {
  id: string;
  channel: Channel;
  externalThreadId: string;
  status: ConversationStatus;
  priority: Priority;
  assignedUserId?: string;
  assignedUser?: User;
  lastMessageAt: string;
  createdAt: string;
  updatedAt: string;
  tags?: Tag[];
}

// ... (no duplicates)
```

---

### Example Fix: index.ts Exports

**Before:**
```typescript
export * from './types/entities';
export * from './types/api';
export * from './types/auth';

export * from './constants/roles';
export * from './constants/statuses';  // ← Contains duplicates
export * from './constants/channels';
export * from './constants/errors';
```

**After (Option A - Selective Exports):**
```typescript
// Types
export * from './types/entities';
export * from './types/api';
export * from './types/auth';

// Constants - selective to avoid duplicates
export { ROLES, ROLE_PERMISSIONS } from './constants/roles';
export {
  CHANNELS,
  CONVERSATION_STATUSES,
  PRIORITY_LEVELS,
  MESSAGE_STATUSES,
  MESSAGE_DIRECTIONS,
  USER_STATUSES,
} from './constants/statuses';
export { ERROR_CODE, ERROR_MESSAGE, ErrorCode } from './constants/errors';
```

---

## 8. Post-Approval Checklist

After the fixes are applied, verify:

- [ ] `npm run type-check` passes with no errors
- [ ] `npm run build` completes successfully
- [ ] `dist/` directory contains compiled JavaScript files
- [ ] `dist/*.d.ts` declaration files are generated
- [ ] Types can be imported in backend: `import { User } from '@yacc/common'`
- [ ] Types can be imported in frontend: `import { User } from '@yacc/common'`
- [ ] Schemas can be imported: `import { LoginRequestSchema } from '@yacc/common'`
- [ ] No TypeScript errors in monorepo build

---

## 9. Conclusion

The shared types package demonstrates **strong architectural fundamentals** with clear separation of concerns and comprehensive type coverage. The Zod integration provides excellent runtime validation capabilities. However, the **critical TypeScript compilation errors** must be addressed before this can be approved.

Once the P0 issues are resolved, this implementation will provide a solid foundation for type safety across the monorepo and will significantly improve developer experience and reduce bugs.

---

**Reviewed by:** Solution Architect
**Date:** January 21, 2026
**Next Review:** After P0 fixes are committed
