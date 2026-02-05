# INDEX.TS RULE CLARIFICATION

**Status**: Architecture Guidance Document  
**Effective**: Phase 1+  
**Owner**: Enterprise Architect

---

## The Rule: NO Barrel Exports (With Exceptions)

The strict rule is: **No `index.ts` barrel exports in feature folders**.

### What This Means

**❌ BANNED - Barrel Export Pattern (Creating index.ts in feature folders):**

```typescript
// ❌ BAD: packages/backend/src/services/index.ts
export { ConversationService } from './conversation.service';
export { AuthService } from './auth.service';
export { MessageService } from './message.service';
```

Then importing from it:
```typescript
// ❌ BAD: Importing from barrel
import { ConversationService } from '../services';
```

**Why This Is Bad:**
- Creates hidden dependencies (hard to trace where things come from)
- Makes it unclear which file actually contains the code
- Violates "one definition per file" principle
- Harder to find actual implementations when debugging
- Creates circular dependency risks

---

## The Correct Pattern: Direct Imports

**✅ GOOD - Direct Import Pattern:**

```typescript
// ✅ GOOD: Import directly from the file
import { ConversationService } from '../services/conversation.service';
import { AuthService } from '../services/auth.service';
import { MessageService } from '../services/message.service';
```

**Benefits:**
- Clear visibility of where code comes from
- File path matches code location exactly
- Easy to find implementations with IDE Go-To-Definition
- Simpler mental model for developers
- Prevents accidentally importing from wrong place

---

## The Exception: Root-Level App Entry Point

**✅ ALLOWED - `index.ts` at package root ONLY for app initialization:**

```typescript
// ✅ ALLOWED: packages/backend/src/index.ts
// THIS IS THE ONLY PLACE index.ts is used for setup/initialization

import 'reflect-metadata';
import 'dotenv/config';
import express from 'express';
import { useExpressServer } from 'routing-controllers';

// Import controllers directly (no barrel export)
import { AuthController } from './controllers/auth.controller';
import { ConversationsController } from './controllers/conversations.controller';

// Import singletons directly
import { dbClient } from './infrastructure/db.client';
import { redisClient } from './infrastructure/redis.client';
import { logger } from './infrastructure/logger';

// Initialize app
const app = express();

// Setup infrastructure
const db = dbClient;
const redis = redisClient;

// Register controllers
useExpressServer(app, {
  controllers: [AuthController, ConversationsController],
  // ...
});

// Start server
app.listen(3000);
```

**This Is Allowed Because:**
- It's NOT a barrel export consolidating multiple files
- It's the application **entry point** (where Node.js starts execution)
- It's **initialization code only** (no re-exports)
- It directly imports from specific files, not from other index.ts files
- It's a single file at the root level, not a pattern repeated in every folder

---

## Real-World Example: Current Backend Structure

### ✅ What We Have (Correct):

```
packages/backend/src/
├── controllers/
│   ├── auth.controller.ts          ← Direct file
│   ├── conversations.controller.ts ← Direct file
│   └── audit.controller.ts         ← Direct file
├── services/
│   ├── auth.service.ts             ← Direct file
│   ├── conversation.service.ts     ← Direct file
│   └── websocket/
│       ├── websocket-gateway.ts    ← Direct file
│       ├── conversation.handler.ts ← Direct file
│       └── message.handler.ts      ← Direct file
├── infrastructure/
│   ├── db.client.ts                ← Direct file
│   ├── redis.client.ts             ← Direct file
│   └── logger.ts                   ← Direct file
├── types/
│   ├── websocket.types.ts          ← Direct file
│   ├── auth.types.ts               ← Direct file
│   └── message-queue.types.ts      ← Direct file
└── index.ts                         ← App entry point (ONLY index.ts)

// Import pattern:
import { ConversationService } from '../services/conversation.service';
import { dbClient } from '../infrastructure/db.client';
import { WebSocketServer } from '../websockets/websocket.server';
```

### ❌ What NOT To Do (Incorrect):

