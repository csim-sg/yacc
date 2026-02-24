# SH-003 to SH-005 | Architect Handoff (Phase 3a)

**Date**: 2026-02-24  
**Status**: 🟢 **PO APPROVED - READY FOR ARCHITECT FINALIZATION**  
**Handoff To**: Architect (EA-Architecture-Validator)  
**Timeline**: 2026-02-25 (1 day for tasks 1-3 below)  
**Next Phase**: Development starts 2026-02-26

---

## Your Tasks (Architect Finalization)

### TASK 1: Create ADR-XXX (Zod Schema Decision)

**Objective**: Document the decision that Zod schemas are the source of truth

**Location**: `.docs/adr/ADR-0XX-zod-schema-source-of-truth.md`

**Template to Follow**: Use existing ADR format (e.g., ADR-001, ADR-019)

**Content Requirements**:

1. **Title**: Zod Schemas as Single Source of Truth for API Validation
2. **Status**: Accepted (2026-02-24, approved by PO)
3. **Context**: 
   - SH-004 requires both Zod schemas + TypeScript types
   - Duplication risk if defined separately
   - Need single source of truth (DRY principle)
4. **Decision**: 
   - Use Zod schemas as primary definition
   - Infer TypeScript types via `z.infer<typeof schema>`
   - Apply to both request validation + response type safety
5. **Consequences**:
   - Positive: Single source of truth, guaranteed type-schema alignment
   - Positive: Easier maintenance, fewer bugs
   - Negative: Slightly verbose imports (z.infer)
   - Negative: Requires familiarity with Zod inference pattern
6. **Compliance**:
   - ADR-005: One-definition-per-file (schemas are one per file)
   - Project constraints: No `any` types, strict TypeScript
7. **Implementation Notes**:
   - SH-002 TypeScript types may need migration (post-MVP refactoring)
   - SH-004 uses this pattern for all 35+ endpoint schemas
   - Backend validation middleware uses Zod.parse()

**Estimated Time**: 30-45 minutes

---

### TASK 2: Update `.docs/06-tasks.md` with Refined Definitions

**Objective**: Replace vague task definitions with refined, detailed versions

**Location**: `.docs/06-tasks.md` (shared tasks section, lines ~240-250)

**Current Definitions** (Vague):
```markdown
| SH-003 | Define WebSocket event types (...) | Not Started | ... | Event types defined with payloads |
| SH-004 | Create Zod schemas (...) | Not Started | ... | All schemas created, export for validation |
| SH-005 | Set up shared package exports (...) | Not Started | ... | All types/schemas exported correctly |
```

**Refined Definitions to Use** (from Architect gap analysis):

#### SH-003: Define WebSocket Event Types (REFINED)
- **Objective**: Create TypeScript interfaces for all 9 WebSocket events with complete payload structures
- **Scope**: 
  - Base event structure
  - Message events (received, sent, failed)
  - Conversation events (updated, reopened)
  - Notification events (received)
  - Presence events (updated, typing started/stopped)
- **Deliverables**:
  1. TypeScript interfaces in `packages/common/types/events/`
  2. One definition per file (ADR-005 compliance)
  3. Domain-specific index aggregators
  4. Discriminated union type `WebSocketEvent`
  5. JSDoc documentation with example payloads
  6. Tests with 85%+ coverage
- **Acceptance Criteria** (Refined):
  1. ✅ All 9 WebSocket events have TypeScript interfaces
  2. ✅ Each interface extends `BaseEvent<T, D>` with event name literal type
  3. ✅ Payloads reference entity types from SH-001
  4. ✅ Events documented with JSDoc + example payloads
  5. ✅ File structure follows one-definition-per-file (ADR-005)
  6. ✅ Discriminated union type `WebSocketEvent` exists
  7. ✅ Exports available in `packages/common/types/events/index.ts`
  8. ✅ Tests verify type assertions and discrimination work
  9. ✅ 85%+ test coverage
