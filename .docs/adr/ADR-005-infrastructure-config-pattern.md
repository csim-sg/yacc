# ADR-005: Simple Infrastructure and Config Pattern

**Status:** Accepted
**Date:** 2026-01-25
**Owner:** Enterprise/Solution Architect
**Architect:** Claude Code ✅
**Product Owner:** ⏳ Pending

---

## Context

### Problem Statement

During BE-003 (Authentication) implementation, a decision was needed on how to organize configuration and infrastructure code in the backend package. The architect identified coding style violations in the config folder, but the user clarified they want a simple and clean approach without complex refactoring.

### Business Driver

- **Simplicity**: User prefers straightforward code organization
- **Maintainability**: Clear separation between configuration data and client initialization
- **Development Velocity**: Avoid extensive refactoring that slows development

### Constraints

1. **Single-tenant MVP**: No need for complex multi-tenant configuration management
2. **Week 1 Timeline**: Must not delay Phase 1 implementation
3. **No Clean Architecture Requirement**: User explicitly stated "I don't want clean architecture"

---

## Decision

### Final Decision

Adopt a **simple two-folder pattern** for configuration and infrastructure:

#### 1. **Config Folder Pattern** (`packages/backend/src/config/`)

**Purpose**: Store configuration data only (no initialization, no business logic)

**Rules**:
- ✅ Export simple `const` objects with environment variable values
- ✅ Can include basic type definitions in the same file
- ❌ No function exports
- ❌ No class instances
- ❌ No initialization logic
- ❌ No client creation

**Example**:
```typescript
// packages/backend/src/config/auth.ts
export const authConfig = {
  betterAuthSecret: process.env.BETTER_AUTH_SECRET || process.env.JWT_SECRET,
  accessTokenTtl: parseInt(process.env.ACCESS_TOKEN_TTL_SECONDS || '172800'),
  refreshTokenTtlDays: parseInt(process.env.REFRESH_TOKEN_TTL_DAYS || '30'),
};

export const emailConfig = {
  sendgridApiKey: process.env.SENDGRID_API_KEY,
  smtpHost: process.env.SMTP_HOST,
  smtpPort: parseInt(process.env.SMTP_PORT || '587'),
};

export const dbConfig = {
  url: process.env.DATABASE_URL,
  poolMin: parseInt(process.env.DB_POOL_MIN || '2'),
  poolMax: parseInt(process.env.DB_POOL_MAX || '10'),
};
```

**Rationale**:
- Configuration is **data**, not code behavior
- Easy to test and modify without side effects
- Clear separation from initialization logic

---

#### 2. **Infrastructure Folder Pattern** (`packages/backend/src/infrastructure/`)

**Purpose**: Store client classes for initialization and instance access

**Rules**:
- ✅ Export **singleton classes** for external service clients
- ✅ Classes handle initialization and provide instance access
- ✅ Classes read configuration from `config/` folder
- ❌ No business logic (belongs in `services/`)
- ❌ No HTTP endpoints (belongs in `controllers/`)

**Examples**:

**Database Client**:
```typescript
// packages/backend/src/infrastructure/db/client.ts
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { dbConfig } from '../../config/db';

export class Database {
  private static instance: Database;
  private pool: Pool;

  private constructor() {
    this.pool = new Pool({
      connectionString: dbConfig.url,
      min: dbConfig.poolMin,
      max: dbConfig.poolMax,
    });
  }

  static getInstance(): Database {
    if (!this.instance) {
      this.instance = new Database();
    }
    return this.instance;
  }

  getPool(): Pool {
    return this.pool;
  }

  getDrizzle() {
    return drizzle(this.pool);
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

// Export singleton instance
export const db = Database.getInstance();
```

**Redis Client**:
```typescript
// packages/backend/src/infrastructure/redis/client.ts
import { createClient } from 'redis';
import { redisConfig } from '../../config/redis';

export class Redis {
  private static instance: Redis;
  private client: ReturnType<typeof createClient>;

  private constructor() {
    this.client = createClient({
      socket: {
        host: redisConfig.host,
        port: redisConfig.port,
      },
      password: redisConfig.password,
    });

    this.client.connect();
  }

  static getInstance(): Redis {
    if (!this.instance) {
      this.instance = new Redis();
    }
    return this.instance;
  }

  getClient() {
    return this.client;
  }

  async close(): Promise<void> {
    await this.client.quit();
  }
}

export const redis = Redis.getInstance();
```

