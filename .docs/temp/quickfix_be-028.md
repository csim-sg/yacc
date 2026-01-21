# Quick Fix Guide: BE-028 TypeScript Errors

**For Developer:** Use this guide to fix the TypeScript compilation errors.

---

## Summary

**Total Errors:** 33 TypeScript errors
**Estimated Fix Time:** 1-2 hours
**Status:** Blocker - Must fix before Architect approval

---

## Quick Fixes (Step-by-Step)

### Fix #1: Remove Duplicates in entities.ts

**File:** `packages/common/src/types/entities.ts`

**Action:** Delete lines 156-275 (the duplicate interfaces)

These lines duplicate: Conversation, Message, Attachment, Tag, Note, Notification, RoutingRule, RuleCondition, RuleAction, AuditLog, RawPayload

---

### Fix #2: Remove Duplicate Constants from entities.ts

**File:** `packages/common/src/types/entities.ts`

**Action:** Delete lines 10-19 (NOTIFICATION_TYPES and ROUTING_RULE_STATUSES)

```typescript
// DELETE THESE LINES:
export const NOTIFICATION_TYPES = {
  ASSIGNMENT: 'assignment',
  MENTION: 'mention',
  UNREAD: 'unread',
} as const;

export const ROUTING_RULE_STATUSES = {
  ACTIVE: 'active',
  DISABLED: 'disabled',
} as const;

export type NotificationType = typeof NOTIFICATION_TYPES[keyof typeof NOTIFICATION_TYPES];
export type RoutingRuleStatus = typeof ROUTING_RULE_STATUSES[keyof typeof ROUTING_RULE_STATUSES];
```

---

### Fix #3: Add Missing Imports to entities.ts

**File:** `packages/common/src/types/entities.ts`

**Replace the import section (lines 5-7):**

```typescript
// BEFORE:
import {
  USER_STATUSES,
} from '../constants';

// AFTER:
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
  NOTIFICATION_TYPES,
  ROUTING_RULE_STATUSES,
} from '../constants';
```

---

### Fix #4: Remove Role Type from auth.ts

**File:** `packages/common/src/types/auth.ts`

**Delete line 6:**

```typescript
// DELETE THIS LINE:
export type Role = typeof ROLES[keyof typeof ROLES];
```

**Result:**

```typescript
// File should look like:
/**
 * Authentication Types
 * JWT and session-related types
 */
import { ROLES } from '../constants';

export interface JWTPayload {
  userId: string;
  email: string;
  role: Role;  // This will now import from constants
  iat: number;
  exp: number;
}
```

---

### Fix #5: Fix user.ts Import or Delete File

**Option A (Recommended): Delete the file**

The file `types/user.ts` is not required by BE-028. Simply delete it:
```bash
rm packages/common/src/types/user.ts
```

**Option B: Fix the import**

**File:** `packages/common/src/types/user.ts`

**Replace line 5:**

```typescript
// BEFORE:
import type { Role, Timestamp } from './domain';

// AFTER:
import type { Role } from '../constants/roles';

export type Timestamp = {
  createdAt: string;
  updatedAt: string;
};
```

---

### Fix #6: Remove Redundant Exports from connector.types.ts

**File:** `packages/common/src/types/connector.types.ts`

**Delete lines 327-346:**

```typescript
// DELETE THESE LINES:
export type {
  Platform,
  ConnectorStatus,
  MessageDirection,
  ConnectorMessage,
  ConnectorAttachment,
  ConnectorConfig,
  ConnectionInfo,
  SendMessageRequest,
  SendMessageResponse,
  ConnectorEventMap,
  IConnector,
  ValidationError,
  RawPayloadInfo,
  RetryJobData,
  ConnectionError,
  MessageSendError,
  MessageParseError,
  AuthenticationError,
};
```

All these types are already exported inline earlier in the file.

---

### Fix #7: Remove Unused Imports from schemas/api.ts

**File:** `packages/common/src/schemas/api.ts`

**Delete lines 2-9:**

```typescript
// DELETE THESE LINES:
import {
  ROLES,
  USER_STATUSES,
  CONVERSATION_STATUSES,
  PRIORITY_LEVELS,
  MESSAGE_STATUSES,
  MESSAGE_DIRECTIONS,
} from '../constants';
```

