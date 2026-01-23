# Week 1 Development Guide - Day 1

**Date**: January 22, 2026
**Focus**: Core Infrastructure Setup
**Issues**: BE-028, BE-026, BE-001

---

## 🎯 Day 1 Goals

Set up the foundational infrastructure required for all subsequent development:

1. **BE-028**: Create shared types package with TypeScript interfaces, Zod schemas, and enums
2. **BE-026**: Create environment configuration scaffolding with `.env.example` and Zod validation
3. **BE-001**: Set up PostgreSQL database connection with Drizzle ORM

**Estimated Time**: 8 hours (1 full business day)

---

## 📋 Task Checklist

### BE-028: Create Shared Types Package (3 hours)

- [ ] Verify `packages/common/` structure
- [ ] Create `src/types/` directory with subdirectories
- [ ] Define all domain entity types (User, Conversation, Message, etc.)
- [ ] Define all API request/response types
- [ ] Define all enums and constants (Role, Status, ErrorCode, etc.)
- [ ] Create Zod validation schemas for entities
- [ ] Create Zod validation schemas for API requests/responses
- [ ] Create main `src/index.ts` export file
- [ ] Update `package.json` exports
- [ ] Build package successfully (`pnpm run build`)
- [ ] Verify TypeScript types generated in `dist/`

### BE-026: Environment Configuration Scaffolding (2 hours)

- [ ] Create `packages/backend/src/config/` directory
- [ ] Create `.env.example` with all 15+ environment variables
- [ ] Create `config.schema.ts` with Zod validation
- [ ] Create `index.ts` with typed config interface
- [ ] Add config validation to app entry point
- [ ] Test config validation with missing/invalid variables
- [ ] Document all environment variables in code

### BE-001: PostgreSQL + Drizzle ORM Setup (3 hours)

- [ ] Install Drizzle dependencies (if not present)
- [ ] Create `packages/backend/src/db/` directory
- [ ] Create Drizzle config file (`drizzle.config.ts`)
- [ ] Create database connection service
- [ ] Configure connection pooling (min: 2, max: 10)
- [ ] Test database connection with sample query
- [ ] Verify environment variables (DATABASE_URL)
- [ ] Document connection setup

---

## 🚀 Implementation Steps

### Step 1: BE-028 - Shared Types Package

#### 1.1 Directory Structure

```bash
packages/common/
├── src/
│   ├── types/
│   │   ├── entities.ts       # Domain entities (User, Conversation, Message, etc.)
│   │   ├── api.ts           # API request/response types
│   │   ├── auth.ts          # Auth-related types
│   │   └── index.ts         # Export all types
│   ├── schemas/
│   │   ├── entities.ts       # Zod schemas for entities
│   │   ├── api.ts           # Zod schemas for API requests/responses
│   │   ├── auth.ts          # Auth validation schemas
│   │   └── index.ts         # Export all schemas
│   ├── constants/
│   │   ├── roles.ts         # Role enum and permissions
│   │   ├── status.ts        # Status enums
│   │   └── errors.ts        # Error codes and messages
│   └── index.ts             # Main export file
├── package.json
├── tsconfig.json
└── tests/
```

#### 1.2 Create Entity Types

**File**: `packages/common/src/types/entities.ts`

```typescript
// User
export interface User {
  id: string;
  email: string;
  role: Role;
  status: UserStatus;
  createdAt: string;  // ISO-8601
  updatedAt: string;  // ISO-8601
}

// Conversation
export interface Conversation {
  id: string;
  channel: Channel;
  externalThreadId: string;
  status: ConversationStatus;
  priority: Priority;
  assignedUserId?: string;
  assignedUser?: User;
  lastMessageAt: string;
  createdAt: string;
  updatedAt: string;
  tags?: Tag[];
}

// Message
export interface Message {
  id: string;
  conversationId: string;
  senderId?: string;
  senderName?: string;
  body: string;
  status: MessageStatus;
  direction: MessageDirection;
  platformMessageId?: string;
  createdAt: string;
  updatedAt: string;
  attachments?: Attachment[];
}

// ... continue with all entities from issue BE-028
```