```
packages/backend/src/
├── controllers/
│   ├── auth.controller.ts
│   ├── conversations.controller.ts
│   └── index.ts ❌ NO! Don't create this
├── services/
│   ├── auth.service.ts
│   ├── conversation.service.ts
│   └── index.ts ❌ NO! Don't create this
├── infrastructure/
│   ├── clients/ ❌ NO! Don't nest like this
│   │   ├── db.client.ts
│   │   └── index.ts
│   └── index.ts ❌ NO! Don't create this
```

---

## Existing Exceptions (Allowed for Data Only)

There are two existing `index.ts` files that ARE allowed because they consolidate **pure data** (schemas, request types):

### ✅ Allowed: `packages/backend/src/schemas/index.ts`

```typescript
// ✅ ALLOWED - Pure data consolidation
export const schemas = {
  attachments,
  auditLogs,
  conversations,
  messages,
  // ...
};
```

**Why This Is Allowed:**
- Consolidates **pure data structures only** (no business logic)
- Schema definitions are declarative, not functional
- Acts like a namespace for database definitions
- Drizzle ORM uses this pattern
- Used only by infrastructure layer (not throughout app)

### ✅ Allowed: `packages/backend/src/requests/index.ts`

```typescript
// ✅ ALLOWED - Pure request type consolidation
export { CreateUserRequest } from './createUser.request';
export { LoginRequest } from './login.request';
```

**Why This Is Allowed:**
- Consolidates **request type definitions only**
- Request types are declarative validation schemas
- Used by single place (routing-controllers validation)
- No business logic involved

---

## Rule Summary Table

| Pattern | Allowed? | Reason |
|---------|----------|--------|
| **Root `src/index.ts` for app init** | ✅ YES | Application entry point only |
| **Barrel export in controllers/** | ❌ NO | Would hide which controller is which |
| **Barrel export in services/** | ❌ NO | Would hide which service is which |
| **Barrel export in middleware/** | ❌ NO | Would hide middleware logic |
| **Barrel export in infrastructure/** | ❌ NO | Would hide which client is which |
| **Data-only schemas index.ts** | ✅ YES | Pure data, no logic |
| **Data-only requests index.ts** | ✅ YES | Pure request types, no logic |
| **Nested folder structure** | ❌ NO | Violates flat structure rule |

---

## Migration Guide (If Encountering Old Code)

If you see old-style barrel exports:

```typescript
// ❌ OLD STYLE
import { SomeService } from '../services';
```

**Migrate to:**

```typescript
// ✅ NEW STYLE
import { SomeService } from '../services/some.service';
```

---

## Validation Checklist

Before committing code with `index.ts`:

- [ ] Is this the root `packages/backend/src/index.ts`? (OK if yes)
- [ ] Is this ONLY for app initialization? (OK if yes)
- [ ] Does it contain business logic? (NOT OK - move to service file)
- [ ] Is this a barrel export of feature files? (NOT OK - use direct imports)
- [ ] Is this pure data (schemas/requests only)? (OK if yes)
- [ ] Can I find the actual code by following the import path? (Must be YES)

---

## Questions to Ask Yourself

1. **Am I creating an index.ts in a feature folder (controllers/services/etc)?**
   - Answer: **NO** - Never do this. Use direct imports instead.

2. **Am I consolidating business logic/classes with index.ts?**
   - Answer: **NO** - Always import directly from the file.

3. **Is my code discoverable by path?** (e.g., `import X from 'path/to/x.ts'`)
   - Answer: **YES** - The import path should match the file location exactly.

4. **Can a developer find my code in 2 seconds with Ctrl+P filename search?**
   - Answer: **YES** - Filename search works because no barrel exports hide things.

---

## Architecture Principle

> **"Make code discoverable by following import paths directly. File paths must match logical code organization. No magic exports that hide implementation details."**

This principle ensures:
- ✅ Code is easy to find and understand
- ✅ Dependency graph is transparent
- ✅ No circular dependency traps
- ✅ IDE navigation works perfectly
- ✅ Mental model matches actual code structure

---

**Last Updated**: February 5, 2026  
**Status**: Active Guidance  
**Next Review**: When new folder patterns added

