## Task Description
Create comprehensive environment configuration scaffolding including .env.example template with all required variables, config validation using Zod, and a centralized config service. This ensures all environment variables are documented, validated, and easily accessible throughout the application.

### Technical Requirements

**1. Environment Variables**
Create `.env.example` file with all 15+ variables from the implementation guide:

```env
# ============================================
# DATABASE
# ============================================
DATABASE_URL=postgresql://user:password@localhost:5432/omni_inbox

# ============================================
# AUTHENTICATION
# ============================================
BETTER_AUTH_SECRET=generate-random-secret-min-32-chars
JWT_SECRET=generate-random-secret-min-32-chars
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
REDIS_PASSWORD=  # Optional, leave blank if no password
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
IRC_PASSWORD=  # Optional, depends on IRC server

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

**2. Config Validation (Zod Schema)**
Create `packages/backend/src/config/config.schema.ts`:

```typescript
import { z } from 'zod';

const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().url(),

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

**3. Config Service**
Create `packages/backend/src/config/index.ts`:

```typescript
import { env } from './config.schema';

export interface IConfig {
  database: {
    url: string;
  };
  auth: {
    betterAuthSecret: string;
    jwtSecret: string;
    accessTokenTtl: number;
    refreshTokenTtl: number;
    resetPasswordTokenTtlMinutes: number;
  };
  storage: {
    r2: {
      endpoint: string;
      accessKey: string;
      secretKey: string;
      bucket: string;
      cdnUrl?: string;
    };
    attachmentMaxSizeMB: number;
    rawPayloadRetentionDays: number;
    exportRetentionHours: number;
  };
  redis: {
    host: string;
    port: number;
    password?: string;
    messageRetryAttempts: number;
    messageRetryBaseDelayMs: number;
    messageRetryBackoffMultiplier: number;
  };
  integrations: {
    telegram: {
      botToken?: string;
    };
    irc: {
      server?: string;
      port: number;
      username?: string;
      password?: string;
    };
  };
  email: {
    sendgrid: {
      apiKey?: string;
      fromEmail?: string;
      fromName?: string;
    };
    smtp: {
      host?: string;
      port: number;
      secure: boolean;
      user?: string;
      password?: string;
      fromEmail?: string;
      fromName?: string;
    };
    resetPasswordTtlMinutes: number;
    resetPasswordUrl: string;
  };
  frontend: {
    url: string;
  };
  websocket: {
    heartbeatIntervalSec: number;
    backlogRetentionHours: number;
  };
  logging: {
    level: 'error' | 'warn' | 'info' | 'debug';
    format: 'json' | 'pretty';
  };
  app: {
    env: 'development' | 'production' | 'test';
    port: number;
  };
}

export const config: IConfig = {
  database: {
    url: env.DATABASE_URL,
  },
  auth: {
    betterAuthSecret: env.BETTER_AUTH_SECRET,
    jwtSecret: env.JWT_SECRET,
    accessTokenTtl: env.ACCESS_TOKEN_TTL_SECONDS,
    refreshTokenTtl: env.RESET_PASSWORD_TOKEN_TTL_MINUTES * 60,
    resetPasswordTokenTtlMinutes: env.RESET_PASSWORD_TOKEN_TTL_MINUTES,
  },
  storage: {
    r2: {
      endpoint: env.CLOUDFLARE_R2_ENDPOINT,
      accessKey: env.CLOUDFLARE_R2_ACCESS_KEY,
      secretKey: env.CLOUDFLARE_R2_SECRET_KEY,
      bucket: env.CLOUDFLARE_R2_BUCKET,
      cdnUrl: env.CLOUDFLARE_CDN_URL,
    },
    attachmentMaxSizeMB: env.ATTACHMENT_MAX_SIZE_MB,
    rawPayloadRetentionDays: env.RAW_PAYLOAD_RETENTION_DAYS,
    exportRetentionHours: env.EXPORT_RETENTION_HOURS,
  },
  redis: {
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    password: env.REDIS_PASSWORD,
    messageRetryAttempts: env.MESSAGE_RETRY_ATTEMPTS,
    messageRetryBaseDelayMs: env.MESSAGE_RETRY_BASE_DELAY_MS,
    messageRetryBackoffMultiplier: env.MESSAGE_RETRY_BACKOFF_MULTIPLIER,
  },
  integrations: {
    telegram: {
      botToken: env.TELEGRAM_BOT_TOKEN,
    },
    irc: {
      server: env.IRC_SERVER,
      port: env.IRC_PORT,
      username: env.IRC_USERNAME,
      password: env.IRC_PASSWORD,
    },
  },
  email: {
    sendgrid: {
      apiKey: env.SENDGRID_API_KEY,
      fromEmail: env.SENDGRID_FROM_EMAIL,
      fromName: env.SENDGRID_FROM_NAME,
    },
    smtp: {
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      user: env.SMTP_USER,
      password: env.SMTP_PASSWORD,
      fromEmail: env.SMTP_FROM_EMAIL,
      fromName: env.SMTP_FROM_NAME,
    },
    resetPasswordTtlMinutes: env.RESET_PASSWORD_TOKEN_TTL_MINUTES,
    resetPasswordUrl: env.RESET_PASSWORD_URL,
  },
  frontend: {
    url: env.FRONTEND_URL,
  },
  websocket: {
    heartbeatIntervalSec: env.WS_HEARTBEAT_INTERVAL_SEC,
    backlogRetentionHours: env.WS_BACKLOG_RETENTION_HOURS,
  },
  logging: {
    level: env.LOG_LEVEL,
    format: env.LOG_FORMAT,
  },
  app: {
    env: env.NODE_ENV,
    port: env.PORT,
  },
};

export default config;
```