#### 1.3 Create API Types

**File**: `packages/common/src/types/api.ts`

```typescript
// Auth Types
export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  user: User;
  accessToken: string;
  refreshToken?: string;
}

// ... continue with all API types from issue BE-028
```

#### 1.4 Create Enums

**File**: `packages/common/src/constants/status.ts`

```typescript
export enum Channel {
  TELEGRAM = 'telegram',
  IRC = 'irc',
}

export enum ConversationStatus {
  OPEN = 'open',
  PENDING = 'pending',
  RESOLVED = 'resolved',
}

export enum Priority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  URGENT = 'urgent',
}

export enum MessageStatus {
  PENDING = 'pending',
  SENT = 'sent',
  FAILED = 'failed',
}
```

**File**: `packages/common/src/constants/errors.ts`

```typescript
export const ErrorCode = {
  INVALID_CREDENTIALS: 'invalid_credentials',
  TOKEN_EXPIRED: 'token_expired',
  UNAUTHORIZED: 'unauthorized',
  FORBIDDEN: 'forbidden',
  NOT_FOUND: 'not_found',
  INTERNAL_ERROR: 'internal_error',
  // ... more codes
} as const;

export type ErrorCode = typeof ErrorCode[keyof typeof ErrorCode];
```

#### 1.5 Create Zod Schemas

**File**: `packages/common/src/schemas/api.ts`

```typescript
import { z } from 'zod';

export const LoginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const ForgotPasswordRequestSchema = z.object({
  email: z.string().email(),
});

export const SendMessageRequestSchema = z.object({
  body: z.string().min(1).max(10000),
  attachments: z.array(z.object({
    name: z.string(),
    type: z.string(),
    size: z.number().max(5 * 1024 * 1024),  // 5MB
    url: z.string().url(),
  })).optional().max(5),
});
```

#### 1.6 Main Export

**File**: `packages/common/src/index.ts`

```typescript
// Types
export * from './types/entities';
export * from './types/api';
export * from './types/auth';

// Schemas
export * from './schemas/entities';
export * from './schemas/api';
export * from './schemas/auth';

// Constants
export * from './constants/roles';
export * from './constants/status';
export * from './constants/errors';
```

#### 1.7 Build and Test

```bash
cd packages/common
pnpm install
pnpm run build
pnpm run type-check

# Verify dist/ directory has compiled files
ls -la dist/
```

---

### Step 2: BE-026 - Environment Configuration

#### 2.1 Directory Structure

```bash
packages/backend/src/
└── config/
    ├── config.schema.ts    # Zod validation schema
    └── index.ts            # Config service export
```

#### 2.2 Create `.env.example`

**File**: `packages/backend/.env.example`