- **Dependencies**: SH-001 (entity types must be complete)
- **Estimate**: 4 days
- **Owner**: Backend Developer

#### SH-004: Create Zod Schemas for Request Validation (REFINED)
- **Objective**: Create Zod schemas for all 35+ REST API endpoints with runtime validation integrated
- **Scope**:
  - Auth endpoints (4)
  - Conversation endpoints (7)
  - Message endpoints (4)
  - Tag, Note, Routing Rule endpoints (13 total)
  - IRC config endpoints (5+)
  - Search, Notifications, Bulk, Raw Payloads, DLQ, Integrations (11+)
- **Deliverables**:
  1. Zod schemas in `packages/common/schemas/` (domain-specific files)
  2. Schema aggregator in `schemas/index.ts`
  3. Validation middleware in `packages/backend/middleware/`
  4. Integration with routing-controllers via `middlewares` option
  5. Tests with 85%+ coverage
- **Acceptance Criteria** (Refined):
  1. ✅ Zod schemas for all 35+ request bodies
  2. ✅ Schemas validate body, query params, path params
  3. ✅ Schemas export from `packages/common/schemas/` organized by domain
  4. ✅ **DECISION**: Schemas are source of truth, types inferred via `z.infer`
  5. ✅ Validation middleware integrates via `middlewares` option
  6. ✅ Error messages are user-friendly (not raw Zod errors)
  7. ✅ Tests verify schema validation catches invalid inputs
  8. ✅ Tests verify valid requests pass validation
  9. ✅ 85%+ test coverage
- **Dependencies**: SH-002 (API types may be refactored to use `z.infer`)
- **Estimate**: 11.5 days
- **Owner**: Backend Developer

#### SH-005: Set Up Shared Package Exports (REFINED)
- **Objective**: Configure domain-specific export paths using package.json `exports` map (NOT barrel exports)
- **Scope**:
  - Configure package.json `exports` map
  - Create domain-specific index aggregators
  - Document allowed import patterns
  - Test imports in backend/frontend
- **Deliverables**:
  1. Updated `packages/common/package.json` with `exports` map
  2. Domain-specific index aggregators:
     - `types/entities/index.ts`
     - `types/api/index.ts`
     - `types/events/index.ts`
     - `schemas/index.ts`
  3. Documentation in `packages/common/README.md`
  4. Tests verifying imports work
- **Acceptance Criteria** (Refined):
  1. ✅ package.json `exports` map configured for domain paths
  2. ✅ Domain-specific index aggregators export all types/schemas
  3. ✅ Import patterns documented in README
  4. ✅ Backend can import and use types/schemas
  5. ✅ Frontend can import and use types
  6. ✅ No circular dependencies introduced
  7. ✅ Tree-shaking works correctly
  8. ✅ **NO** single barrel export at `src/index.ts`
  9. ✅ TypeScript module resolution works
  10. ✅ Tests verify all imports resolve and compile
- **Dependencies**: SH-001, SH-002, SH-003, SH-004
- **Estimate**: 3.5 days
- **Owner**: Architect

**Format**: Use markdown table format (match existing style in file)

**Estimated Time**: 45-60 minutes (copy from refined definitions above)

---

### TASK 3: Create GitHub Issues for SH-003, SH-004, SH-005

**Objective**: Create GitHub Issues with detailed ACs so developers have clear requirements

**Issue 1: SH-003 - Define WebSocket Event Types**

**Title**: `SH-003: Define WebSocket Event Types (9 events)`

**Labels**: `enhancement`, `P0`, `backend`, `shared-code`

**Milestone**: Phase 1.6 (or current sprint)

