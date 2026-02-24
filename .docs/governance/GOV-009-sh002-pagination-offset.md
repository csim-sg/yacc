# GOV-009: Pagination Offset Calculation Clarification

**Date**: 2026-02-24  
**Issue**: SH-002 task instructions showed `(page - 1) * limit`, but code uses 0-indexed pages internally  
**Decision**: Use `page * limit` for `getOffset()` because `getPage()` already normalizes to 0-indexed  
**Approved By**: Enterprise Architect  
**Impact**: Low (internal utility method, no API contract change)  
**Status**: ✅ Implemented

---

## Context

- API accepts 1-indexed pages (`?page=1` for first page)
- `BaseListRequest.getPage()` normalizes to 0-indexed (returns 0 for `page=1`)
- `BaseListResponse` converts back to 1-indexed for response (`this.page = listRequest.getPage() + 1`)

## Resolution

- `getOffset()` uses 0-indexed page value: `offset = page * limit`
- Documentation updated with examples showing 0-indexed internal representation
- No changes to API contract (still accepts 1-indexed pages)

## Implementation

### Code Change

**File**: `packages/common/src/requests/base-list.request.ts`

```typescript
/**
 * Calculate the offset for database pagination queries.
 * Uses 0-indexed pages internally (page=0 is first page).
 *
 * Formula: offset = page * limit
 * - Page 0 (first page) → offset 0
 * - Page 1 (second page) → offset = limit
 *
 * Note: API accepts 1-indexed pages, but getPage() normalizes to 0-indexed.
 * BaseListResponse converts back to 1-indexed for API response.
 */
getOffset(): number {
  return this.getPage() * this.getLimit();
}
```

### Test Coverage

Unit tests added in `packages/common/src/requests/__tests__/base-list.request.spec.ts`:
- Page 0 → offset 0
- Page 1 → offset = limit
- Page 2 → offset = 2 * limit
- Large page numbers (page 10 → offset 1000 with limit 100)
- Default values handling

### Documentation

Updated `.docs/02-api-and-data-model.md` with pagination calculation table:

| API Request (1-indexed) | Internal Page | Limit | Offset | Records Returned |
|-------------------------|---------------|-------|--------|------------------|
| `?page=1&limit=15`      | 0             | 15    | 0      | 1-15             |
| `?page=2&limit=15`      | 1             | 15    | 15     | 16-30            |
| `?page=3&limit=25`      | 2             | 25    | 50     | 51-75            |

---

## Traceability

- **ADR**: N/A (utility method, no architectural change)
- **PR**: Will be linked after PR creation
- **Tests**: `packages/common/src/requests/__tests__/base-list.request.spec.ts`
- **GitHub Issue**: #74

---

## Acceptance Criteria Met

- [x] `BaseListRequest.getOffset()` method exists
- [x] Formula is CORRECT: `page * limit` (for 0-indexed pages)
- [x] `BaseListRequest` exported from `packages/common/src/index.ts`
- [x] `BaseListResponse` exported from `packages/common/src/index.ts`
- [x] Unit tests for `getOffset()` with 90%+ coverage
- [x] Documentation updated with pagination example table