```env
# ============================================
# DATABASE
# ============================================
DATABASE_URL=postgresql://user:password@localhost:5432/omni_inbox
DATABASE_POOL_MIN=2
DATABASE_POOL_MAX=10

# ============================================
# AUTHENTICATION
# ============================================
BETTER_AUTH_SECRET=<generate-random-secret-min-32-chars>
JWT_SECRET=<generate-random-secret-min-32-chars>
ACCESS_TOKEN_TTL_SECONDS=172800  # 48 hours
REFRESH_TOKEN_TTL_SECONDS=2592000  # 30 days
RESET_PASSWORD_TOKEN_TTL_MINUTES=60

# ============================================
# CLOUDFLARE R2 STORAGE
# ============================================
CLOUDFLARE_R2_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
CLOUDFLARE_R2_ACCESS_KEY=<your-r2-access-key-id>
CLOUDFLARE_R2_SECRET_KEY=<your-r2-secret-access-key>
CLOUDFLARE_R2_BUCKET=omni-inbox
CLOUDFLARE_CDN_URL=https://cdn.example.com
ATTACHMENT_MAX_SIZE_MB=5
RAW_PAYLOAD_RETENTION_DAYS=7
EXPORT_RETENTION_HOURS=24

# ============================================
# REDIS & QUEUES
# ============================================
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
MESSAGE_RETRY_ATTEMPTS=3
MESSAGE_RETRY_BASE_DELAY_MS=60000  # 1 minute
MESSAGE_RETRY_BACKOFF_MULTIPLIER=5

# ============================================
# INTEGRATIONS
# ============================================
# Telegram
TELEGRAM_BOT_TOKEN=<your-telegram-bot-token>

# IRC
IRC_SERVER=irc.example.com
IRC_PORT=6667
IRC_USERNAME=botname
IRC_PASSWORD=

# ============================================
# EMAIL SERVICE
# ============================================
# Option 1: SendGrid (Recommended)
SENDGRID_API_KEY=<your-sendgrid-api-key>
SENDGRID_FROM_EMAIL=noreply@example.com
SENDGRID_FROM_NAME=OmniInbox

# Option 2: SMTP (Fallback)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_FROM_EMAIL=noreply@example.com
SMTP_FROM_NAME=OmniInbox

# ============================================
# FRONTEND
# ============================================
FRONTEND_URL=https://app.example.com
RESET_PASSWORD_URL=https://app.example.com/reset-password

# ============================================
# WEBSOCKET
# ============================================
WS_HEARTBEAT_INTERVAL_SEC=60
WS_BACKLOG_RETENTION_HOURS=1

# ============================================
# LOGGING
# ============================================
LOG_LEVEL=info  # error | warn | info | debug
LOG_FORMAT=json  # json | pretty

# ============================================
# NODE ENVIRONMENT
# ============================================
NODE_ENV=development  # development | production | test
PORT=3000
```

#### 2.3 Create Config Schema

**File**: `packages/backend/src/config/config.schema.ts`

```typescript
import { z } from 'zod';

const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().url(),
  DATABASE_POOL_MIN: z.coerce.number().default(2),
  DATABASE_POOL_MAX: z.coerce.number().default(10),

  // Auth
  BETTER_AUTH_SECRET: z.string().min(32),
  JWT_SECRET: z.string().min(32),
  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().default(172800),
  REFRESH_TOKEN_TTL_SECONDS: z.coerce.number().default(2592000),
  RESET_PASSWORD_TOKEN_TTL_MINUTES: z.coerce.number().default(60),

  // R2 Storage
  CLOUDFLARE_R2_ENDPOINT: z.string().url(),
  CLOUDFLARE_R2_ACCESS_KEY: z.string().min(1),
  CLOUDFLARE_R2_SECRET_KEY: z.string().min(1),
  CLOUDFLARE_R2_BUCKET: z.string().min(1),
  CLOUDFLARE_CDN_URL: z.string().url().optional(),
  ATTACHMENT_MAX_SIZE_MB: z.coerce.number().default(5),
  RAW_PAYLOAD_RETENTION_DAYS: z.coerce.number().default(7),
  EXPORT_RETENTION_HOURS: z.coerce.number().default(24),

  // Redis
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().default(6379),
  REDIS_PASSWORD: z.string().optional(),
  MESSAGE_RETRY_ATTEMPTS: z.coerce.number().default(3),
  MESSAGE_RETRY_BASE_DELAY_MS: z.coerce.number().default(60000),
  MESSAGE_RETRY_BACKOFF_MULTIPLIER: z.coerce.number().default(5),

  // Integrations
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  IRC_SERVER: z.string().optional(),
  IRC_PORT: z.coerce.number().default(6667),
  IRC_USERNAME: z.string().optional(),
  IRC_PASSWORD: z.string().optional(),

  // Email
  SENDGRID_API_KEY: z.string().optional(),
  SENDGRID_FROM_EMAIL: z.string().email().optional(),
  SENDGRID_FROM_NAME: z.string().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_SECURE: z.coerce.boolean().default(false),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_FROM_EMAIL: z.string().email().optional(),
  SMTP_FROM_NAME: z.string().optional(),

  // Frontend
  FRONTEND_URL: z.string().url(),
  RESET_PASSWORD_URL: z.string().url(),

  // WebSocket
  WS_HEARTBEAT_INTERVAL_SEC: z.coerce.number().default(60),
  WS_BACKLOG_RETENTION_HOURS: z.coerce.number().default(1),

  // Logging
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  LOG_FORMAT: z.enum(['json', 'pretty']).default('json'),

  // Node
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
});

// Validate and export
export const env = envSchema.parse(process.env);
```

