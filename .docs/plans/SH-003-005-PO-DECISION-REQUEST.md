# SH-003, SH-004, SH-005 | BLOCKING: PO Scope Clarification Required

**Date**: 2026-02-24  
**Status**: 🔴 **BLOCKED** - Awaiting PO decisions  
**Impact**: Development cannot start until 3 scope decisions are made  
**Timeline**: Need decisions within 24 hours to stay on schedule

---

## Executive Summary

Gap analysis completed by Architect revealed that **3 tasks (SH-003, SH-004, SH-005) have ambiguous or conflicting scope** that prevents development from starting.

**Blocks Affected**:
- 🔴 **BLOCKER-1**: SH-003 event scope unclear (3 events vs 8+ events)
- 🔴 **BLOCKER-2**: SH-004 endpoint scope unclear (4 domains vs 35+ endpoints)
- 🔴 **BLOCKER-3**: SH-005 export pattern conflicts with ADR-005

**Estimated Impact**:
- If NOT resolved before development: 2-3 days rework + PR cycle delay
- If resolved NOW: Development can start in 24 hours, **saves 4 days by parallelizing** SH-003 + SH-004

---

## BLOCKER-1: SH-003 WebSocket Event Scope

### Current Definition (Ambiguous)

**Task**: "Define WebSocket event types (message.received, message.sent, message.failed)"

**Scope**: Only 3 message-related events mentioned

### The Reality: API Spec Defines 8+ Events

From `.docs/02-api-and-data-model.md` Section 6, WebSocket Real-Time Events:

| # | Event | Purpose | MVP Required? |
|---|-------|---------|---|
| 1 | `message.received` | Inbound message from platform | ✅ YES (core messaging) |
| 2 | `message.sent` | Outbound message succeeded | ✅ YES (core messaging) |
| 3 | `message.failed` | Outbound message failed | ✅ YES (core messaging) |
| 4 | `conversation.updated` | Status/assignment/tags changed | ❓ **PO DECIDES** |
| 5 | `conversation.reopened` | Resolved conversation reopened | ❓ **PO DECIDES** |
| 6 | `notification.received` | User assigned or @mentioned | ❓ **PO DECIDES** |
| 7 | `presence.updated` | User online/offline status | ❓ **PO DECIDES** |
| 8 | `typing.started` | User is typing | ❓ **PO DECIDES** |
| 9 | `typing.stopped` | User stopped typing | ❓ **PO DECIDES** |

### Your Decision: Which Events are Phase 1 MVP?

**Option A: Minimal (3 events)** - Message events only
- Scope: message.received, message.sent, message.failed
- Pro: Smallest scope, fastest development (4 days)
- Con: Phase 2 must implement events 4-9; incomplete real-time feature set
- Impact: Presence, typing, notifications will feel disconnected in Phase 1

**Option B: Full (9 events)** - All events from spec
- Scope: All 9 events including presence, typing, notifications
- Pro: Complete real-time feature set in Phase 1; better UX
- Con: Larger scope, 4-5 days development (still manageable)
- Impact: Developers need to implement all event types at once

**Option C: Hybrid (6 events)** - Message + Conversation + Notification
- Scope: message.* (3) + conversation.updated + conversation.reopened + notification.received
- Pro: Complete core features without presence/typing
- Con: Medium scope, 4-5 days development
- Impact: Presence/typing deferred to Phase 2

### ✅ PO DECISION REQUIRED

**Choose one**:
- [ ] Option A: Minimal (3 events, fastest)
- [ ] Option B: Full (9 events, complete)
- [ ] Option C: Hybrid (6 events, balanced)

**Rationale** (briefly explain why):
_______________________________________________

**Impact on User Experience**:
- If A: Users won't see presence/typing until Phase 2
- If B: Users get full real-time experience in Phase 1 ✅
- If C: Users get partial real-time experience, presence/typing later

---

