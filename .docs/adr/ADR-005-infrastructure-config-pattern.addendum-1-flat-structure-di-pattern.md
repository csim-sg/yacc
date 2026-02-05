# ADR-005-Addendum-1: Flat Infrastructure + DI Pattern

**Date:** 2026-01-28  
**Status:** Accepted  
**Parent ADR:** ADR-005 (Infrastructure and Config Pattern)  
**Type:** Architecture Refinement

---

## Context

During ADR-005 implementation (Week 2), a refinement was made to the infrastructure pattern to improve simplicity and testability:
1. **Subfolders removed**: No `db/`, `redis/`, `logging/`, etc. subfolders under `infrastructure/`
2. **DI pattern adopted**: Classes accept dependencies in constructor instead of using `getInstance()` singleton pattern

---

## Decision

### 1. Flat Infrastructure Folder Structure

Instead of nested folders:
```
infrastructure/
├── db/
│   ├── client.ts
│   └── schema.ts
├── redis/
│   └── client.ts
├── logging/
│   └── logger.ts
└── storage/
    └── r2.ts
```

Use flat structure:
```
infrastructure/
├── db.client.ts          (Database class)
├── db.schema.ts         (Schema definitions)
├── redis.client.ts       (Redis class)
├── logger.ts            (Logger class)
├── r2.client.ts          (R2 storage class)
└── better-auth.client.ts  (BetterAuth class)
```

**Rationale:**
- ✅ Simpler: No nested folder navigation
- ✅ Easier: All infrastructure files at same level
- ✅ Clearer: `infrastructure/db.client.ts` shows purpose immediately

---

### 2. Dependency Injection (DI) Pattern

Instead of singleton `getInstance()` pattern:

**Before (Singleton):**
```typescript
export class Database {
  private static instance: Database;
  
  static getInstance(): Database {
    if (!this.instance) {
      this.instance = new Database();
    }
    return this.instance;
  }
}

// Usage
const db = Database.getInstance();
```

**After (DI Pattern):**
```typescript
export class Database {
  constructor(dbConfig: { url: string }) {
    // Initialize with provided config
  }
}

// Usage (inject in services)
const db = new Database(config.database);
```

**Rationale:**
- ✅ Better testability: Inject mock clients in tests
- ✅ Explicit dependencies: Constructor shows what's needed
- ✅ Flexible: Can create multiple instances (if needed)
- ✅ Modern: Follows current TypeScript/Node.js best practices

---

### 3. Service Usage with DI

**Example Service:**
```typescript
import { Database } from '../../infrastructure/db.client';
import { Logger } from '../../infrastructure/logger';
import { config } from '../../config/config';

export class AuthService {
  private db: Database;
  private logger: Logger;
  
  constructor(db?: Database, logger?: Logger) {
    // Inject dependencies (or create default)
    this.db = db ?? new Database(config.database);
    this.logger = logger ?? new Logger(config.logging);
  }
  
  async getUser(id: string) {
    // Use injected dependencies
    return this.db.query(/* ... */);
  }
}
```

---

## Consequences

### Impact of Changes

**Pros:**
- ✅ Improved testability: Can mock infrastructure easily
- ✅ Cleaner imports: Shorter paths (`../infrastructure/logger` vs `../infrastructure/logging/logger`)
- ✅ Explicit dependencies: Constructor shows what class needs
- ✅ No breaking changes: Can migrate incrementally

**Cons:**
- ⚠️ Slightly more boilerplate: Services need to accept dependencies
- ⚠️ No automatic singletons: Services must manage instances

---

## Migration Status

### Created Files

- ✅ `infrastructure/db.client.ts` - Created with DI pattern
- ✅ `infrastructure/db.schema.ts` - Created (flat structure)
- ✅ `infrastructure/redis.client.ts` - Created with DI pattern
- ✅ `infrastructure/logger.ts` - Created with DI pattern
- ✅ `infrastructure/r2.client.ts` - Created with DI pattern
- ✅ `infrastructure/better-auth.client.ts` - Created with DI pattern

### In Progress

- 🔄 Import updates across services/controllers/middleware (20+ files)

### Updated Actions (from Parent ADR)

**Phase 1: Core Infrastructure (Week 1)**
1. ✅ Move BetterAuth initialization to `infrastructure/better-auth.client.ts` (DI)
2. ✅ Create simple `authConfig` in `config/auth.ts`
3. ✅ Move database client to `infrastructure/db.client.ts` (DI)
4. ✅ Move schema to `infrastructure/db.schema.ts` (flat)
5. ✅ Move logging setup to `infrastructure/logger.ts` (DI)
6. ✅ Create simple `loggingConfig` in `config/logging.ts`

**Phase 2: Additional Infrastructure (Week 2)**
7. ✅ Move Redis client to `infrastructure/redis.client.ts` (DI)
8. ⏳ Move email service to `services/email.service.ts` (deferred to BE-007)
9. ✅ Create simple `redisConfig` in `config/` (already in `config/config.ts`)

**Phase 3: Storage & Queues (Week 3)**
10. ✅ Move R2 client to `infrastructure/r2.client.ts` (DI)
11. ⏳ Move queue manager to `infrastructure/` (deferred to BE-007)
12. ✅ Create simple `r2Config` in `config/` (already in `config/config.ts`)

---

## Related Documents

- **ADR-005**: Infrastructure and Config Pattern (parent ADR)
- **GOV-008**: Week 1 Workarounds (tracks config refactoring debt)
- **03-implementation-guide.md**: System architecture and folder structure

---

## Approval

**Architect Approval:**
- Name: Enterprise/Solution Architect (Claude Code)
- Date: 2026-01-28
- Status: ✅ APPROVED

**Product Owner Approval:**
- Name: _________________
- Date: _________________
- Comments: _________________

---

**Version**: 1.0  
**Last Updated**: 2026-01-28