#### 2.4 Create Config Service

**File**: `packages/backend/src/config/index.ts`

```typescript
import { env } from './config.schema';

export interface IConfig {
  database: {
    url: string;
    poolMin: number;
    poolMax: number;
  };
  auth: {
    betterAuthSecret: string;
    jwtSecret: string;
    accessTokenTtl: number;
    refreshTokenTtl: number;
    resetPasswordTokenTtlMinutes: number;
  };
  // ... more config sections
}

export const config: IConfig = {
  database: {
    url: env.DATABASE_URL,
    poolMin: env.DATABASE_POOL_MIN,
    poolMax: env.DATABASE_POOL_MAX,
  },
  auth: {
    betterAuthSecret: env.BETTER_AUTH_SECRET,
    jwtSecret: env.JWT_SECRET,
    accessTokenTtl: env.ACCESS_TOKEN_TTL_SECONDS,
    refreshTokenTtl: env.REFRESH_TOKEN_TTL_SECONDS,
    resetPasswordTokenTtlMinutes: env.RESET_PASSWORD_TOKEN_TTL_MINUTES,
  },
  // ... more config sections
};

export default config;
```

#### 2.5 Add Startup Validation

**File**: `packages/backend/src/index.ts`

```typescript
import { config } from './config';

// Validate config on startup
try {
  console.log('✓ Configuration validated successfully');
  console.log(`  - Environment: ${config.app.env}`);
  console.log(`  - Port: ${config.app.port}`);
  console.log(`  - Log Level: ${config.logging.level}`);
} catch (error) {
  console.error('✗ Configuration validation failed:', error);
  process.exit(1);
}

// Continue with app initialization...
```

---

### Step 3: BE-001 - PostgreSQL + Drizzle ORM

#### 3.1 Install Dependencies

```bash
cd packages/backend
pnpm add drizzle-orm pg
pnpm add -D drizzle-kit @types/pg
```

#### 3.2 Create Database Directory Structure

```bash
packages/backend/src/
└── db/
    ├── db.ts              # Database connection
    ├── schema.ts          # Database schema (will be BE-002)
    └── drizzle.config.ts  # Drizzle kit configuration
```

#### 3.3 Create Drizzle Configuration

**File**: `packages/backend/src/db/drizzle.config.ts`

```typescript
import type { Config } from 'drizzle-kit';
import { config } from '../config';

export default {
  schema: './schema.ts',
  out: './drizzle',  // Directory for migration files
  driver: 'pg',
  dbCredentials: {
    url: config.database.url,
  },
} satisfies Config;
```

#### 3.4 Create Database Connection

**File**: `packages/backend/src/db/db.ts`

```typescript
import { drizzle } from 'drizzle-orm/pg';
import pg from 'pg';
import { config } from '../config';

// Configure connection pool
const pool = new pg.Pool({
  connectionString: config.database.url,
  min: config.database.poolMin,
  max: config.database.poolMax,
});

// Create Drizzle instance
export const db = drizzle(pool);

// Test connection
export async function testConnection() {
  try {
    await pool.query('SELECT 1');
    console.log('✓ Database connected successfully');
    return true;
  } catch (error) {
    console.error('✗ Database connection failed:', error);
    return false;
  }
}
```

#### 3.5 Update Package.json Scripts

Add Drizzle commands to `packages/backend/package.json`:

```json
{
  "scripts": {
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:push": "drizzle-kit push",
    "db:studio": "drizzle-kit studio"
  }
}
```

#### 3.6 Test Connection

**File**: `packages/backend/src/test-db.ts`