**Auth Client**:
```typescript
// packages/backend/src/infrastructure/auth/better-auth.ts
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { authConfig } from '../../config/auth';
import { db } from '../db/client';

export const auth = betterAuth({
  database: drizzleAdapter(db.getDrizzle(), { schema }),
  secret: authConfig.betterAuthSecret,
  session: {
    expiresIn: authConfig.accessTokenTtl * 1000, // Convert to ms
    refreshAgeInDays: authConfig.refreshTokenTtlDays,
  },
});
```

**Rationale**:
- **Single source of truth**: Client initialization is centralized
- **Lazy initialization**: Clients are created only when needed
- **Testability**: Easy to mock infrastructure in tests
- **Clear ownership**: Infrastructure team owns client lifecycle

---

### Folder Structure Summary

```
packages/backend/src/
├── config/                    ← Configuration data (simple objects)
│   ├── auth.ts              ← authConfig, emailConfig
│   ├── db.ts                ← dbConfig
│   ├── redis.ts             ← redisConfig
│   ├── logging.ts           ← loggingConfig
│   └── r2.ts               ← r2Config
│
├── infrastructure/           ← Client initialization (classes)
│   ├── auth/
│   │   └── better-auth.ts  ← export const auth = betterAuth({...})
│   ├── db/
│   │   └── client.ts       ← export const db = Database.getInstance()
│   ├── redis/
│   │   └── client.ts       ← export const redis = Redis.getInstance()
│   └── storage/
│       └── r2.ts           ← export const r2 = R2.getInstance()
│
├── services/                ← Business logic
│   ├── auth.service.ts
│   ├── email.service.ts
│   └── ...
│
├── controllers/            ← HTTP endpoints
├── middleware/            ← Request/response middleware
├── types/                ← Type definitions
└── utils/                ← Utility functions
```

---

## Alternatives Considered

### Option A: Strict Separation (All Config Objects, All Initialization in Infrastructure)

**Pros**:
- Clean separation of concerns
- Easy to test configuration in isolation
- No side effects in config files

**Cons**:
- More files to maintain
- Potential duplication between config and infrastructure
- More import paths to manage

**Decision**: ❌ Rejected (too verbose for MVP)

---

### Option B: Mixed Pattern (Config + Initialization in Same File)

**Pros**:
- Simpler (fewer files)
- Configuration and initialization are co-located

**Cons**:
- Config files have side effects (clients initialized on import)
- Difficult to test configuration without initializing clients
- Blurs line between data and behavior

**Decision**: ❌ Rejected (violates single responsibility)

---

### Option C: Selected Pattern (Simple Two-Folder Separation)

**Pros**:
- ✅ Simple and clean (user requirement)
- ✅ Clear separation: config = data, infrastructure = behavior
- ✅ Minimal overhead (no complex refactoring needed)
- ✅ Follows standard patterns (config objects, singleton classes)
- ✅ Easy to test and mock

**Cons**:
- Requires two imports in some cases (config + infrastructure)
- Slightly more boilerplate for singleton classes

**Decision**: ✅ Selected

---

## Consequences

### Stability Impact

- ✅ **Low Risk**: Pattern is simple and widely used
- ✅ **No Breaking Changes**: Existing code can be refactored incrementally
- ⚠️ **Migration Needed**: Some config files need refactoring (tracked in GOV-008)

---

### Cost Impact

- ✅ **Development Cost**: Minimal (simple pattern)
- ✅ **Maintenance Cost**: Low (clear ownership)
- ⚠️ **Technical Debt**: Current PR has violations (tracked in GOV-008)

---

### Security Impact

- ✅ **No Security Issues**: Pattern does not affect security
- ✅ **Secret Management**: Config reads from env vars (standard practice)

---

### Operability Impact

- ✅ **Deployment**: Simple (no complex initialization order)
- ✅ **Debugging**: Clear (config vs infrastructure separation)
- ✅ **Testing**: Easy (mock infrastructure, test config independently)

---

## Standards Alignment

### TOGAF Domain: Application Architecture

**Alignment**:
- ✅ Separation of concerns (config vs infrastructure)
- ✅ Single responsibility (each file has one job)
- ✅ Service boundaries clear (infrastructure owns clients)

---

### AWS Well-Architected Pillars

**Operational Excellence**:
- ✅ Easy to debug (clear separation)
- ✅ Testable (infrastructure can be mocked)

