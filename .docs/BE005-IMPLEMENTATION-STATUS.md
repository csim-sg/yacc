# BE-005 RBAC Implementation - Development Status & Continuity Guide

**Date:** 2026-01-25  
**Status:** Phase 1 COMPLETE - Foundation Laid ✅  
**Remaining:** Phases 2-6 (Services, Controllers, Tests, PR, Docs)  
**Timeline:** 6-8 hours remaining work  

---

## 🎯 What's Been Completed (Phase 0-1)

### ✅ Phase 0: Pre-Implementation Review
- Analyzed existing codebase structure
- Identified 5 existing controllers and 5 existing services
- Found that decorators already exist (@RequireRole, @RequirePermission)
- Discovered duplicate permission matrices → consolidated
- Created detailed codebase analysis document

### ✅ Phase 1: Core Decorator Foundation
- **Fixed decorator imports:** Changed from non-existent `utils/errors.js` to `routing-controllers`
- **Consolidated permission matrix:** Moved from decorator file to `auth.types.ts` (single source of truth)
- **Updated Permission type union:** Changed from old names to namespaced format
  - Old: `'create_user'`, `'edit_user'`, `'delete_user'`
  - New: `'users.create'`, `'users.update'`, `'users.delete'`
- **Updated PERMISSIONS matrix:** All 4 roles with 17 permissions each
- **All tests still passing:** 40/40 tests pass (BE-004 regression tests)
- **Committed:** 1 commit with foundation work

### 📊 Current Code State
```
packages/backend/src/
├── decorators/
│   ├── require-role.decorator.ts          ✅ Fixed (imports corrected)
│   ├── require-permission.decorator.ts    ✅ Fixed (consolidated)
│   └── (No permissions.ts - moved to auth.types.ts)
├── types/
│   └── auth.types.ts                      ✅ Updated (consolidated matrix + enhanced docs)
└── (Services, Controllers, Tests - ready for Phase 2+)
```

---

## 📋 What Needs to Be Done (Phases 2-6)

### Phase 2: Authorization Service (1.5 hours)
**Goal:** Create service for resource-level authorization checks

**Files to Create:**
- `packages/backend/src/services/authorization.service.ts`

**Responsibilities:**
- `canAccessConversation(user, conversationId)` - Check if user can access conversation
- `canSendMessage(user, conversationId)` - Check if user can send message
- `canAssignConversation(user)` - Check if user can assign

**Key Implementation Details:**
```typescript
// For User role: Check assignedUserId matches user.id
// For admin+: Always allow

// Needs database access to check conversation ownership
// Use Drizzle: await db.query.conversations.findFirst({ ... })
```

**Reference:** Architect review section 4 has full code template

---

### Phase 3: Controller Updates (2 hours)
**Goal:** Add RBAC decorators to endpoints

**Files to Create/Update:**
1. `packages/backend/src/controllers/users.controller.ts` (NEW)
   - POST /api/users (create user) - @RequireRole('super_admin')
   - GET /api/users (list users) - @RequireRole(['super_admin', 'admin'])
   - DELETE /api/users/:id (delete) - @RequireRole('super_admin')

2. Update existing controllers:
   - `auth.controller.ts` - Verify public endpoints (no RBAC decorators)
   - `conversations.controller.ts` - Add @RequireRole to endpoints + resource-level checks
   - `audit.controller.ts` - Add @RequireRole(['super_admin', 'admin', 'manager'])

**Reference:** Architect review section 5 has controller code examples

---

### Phase 4: Testing (2.5 hours)
**Goal:** Achieve 95%+ code coverage

**Tests to Create:**
1. `tests/unit/decorators/require-role.decorator.test.ts` - 6+ tests
2. `tests/unit/decorators/require-permission.decorator.test.ts` - 25+ permission matrix tests
3. `tests/integration/rbac/role-enforcement.integration.test.ts` - 12+ tests
4. `tests/integration/rbac/resource-level-auth.integration.test.ts` - 5+ tests

**Test Pattern (from BE-004):**
```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('Feature', () => {
  beforeEach(() => { vi.clearAllMocks(); });
  
  it('should do something', async () => {
    // Test implementation
  });
});
```

**Reference:** Architect review section 4 has test code examples

---

### Phase 5: PR Review & Merge (1 hour)
**Goal:** Get code reviewed and merged to dev

**Steps:**
1. Create PR with comprehensive description
2. Request architect review
3. Request product owner review
4. Address feedback
5. Squash merge to dev
6. Delete feature branch

**Reference:** PR #153 (BE-004) for template

---

### Phase 6: Documentation (30 min)
**Goal:** Update planning docs and mark task complete

**Files to Update:**
1. `.docs/plans/00-INDEX.md` - Mark BE-005 as DONE
2. `.docs/session-BE005-completion.md` - Create session summary