```typescript
import { testConnection, db } from './db';

async function main() {
  console.log('Testing database connection...');
  const connected = await testConnection();

  if (connected) {
    console.log('Database is ready for development');
    process.exit(0);
  } else {
    console.error('Database setup failed');
    process.exit(1);
  }
}

main();
```

```bash
# Run test
cd packages/backend
tsx src/test-db.ts
```

---

## ✅ Day 1 Completion Checklist

Before marking Day 1 as complete, verify:

- [ ] **BE-028 Checklist**:
  - [ ] All entity types defined (User, Conversation, Message, etc.)
  - [ ] All API types defined (LoginRequest, SendMessageRequest, etc.)
  - [ ] All enums defined (Role, Status, ErrorCode, etc.)
  - [ ] All Zod schemas created
  - [ ] Package builds successfully
  - [ ] TypeScript types generated in dist/
  - [ ] Workspace dependency works in backend

- [ ] **BE-026 Checklist**:
  - [ ] `.env.example` created with all 15+ variables
  - [ ] Zod schema validates all variables
  - [ ] Config service exports typed IConfig interface
  - [ ] Startup validation works (fails fast on missing vars)
  - [ ] All env vars documented

- [ ] **BE-001 Checklist**:
  - [ ] Drizzle configured with connection pooling
  - [ ] Database connection service created
  - [ ] Test connection passes
  - [ ] Environment variables (DATABASE_URL) configured
  - [ ] Drizzle CLI scripts added

- [ ] **Integration Testing**:
  - [ ] Backend can import from `@yacc/common`
  - [ ] Config validation works at startup
  - [ ] Database connection test passes
  - [ ] No TypeScript errors in backend

---

## 🐛 Troubleshooting

### Common Issues

**1. TypeScript errors when importing from common**
```
Solution: Ensure common package is built first:
  cd packages/common && pnpm run build
```

**2. Zod validation fails at startup**
```
Solution: Check .env file has all required variables:
  cp .env.example .env
  Edit .env with your values
```

**3. Database connection fails**
```
Solution: Verify PostgreSQL is running and DATABASE_URL is correct:
  - Check if PostgreSQL is running: `ps aux | grep postgres`
  - Test connection: `psql $DATABASE_URL`
  - Verify DATABASE_URL format: postgresql://user:password@host:port/db
```

**4. Drizzle CLI not found**
```
Solution: Install drizzle-kit:
  cd packages/backend
  pnpm add -D drizzle-kit
```

---

## 📝 Day 1 Deliverables

After completing Day 1, you should have:

1. ✅ **Shared Types Package** (`packages/common/`)
   - All domain entity types
   - All API request/response types
   - All enums and constants
   - All Zod validation schemas
   - Built and ready for consumption

2. ✅ **Environment Configuration** (`packages/backend/src/config/`)
   - `.env.example` with all variables
   - Zod schema for validation
   - Config service with typed interface
   - Startup validation

3. ✅ **Database Connection** (`packages/backend/src/db/`)
   - Drizzle ORM configured
   - Connection pooling setup
   - Database connection service
   - Test connection passing

---

## 🔗 Resources

- **Issue BE-028**: [Create shared types package](https://github.com/csim-sg/yacc/issues/109)
- **Issue BE-026**: [Create environment configuration scaffolding](https://github.com/csim-sg/yacc/issues/108)
- **Issue BE-001**: [Set up PostgreSQL + Drizzle ORM](https://github.com/csim-sg/yacc/issues/12)
- **Execution Plan**: `.docs/06-p0-execution-plan.md`
- **API Spec**: `.docs/02-api-and-data-model.md`

---

## 🚀 Next Steps (Day 2)

After Day 1 is complete, proceed to **Day 2: Database + Logging**:

- **BE-002**: Define database schema (11 tables)
- **BE-027**: Set up structured logging infrastructure

**Preparation**:
- Review issue BE-002 requirements (11 tables, indexes, cascade deletes)
- Review issue BE-027 requirements (Pino, correlation ID, audit log)

---

**Day 1 Goal**: Set up foundation infrastructure for Phase 1. Let's build! 🚀