**4. Startup Validation**
Add to `packages/backend/src/index.ts`:

```typescript
import { config } from './config';

// Validate config on startup
try {
  // Zod validation happens in config schema
  console.log('✓ Configuration validated successfully');
  console.log(`  - Environment: ${config.app.env}`);
  console.log(`  - Port: ${config.app.port}`);
  console.log(`  - Log Level: ${config.logging.level}`);
} catch (error) {
  console.error('✗ Configuration validation failed:', error);
  process.exit(1);
}
```

**5. Documentation**
Create `.docs/backend/configuration.md`:

```markdown
# Backend Configuration

## Environment Variables

All environment variables are documented in `.env.example` at the root of the backend package.

### Required Variables

The following variables must be set for the application to start:

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@localhost:5432/omni_inbox` |
| `BETTER_AUTH_SECRET` | Secret key for BetterAuth | 32+ random characters |
| `JWT_SECRET` | Secret key for JWT signing | 32+ random characters |
| `CLOUDFLARE_R2_ENDPOINT` | R2 API endpoint | `https://<account-id>.r2.cloudflarestorage.com` |
| `CLOUDFLARE_R2_ACCESS_KEY` | R2 access key ID | From Cloudflare dashboard |
| `CLOUDFLARE_R2_SECRET_KEY` | R2 secret access key | From Cloudflare dashboard |
| `CLOUDFLARE_R2_BUCKET` | R2 bucket name | `omni-inbox` |
| `FRONTEND_URL` | Frontend application URL | `https://app.example.com` |

### Optional Variables

Email, Redis, and integration variables have sensible defaults. See `.env.example` for details.

## Usage

```typescript
import config from './config';

// Access configuration
console.log(config.database.url);
console.log(config.auth.jwtSecret);
console.log(config.storage.r2.bucket);
```
```

**6. Frontend Environment Variables**
Create `packages/frontend/.env.example`:

```env
# Frontend Environment Variables
VITE_API_URL=http://localhost:3000/api
VITE_WS_URL=ws://localhost:3000
VITE_APP_URL=http://localhost:5173
```

### File Structure

```
packages/backend/src/config/
├── config.schema.ts    # Zod validation schema
├── index.ts            # Config service export
└── README.md           # Config documentation

packages/
├── backend/.env.example
└── frontend/.env.example
```

## Priority
P0 - Critical - blocks Phase 1 completion or release

## Assignee
Backend

## Acceptance Criteria
- [ ] `.env.example` created with all 15+ environment variables
- [ ] `.env.example` includes:
  - [ ] Database variables (1 variable)
  - [ ] Auth variables (5 variables)
  - [ ] R2 storage variables (7 variables)
  - [ ] Redis & queues variables (5 variables)
  - [ ] Integration variables (4 variables)
  - [ ] Email service variables (11 variables)
  - [ ] Frontend variables (3 variables)
  - [ ] WebSocket variables (2 variables)
  - [ ] Logging variables (2 variables)
  - [ ] Node environment variables (2 variables)
- [ ] Zod schema validates all variables with:
  - [ ] Type coercion (numbers, booleans)
  - [ ] Default values for optional variables
  - [ ] URL format validation where applicable
  - [ ] Email format validation where applicable
  - [ ] Enum validation (log level, node env, etc.)
- [ ] Config service exports typed `IConfig` interface
- [ ] Startup validation in application entry point
- [ ] Application fails fast if required env vars are missing
- [ ] Documentation created (`.docs/backend/configuration.md`)
- [ ] Frontend `.env.example` created
- [ ] Unit tests for config validation
- [ ] All environment variables documented with descriptions and examples

## Status
Not Started

## Dependencies
- None (should be implemented first)

## Category
Backend