## BLOCKER-2: SH-004 Endpoint Validation Scope

### Current Definition (Ambiguous)

**Task**: "Create Zod schemas for request validation (auth, conversations, messages, IRC config)"

**Scope**: Only 4 domains mentioned (~12 endpoints)

### The Reality: API Spec Defines 35+ Endpoints

From `.docs/02-api-and-data-model.md` Sections 2-5, all REST endpoints:

| Domain | Endpoints | Count | Include in Phase 1? |
|--------|-----------|-------|---|
| **Auth** | login, logout, forgot password, reset password | 4 | ✅ YES (must-have) |
| **Conversations** | list (with filters), get, update, assign, bulk update, bulk tag, bulk prioritize | 7 | ✅ YES (core inbox) |
| **Messages** | send, retry, get conversation messages, search | 4 | ✅ YES (core messaging) |
| **Tags** | CRUD (create, list, get, update, delete) | 5 | ❓ **PO DECIDES** |
| **Notes** | CRUD (create, list, get, update, delete) | 3 | ❓ **PO DECIDES** |
| **Routing Rules** | CRUD (create, list, get, update, delete) | 5 | ❓ **PO DECIDES** |
| **IRC Config** | CRUD (create, list, get, update, delete), plus test endpoint | 5 | ✅ YES (integration) |
| **Notifications** | list, mark as read | 2 | ❓ **PO DECIDES** |
| **Search** | full-text search with filters | 1 | ✅ YES (core feature) |
| **Audit Logs** | list (admin+ only) | 1 | ❓ **PO DECIDES** |
| **Bulk Operations** | bulk action orchestrator | 1 | ✅ YES (core feature) |
| **Raw Payloads** | list (manager+ only), delete (admin+) | 2 | ❓ **PO DECIDES** |
| **DLQ Management** | list, retry (admin+) | 2 | ❓ **PO DECIDES** |
| **Integrations** | status, health, health+ integration details | 3+ | ✅ YES (ops) |

**Total: 35+ endpoints**

### Validation Scope Questions

For each endpoint, should we validate:

1. **Request Body**: POST/PUT/PATCH bodies (e.g., login credentials)
2. **Query Parameters**: GET filters and pagination (e.g., `/conversations?status=open&assignee=user-123`)
3. **Path Parameters**: URL slugs (e.g., `/conversations/:conversationId`)
4. **Response Bodies**: Ensure API returns expected structure (optional, for type safety)

### Your Decision: Which Endpoints + What Validation?

**Option A: Core Only (12 endpoints, body + params)**
- Scope: Auth (4) + Conversations (7) + Messages (4) = **15 endpoints minimum**
- Validation: Request body + query params + path params
- Pro: Focused scope, most critical paths validated, ~5 days development
- Con: Tags, notes, rules, notifications not validated → potential bugs

**Option B: Full Phase 1 (all 35+ endpoints, body + params)**
- Scope: All 35+ endpoints
- Validation: Request body + query params + path params
- Pro: Complete API validation, fewer bugs, better UX
- Con: Larger scope, ~11.5 days development
- Benefit: Developers know exact contract for all endpoints

**Option C: Hybrid (core + collaboration, ~22 endpoints)**
- Scope: Core (15) + Tags (5) + Notes (3) = **23 endpoints**
- Validation: Request body + query params + path params
- Pro: Complete core + collaboration features validated
- Con: Audit, DLQ, raw payloads not validated
- Timeline: ~8 days development

### ✅ PO DECISION REQUIRED

**Choose one**:
- [ ] Option A: Core only (Auth, Conversations, Messages, IRC, Search, Bulk)
- [ ] Option B: Full Phase 1 (All 35+ endpoints)
- [ ] Option C: Hybrid (Core + Collaboration)

**For chosen option, validate**:
- [ ] Request bodies (POST/PUT/PATCH)
- [ ] Query parameters (GET filters)
- [ ] Path parameters (URL slugs)
- [ ] Response bodies (optional, for type safety)

