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
 * Creates a new test user via /auth/sign-up/email, then logs in to get access token.
 * Optionally sets the role via direct DB update (BetterAuth signup doesn't support role field).
 * This makes tests deterministic: no pre-seeded users required.
 *
 * Flow:
 * 1. Try POST /auth/sign-up/email with email, password, name
 *    - If user already exists (422), skip to login
 *    - If signup fails with other error, throw
 * 2. POST /auth/sign-in/email with email, password
 * 3. (Optional) UPDATE user role in DB via Drizzle
 * 4. Return { id, token }
 *
 * @param app - Express app instance
 * @param options - User options (email, password, optional role, name)
 * @returns { id, token } for authenticated user
 * @throws Error if signup or login fails
 */
export async function createTestUser(app: Express, options: TestUserOptions): Promise<TestUser> {
  const name = options.name || options.email.split('@')[0] || 'Test User';

  // Step 1: Sign up (skip if user already exists)
  const signupRes = await request(app)
    .post('/auth/sign-up/email')
    .set('Content-Type', 'application/json')
    .send({
      email: options.email,
      password: options.password,
      name: name,
    });

  // 422 means user already exists (unique email constraint), which is fine for tests
  // We can just login instead
  if (signupRes.status !== 200 && signupRes.status !== 422) {
    throw new Error(
      `Signup failed: ${signupRes.status} - ${JSON.stringify(signupRes.body)}`
    );
  }

  // Step 2: Log in (sign-up may not return token, so we login to get it)
  const loginRes = await request(app)
    .post('/auth/sign-in/email')
    .set('Content-Type', 'application/json')
    .send({ email: options.email, password: options.password });

  if (loginRes.status !== 200) {
    throw new Error(
      `Login failed: ${loginRes.status} - ${JSON.stringify(loginRes.body)}`
    );
  }

  // Extract user id and token from login response
  // BetterAuth sign-in/email returns { user, accessToken, refreshToken } at top level
  const body = loginRes.body as {
    user?: { id: string };
    accessToken?: string;
    refreshToken?: string;
    session?: { accessToken?: string; token?: string };
    token?: string;
  };
  const id = body.user?.id;
  const token =
    body.accessToken ??
    body.session?.accessToken ??
    body.session?.token ??
    body.token ??
    (loginRes.headers['set-auth-token'] as string) ??
    (Array.isArray(loginRes.headers['set-cookie'])
      ? loginRes.headers['set-cookie'][0]?.split(';')[0]?.replace(/^[^=]+=/, '')
      : undefined);

  if (!id || !token) {
    throw new Error(
      `Login response missing id or token: ${JSON.stringify(body)}`
    );
  }

  // Step 3: (Optional) Update user role if specified
  // BetterAuth signup doesn't support role, so we update it directly
  if (options.role) {
    const { dbClient } = await import('../src/infrastructure/db.client.js');
    const { users } = await import('../src/schemas/user.schema.js');
    const { eq } = await import('drizzle-orm');

    await dbClient.update(users).set({ role: options.role as any }).where(eq(users.id, id)).execute();
  }

  return { id, token };
}

/**
 * Seeds the database with test conversations for the given user.
 * Requires dbClient and conversation schema. userId is UUID (optional assignee).
 */
export async function seedTestConversations(
  userId: string,
  count: number
): Promise<void> {
  const { dbClient } = await import('../src/infrastructure/db.client.js');
  const { conversations } = await import('../src/schemas/conversation.schema.js');

  for (let i = 0; i < count; i++) {
    await dbClient.insert(conversations).values({
      channel: i % 2 === 0 ? 'telegram' : 'irc',
      externalThreadId: `test-${Date.now()}-${i}`,
      title: `Test conversation ${i}`,
      status: i % 3 === 0 ? 'open' : i % 3 === 1 ? 'pending' : 'resolved',
      priority: (['low', 'medium', 'high', 'urgent'] as const)[i % 4],
      assignedUserId: i % 5 === 0 ? null : userId,
    }).onConflictDoNothing();
  }
}