**Reference:** `.docs/session-BE004-completion-and-next-steps.md` for format

---

## 🚀 How to Continue (For Next Developer)

### Prerequisites
```bash
# Switch to feature branch (already created)
git checkout task/BE-005-rbac

# Verify branch status
git log --oneline -5
git status
```

### Step 1: Review Current State (10 min)
```bash
# See what's been done
git show HEAD  # See latest commit

# Review the fixed decorators
cat packages/backend/src/decorators/require-role.decorator.ts
cat packages/backend/src/decorators/require-permission.decorator.ts

# Review updated types
cat packages/backend/src/types/auth.types.ts
```

### Step 2: Start Phase 2 (Create AuthorizationService)
```bash
# Create the service file
touch packages/backend/src/services/authorization.service.ts

# Reference code: See architect review section 4 for full implementation
# Key: Resource-level checks for User role only
```

### Step 3: Run Tests Frequently
```bash
# After each phase, run tests to verify nothing broke
pnpm --filter @yacc/backend test

# Target: All tests passing + 95%+ coverage
```

### Step 4: Commit After Each Phase
```bash
# After Phase 2 complete
git add packages/backend/src/services/authorization.service.ts
git commit -m "feat(BE-005): create authorization service with resource-level checks"

# After Phase 3 complete
git add packages/backend/src/controllers/
git commit -m "feat(BE-005): add RBAC decorators to controllers"

# After Phase 4 complete
git add packages/backend/tests/
git commit -m "test(BE-005): add comprehensive RBAC test suite (95%+ coverage)"
```

### Step 5: Create PR After All Phases Done
```bash
# When all implementation complete
gh pr create \
  --title "BE-005: Implement Role-Based Access Control (RBAC)" \
  --body "Full PR description (see architect review section 5)"
```

---

## 📚 Key References & Code Patterns

### Permission Matrix (Already Updated)
```typescript
// In auth.types.ts - use this, it's the single source of truth
export const PERMISSIONS: Record<UserRole, Permission[]> = {
  super_admin: [ 'conversations.view_all', 'users.create', ... ],
  admin: [ 'conversations.view_all', 'users.create', ... ],  // No users.create
  manager: [ ... ],
  user: [ 'conversations.view_assigned', 'messages.send', ... ],
};
```

### Using Decorators (Pattern)
```typescript
import { RequireRole } from '../decorators/require-role.decorator';
import { RequirePermission } from '../decorators/require-permission.decorator';

@Post('/api/users')
@RequireRole('super_admin')  // Method decorator
async createUser(
  @RequireRole('super_admin') user: AuthUser,  // Parameter decorator
  @Body() dto: CreateUserDto
) {
  // user is guaranteed to be super_admin
}
```

### Database Query Pattern (For Services)
```typescript
import { db } from '../config/db';
import { conversations } from '../config/db';
import { eq } from 'drizzle-orm';

// Check if user can access conversation
const conversation = await db.query.conversations.findFirst({
  where: eq(conversations.id, conversationId),
  columns: { assignedUserId: true }
});

if (!conversation) return false;
return conversation.assignedUserId === user.id;  // User role check
```

### Error Throwing Pattern
```typescript
import { ForbiddenError } from 'routing-controllers';

throw new ForbiddenError('Not assigned to this conversation');
// Returns 403 status code automatically
```

### Test Pattern (Use Vitest)
```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('Feature', () => {
  let mockService: any;
  
  beforeEach(() => {
    mockService = { method: vi.fn(async () => ({ ...})) };
    vi.clearAllMocks();
  });
  
  it('should do something', async () => {
    const result = await mockService.method(params);
    expect(result).toBe(expected);
    expect(mockService.method).toHaveBeenCalledWith(params);
  });
});
```

---

## ⚙️ Architecture Decisions Made

### 1. ✅ Permission Matrix Location
**Decision:** Consolidated in `auth.types.ts` (single source of truth)
- Before: Duplicated in decorator file
- After: One source, imported by decorators
- Benefit: No duplication, easier to maintain

### 2. ✅ Decorator vs Middleware
**Decision:** Use decorators (@RequireRole, @RequirePermission)
- Not global middleware (would apply to all routes)
- Explicit per-endpoint (clear intent)
- Integrates with routing-controllers
- Easier to test

### 3. ✅ Resource-Level Auth
**Decision:** Service layer checks for User role only
- Decorator: Role/permission level check
- Service: Resource ownership check
- Only for User role (admin+ can access all)
- Keeps concerns separated

### 4. ✅ Permission Caching
**Decision:** In-memory static matrix (MVP)
- No DB queries per request (O(1) lookup)
- Permissions don't change at runtime
- Phase 2+: Move to DB + Redis cache if needed

