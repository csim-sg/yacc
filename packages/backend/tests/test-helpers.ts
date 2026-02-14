/**
 * Test helpers for integration tests (BE-007, etc.)
 * - createTestApp: returns Express app from src/app (no server listen)
 * - createTestUser: creates user via /auth/sign-up/email, then logs in, returns { id, token }
 * - seedTestConversations: inserts test conversations (requires DB)
 *
 * Test flow:
 * 1. createTestApp() - initialize Express with routing-controllers
 * 2. createTestUser() - sign up new user, then login to get token (deterministic, no pre-seeding)
 * 3. seedTestConversations() - insert test data into DB
 *
 * All operations are self-contained; tests are deterministic and don't require db:fixtures.
 */

import 'reflect-metadata';

import type { Express } from 'express';
import request from 'supertest';

export interface TestUserOptions {
  email: string;
  password: string;
  role?: string;
  name?: string;
}

export interface TestUser {
  id: string;
  token: string;
}

/**
 * Returns a fully configured Express app for testing.
 * Sets up routing-controllers with same configuration as src/index.ts.
 */
export async function createTestApp(): Promise<Express> {
   const express = await import('express');
   const { useExpressServer } = await import('routing-controllers');
   const { authorizationChecker, currentUserChecker } = await import('../src/middleware/routingControllersAuth');
   const { correlationIdMiddleware } = await import('../src/middleware/correlationId.middleware');
   const { requestLoggingMiddleware } = await import('../src/middleware/requestLogging.middleware');
   const { bodyParserMiddleware } = await import('../src/middleware/bodyParser.middleware');
   const { controllers } = await import('../src/controllers');
   const { appConfig } = await import('../src/config/appConfig');

   const testApp = express.default();

   // Register body parser middleware BEFORE routing-controllers
   // This ensures request.body is available in all route handlers
   testApp.use(bodyParserMiddleware);

   useExpressServer(testApp, {
     controllers: controllers,
     authorizationChecker: authorizationChecker,
     currentUserChecker: currentUserChecker,
     defaultErrorHandler: true,
     validation: {
       whitelist: true,
       forbidNonWhitelisted: true,
     },
     classTransformer: true,
     cors: {
       origin: appConfig.APP_FRONTEND_URL,
       credentials: true,
       exposedHeaders: ['set-auth-token', 'x-total-count', 'x-current-page', 'x-total-pages'],
     },
     middlewares: [
       correlationIdMiddleware,
       requestLoggingMiddleware,
     ],
   });

   return testApp as Express;
 }

/**
 * Creates a new test user directly in the database (bypassing BetterAuth signup issues)
 * and logs in to get access token via BetterAuth handler.
 * 
 * This makes tests deterministic: no pre-seeded users required.
 *
 * Flow:
 * 1. Check if user already exists; skip DB insert if so
 * 2. Hash password using BetterAuth crypto (compatible with BetterAuth)
 * 3. INSERT user into database with hashed password
 * 4. Call BetterAuth handler POST /auth/sign-in/email to get valid token
 * 5. (Optional) UPDATE user role in DB via Drizzle
 * 6. Return { id, token }
 *
 * @param app - Express app instance
 * @param options - User options (email, password, optional role, name)
 * @returns { id, token } for authenticated user
 * @throws Error if login fails (user creation handled gracefully)
 */
export async function createTestUser(app: Express, options: TestUserOptions): Promise<TestUser> {
   const name = options.name || options.email.split('@')[0] || 'Test User';

   // Step 1-3: Create user directly in DB (bypasses BetterAuth signup issues)
   const { dbClient } = await import('../src/infrastructure/db.client.js');
   const { users } = await import('../src/schemas/user.schema.js');
   const { account } = await import('../src/schemas/account.schema.js');
   const { eq } = await import('drizzle-orm');
   const { hashPassword } = await import('better-auth/crypto');
   const { randomBytes } = await import('crypto');

   // Check if user already exists
   const existingUser = await dbClient
     .select({ id: users.id })
     .from(users)
     .where(eq(users.email, options.email))
     .limit(1);

   let userId: string;

   if (existingUser.length === 0) {
     // Create new user with hashed password (BetterAuth-compatible)
     // ID is TEXT type, generate random string (same format as BetterAuth uses)
     const hashedPassword = await hashPassword(options.password);
     const randomId = randomBytes(16).toString('hex');
     
     const result = await dbClient
       .insert(users)
       .values({
         id: randomId,
         email: options.email,
         name: name,
         passwordHash: hashedPassword,
         emailVerified: true, // Pre-verify test users
       })
       .returning({ id: users.id });
     userId = result[0]?.id;

     if (!userId) {
       throw new Error('Failed to create test user in database');
     }

     // Create credential account for email/password login
     // BetterAuth expects account with providerId='credential' and accountId=email
     const accountId = randomBytes(16).toString('hex');
     await dbClient
       .insert(account)
       .values({
         id: accountId,
         userId: userId,
         accountId: options.email,
         providerId: 'credential',
       })
       .onConflictDoNothing();
   } else {
     userId = existingUser[0].id;
   }

   // Step 4: Create a valid JWT token for test purposes
   // For tests, we create a token directly since BetterAuth handler uses node-fetch which may not work properly in test environment
   const { sign } = await import('jsonwebtoken');
   const { appConfig } = await import('../src/config/appConfig');
   
   // Create a JWT token (BetterAuth-compatible format)
   const token = sign(
     { 
       sub: userId,
       email: options.email,
       expiresIn: '7d',
     },
     appConfig.BETTER_AUTH_SECRET,
     {
       expiresIn: '7d',
       algorithm: 'HS256',
     }
   );

   if (!token) {
     throw new Error('Failed to generate test token');
   }

    // Step 5: (Optional) Update user role if specified
    if (options.role) {
      const validRoles = ['admin', 'manager', 'user', 'super_admin'];
      const roleValue = validRoles.includes(options.role) ? options.role : 'user';
      await dbClient.update(users).set({ role: roleValue as 'admin' | 'manager' | 'user' | 'super_admin' }).where(eq(users.id, userId)).execute();
    }

   return { id: userId, token };
}

/**
 * Seeds the database with test conversations for the given user.
 * Returns array of created conversation objects with id.
 */
export async function seedTestConversations(
  userId: string,
  count: number
): Promise<Array<{ id: string }>> {
  const { dbClient } = await import('../src/infrastructure/db.client.js');
  const { conversations } = await import('../src/schemas/conversation.schema.js');

  const createdConversations: Array<{ id: string }> = [];

  for (let i = 0; i < count; i++) {
    const result = await dbClient.insert(conversations).values({
      channel: i % 2 === 0 ? 'telegram' : 'irc',
      externalThreadId: `test-${Date.now()}-${i}`,
      title: `Test conversation ${i}`,
      status: i % 3 === 0 ? 'open' : i % 3 === 1 ? 'pending' : 'resolved',
      priority: (['low', 'normal', 'high', 'urgent'] as const)[i % 4],
      assignedUserId: i % 5 === 0 ? null : userId,
    }).returning({ id: conversations.id });

    if (result[0]?.id) {
      createdConversations.push({ id: result[0].id });
    }
  }

  return createdConversations;
}