**Rationale** (briefly explain why):
_______________________________________________

**Impact on Quality + Timeline**:
- If A: ~5 days, core paths protected, non-core paths may have bugs
- If B: ~11.5 days, complete validation, best quality ✅
- If C: ~8 days, core + collaboration validated

---

## BLOCKER-3: SH-005 Export Pattern

### Current Definition (Conflicts with ADR-005)

**Task**: "Set up shared package exports in packages/common/src/index.ts"

**Issue**: This creates a single barrel export at `src/index.ts`, which **violates ADR-005**.

### ADR-005 Constraint on Barrel Exports

From **AGENTS.md** (Project Constraints):

> **Index Aggregators (Limited Allowance)**
> - ✅ Allowed: `index.ts` that exports **lists** for libraries (e.g., controller arrays for routing-controllers, schema registries for ORM)
> - ✅ Allowed: data-only aggregations (no business logic)
> - ❌ **Not allowed**: barrel exports for general imports (avoid `import { X } from '../services'`)
> - Rationale: enable library wiring while keeping code discoverable

### The Problem: Single Barrel Export

**Current Approach** (what task suggests):
```typescript
// packages/common/src/index.ts
export * from './types/entities';
export * from './types/api';
export * from './types/events';
export * from './schemas';

// Bad: This is a barrel export
import { User, LoginRequest, MessageReceivedEvent, loginSchema } from '@yacc/common';
```

**Why This Violates ADR-005**:
- ❌ Developers can't find where `User` type lives (entity? API? events?)
- ❌ IDE autocomplete becomes harder (too many exports)
- ❌ Code navigation breaks (no clear import paths)
- ❌ Violates "keep code discoverable" principle

### The Solution: Domain-Specific Exports

**Recommended Approach** (Architect suggestion):
```typescript
// packages/common/types/entities/index.ts
export { User, Conversation, Message, ... };

// packages/common/types/api/index.ts
export { LoginRequest, LoginResponse, ... };

// packages/common/types/events/index.ts
export { MessageReceivedEvent, MessageSentEvent, ... };

// packages/common/schemas/index.ts
export { loginSchema, conversationSchema, ... };

// Good: Clear, discoverable imports
import { User, Conversation } from '@yacc/common/types/entities';
import { LoginRequest } from '@yacc/common/types/api';
import { MessageReceivedEvent } from '@yacc/common/types/events';
import { loginSchema } from '@yacc/common/schemas';
```

**Package.json Configuration** (enables convenient imports):
```json
{
  "exports": {
    "./types/entities": "./types/entities/index.ts",
    "./types/api": "./types/api/index.ts",
    "./types/events": "./types/events/index.ts",
    "./schemas": "./schemas/index.ts"
  }
}
```

### ✅ PO DECISION REQUIRED

**Choose one**:
- [ ] Option A: Domain-specific imports (recommended by Architect)
  - Imports: `@yacc/common/types/entities`, `@yacc/common/types/api`, etc.
  - Pro: Follows ADR-005, discoverable, IDE-friendly ✅
  - Con: Slightly more verbose imports

- [ ] Option B: Single barrel export (convenience)
  - Imports: `import { User, LoginRequest } from '@yacc/common'`
  - Pro: Shorter imports, convenient
  - Con: Violates ADR-005, hurts discoverability ❌

**Recommendation**: **Option A** (domain-specific, maintains code quality + ADR-005 compliance)

**Rationale** (briefly explain if different from above):
_______________________________________________

---

## Architectural Decision: Zod vs TypeScript Types (ADR-XXX)

### The Question: Source of Truth?

**SH-004 requires deciding**: Are Zod schemas or TypeScript types the "source of truth"?

