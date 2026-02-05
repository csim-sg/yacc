import { z } from 'zod';

export const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  DATABASE_MIN_CONNECTIONS: z.coerce.number().default(2),
  DATABASE_MAX_CONNECTIONS: z.coerce.number().default(10),

  BETTER_AUTH_SECRET: z.string().min(32),
  JWT_SECRET: z.string().min(32),
  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().default(172800),
  REFRESH_TOKEN_TTL_SECONDS: z.coerce.number().default(2592000),
  RESET_PASSWORD_TOKEN_TTL_MINUTES: z.coerce.number().default(60),

  CLOUDFLARE_R2_ENDPOINT: z.string().url(),
  CLOUDFLARE_R2_ACCESS_KEY: z.string().min(1),
  CLOUDFLARE_R2_SECRET_KEY: z.string().min(1),
  CLOUDFLARE_R2_BUCKET: z.string().min(1),
  CLOUDFLARE_CDN_URL: z.string().url().optional(),
  ATTACHMENT_MAX_SIZE_MB: z.coerce.number().default(5),
  RAW_PAYLOAD_RETENTION_DAYS: z.coerce.number().default(7),
  EXPORT_RETENTION_HOURS: z.coerce.number().default(24),

  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().default(6379),
  REDIS_PASSWORD: z.string().optional(),
  MESSAGE_RETRY_ATTEMPTS: z.coerce.number().default(3),
  MESSAGE_RETRY_BASE_DELAY_MS: z.coerce.number().default(60000),
  MESSAGE_RETRY_BACKOFF_MULTIPLIER: z.coerce.number().default(5),

  TELEGRAM_BOT_TOKEN: z.string().optional(),
  IRC_SERVER: z.string().optional(),
  IRC_PORT: z.coerce.number().default(6667),
  IRC_USERNAME: z.string().optional(),
  IRC_PASSWORD: z.string().optional(),

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

   APP_FRONTEND_URL: z.string().url(),
   RESET_PASSWORD_URL: z.string().url(),

   WS_HEARTBEAT_INTERVAL_SEC: z.coerce.number().default(60),
   WS_BACKLOG_RETENTION_HOURS: z.coerce.number().default(1),

   LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
   LOG_FORMAT: z.enum(['json', 'pretty']).default('json'),
   LOG_FILE_ENABLED: z.coerce.boolean().default(true),
   LOG_FILE_PATH: z.string().default('logs/app.log'),
   LOG_FILE_MAX_SIZE: z.string().default('10M'),
   LOG_FILE_MAX_FILES: z.coerce.number().default(5),
   AUDIT_LOG_ENABLED: z.coerce.boolean().default(true),
   AUDIT_LOG_PATH: z.string().default('logs/audit.log'),
   AUDIT_LOG_MAX_SIZE: z.string().default('10M'),
   AUDIT_LOG_MAX_FILES: z.coerce.number().default(10),

   APP_ENV: z.enum(['development', 'production', 'test']).default('development'),
   APP_PORT: z.coerce.number().default(3000),
});

export type EnvConfig = z.infer<typeof envSchema>;

export const appConfig = envSchema.parse(process.env);