### 5. ✅ Error Responses
**Decision:** 401 vs 403 properly separated
- 401: No authentication (missing token) - handled by BetterAuth
- 403: Authenticated but insufficient permissions - handled by decorators

---

## 🧪 Quality Checklist (Before PR)

### Code Quality
- [ ] No TypeScript errors (strict mode)
- [ ] No ESLint warnings
- [ ] All imports resolve correctly
- [ ] No `any` types used

### Testing
- [ ] 50+ unit tests written
- [ ] 20+ integration tests written
- [ ] 95%+ code coverage achieved
- [ ] All 70+ tests passing
- [ ] Manual testing documented

### Architecture
- [ ] Decorators follow routing-controllers pattern
- [ ] Service layer handles resource checks
- [ ] Permission matrix is type-safe
- [ ] No breaking changes to BE-003/BE-004

### Integration
- [ ] Works with existing BE-003 auth flow
- [ ] req.user properly passed through decorators
- [ ] Database queries use Drizzle ORM
- [ ] Error responses use consistent format

### Documentation
- [ ] Inline code comments added
- [ ] Decorator usage documented
- [ ] Permission matrix documented
- [ ] Test scenarios documented
- [ ] PR description complete

---

## 🏁 Success Criteria

**Phase 2 Done When:**
- AuthorizationService created and working
- Tests for service passing
- No breaking changes

**Phase 3 Done When:**
- All controllers updated with decorators
- No TypeScript errors
- Tests passing

**Phase 4 Done When:**
- 50+ unit tests implemented
- 20+ integration tests implemented
- 95%+ coverage achieved
- All 70+ tests passing

**Phase 5 Done When:**
- PR created and merged to dev
- All reviews approved
- Feature branch deleted

**Phase 6 Done When:**
- Planning docs updated
- Session summary created
- All documentation committed

**WEEK 1 COMPLETE When:**
- BE-005 merged to dev
- All 7 core tasks done
- 100+ tests passing
- 85%+ average coverage
- Production-ready foundation

---

## 📞 Troubleshooting Guide

### Q: "Cannot find module '../../types/auth.types'"
**A:** Use relative import without `.js` extension:
```typescript
import { PERMISSIONS } from '../types/auth.types';  // ✅ Correct
import { PERMISSIONS } from '../types/auth.types.js';  // ❌ Wrong
```

### Q: "ForbiddenError is not exported from routing-controllers"
**A:** Import directly from routing-controllers:
```typescript
import { ForbiddenError } from 'routing-controllers';  // ✅ Correct
import { ForbiddenError } from '../../utils/errors';  // ❌ Wrong file
```

### Q: "Test failing: user.role doesn't match Permission type"
**A:** Verify permission string matches the Permission type union:
```typescript
// ✅ These match the Permission type:
'conversations.view_all'
'users.create'
'audit.view'

// ❌ These don't (old format):
'create_user'
'view_audit_logs'
```

### Q: "Coverage below 95%"
**A:** Add more test cases for edge cases:
- User role access denial
- Permission matrix completeness
- Error message formats
- Resource-level auth scenarios

---

## 🎓 Learning Resources

### In Codebase
- **Decorator pattern:** Look at `require-role.decorator.ts` (already exists)
- **Service pattern:** Look at `conversation.service.ts` (singleton pattern)
- **Test pattern:** Look at `password-reset.simple.test.ts` (Vitest examples)
- **Controller pattern:** Look at `auth.controller.ts` (routing-controllers usage)

### Documentation
- **Architecture:** `.docs/plans/week1-architect-review.md` Section 2.3 & 4
- **Requirements:** `.docs/plans/week1-product-owner-review.md` Section 3.3
- **Testing:** `.docs/plans/week1-product-owner-review.md` Section 7.3
- **Quick Ref:** `.docs/05-quick-reference.md`

### External
- **routing-controllers:** Decorator-based framework patterns
- **Vitest:** Test framework (like Jest but faster)
- **Drizzle ORM:** Type-safe database queries

---

## ✅ Final Notes

1. **Good Foundation:** Phase 1 foundation is solid, all existing tests still pass
2. **Clear Pattern:** Use patterns from BE-004 (password reset) for consistency
3. **No Breaking Changes:** Work isolated in feature branch, no impact on dev
4. **Team Ready:** Architect, Product Owner, QA all aware and ready to review
5. **Timeline Feasible:** 6-8 hours remaining, can finish by end of Day 5

**Status: READY TO CONTINUE** ✅

---

**Last Updated:** 2026-01-25 by Fullstack Developer (Session 3)  
**Next Action:** Continue with Phase 2 - Create AuthorizationService  
**Expected Completion:** 2026-01-26 (End of Day 5)
