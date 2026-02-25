# GH-206: Auth Endpoint Prefix Decision - Architect Analysis

**Issue**: GH-206 - Clarify auth endpoint prefix decision (BetterAuth)  
**Date**: February 25, 2026  
**Status**: Ready for architect decision  
**Impact**: Affects 40+ endpoint routing + frontend integration

---

## Current State

### Backend Auth Controller
```typescript
// File: packages/backend/src/controllers/auth.controller.ts
@JsonController('/api/auth')
export class AuthController {
  // Custom endpoints:
  // - /api/auth/forgot-password
  // - /api/auth/reset-password
}
```

### BetterAuth Configuration
```typescript
// File: packages/backend/src/config/auth.config.ts
export const authConfig = {
  basePath: '/auth',
  // ... other config
} as const;
```

**Current Routes**:
- BetterAuth handler: `/auth/*` (sign-in/email, sign-up/email, sign-out, get-session, etc.)
- Custom auth controller: `/api/auth/forgot-password`, `/api/auth/reset-password`

### Frontend Integration
```typescript
// File: packages/frontend/src/lib/apiClient.ts
const response = await fetch(`${API_BASE_URL}/api/auth/refresh-token`, {
  // ...
});
```

### Rate Limiting
```typescript
// File: packages/backend/src/middleware/rateLimit.middleware.ts
app.post('/api/auth/sign-in/email', loginRateLimiter);
app.post('/api/auth/forgot-password', passwordResetRateLimiter);
app.post('/api/auth/reset-password', passwordResetRateLimiter);
```

---

## The Decision Question

**Should auth endpoints use:**

### Option 1: Keep Current (Mixed) ⚠️
- **BetterAuth handler**: `/auth/*`
- **Custom endpoints**: `/api/auth/*`

**Pros**:
- BetterAuth is standard at `/auth` (industry convention)
- Follows BetterAuth documentation defaults

**Cons**:
- Inconsistent: Some auth endpoints at `/auth`, others at `/api/auth`
- Frontend must call two different paths
- Violates AGENTS.md principle: "No Global /api Prefix" is about controllers, not the overall API structure
- Rate limiting is registered on `/api/auth`, but BetterAuth is at `/auth`
- Confusing for API consumers

### Option 2: Move All Under `/api/auth` ✅
- **BetterAuth handler**: `/api/auth/*`
- **Custom endpoints**: `/api/auth/*`
- **Rate limiting**: Consistent

**Pros**:
- Consistent: All auth endpoints under `/api/auth`
- Single frontend service path: `${API_BASE_URL}/api/auth`
- All endpoints follow same routing pattern
- Easier for API consumers to understand
- Rate limiting naturally aligns
- Supports future `/api` prefix enforcement (GH-207)

**Cons**:
- Requires BetterAuth basePath change (`/auth` → `/api/auth`)
- Minor deviation from BetterAuth defaults (but fully supported)

### Option 3: Move Everything to `/auth` (No Global Prefix)
- **BetterAuth handler**: `/auth/*`
- **Custom endpoints**: `/auth/*`
- **All other endpoints**: NO `/api` prefix

**Pros**:
- Simplest: All auth under `/auth`
- Aligns with AGENTS.md "No global /api prefix" principle (taken literally)

**Cons**:
- GH-207 explicitly requires `/api` prefix on all REST endpoints
- This option contradicts GH-207
- Requires massive refactoring (40+ endpoints need repath)
- Not practical given Phase 1 scope

---

## Recommendation: Option 2 ✅

**Move all auth endpoints under `/api/auth`**

### Why Option 2 is Best

1. **Consistency**: All auth endpoints (BetterAuth + custom) under same path
2. **Alignment with GH-207**: Supports "enforce `/api` prefix on all REST endpoints"
3. **Frontend Simplicity**: Single `apiClient` configuration for all auth calls
4. **Rate Limiting**: Natural alignment (all auth routes at same base)
5. **Scalability**: Future auth endpoints automatically follow pattern
6. **Documentation**: Clear, predictable API surface

### Implementation Steps

1. **Update BetterAuth config** (5 min):
   ```typescript
   // packages/backend/src/config/auth.config.ts
   export const authConfig = {
     basePath: '/api/auth',  // Change from '/auth' to '/api/auth'
     // ... rest of config
   } as const;
   ```

2. **Verify auth controller** (0 min):
   - Already at `/api/auth` ✅
   - No changes needed

3. **Verify rate limiting** (0 min):
   - Already configured for `/api/auth/*` ✅
   - No changes needed

4. **Update frontend** (5-10 min):
   - All calls already use `${API_BASE_URL}/api/auth/...` ✅
   - Verify no hardcoded `/auth` paths
   - Test integration

5. **Update documentation** (10-15 min):
   - `.docs/02-api-and-data-model.md` - Auth section
   - `.docs/03-implementation-guide.md` - Auth architecture
   - API contract alignment

6. **Update integration guide** (5 min):
   - `.docs/frontend/BE-003-INTEGRATION-GUIDE.md`
   - Update auth endpoint examples

### Changes Required

**Backend (5 min)**:
```typescript
// packages/backend/src/config/auth.config.ts
- basePath: '/auth',
+ basePath: '/api/auth',
```

**Documentation (15-20 min)**:
- Update endpoint examples in `.docs/02-api-and-data-model.md`
- Update architecture notes in `.docs/03-implementation-guide.md`
- Update frontend integration guide

**Testing (10-15 min)**:
- Run auth integration tests to verify BetterAuth still works
- Verify frontend auth client still functions
- Verify rate limiting works on new path

**Total Effort**: ~45-60 minutes

---

## Timeline

- **This Week**: Make decision + implement (if approved)
- **Before Phase 1 Release**: Verify all auth flows working
- **GH-207 Dependency**: This decision unblocks GH-207 (endpoint prefix enforcement)

---

## Decision Required

**Architect to decide**: Option 2 (Move all auth to `/api/auth`)?

Once decided:
- [ ] Update backend config
- [ ] Verify frontend integration
- [ ] Update documentation
- [ ] Test end-to-end
- [ ] Create PR for approval
- [ ] Merge and close GH-206

---

## Related Issues

- **GH-207**: Enforce `/api` prefix on all REST endpoints (depends on this decision)
- **GH-203/204/199**: BE-007 PR issues (auth related, will be affected by routing changes)
- **BE-003**: Authentication implementation (initial auth work, now needs prefix alignment)

---

## References

- BetterAuth Docs: https://better-auth.com/docs
- AGENTS.md: "No Global /api Prefix" (applies to controller-level prefixes, not this routing decision)
- `.docs/02-api-and-data-model.md`: Current API contract
- `.docs/frontend/BE-003-INTEGRATION-GUIDE.md`: Frontend integration details