**Option A: Zod Schemas as Source of Truth** (RECOMMENDED)
```typescript
// Define schema once
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

// Infer type from schema
type LoginRequest = z.infer<typeof loginSchema>;

// Use both at runtime + compile-time
const validate = (data) => loginSchema.parse(data);
```

- Pro: Single source of truth (DRY principle) ✅
- Pro: Runtime + compile-time validation guaranteed to match
- Pro: Easier to maintain (change schema, type updates automatically)
- Con: Slightly more verbose syntax

**Option B: Separate Definitions** (NOT RECOMMENDED)
```typescript
// Separate definitions
interface LoginRequest {
  email: string;
  password: string;
}

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

// Risk: Type can drift from schema if not kept in sync
```

- Pro: Clear separation of concerns
- Con: Duplication (violates DRY principle)
- Con: Risk of type-schema mismatch (causes bugs)

### ✅ Architect Recommendation

**Use Option A: Zod Schemas as Source of Truth**

This means:
1. Define Zod schemas first
2. Infer TypeScript types from schemas using `z.infer`
3. Single source of truth, fewer bugs

---

## Summary: What Needs Your Input

| Decision | Impact | Timeline |
|----------|--------|----------|
| **SH-003 Event Scope** (3 vs 8+ events) | Real-time feature completeness | 4-5 days development |
| **SH-004 Endpoint Scope** (4 vs 35+ endpoints) | API validation coverage + quality | 5-11.5 days development |
| **SH-005 Export Pattern** (domain vs barrel) | ADR-005 compliance + code discoverability | Blocks SH-005 approval |
| **ADR-XXX: Zod Source of Truth** (Zod vs types) | Implementation approach for SH-004 | Blocks SH-004 development |

---

## Recommended Path Forward

### If You Approve All Architect Recommendations:

1. **SH-003**: Full scope (9 events) → **4-5 days development**
2. **SH-004**: Full scope (35+ endpoints) with Zod-as-source-of-truth → **11.5 days development**
3. **SH-005**: Domain-specific exports → **3.5 days development**

**Timeline**:
- Day 1-4: SH-003 (parallel with SH-004 start)
- Day 1-12: SH-004 (continues after SH-003 completes)
- Day 13-16: SH-005 (after SH-003 + SH-004 complete)
- **Total: 15-16 days** (saves 4 days by parallelizing SH-003 + SH-004)

### If You Choose Minimal Scope:

1. **SH-003**: Minimal scope (3 events) → **4 days development**
2. **SH-004**: Core only (15 endpoints) → **5 days development**
3. **SH-005**: Domain-specific exports → **3.5 days development**

**Timeline**:
- Day 1-4: SH-003 (parallel with SH-004 start)
- Day 1-5: SH-004 (continues after SH-003 completes)
- Day 6-9: SH-005
- **Total: 9 days** (faster, but incomplete feature set)

---

## Your Action Items

### ✅ REQUIRED (By EOD Tomorrow)

1. **Decide SH-003 Scope**: Option A/B/C → Check box above
2. **Decide SH-004 Scope**: Option A/B/C → Check box above
3. **Decide SH-005 Pattern**: Option A/B → Check box above
4. **Approve Architect Recommendations**: For Zod source of truth + ADR-005 compliance

### ✅ OPTIONAL (If Different from Recommendations)

5. **Provide rationale** for any non-recommended choices

### ✅ FINAL STEP

6. **Sign off** on requirement completeness (95%+ coverage achieved)

---

## Next Steps (Once Decisions Received)

1. **Architect** creates ADR-XXX (Zod source of truth)
2. **Update** `.docs/06-tasks.md` with refined definitions
3. **Create GitHub Issues** for SH-003, SH-004, SH-005 with detailed ACs
4. **Development starts** with SH-003 + SH-004 in parallel
5. **Code review** cycles per workflow

---

**Contact**: Ready to clarify any aspect of this decision document.  
**Deadline**: Please provide decisions within 24 hours to stay on schedule.