---

### Fix #8: Delete Empty/Placeholder Files

```bash
rm packages/common/src/types/domain.ts
rm packages/common/src/types/conversation.ts
```

---

### Fix #9: Fix package.json Exports (Optional but Recommended)

**File:** `packages/common/package.json`

**Update the exports section:**

```json
// BEFORE:
"exports": {
  "./types": "./dist/types/index.js",
  "./schemas": "./dist/schemas/index.js",
  "./constants": "./dist/constants/index.js",
  "./utils": "./dist/utils/index.js"
}

// AFTER:
"exports": {
  ".": "./dist/index.js",
  "./types": "./dist/types/index.js",
  "./schemas": "./dist/schemas/index.js",
  "./constants": "./dist/constants/index.js",
  "./utils": "./dist/utils/index.js"
}
```

---

## Verification Steps

After applying all fixes:

### Step 1: Type Check
```bash
cd packages/common
npm run type-check
```

**Expected:** No errors (exit code 0)

### Step 2: Build
```bash
npm run build
```

**Expected:** No errors, `dist/` directory created

### Step 3: Verify Imports

Create a test file to verify imports work:

```typescript
// test-imports.ts
import {
  User,
  Conversation,
  LoginRequest,
  Role,
  ConversationStatus,
} from '@yacc/common';

import { LoginRequestSchema, UserSchema } from '@yacc/common';

import {
  ROLES,
  CONVERSATION_STATUSES,
  ERROR_CODE,
} from '@yacc/common';
```

### Step 4: Check Generated Files

```bash
ls -la dist/
```

**Expected:**
```
dist/
├── index.js
├── index.d.ts
├── types/
├── schemas/
├── constants/
└── utils/
```

---

## All Fixes Summary

| # | Fix | File | Action |
|---|-----|------|--------|
| 1 | Remove duplicate interfaces | `types/entities.ts` | Delete lines 156-275 |
| 2 | Remove duplicate constants | `types/entities.ts` | Delete lines 10-19 |
| 3 | Add missing imports | `types/entities.ts` | Replace import section |
| 4 | Remove Role type | `types/auth.ts` | Delete line 6 |
| 5a | Delete user.ts (recommended) | `types/user.ts` | Delete file |
| 5b | OR fix import | `types/user.ts` | Replace import |
| 6 | Remove redundant exports | `types/connector.types.ts` | Delete lines 327-346 |
| 7 | Remove unused imports | `schemas/api.ts` | Delete lines 2-9 |
| 8 | Delete domain.ts | `types/domain.ts` | Delete file |
| 9 | Delete conversation.ts | `types/conversation.ts` | Delete file |
| 10 | Fix package.json (optional) | `package.json` | Add main entry point |

---

## Troubleshooting

### Error: "Module 'x' has already exported a member named 'y'"

**Cause:** You still have duplicate exports between files.

**Fix:** Check Fix #2 and #4 above - make sure constants are only in one place.

### Error: "Cannot find name 'Role'"

**Cause:** Missing import in entities.ts.

**Fix:** Apply Fix #3 above.

### Error: "File is not a module"

**Cause:** domain.ts or conversation.ts still exists and only has comments.

**Fix:** Apply Fix #8 and #9 above.

---

## After All Fixes

Once all fixes are complete:

1. Commit changes:
   ```bash
   git add packages/common/
   git commit -m "fix(common): Resolve TypeScript compilation errors and remove duplicates

   - Remove duplicate interfaces in entities.ts
   - Remove duplicate constants (NOTIFICATION_TYPES, ROUTING_RULE_STATUSES)
   - Add missing imports (Role, Channel, ConversationStatus, etc.)
   - Remove redundant exports from connector.types.ts
   - Delete empty placeholder files
   - Remove unused imports

   Fixes TypeScript compilation errors. Package now builds successfully.
   "
   ```

2. Request Architect review again.

3. Architect will approve and you can proceed with next tasks.

---

## Questions?

If you encounter any issues not covered in this guide, check:
1. `.docs/temp/review_be-028_shared_types.md` - Detailed architectural review
2. TypeScript error messages - They usually indicate the exact issue
3. GitHub Issue #109 - Original requirements

---

**Good luck!** 🚀
