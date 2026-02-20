/**
 * BetterAuth Client (Singleton)
 *
 * Initializes and provides access to BetterAuth authentication system
 * Follows ADR-005: Infrastructure folder for client initialization
 */

import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { authConfig } from '../config/auth.config';
import { account } from '../schemas/account.schema';
import { session } from '../schemas/session.schema';
import { users } from '../schemas/user.schema';
import { verification } from '../schemas/verification.schema';
import { dbClient } from './db.client';
import { emailService } from './email.client';
import { logger } from './logger';

/**
 * User object shape for password reset email callback
 * Contains at minimum the email field used by sendEmail
 */
type BetterAuthUser = {
  email: string;
};

/**
 * Initialize BetterAuth client with proper database and email integration
 */
function initializeBetterAuth() {
  try {
    // Wire the database client into the config using drizzle adapter
    // Type is inferred from betterAuth function parameter; wiredConfig satisfies BetterAuthOptions
    const wiredConfig = {
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
        sendResetEmail: async (user: BetterAuthUser, url: string) => {
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