**Body**:
```markdown
## Objective
Define TypeScript interfaces for all 9 WebSocket events from the API spec with complete payload structures.

## Scope
Define event types for:
- Message events: received, sent, failed
- Conversation events: updated, reopened
- Notification events: received
- Presence events: updated, typing started/stopped

## Deliverables
1. TypeScript interfaces in `packages/common/types/events/`
2. One definition per file (ADR-005 compliance)
3. Domain-specific index aggregators (message, conversation, notification, presence)
4. Discriminated union type `WebSocketEvent`
5. JSDoc documentation with example payloads
6. Tests with 85%+ coverage

## Acceptance Criteria
- [ ] All 9 WebSocket events have TypeScript interfaces
- [ ] Each interface extends `BaseEvent<T, D>` with event name literal type
- [ ] Payloads reference entity types from SH-001
- [ ] Events documented with JSDoc + example payloads
- [ ] File structure follows one-definition-per-file (ADR-005)
- [ ] Discriminated union type `WebSocketEvent` exists
- [ ] Exports available in `packages/common/types/events/index.ts`
- [ ] Tests verify type assertions and discrimination work
- [ ] 85%+ test coverage
- [ ] Zero `any` types in TypeScript
- [ ] All linting passes

## Dependencies
- SH-001 (entity types must be complete)
- Verify SH-001 types are sufficient for event payloads

## Estimate
4 days

## Reference
- `.docs/02-api-and-data-model.md` Section 6 (WebSocket events)
- `.docs/03-implementation-guide.md` (architecture)
- `.docs/plans/SH-003-005-ORCHESTRATION-MEMO.md` (orchestration context)
```

**Issue 2: SH-004 - Create Zod Schemas for Request Validation**

**Title**: `SH-004: Create Zod Schemas for Request Validation (35+ endpoints)`

**Labels**: `enhancement`, `P0`, `backend`, `shared-code`

**Milestone**: Phase 1.6

**Body**:
```markdown
## Objective
Create Zod schemas for all 35+ REST API endpoints with runtime validation integrated into backend.

## Scope
Create schemas for:
- Auth (4 endpoints)
- Conversations (7 endpoints)
- Messages (4 endpoints)
- Tags, Notes, Routing Rules (13 endpoints)
- IRC Config (5+ endpoints)
- Search, Notifications, Bulk, Raw Payloads, DLQ, Integrations (11+ endpoints)

## Deliverables
1. Zod schemas in `packages/common/schemas/` (domain-specific files)
2. Schema aggregator in `schemas/index.ts`
3. Validation middleware in `packages/backend/middleware/validation.middleware.ts`
4. Integration with routing-controllers via `middlewares` option
5. Tests with 85%+ coverage

## Acceptance Criteria
- [ ] Zod schemas for all 35+ request bodies
- [ ] Schemas validate body, query params, path params
- [ ] Schemas export from `packages/common/schemas/` organized by domain
- [ ] Schemas are source of truth, types inferred via `z.infer<typeof schema>`
- [ ] Validation middleware integrates via `middlewares` option (NOT app.use())
- [ ] Error messages are user-friendly
- [ ] Tests verify schema validation catches invalid inputs
- [ ] Tests verify valid requests pass validation
- [ ] 85%+ test coverage
- [ ] Zero `any` types in TypeScript
- [ ] All linting passes

## Implementation Notes
- **ADR-XXX**: Zod schemas are source of truth (see ADR for rationale)
- Middleware must not use app.use() (violates routing-controllers pattern)
- Use `middlewares` option in useExpressServer() instead
- Error handling: catch Zod errors, return 400 with friendly message

## Dependencies
- SH-002 (API types may be refactored to use `z.infer`)
- ADR-XXX (Zod source of truth decision)

## Estimate
11.5 days

## Reference
- `.docs/02-api-and-data-model.md` Sections 2-5 (API endpoints)
- `.docs/adr/ADR-0XX-zod-schema-source-of-truth.md` (source of truth decision)
- `.docs/plans/SH-003-005-ORCHESTRATION-MEMO.md` (orchestration context)
```

**Issue 3: SH-005 - Set Up Shared Package Exports**

**Title**: `SH-005: Set Up Shared Package Exports (domain-specific, ADR-005 compliant)`

