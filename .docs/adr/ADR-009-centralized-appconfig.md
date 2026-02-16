# ADR-009: Centralized Application Configuration (appConfig)

**Date**: 2026-02-05  
**Status**: ✅ ACCEPTED  
**Decision Maker**: Architecture Team  

---

## Problem

The backend had scattered configuration handling:
- 9 separate config files (config.ts, auth.ts, db.ts, email.ts, logging.ts, queues.ts, r2.ts, redis.ts, config.schema.ts)
- Mix of direct `process.env` access in infrastructure layer
- No type safety for configuration values
- Unclear where configuration comes from
- Multiple transformations between env vars and typed config objects

## Solution

**Centralize all configuration in a single, type-safe `appConfig` module using Zod schema validation.**

### Implementation

```typescript
// packages/backend/src/config/appConfig.ts
export const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  REDIS_HOST: z.string().default('localhost'),
  // ... 50+ config values with Zod validation
});

export const appConfig = envSchema.parse(process.env);
```

### Key Benefits

1. **Single Source of Truth**: All config in one file
2. **Type-Safe**: Zod validation at runtime, TypeScript types at compile-time
3. **Defaults**: All values have sensible defaults via Zod `.default()`
4. **Validation**: Fails fast at startup if required env vars missing
5. **No process.env in Infrastructure**: Infrastructure only imports `appConfig`
6. **Clear Naming**: All config keys are UPPERCASE_WITH_UNDERSCORES

### What Changed

**DELETED**:
- config.schema.ts (merged into appConfig)
- config.ts (transformed structure not needed)
- auth.ts, db.ts, email.ts, logging.ts, queues.ts, r2.ts, redis.ts (all configs in appConfig)

**KEPT**:
- `appConfig.ts` (ONLY config file)

### Infrastructure Layer Updates

All infrastructure clients now:
```typescript
// Before
import { config } from '../config/config';
const secret = config.auth.betterAuthSecret;
const isProduction = process.env.NODE_ENV === 'production';

// After
import { appConfig } from '../config/appConfig';
const secret = appConfig.BETTER_AUTH_SECRET;
const isProduction = appConfig.APP_ENV === 'production';
```

### Config Values Available

| Category | Examples |
|----------|----------|
| **App** | APP_ENV, APP_PORT, APP_FRONTEND_URL |
| **Database** | DATABASE_URL, DATABASE_MIN_CONNECTIONS, DATABASE_MAX_CONNECTIONS |
| **Auth** | BETTER_AUTH_SECRET, JWT_SECRET, ACCESS_TOKEN_TTL_SECONDS |
| **Storage** | CLOUDFLARE_R2_ENDPOINT, CLOUDFLARE_R2_BUCKET, CLOUDFLARE_CDN_URL |
| **Redis** | REDIS_HOST, REDIS_PORT, REDIS_PASSWORD |
| **Logging** | LOG_LEVEL, LOG_FORMAT, LOG_FILE_PATH, AUDIT_LOG_PATH |
| **Email** | SENDGRID_API_KEY, SMTP_HOST, SMTP_PORT (with defaults) |
| **Integrations** | TELEGRAM_BOT_TOKEN, IRC_SERVER, IRC_PORT, IRC_USERNAME, IRC_PASSWORD, IRC_CHANNELS |
| **WebSocket** | WS_HEARTBEAT_INTERVAL_SEC, WS_BACKLOG_RETENTION_HOURS |

---

## Exceptions & Special Cases

### Controllers & Schemas: index.ts Creation

Following the "One Definition Per File" principle, we use `index.ts` ONLY in these folders:

1. **`packages/backend/src/schemas/index.ts`** ✅
   - Reason: Exports schema objects used throughout the app
   - Pattern: Aggregates all schema definitions for db client initialization
   - Style: Imports all schemas, exports as single `schemas` object

2. **`packages/backend/src/controllers/index.ts`** ✅ (Exception)
   - Reason: Controllers need to be registered with routing-controllers
   - Pattern: Central export for controller discovery
   - Style: Mirrors schemas/index.ts pattern

**NO index.ts**:
- config/ - Direct appConfig.ts import only
- infrastructure/ - Direct client imports (better-auth.client, db.client, etc.)
- services/ - Direct service imports
- middleware/ - Direct middleware imports
- types/ - Direct type imports
- utils/ - Direct utility imports

---

## Advantages

✅ **Type Safety**: All config properties are typed  
✅ **Validation**: Fails early if config is invalid  
✅ **Defaults**: Sensible defaults for all values  
✅ **Single File**: Easy to audit and understand all configuration  
✅ **No Magic**: Clear what config is available  
✅ **Testable**: Easy to mock or override for tests  

## Disadvantages

⚠️ Large schema file (70+ lines) but acceptable for single source of truth  
⚠️ All env vars must match Zod schema keys (prevents typos)  

## Implementation Notes

- `appConfig` is evaluated at module load (process.env parsing)
- Runtime errors if required config missing or invalid
- All infrastructure files must import from `config/appConfig`
- Controllers/services can import `appConfig` directly
- Never access `process.env` directly in application code

---

## Related

- ADR-005: Infrastructure & Config Pattern
- `.docs/03-implementation-guide.md`: Architecture overview
