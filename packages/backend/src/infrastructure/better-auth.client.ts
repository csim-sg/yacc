/**
 * BetterAuth Client (Singleton)
 *
 * Initializes and provides access to BetterAuth authentication system
 * Follows ADR-005: Infrastructure folder for client initialization
 */

import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { authConfig } from '../config/auth.config';
import { dbClient } from './db.client';
import { emailService } from './email.client';
import { logger } from './logger';
import { session, verification, account } from '../schemas/betterAuth.schema';
import { users } from '../schemas/user.schema';

/**
 * Initialize BetterAuth client with proper database and email integration
 */
function initializeBetterAuth() {
  try {
    // Wire the database client into the config using drizzle adapter
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const wiredConfig: any = {
      ...authConfig,
      database: drizzleAdapter(dbClient, {
        provider: 'pg',
        schema: {
          user: users,
          session,
          account,
          verification,
        },
      }),
      emailAndPassword: {
        enabled: true,
        sendResetEmail: async (user: any, url: string) => {
          await emailService.sendEmail({
            to: user.email,
            subject: 'Reset your password',
            html: `<a href="${url}">Click here to reset your password</a>`,
          });
        },
      },
    };

    const client = betterAuth(wiredConfig);
    logger.info('BetterAuth client initialized successfully');
    return client;
  } catch (error) {
    logger.error({ error }, 'Failed to initialize BetterAuth client');
    throw error;
  }
}

// Singleton: Initialize once at module load
export const betterAuthClient = initializeBetterAuth();