**Reliability**:
- ✅ Singleton pattern prevents duplicate connections
- ✅ Lazy initialization reduces startup time

---

### ISO 27001 Controls

**A.9.1.1 (Asset Inventory)**:
- ✅ Clear folder structure makes assets discoverable

**A.12.1.1 (Documentation)**:
- ✅ This ADR documents the pattern for team reference

---

## Implementation Guidance

### When to Create Config File

**Use Case**: You need to store configuration values from environment variables

**Example**:
```typescript
// packages/backend/src/config/some-service.ts
export const someServiceConfig = {
  apiKey: process.env.SOME_SERVICE_API_KEY,
  timeout: parseInt(process.env.SOME_SERVICE_TIMEOUT_MS || '5000'),
  retries: parseInt(process.env.SOME_SERVICE_RETRIES || '3'),
};
```

**Rules**:
- ✅ Export simple `const` object
- ✅ Use `process.env` for values
- ✅ Provide sensible defaults
- ❌ No functions, classes, or initialization

---

### When to Create Infrastructure Class

**Use Case**: You need to initialize an external service client (Redis, R2, etc.)

**Example**:
```typescript
// packages/backend/src/infrastructure/some-service/client.ts
import { SomeServiceClient } from 'some-service-sdk';
import { someServiceConfig } from '../../config/some-service';

export class SomeService {
  private static instance: SomeService;
  private client: SomeServiceClient;

  private constructor() {
    this.client = new SomeServiceClient({
      apiKey: someServiceConfig.apiKey,
      timeout: someServiceConfig.timeout,
    });
  }

  static getInstance(): SomeService {
    if (!this.instance) {
      this.instance = new SomeService();
    }
    return this.instance;
  }

  getClient(): SomeServiceClient {
    return this.client;
  }
}

export const someService = SomeService.getInstance();
```

**Rules**:
- ✅ Export singleton class with `getInstance()`
- ✅ Read config from `config/` folder
- ✅ Provide method to get client instance
- ❌ No business logic (belongs in `services/`)
- ❌ No HTTP endpoints (belongs in `controllers/`)

---

### Migration Plan

#### Current State (PR #152)

**Violations Found**:
- `config/auth.ts`: Exports BetterAuth instance + functions
- `config/db.ts`: Exports Drizzle instance + schema + types
- `config/logging.ts`: Exports Pino logger + functions
- `config/email.ts`: Exports EmailService class
- `config/redis.ts`: Exports singleton functions
- `config/r2.ts`: Exports singleton functions
- `config/queues.ts`: Exports queue manager

#### Required Actions

**Phase 1: Core Infrastructure (Week 1)**
1. ✅ Move BetterAuth initialization to `infrastructure/auth/better-auth.ts`
2. ✅ Create simple `authConfig` in `config/auth.ts`
3. ⏳ Move database client to `infrastructure/db/client.ts`
4. ⏳ Move schema to `infrastructure/db/schema.ts`
5. ⏳ Move logging setup to `infrastructure/logging/logger.ts`
6. ⏳ Create simple `loggingConfig` in `config/logging.ts`

**Phase 2: Additional Infrastructure (Week 2)**
7. ⏳ Move Redis client to `infrastructure/redis/client.ts`
8. ⏳ Move email service to `services/email.service.ts`
9. ⏳ Create simple `redisConfig` and `emailConfig`

**Phase 3: Storage & Queues (Week 3)**
10. ⏳ Move R2 client to `infrastructure/storage/r2/client.ts`
11. ⏳ Move queue manager to `infrastructure/queues/retry-queue.ts`
12. ⏳ Create simple `r2Config` and `queueConfig`

---

## Related Documents

- **GOV-008**: Week 1 Workarounds (tracks config refactoring debt)
- **ADR-004**: Logging and Observability Strategy
- **03-implementation-guide.md**: System architecture and folder structure
- **PR #152**: BE-003 Authentication implementation (contains violations)
- **ADR-005-Addendum-1**: Flat Infrastructure + DI Pattern
- **ADR-005-Addendum-2**: External Platform Adapters in Infrastructure

---

## Approval

**Architect Approval**:
- Name: Enterprise/Solution Architect (Claude Code)
- Date: 2026-01-25
- Status: ✅ APPROVED

**Product Owner Approval**:
- Name: _________________
- Date: _________________
- Comments: _________________

---

**Version**: 1.0
**Last Updated**: 2026-01-25
**Review Date**: 2026-02-01 (End of Phase 1)
