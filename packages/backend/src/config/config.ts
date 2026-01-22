import { envConfig } from './config.schema';

export type AppConfig = {
  database: {
    url: string;
  };
  auth: {
    betterAuthSecret: string;
    jwtSecret: string;
    accessTokenTtlSeconds: number;
    refreshTokenTtlSeconds: number;
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
    attachmentMaxSizeMb: number;
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
    file: {
      enabled: boolean;
      path: string;
      maxSize: string;
      maxFiles: number;
    };
    audit: {
      enabled: boolean;
      path: string;
      maxSize: string;
      maxFiles: number;
    };
  };
  app: {
    env: 'development' | 'production' | 'test';
    port: number;
  };
};

export const config: AppConfig = {
  database: {
    url: envConfig.DATABASE_URL,
  },
  auth: {
    betterAuthSecret: envConfig.BETTER_AUTH_SECRET,
    jwtSecret: envConfig.JWT_SECRET,
    accessTokenTtlSeconds: envConfig.ACCESS_TOKEN_TTL_SECONDS,
    refreshTokenTtlSeconds: envConfig.REFRESH_TOKEN_TTL_SECONDS,
    resetPasswordTokenTtlMinutes: envConfig.RESET_PASSWORD_TOKEN_TTL_MINUTES,
  },
  storage: {
    r2: {
      endpoint: envConfig.CLOUDFLARE_R2_ENDPOINT,
      accessKey: envConfig.CLOUDFLARE_R2_ACCESS_KEY,
      secretKey: envConfig.CLOUDFLARE_R2_SECRET_KEY,
      bucket: envConfig.CLOUDFLARE_R2_BUCKET,
      cdnUrl: envConfig.CLOUDFLARE_CDN_URL,
    },
    attachmentMaxSizeMb: envConfig.ATTACHMENT_MAX_SIZE_MB,
    rawPayloadRetentionDays: envConfig.RAW_PAYLOAD_RETENTION_DAYS,
    exportRetentionHours: envConfig.EXPORT_RETENTION_HOURS,
  },
  redis: {
    host: envConfig.REDIS_HOST,
    port: envConfig.REDIS_PORT,
    password: envConfig.REDIS_PASSWORD,
    messageRetryAttempts: envConfig.MESSAGE_RETRY_ATTEMPTS,
    messageRetryBaseDelayMs: envConfig.MESSAGE_RETRY_BASE_DELAY_MS,
    messageRetryBackoffMultiplier: envConfig.MESSAGE_RETRY_BACKOFF_MULTIPLIER,
  },
  integrations: {
    telegram: {
      botToken: envConfig.TELEGRAM_BOT_TOKEN,
    },
    irc: {
      server: envConfig.IRC_SERVER,
      port: envConfig.IRC_PORT,
      username: envConfig.IRC_USERNAME,
      password: envConfig.IRC_PASSWORD,
    },
  },
  email: {
    sendgrid: {
      apiKey: envConfig.SENDGRID_API_KEY,
      fromEmail: envConfig.SENDGRID_FROM_EMAIL,
      fromName: envConfig.SENDGRID_FROM_NAME,
    },
    smtp: {
      host: envConfig.SMTP_HOST,
      port: envConfig.SMTP_PORT,
      secure: envConfig.SMTP_SECURE,
      user: envConfig.SMTP_USER,
      password: envConfig.SMTP_PASSWORD,
      fromEmail: envConfig.SMTP_FROM_EMAIL,
      fromName: envConfig.SMTP_FROM_NAME,
    },
    resetPasswordTtlMinutes: envConfig.RESET_PASSWORD_TOKEN_TTL_MINUTES,
    resetPasswordUrl: envConfig.RESET_PASSWORD_URL,
  },
  frontend: {
    url: envConfig.FRONTEND_URL,
  },
  websocket: {
    heartbeatIntervalSec: envConfig.WS_HEARTBEAT_INTERVAL_SEC,
    backlogRetentionHours: envConfig.WS_BACKLOG_RETENTION_HOURS,
  },
  logging: {
    level: envConfig.LOG_LEVEL,
    format: envConfig.LOG_FORMAT,
    file: {
      enabled: envConfig.LOG_FILE_ENABLED,
      path: envConfig.LOG_FILE_PATH,
      maxSize: envConfig.LOG_FILE_MAX_SIZE,
      maxFiles: envConfig.LOG_FILE_MAX_FILES,
    },
    audit: {
      enabled: envConfig.AUDIT_LOG_ENABLED,
      path: envConfig.AUDIT_LOG_PATH,
      maxSize: envConfig.AUDIT_LOG_MAX_SIZE,
      maxFiles: envConfig.AUDIT_LOG_MAX_FILES,
    },
  },
  app: {
    env: envConfig.NODE_ENV,
    port: envConfig.PORT,
  },
};