**Labels**: `enhancement`, `P0`, `backend`, `frontend`, `shared-code`

**Milestone**: Phase 1.6

**Body**:
```markdown
## Objective
Configure domain-specific export paths for @yacc/common package using package.json exports map (NOT barrel exports).

## Scope
- Configure package.json exports map
- Create domain-specific index aggregators
- Document allowed import patterns
- Test imports in backend/frontend

## Deliverables
1. Updated `packages/common/package.json` with `exports` map
2. Domain-specific index aggregators:
   - `types/entities/index.ts`
   - `types/api/index.ts`
   - `types/events/index.ts`
   - `schemas/index.ts`
3. Documentation in `packages/common/README.md`
4. Tests in backend/frontend verifying imports work

## Acceptance Criteria
- [ ] package.json exports map configured for domain paths
- [ ] Domain-specific index aggregators export all types/schemas
- [ ] Import patterns documented in README
- [ ] Backend can import and use types/schemas
- [ ] Frontend can import and use types
- [ ] No circular dependencies introduced
- [ ] Tree-shaking works correctly
- [ ] NO single barrel export at src/index.ts (ADR-005 compliance)
- [ ] TypeScript module resolution works
- [ ] Tests verify all imports resolve and compile

## Import Pattern (Expected)
```typescript
// ✅ GOOD (domain-specific)
import { User, Conversation } from '@yacc/common/types/entities';
import { LoginRequest } from '@yacc/common/types/api';
import { MessageReceivedEvent } from '@yacc/common/types/events';
import { loginSchema } from '@yacc/common/schemas';

// ❌ BAD (barrel export, violates ADR-005)
import { User, LoginRequest } from '@yacc/common';
```

## Dependencies
- SH-001, SH-002, SH-003, SH-004 must be complete

## Estimate
3.5 days

## Reference
- `AGENTS.md` (ADR-005 constraint on barrel exports)
- `.docs/adr/ADR-005-backend-architecture.md`
- `.docs/plans/SH-003-005-ORCHESTRATION-MEMO.md` (orchestration context)
```

**Estimated Time**: 60-90 minutes (create 3 issues with detailed ACs)

---

## Timeline

| Task | Date | Owner | Duration |
|------|------|-------|----------|
| ADR-XXX (Zod) | 2026-02-25 | Architect | 30-45 min |
| Update tasks in .docs/06-tasks.md | 2026-02-25 | Architect | 45-60 min |
| Create GitHub Issues | 2026-02-25 | Architect | 60-90 min |
| **TOTAL** | **2026-02-25** | **Architect** | **2-3 hours** |

**Target Completion**: EOD 2026-02-25  
**Next Milestone**: Assign developers + start development 2026-02-26

---

## Quality Checklist

Before handoff to developers:

- [ ] ADR-XXX created and approved (Zod source of truth)
- [ ] .docs/06-tasks.md updated with refined SH-003, SH-004, SH-005 definitions
- [ ] GitHub Issues created with detailed ACs (all 3 issues)
- [ ] GitHub Issues linked in .docs/06-tasks.md
- [ ] Developers assigned to SH-003 + SH-004
- [ ] Feature branches created (sh-003-websocket-events, sh-004-zod-schemas)
- [ ] Daily standup established for parallel work coordination

---

## Questions?

- **Requirement clarity**: See .docs/plans/SH-003-005-PO-DECISION-REQUEST.md
- **Gap analysis details**: See Architect gap analysis (earlier conversation)
- **Orchestration context**: See .docs/plans/SH-003-005-ORCHESTRATION-MEMO.md
- **PO approval**: See .docs/plans/SH-003-005-PO-APPROVAL.md

---

**Status**: 🟢 GO - Ready for Architect finalization  
**Next Step**: Complete tasks 1-3 above by EOD 2026-02-25  
**Development Start**: 2026-02-26 (SH-003 + SH-004 parallel)

