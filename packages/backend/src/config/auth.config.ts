/**
 * BetterAuth Configuration
 * 
 * Defines the configuration for BetterAuth authentication system.
 * This is pure configuration data - no client initialization here.
 * 
 * The actual client is initialized in infrastructure/better-auth.client.ts
 * where the database client is wired in.
 */

import { appConfig } from './appConfig';

// Configuration object for BetterAuth
// This is intentionally kept simple and is wired with actual clients in infrastructure/better-auth.client.ts
export const authConfig = {
  database: {
    // Database client will be injected by better-auth.client.ts
    client: null as any,
  },
  secret: appConfig.BETTER_AUTH_SECRET,
  baseURL: appConfig.APP_FRONTEND_URL,
  basePath: '/auth',
  sessionExpiresIn: 60 * 60 * 24 * 7, // 7 days in seconds
};
