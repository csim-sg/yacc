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
// Database adapter is wired in infrastructure/better-auth.client.ts
// This contains the base config that will be extended with the database adapter
export const authConfig = {
  secret: appConfig.BETTER_AUTH_SECRET,
  baseURL: appConfig.APP_FRONTEND_URL,
  basePath: '/auth',
} as const;
